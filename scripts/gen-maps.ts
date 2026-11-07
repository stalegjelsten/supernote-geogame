#!/usr/bin/env node
/* eslint-disable no-bitwise -- PNG encoding and CRC32 */
/**
 * Generates the map images for map mode and the data that goes with them:
 *
 *   node --no-warnings scripts/gen-maps.ts
 *
 * (Node 23.6 or newer runs TypeScript directly.)
 *
 * Writes
 * - assets/maps/<region>.png – high-contrast grayscale maps for e-ink, without capitals,
 * - src/data/maps.ts         – projection, extent and image size per map,
 * - src/data/capitals.ts     – longitude/latitude of each country's capital.
 *
 * Sources (both freely available):
 * - Country borders: Natural Earth 1:50m Admin 0 – Countries (public domain),
 *   https://www.naturalearthdata.com. Downloaded to scripts/data/cache/ on first run.
 * - Capitals: the coordinates (P625) of the capitals (P36) in Wikidata (CC0), for the
 *   same Q-IDs the language files use (scripts/data/capitals-wikidata.json).
 *   Fetched once into scripts/data/capitals-coords-wikidata.json.
 *
 * The projections live in src/core/projection.ts and are used both here and in the plugin,
 * so the pixels in the image and the coordinates when grading match exactly.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {
  project,
  projectRelative,
  unproject,
  haversineKm,
  type Bounds,
  type MapMeta,
  type Projection,
} from '../src/core/projection.ts';
import {computeMapLayout} from '../src/core/mapLayout.ts';
import {
  CONTINENT_OF,
  COUNTRY_CODES,
  type Continent,
  type CountryCode,
} from '../src/data/countries.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'scripts/data/cache');
const NE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const NE_FILE = path.join(CACHE, 'ne_50m_admin_0_countries.geojson');
const QIDS_FILE = path.join(ROOT, 'scripts/data/capitals-wikidata.json');
const COORDS_FILE = path.join(
  ROOT,
  'scripts/data/capitals-coords-wikidata.json',
);

/** Number of capitals per map sheet; the images are made at full size for this layout. */
export const MAP_SHEET_COUNT = 10;
/** Images are made at full resolution for the Manta; smaller devices scale down. */
const PAGE = {width: 1920, height: 2560};

type Region = Continent | 'ALL';

interface RegionDef {
  region: Region;
  file: string;
  projection: Projection;
  /** Points (longitude, latitude) to include on the map, in addition to the capitals. */
  extent: Array<[number, number]>;
  /** For the world map: the latitude limits instead of points. */
  latRange?: [number, number];
}

const REGIONS: RegionDef[] = [
  {
    region: 'EU',
    file: 'eu',
    projection: {kind: 'laea', lon0: 15, lat0: 52},
    extent: [
      [-24.5, 63.3],
      [-10, 36],
      [26, 71.2],
      [44, 58],
      [34.6, 34.6],
      [-9.5, 43.5],
    ],
  },
  {
    region: 'AS',
    file: 'as',
    projection: {kind: 'laea', lon0: 88, lat0: 28},
    extent: [
      [26, 36],
      [26, 42],
      [146, 44],
      [141, -10],
      [95, 6],
      [72, 55],
      [120, 53],
    ],
  },
  {
    region: 'AF',
    file: 'af',
    projection: {kind: 'laea', lon0: 17, lat0: 2},
    extent: [
      [-25.4, 15],
      [-17.5, 28],
      [10, 37.5],
      [32, 31.5],
      [51.5, 11.8],
      [58, -20.5],
      [20, -35.2],
    ],
  },
  {
    region: 'NA',
    file: 'na',
    projection: {kind: 'laea', lon0: -85, lat0: 28},
    // Northern Canada is cut off: the northernmost capital is Ottawa (45° N), and
    // the Caribbean gets larger when the map does not have to fit the Arctic.
    extent: [
      [-124.5, 48.5],
      [-117, 32.5],
      [-53, 47.5],
      [-60, 10],
      [-78, 7],
      [-90, 49],
    ],
  },
  {
    region: 'SA',
    file: 'sa',
    projection: {kind: 'laea', lon0: -60, lat0: -22},
    extent: [
      [-81.5, -5],
      [-35, -7],
      [-72, -55],
      [-72, 12.5],
      [-55, 6],
      [-60, 11],
    ],
  },
  {
    region: 'OC',
    file: 'oc',
    projection: {kind: 'laea', lon0: 160, lat0: -14},
    extent: [
      [113, -22],
      [114.5, -35],
      [146, -44],
      [167, -47],
      [179, -37],
      [-175, -22],
      [-171, -13],
      [172, 12],
      [134, 8],
    ],
  },
  {
    region: 'ALL',
    file: 'world',
    projection: {kind: 'equalEarth', lon0: 10},
    extent: [],
    latRange: [-56, 83.7],
  },
];

// Colors (8-bit grayscale). Sea light gray, land white, borders dark gray, frame black.
const OCEAN = 205;
const LAND = 255;
const BORDER = 60;
const FRAME = 0;

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

/** Fetches the capitals' coordinates from Wikidata (once) and creates src/data/capitals.ts. */
async function capitals(): Promise<Record<string, [number, number]>> {
  const qids: Record<string, {q: string}> = JSON.parse(
    fs.readFileSync(QIDS_FILE, 'utf8'),
  );
  let coords: Record<string, [number, number] | null> = fs.existsSync(
    COORDS_FILE,
  )
    ? JSON.parse(fs.readFileSync(COORDS_FILE, 'utf8'))
    : {};
  const missing = [...new Set(Object.values(qids).map(v => v.q))].filter(
    q => !coords[q],
  );
  for (let i = 0; i < missing.length; i += 50) {
    const ids = missing.slice(i, i + 50).join('|');
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${ids}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'geogame-map-script/0.7 (Supernote plugin build script)',
      },
    });
    const json: any = await res.json();
    for (const [q, e] of Object.entries<any>(json.entities)) {
      const claims = e.claims?.P625 ?? [];
      const c = claims.find((x: any) => x.rank === 'preferred') ?? claims[0];
      const v = c?.mainsnak?.datavalue?.value;
      coords[q] = v ? [v.longitude, v.latitude] : null;
    }
  }
  if (missing.length) {
    fs.writeFileSync(COORDS_FILE, JSON.stringify(coords, null, 1) + '\n');
  }
  const out: Record<string, [number, number]> = {};
  for (const code of COUNTRY_CODES) {
    const q = qids[code]?.q;
    const c = q ? coords[q] : null;
    if (!c) {
      throw new Error(`Missing coordinates for the capital of ${code} (${q})`);
    }
    out[code] = [Math.round(c[0] * 1e4) / 1e4, Math.round(c[1] * 1e4) / 1e4];
  }
  const lines = COUNTRY_CODES.map(
    code => `  ${code}: [${out[code][0]}, ${out[code][1]}],`,
  );
  fs.writeFileSync(
    path.join(ROOT, 'src/data/capitals.ts'),
    `// Generated by scripts/gen-maps.ts – do not edit by hand.
/**
 * Each country's capital location: [longitude, latitude] in degrees (WGS 84).
 * Source: Wikidata (CC0), property P625 of the capital (P36) in scripts/data/capitals-wikidata.json.
 */
import type {CountryCode} from './countries';

export const CAPITAL_LONLAT: Record<CountryCode, readonly [lon: number, lat: number]> = {
${lines.join('\n')}
};
`,
  );
  return out;
}

const RAD = Math.PI / 180;

/** Angular distance in degrees between two points. */
function angularDeg(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  return (
    haversineKm({lon: lon1, lat: lat1}, {lon: lon2, lat: lat2}) /
    (6371.0088 * RAD)
  );
}

function boundsFor(
  def: RegionDef,
  caps: Record<string, [number, number]>,
): Bounds {
  if (def.latRange) {
    const p = def.projection;
    const xmax = projectRelative(p, Math.PI, 0).x;
    const pad = xmax * 0.012;
    return {
      xmin: -xmax - pad,
      xmax: xmax + pad,
      ymin: project(p, p.lon0, def.latRange[0]).y,
      ymax: project(p, p.lon0, def.latRange[1]).y,
    };
  }
  const pts = [
    ...COUNTRY_CODES.filter(c => CONTINENT_OF[c] === def.region).map(
      c => caps[c],
    ),
    ...def.extent,
  ].map(([lon, lat]) => project(def.projection, lon, lat));
  const xs = pts.map(q => q.x);
  const ys = pts.map(q => q.y);
  const b = {
    xmin: Math.min(...xs),
    xmax: Math.max(...xs),
    ymin: Math.min(...ys),
    ymax: Math.max(...ys),
  };
  const pad = Math.max(b.xmax - b.xmin, b.ymax - b.ymin) * 0.035;
  return {
    xmin: b.xmin - pad,
    xmax: b.xmax + pad,
    ymin: b.ymin - pad,
    ymax: b.ymax + pad,
  };
}

// ---------------------------------------------------------------------------
// Simple rasterization: filled polygons (even-odd) and thick lines.

class Raster {
  w: number;
  h: number;
  data: Uint8Array;
  constructor(w: number, h: number, fill: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h).fill(fill);
  }

  /** Fills all rings together with the even-odd rule, so holes stay holes. */
  fillRings(rings: Array<Array<[number, number]>>, color: number) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const ring of rings) {
      for (const [, y] of ring) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.h - 1, Math.ceil(maxY));
    const xs: number[] = [];
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (const ring of rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i];
          const [xj, yj] = ring[j];
          if (yi > sy !== yj > sy) {
            xs.push(xi + ((sy - yi) / (yj - yi)) * (xj - xi));
          }
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, Math.ceil(xs[k] - 0.5));
        const b = Math.min(this.w - 1, Math.floor(xs[k + 1] - 0.5));
        if (b >= a) {
          this.data.fill(color, y * this.w + a, y * this.w + b + 1);
        }
      }
    }
  }

  dot(cx: number, cy: number, radius: number, color: number) {
    const r2 = radius * radius;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if (
          x >= 0 &&
          y >= 0 &&
          x < this.w &&
          y < this.h &&
          (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r2
        ) {
          this.data[y * this.w + x] = color;
        }
      }
    }
  }

  line(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    width: number,
    color: number,
  ) {
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(len / 0.5));
    const r = width / 2;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      this.dot(ax + (bx - ax) * t, ay + (by - ay) * t, r, color);
    }
  }

  ring(cx: number, cy: number, radius: number, width: number, color: number) {
    const steps = Math.max(12, Math.ceil(radius * 4));
    for (let s = 0; s < steps; s++) {
      const a = (2 * Math.PI * s) / steps;
      const b = (2 * Math.PI * (s + 1)) / steps;
      this.line(
        cx + radius * Math.cos(a),
        cy + radius * Math.sin(a),
        cx + radius * Math.cos(b),
        cy + radius * Math.sin(b),
        width,
        color,
      );
    }
  }

  frame(width: number, color: number) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (
          x < width ||
          y < width ||
          x >= this.w - width ||
          y >= this.h - width
        ) {
          this.data[y * this.w + x] = color;
        }
      }
    }
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) {
    c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/**
 * PNG with an indexed palette (4 bit). The map has only a few gray shades, so it
 * ends up much smaller than 8-bit grayscale, and Android reads it as usual.
 */
function encodePng(r: Raster): Buffer {
  const levels = [...new Set(r.data)].sort((a, b) => a - b);
  if (levels.length > 16) {
    throw new Error('Too many gray shades for a 4-bit palette');
  }
  const index = new Map(levels.map((v, i) => [v, i]));
  const rowBytes = Math.ceil(r.w / 2);
  const raw = Buffer.alloc((rowBytes + 1) * r.h);
  for (let y = 0; y < r.h; y++) {
    const o = y * (rowBytes + 1);
    raw[o] = 0; // filter: none
    for (let x = 0; x < r.w; x++) {
      const v = index.get(r.data[y * r.w + x])!;
      raw[o + 1 + (x >> 1)] |= x & 1 ? v : v << 4;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(r.w, 0);
  ihdr.writeUInt32BE(r.h, 4);
  ihdr[8] = 4; // bit depth
  ihdr[9] = 3; // indexed color
  const plte = Buffer.from(levels.flatMap(v => [v, v, v]));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    chunk('IDAT', zlib.deflateSync(raw, {level: 9})),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

// ---------------------------------------------------------------------------

/** Enclaves where a dot would only clutter the map. */
const NO_DOT = new Set(['VA', 'SM', 'MC', 'LI', 'AD']);

/** Creates a function that projects a ring (longitude, latitude) to pixels in the map image. */
function projector(def: RegionDef, meta: MapMeta) {
  const W = meta.width;
  const H = meta.height;
  const b = meta.bounds;
  const toPx = (x: number, y: number): [number, number] => [
    ((x - b.xmin) / (b.xmax - b.xmin)) * W,
    ((b.ymax - y) / (b.ymax - b.ymin)) * H,
  ];
  const p = def.projection;
  const center = p.kind === 'laea' ? [p.lon0, p.lat0] : null;

  /** Projects a ring. On the world map the ring is kept in one piece even if it crosses the edge. */
  const projectRing = (ring: number[][]): Array<[number, number]> | null => {
    if (center) {
      if (
        ring.some(
          ([lon, lat]) => angularDeg(lon, lat, center[0], center[1]) > 150,
        )
      ) {
        return null;
      }
      return ring.map(([lon, lat]) => {
        const q = project(p, lon, lat);
        return toPx(q.x, q.y);
      });
    }
    // Longitude relative to the central meridian, without jumps between neighboring points.
    const rel: number[] = [];
    for (const [lon] of ring) {
      let d = lon - p.lon0;
      if (rel.length) {
        const prev = rel[rel.length - 1];
        while (d - prev > 180) {
          d -= 360;
        }
        while (d - prev < -180) {
          d += 360;
        }
      } else {
        d = ((d + 540) % 360) - 180;
      }
      rel.push(d);
    }
    const mean = rel.reduce((a, v) => a + v, 0) / rel.length;
    const shift = mean > 180 ? -360 : mean < -180 ? 360 : 0;
    return ring.map(([, lat], i) => {
      const q = projectRelative(
        p,
        (rel[i] + shift) * RAD,
        Math.max(lat, -89.9),
      );
      return toPx(q.x, q.y);
    });
  };
  return projectRing;
}

function render(def: RegionDef, meta: MapMeta, ne: any): Raster {
  const W = meta.width;
  const H = meta.height;
  const projectRing = projector(def, meta);
  const raster = new Raster(W, H, OCEAN);
  const outlines: Array<Array<[number, number]>> = [];
  const dots: Array<[number, number]> = [];
  for (const f of ne.features) {
    const g = f.geometry;
    if (!g) {
      continue;
    }
    const polys: number[][][][] =
      g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const iso = f.properties.ISO_A2_EH ?? f.properties.ISO_A2;
    for (const poly of polys) {
      const rings = poly
        .map(projectRing)
        .filter((x): x is Array<[number, number]> => !!x);
      if (!rings.length) {
        continue;
      }
      const xs = rings[0].map(q => q[0]);
      const ys = rings[0].map(q => q[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      if (maxX < -10 || minX > W + 10 || maxY < -10 || minY > H + 10) {
        continue;
      }
      raster.fillRings(rings, LAND);
      outlines.push(...rings);
      // Small island states would otherwise vanish: draw a small island dot.
      if (maxX - minX < 3.5 && maxY - minY < 3.5 && !NO_DOT.has(iso)) {
        dots.push([(minX + maxX) / 2, (minY + maxY) / 2]);
      }
    }
  }
  for (const ring of outlines) {
    for (let i = 1; i < ring.length; i++) {
      const [ax, ay] = ring[i - 1];
      const [bx, by] = ring[i];
      if (Math.abs(bx - ax) > W / 2) {
        continue; // skip edges that cross the whole map
      }
      if (
        (ax < -2 && bx < -2) ||
        (ax > W + 2 && bx > W + 2) ||
        (ay < -2 && by < -2) ||
        (ay > H + 2 && by > H + 2)
      ) {
        continue;
      }
      raster.line(ax, ay, bx, by, 2.2, BORDER);
    }
  }
  for (const [x, y] of dots) {
    raster.dot(x, y, 3.2, LAND);
    raster.ring(x, y, 3.6, 1.4, BORDER);
  }
  raster.frame(3, FRAME);
  return raster;
}

/** The country code a Natural Earth feature counts as, or null. */
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
  // Australia's small territories (Christmas Island etc.) also have the code AU.
  return code === 'AU' && p.ADM0_A3 !== 'AUS' ? null : code;
}

/** The size of a cell in the country grid, in image pixels. */
const CELL = 4;
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const b62 = (v: number) => {
  if (v < 0 || v >= 62 * 62) {
    throw new Error(`Outside base62: ${v}`);
  }
  return B62[Math.floor(v / 62)] + B62[v % 62];
};

/**
 * Country grid for the map: which country (in the region) each CELL×CELL-pixel
 * cell belongs to, encoded as rows of runs ("id, length" in base62). Used
 * for grading country mode. Also gives a label point per country: the cell
 * farthest from other countries, within the map.
 */
function cellIndex(def: RegionDef, meta: MapMeta, ne: any) {
  const codes = COUNTRY_CODES.filter(c => def.region === 'ALL' || CONTINENT_OF[c] === def.region);
  const idOf = new Map(codes.map((c, k) => [c, k + 1]));
  const cols = Math.ceil(meta.width / CELL);
  const rows = Math.ceil(meta.height / CELL);
  const grid = new Raster(cols, rows, 0);
  const projectRing = projector(def, meta);
  const tiny: Array<[number, number, number]> = [];
  // Polygons are filled from largest to smallest, so small countries are not overwritten by their neighbors.
  const polygons: Array<{id: number; rings: Array<Array<[number, number]>>; w: number; h: number}> = [];
  for (const f of ne.features) {
    const code = codeOf(f);
    const id = code ? idOf.get(code) : undefined;
    if (!id || !f.geometry) {
      continue;
    }
    const g = f.geometry;
    const polys: number[][][][] = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) {
      const rings = poly
        .map(projectRing)
        .filter((x): x is Array<[number, number]> => !!x)
        .map(r => r.map(([x, y]): [number, number] => [x / CELL, y / CELL]));
      if (!rings.length) {
        continue;
      }
      const xs = rings[0].map(q => q[0]);
      const ys = rings[0].map(q => q[1]);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      polygons.push({id, rings, w, h});
      if (w < 3 && h < 3) {
        tiny.push([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, id]);
      }
    }
  }
  polygons.sort((p1, p2) => p2.w * p2.h - p1.w * p1.h);
  for (const poly of polygons) {
    grid.fillRings(poly.rings, poly.id);
  }
  // Small islands and microstates get at least one cell, drawn last so they are not overwritten.
  for (const [x, y, id] of tiny) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) {
      grid.data[cy * cols + cx] = id;
    }
  }
  // Narrow countries (Gambia on the world map) can fall between cell centers: stamp the middle
  // of the country's largest polygon.
  for (const c of codes) {
    const id = idOf.get(c)!;
    if (grid.data.includes(id)) {
      continue;
    }
    const biggest = polygons.filter(q => q.id === id).sort((p1, p2) => p2.w * p2.h - p1.w * p1.h)[0];
    if (biggest) {
      const xs = biggest.rings[0].map(q => q[0]);
      const ys = biggest.rings[0].map(q => q[1]);
      const cx = Math.floor((Math.min(...xs) + Math.max(...xs)) / 2);
      const cy = Math.floor((Math.min(...ys) + Math.max(...ys)) / 2);
      if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) {
        grid.data[cy * cols + cx] = id;
      }
    }
    if (!grid.data.includes(id)) {
      throw new Error(`${c} has no cells in ${def.file}`);
    }
  }

  // Distance (in cells) to the nearest cell with another country, using a two-pass chamfer.
  const dist = new Float32Array(cols * rows).fill(1e9);
  const at = (x: number, y: number) => grid.data[y * cols + x];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = at(x, y);
      const edge =
        x === 0 || y === 0 || x === cols - 1 || y === rows - 1 ||
        at(x - 1, y) !== v || at(x + 1, y) !== v || at(x, y - 1) !== v || at(x, y + 1) !== v;
      if (edge) {
        dist[y * cols + x] = 0;
      }
    }
  }
  const relax = (x: number, y: number, dx: number, dy: number, w: number) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) {
      const k = y * cols + x;
      dist[k] = Math.min(dist[k], dist[ny * cols + nx] + w);
    }
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      relax(x, y, -1, 0, 1);
      relax(x, y, 0, -1, 1);
      relax(x, y, -1, -1, 1.414);
      relax(x, y, 1, -1, 1.414);
    }
  }
  for (let y = rows - 1; y >= 0; y--) {
    for (let x = cols - 1; x >= 0; x--) {
      relax(x, y, 1, 0, 1);
      relax(x, y, 0, 1, 1);
      relax(x, y, 1, 1, 1.414);
      relax(x, y, -1, 1, 1.414);
    }
  }
  const best = new Map<number, {d: number; x: number; y: number}>();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const id = at(x, y);
      const d = dist[y * cols + x];
      if (id && (!best.has(id) || d > best.get(id)!.d)) {
        best.set(id, {d, x, y});
      }
    }
  }
  const labels = codes.map(c => {
    const b = best.get(idOf.get(c)!)!;
    return [Math.round((b.x + 0.5) * CELL), Math.round((b.y + 0.5) * CELL)];
  });

  let runs = '';
  let count = 0;
  for (let y = 0; y < rows; y++) {
    let x = 0;
    while (x < cols) {
      const id = at(x, y);
      let len = 1;
      while (x + len < cols && at(x + len, y) === id) {
        len++;
      }
      runs += b62(id) + b62(len);
      count++;
      x += len;
    }
  }
  return {cols, rows, codes, labels, runs, count};
}

function diagonalKm(meta: MapMeta): number {
  if (meta.projection.kind === 'equalEarth') {
    return 20000;
  }
  const b = meta.bounds;
  const a = unproject(meta.projection, b.xmin, b.ymax);
  const c = unproject(meta.projection, b.xmax, b.ymin);
  return haversineKm(a, c);
}

interface CellData {
  region: Region;
  cols: number;
  rows: number;
  codes: CountryCode[];
  labels: number[][];
  runs: string;
}

function writeCells(all: CellData[]) {
  const entries = all.map(
    c => `  ${c.region}: {
    cell: ${CELL},
    cols: ${c.cols},
    rows: ${c.rows},
    codes: ${JSON.stringify(c.codes).replace(/"/g, "'")},
    labels: ${JSON.stringify(c.labels)},
    runs: '${c.runs}',
  },`,
  );
  fs.writeFileSync(
    path.join(ROOT, 'src/data/countryCells.ts'),
    `// Generated by scripts/gen-maps.ts – do not edit by hand.
/**
 * Country grids for the maps, for country mode. For each map:
 * - cell: cell size in image pixels; cols × rows cells.
 * - codes: the countries in the region; id k in the grid is codes[k - 1], 0 is sea/other countries.
 * - labels: per country a point (image pixels) well inside the country, for the answer marker.
 * - runs: the rows one after another as runs "id, length", two base62 characters each.
 * Source: Natural Earth 1:50m (public domain), projected like the map image.
 */
import type {Region} from '../core/sheet';
import type {CountryCode} from './countries';

export interface CountryCellData {
  cell: number;
  cols: number;
  rows: number;
  codes: readonly CountryCode[];
  labels: readonly (readonly number[])[];
  runs: string;
}

export const COUNTRY_CELLS: Record<Region, CountryCellData> = {
${entries.join('\n')}
};
`,
  );
}

async function main() {
  const ne = await ensureNaturalEarth();
  const caps = await capitals();
  fs.mkdirSync(path.join(ROOT, 'assets/maps'), {recursive: true});

  const metas: Record<string, MapMeta> = {};
  const cellData: CellData[] = [];
  for (const def of REGIONS) {
    const bounds = boundsFor(def, caps);
    const aspect = (bounds.xmax - bounds.xmin) / (bounds.ymax - bounds.ymin);
    const rect = computeMapLayout(PAGE, aspect, MAP_SHEET_COUNT).map;
    const width = rect.right - rect.left;
    const height = Math.round(width / aspect);
    const meta: MapMeta = {
      file: def.file,
      projection: def.projection,
      bounds,
      width,
      height,
      scaleKm: 0,
    };
    // The scale of the score curve: 1/20 of the map's diagonal, rounded to the nearest 10 km.
    meta.scaleKm = Math.round(diagonalKm(meta) / 20 / 10) * 10;
    const png = encodePng(render(def, meta, ne));
    fs.writeFileSync(path.join(ROOT, `assets/maps/${def.file}.png`), png);
    console.log(
      `${def.file}.png ${width}×${height}, ${(png.length / 1024).toFixed(
        0,
      )} kB, scale ${meta.scaleKm} km`,
    );
    metas[def.region] = meta;
    const cells = cellIndex(def, meta, ne);
    cellData.push({region: def.region, ...cells});
    console.log(`  country grid ${cells.cols}×${cells.rows}, ${cells.count} runs, ${(cells.runs.length / 1024).toFixed(0)} kB`);
  }
  writeCells(cellData);

  const num = (v: number) => Number(v.toPrecision(10));
  const entries = REGIONS.map(def => {
    const m = metas[def.region];
    const b = m.bounds;
    const proj =
      m.projection.kind === 'laea'
        ? `{kind: 'laea', lon0: ${m.projection.lon0}, lat0: ${m.projection.lat0}}`
        : `{kind: 'equalEarth', lon0: ${m.projection.lon0}}`;
    return `  ${def.region}: {
    file: '${m.file}',
    projection: ${proj},
    bounds: {xmin: ${num(b.xmin)}, xmax: ${num(b.xmax)}, ymin: ${num(
      b.ymin,
    )}, ymax: ${num(b.ymax)}},
    width: ${m.width},
    height: ${m.height},
    scaleKm: ${m.scaleKm},
  },`;
  });
  fs.writeFileSync(
    path.join(ROOT, 'src/data/maps.ts'),
    `// Generated by scripts/gen-maps.ts – do not edit by hand.
/**
 * The maps in assets/maps/: projection, extent (projection coordinates on a
 * unit sphere) and image size. See src/core/projection.ts for the formulas.
 */
import type {MapMeta} from '../core/projection';
import type {Region} from '../core/sheet';

/** Number of capitals on one map sheet; the images are made at full size for this layout. */
export const MAP_SHEET_COUNT = ${MAP_SHEET_COUNT};

export const MAPS: Record<Region, MapMeta> = {
${entries.join('\n')}
};
`,
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
