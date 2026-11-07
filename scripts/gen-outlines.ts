#!/usr/bin/env node
/**
 * Generates the country outlines for outline mode ("which country is this?"):
 *
 *   node --no-warnings --import ./scripts/ts-resolve.mjs scripts/gen-outlines.ts
 *
 * Writes src/data/outlines.ts.
 *
 * Sources:
 * - Natural Earth 1:10m Admin 0 – Countries (public domain), https://www.naturalearthdata.com.
 * - geoBoundaries gbOpen ADM0 (https://www.geoboundaries.org) for small countries, where
 *   Natural Earth has too few points to show the shape (Monaco has 12). Each of these has its
 *   own open license (often OpenStreetMap, ODbL); source and license per country are written
 *   to scripts/data/outline-sources.json and listed in THIRD_PARTY_NOTICES.md.
 * Downloads are cached in scripts/data/cache/.
 *
 * Each country is projected on its own with a Lambert azimuthal equal-area projection
 * centred on the country, so the shape is not distorted by a world projection and the
 * areas of different countries can be compared (used for "same scale" sheets).
 * Overseas parts far from the main part (French Guiana, the Canary Islands …) and very
 * small islands are left out, and the rings are simplified with Douglas–Peucker so each
 * country has at most MAX_POINTS points.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {projectRelative, type Projection} from '../src/core/projection.ts';
import {encodeRings, OUTLINE_GRID} from '../src/core/outlineCodec.ts';
import {CONTINENT_OF, COUNTRY_CODES, type CountryCode} from '../src/data/countries.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'scripts/data/cache');
const NE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson';
const NE_FILE = path.join(CACHE, 'ne_10m_admin_0_countries.geojson');
const OUT = path.join(ROOT, 'src/data/outlines.ts');

/**
 * Countries whose largest ring in Natural Earth has fewer points than this get their outline
 * from geoBoundaries instead.
 */
const GB_THRESHOLD = 150;
/** geoBoundaries outlines that are worse than Natural Earth (Singapore is pieced together from districts). */
const GB_SKIP = new Set<CountryCode>(['SG']);
const GB_API = 'https://www.geoboundaries.org/api/current/gbOpen';
const GB_CACHE = path.join(CACHE, 'geoboundaries');
const SOURCES_FILE = path.join(ROOT, 'scripts/data/outline-sources.json');

/** Earth radius in km; the projection works on a unit sphere. */
const R_KM = 6371;
/** Most points per country after simplification. */
const MAX_POINTS = 420;
/** Most parts (islands) per country. */
const MAX_PARTS = 30;
/** Parts smaller than this share of the country's kept area are dropped … */
const MIN_PART_SHARE = 0.0015;
/** … unless they are at least this large compared with the drawing (fraction of the grid squared). */
const MIN_PART_GRID = 0.0004;
/** Parts farther than this many times the main part's size from it are dropped (overseas regions). */
const MAX_PART_DISTANCE = 1.6;

type LonLat = [number, number];
type XY = {x: number; y: number};

async function ensureNaturalEarth(): Promise<any> {
  if (!fs.existsSync(NE_FILE)) {
    fs.mkdirSync(CACHE, {recursive: true});
    console.log(`Downloading ${NE_URL}`);
    const res = await fetch(NE_URL);
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status}`);
    }
    fs.writeFileSync(NE_FILE, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(NE_FILE, 'utf8'));
}

/** The country code a Natural Earth feature counts as, or null (same rules as gen-maps.ts). */
function codeOf(f: any): CountryCode | null {
  const p = f.properties;
  if (p.ADM0_A3 === 'SOL') {
    return 'SO'; // Somaliland is counted as part of Somalia.
  }
  if (p.ADM0_A3 === 'CYN') {
    return 'CY'; // Northern Cyprus is counted as part of Cyprus.
  }
  const code = p.ISO_A2_EH as CountryCode;
  if (!(code in CONTINENT_OF)) {
    return null;
  }
  return code === 'AU' && p.ADM0_A3 !== 'AUS' ? null : code;
}

/** Outer rings only (holes such as Lesotho in South Africa are drawn as their own country). */
function outerRings(geometry: any): LonLat[][] {
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates[0]];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((poly: LonLat[][]) => poly[0]);
  }
  return [];
}

/** Longitudes made continuous across the antimeridian, relative to `ref`. */
function unwrapLon(lon: number, ref: number): number {
  let d = lon - ref;
  while (d > 180) {
    d -= 360;
  }
  while (d < -180) {
    d += 360;
  }
  return ref + d;
}

function area(ring: XY[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j].x + ring[i].x) * (ring[j].y - ring[i].y);
  }
  return Math.abs(a / 2);
}

function centroid(ring: XY[]): XY {
  const n = ring.length;
  return {x: ring.reduce((s, p) => s + p.x, 0) / n, y: ring.reduce((s, p) => s + p.y, 0) / n};
}

function bbox(rings: XY[][]) {
  const pts = rings.flat();
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  return {xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys)};
}

/** Douglas–Peucker on a closed ring. */
function simplify(ring: XY[], tol: number): XY[] {
  if (ring.length <= 4) {
    return ring;
  }
  const keep = new Uint8Array(ring.length);
  // Split the ring at the point farthest from the first, so both halves are open polylines.
  let far = 0;
  let farD = -1;
  ring.forEach((p, i) => {
    const d = Math.hypot(p.x - ring[0].x, p.y - ring[0].y);
    if (d > farD) {
      farD = d;
      far = i;
    }
  });
  keep[0] = 1;
  keep[far] = 1;
  const stack: Array<[number, number]> = [
    [0, far],
    [far, ring.length - 1],
  ];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const A = ring[a];
    const B = ring[b];
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy) || 1e-12;
    let best = -1;
    let bestD = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (ring[i].x - A.x) - dx * (ring[i].y - A.y)) / len;
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  keep[ring.length - 1] = 1;
  const out = ring.filter((_, i) => keep[i]);
  // The ring is closed: drop the repeated last point.
  const last = out[out.length - 1];
  if (out.length > 1 && last.x === out[0].x && last.y === out[0].y) {
    out.pop();
  }
  return out;
}

interface Outline {
  /** Largest side in km. */
  sizeKm: number;
  width: number;
  height: number;
  rings: Array<Array<[number, number]>>;
  points: number;
}

function outlineOf(code: CountryCode, lonlatRings: LonLat[][]): Outline {
  // Centre: the largest ring (by rough lon/lat area), then the area-weighted mean of the parts near it.
  const roughArea = (r: LonLat[]) =>
    area(r.map(([lon, lat]) => ({x: unwrapLon(lon, r[0][0]) * Math.cos((lat * Math.PI) / 180), y: lat})));
  const mainRing = [...lonlatRings].sort((a, b) => roughArea(b) - roughArea(a))[0];
  const ref = mainRing[0][0];
  const lons = mainRing.map(p => unwrapLon(p[0], ref));
  const lats = mainRing.map(p => p[1]);
  const lon0 = (Math.min(...lons) + Math.max(...lons)) / 2;
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const proj: Projection = {kind: 'laea', lon0, lat0};
  const toXY = (r: LonLat[]): XY[] =>
    r.map(([lon, lat]) => {
      const p = projectRelative(proj, ((unwrapLon(lon, lon0) - lon0) * Math.PI) / 180, lat);
      // Page y points down.
      return {x: p.x * R_KM, y: -p.y * R_KM};
    });

  let rings = lonlatRings.map(toXY).sort((a, b) => area(b) - area(a));
  const mainXY = rings[0];
  const mb = bbox([mainXY]);
  const mainSize = Math.hypot(mb.xmax - mb.xmin, mb.ymax - mb.ymin);
  const mc = {x: (mb.xmin + mb.xmax) / 2, y: (mb.ymin + mb.ymax) / 2};
  // Overseas parts: far from the main part compared with its size.
  rings = rings.filter((r, i) => {
    if (i === 0) {
      return true;
    }
    const c = centroid(r);
    return Math.hypot(c.x - mc.x, c.y - mc.y) <= MAX_PART_DISTANCE * mainSize + mainSize / 2;
  });
  const total = rings.reduce((s, r) => s + area(r), 0);
  const b0 = bbox(rings);
  const extent0 = Math.max(b0.xmax - b0.xmin, b0.ymax - b0.ymin);
  rings = rings
    .filter((r, i) => i === 0 || area(r) >= MIN_PART_SHARE * total || area(r) >= MIN_PART_GRID * extent0 * extent0)
    .slice(0, MAX_PARTS);

  const b = bbox(rings);
  const sizeKm = Math.max(b.xmax - b.xmin, b.ymax - b.ymin);
  const scale = OUTLINE_GRID / sizeKm;
  const grid = rings.map(r => r.map(p => ({x: (p.x - b.xmin) * scale, y: (p.y - b.ymin) * scale})));

  // Simplify until the point budget holds.
  let tol = 1.2;
  let simple: XY[][] = [];
  for (;;) {
    simple = grid
      .map(r => simplify(r, tol))
      .filter((r, i) => i === 0 || (r.length >= 3 && area(r) > tol * tol * 4));
    const n = simple.reduce((s, r) => s + r.length, 0);
    if (n <= MAX_POINTS) {
      break;
    }
    tol *= 1.25;
  }
  const out = simple.map(r => r.map(p => [Math.round(p.x), Math.round(p.y)] as [number, number]));
  const all = out.flat();
  if (out[0].length < 3) {
    throw new Error(`${code}: outline collapsed`);
  }
  return {
    sizeKm,
    width: Math.max(...all.map(p => p[0])),
    height: Math.max(...all.map(p => p[1])),
    rings: out,
    points: all.length,
  };
}

async function fetchCached(url: string, file: string): Promise<string> {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    console.log(`Downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${url}`);
    }
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return fs.readFileSync(file, 'utf8');
}

interface GbSource {
  iso3: string;
  boundaryID: string;
  source: string;
  license: string;
  licenseSource: string;
}

/** The outline of a country from geoBoundaries gbOpen ADM0, with its source and license. */
async function geoBoundaries(iso3: string): Promise<{rings: LonLat[][]; source: GbSource}> {
  const meta = JSON.parse(await fetchCached(`${GB_API}/${iso3}/ADM0/`, path.join(GB_CACHE, `${iso3}.json`)));
  const gj = JSON.parse(await fetchCached(meta.gjDownloadURL, path.join(GB_CACHE, `${iso3}.geojson`)));
  const rings = gj.features.flatMap((f: any) => outerRings(f.geometry));
  return {
    rings,
    source: {
      iso3,
      boundaryID: meta.boundaryID,
      source: meta.boundarySource,
      license: meta.boundaryLicense,
      licenseSource: meta.licenseSource,
    },
  };
}

async function main() {
  const ne = await ensureNaturalEarth();
  const byCode = new Map<CountryCode, LonLat[][]>();
  const iso3 = new Map<CountryCode, string>();
  for (const f of ne.features) {
    const code = codeOf(f);
    if (!code) {
      continue;
    }
    byCode.set(code, [...(byCode.get(code) ?? []), ...outerRings(f.geometry)]);
    if (f.properties.ISO_A3_EH && f.properties.ISO_A3_EH !== '-99' && !iso3.has(code)) {
      iso3.set(code, f.properties.ISO_A3_EH);
    }
  }
  const missing = COUNTRY_CODES.filter(c => !byCode.has(c));
  if (missing.length) {
    throw new Error(`No outline for ${missing.join(', ')}`);
  }
  // Small countries: more detailed outlines from geoBoundaries.
  const sources: Record<string, GbSource> = {};
  for (const code of COUNTRY_CODES) {
    const largest = Math.max(...byCode.get(code)!.map(r => r.length));
    if (largest >= GB_THRESHOLD || GB_SKIP.has(code)) {
      continue;
    }
    const gb = await geoBoundaries(iso3.get(code)!);
    const gbLargest = Math.max(...gb.rings.map(r => r.length));
    if (gbLargest <= largest) {
      continue;
    }
    byCode.set(code, gb.rings);
    sources[code] = gb.source;
  }
  fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2) + '\n');
  console.log(`geoBoundaries for ${Object.keys(sources).length} countries: ${Object.keys(sources).join(' ')}`);
  const lines: string[] = [];
  let points = 0;
  for (const code of COUNTRY_CODES) {
    const o = outlineOf(code, byCode.get(code)!);
    points += o.points;
    lines.push(`  ${code}: [${Math.round(o.sizeKm * 10) / 10}, ${o.width}, ${o.height}, '${encodeRings(o.rings)}'],`);
  }
  const src = `// Generated by scripts/gen-outlines.ts – do not edit by hand.
/**
 * Country outlines for outline mode. Per country: [largest side in km, width, height, rings].
 * The rings are in a grid where the largest side is ${OUTLINE_GRID} units, y pointing down,
 * encoded with src/core/outlineCodec.ts. Each country is projected on its own
 * (Lambert azimuthal equal-area centred on the country), so areas can be compared.
 * Sources: Natural Earth 1:10m Admin 0 – Countries (public domain), and for small countries
 * geoBoundaries gbOpen ADM0 (open licenses per country, mostly OpenStreetMap under ODbL; see
 * scripts/data/outline-sources.json and THIRD_PARTY_NOTICES.md).
 */
import type {CountryCode} from './countries';

export type OutlineData = readonly [sizeKm: number, width: number, height: number, rings: string];

export const OUTLINES: Record<CountryCode, OutlineData> = {
${lines.join('\n')}
};
`;
  fs.writeFileSync(OUT, src);
  console.log(`Wrote ${path.relative(ROOT, OUT)}: ${COUNTRY_CODES.length} countries, ${points} points, ${src.length} bytes`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
