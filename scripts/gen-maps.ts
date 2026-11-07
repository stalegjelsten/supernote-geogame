#!/usr/bin/env node
/* eslint-disable no-bitwise -- PNG-koding og CRC32 */
/**
 * Lager kartbildene til kartmodusen og dataene som hører til:
 *
 *   node --no-warnings scripts/gen-maps.ts
 *
 * (Node 23.6 eller nyere kjører TypeScript direkte.)
 *
 * Skriver
 * - assets/maps/<region>.png – gråtonekart med høy kontrast for e-blekk, uten hovedsteder,
 * - src/data/maps.ts         – projeksjon, utsnitt og bildestørrelse per kart,
 * - src/data/capitals.ts     – lengde/bredde for hovedstaden i hvert land.
 *
 * Kilder (begge fritt tilgjengelige):
 * - Landgrenser: Natural Earth 1:50m Admin 0 – Countries (public domain),
 *   https://www.naturalearthdata.com. Lastes ned til scripts/data/cache/ første gang.
 * - Hovedsteder: koordinatene (P625) til hovedstedene (P36) i Wikidata (CC0), for de
 *   samme Q-ID-ene som språkfilene bruker (scripts/data/capitals-wikidata.json).
 *   Hentes én gang til scripts/data/capitals-coords-wikidata.json.
 *
 * Projeksjonene ligger i src/core/projection.ts og brukes både her og i pluginen,
 * så pikslene i bildet og koordinatene ved retting stemmer nøyaktig.
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

/** Antall hovedsteder per kartark; bildene lages i full størrelse for denne layouten. */
export const MAP_SHEET_COUNT = 10;
/** Bildene lages i full oppløsning for Manta; mindre enheter skalerer ned. */
const PAGE = {width: 1920, height: 2560};

type Region = Continent | 'ALL';

interface RegionDef {
  region: Region;
  file: string;
  projection: Projection;
  /** Punkter (lengde, bredde) som skal være med på kartet, i tillegg til hovedstedene. */
  extent: Array<[number, number]>;
  /** For verdenskartet: breddegrensene i stedet for punkter. */
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
    // Nord-Canada er kuttet bort: nordligste hovedstad er Ottawa (45° N), og
    // Karibia blir større når kartet ikke må romme Arktis.
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

// Farger (8-bit gråtone). Hav lys grå, land hvitt, grenser mørk grå, ramme svart.
const OCEAN = 205;
const LAND = 255;
const BORDER = 60;
const FRAME = 0;

async function ensureNaturalEarth(): Promise<any> {
  if (!fs.existsSync(NE_FILE)) {
    fs.mkdirSync(CACHE, {recursive: true});
    console.log(`Laster ned ${NE_URL}`);
    const res = await fetch(NE_URL);
    if (!res.ok) {
      throw new Error(`Nedlasting feilet: ${res.status}`);
    }
    fs.writeFileSync(NE_FILE, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(NE_FILE, 'utf8'));
}

/** Henter koordinatene til hovedstedene fra Wikidata (én gang) og lager src/data/capitals.ts. */
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
      throw new Error(`Mangler koordinater for hovedstaden i ${code} (${q})`);
    }
    out[code] = [Math.round(c[0] * 1e4) / 1e4, Math.round(c[1] * 1e4) / 1e4];
  }
  const lines = COUNTRY_CODES.map(
    code => `  ${code}: [${out[code][0]}, ${out[code][1]}],`,
  );
  fs.writeFileSync(
    path.join(ROOT, 'src/data/capitals.ts'),
    `// Generert av scripts/gen-maps.ts – ikke rediger for hånd.
/**
 * Hovedstadens plassering for hvert land: [lengdegrad, breddegrad] i grader (WGS 84).
 * Kilde: Wikidata (CC0), egenskap P625 for hovedstaden (P36) i scripts/data/capitals-wikidata.json.
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

/** Vinkelavstand i grader mellom to punkter. */
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
// Enkel rasterisering: fylte polygoner (partall/odde) og tykke linjer.

class Raster {
  w: number;
  h: number;
  data: Uint8Array;
  constructor(w: number, h: number, fill: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h).fill(fill);
  }

  /** Fyller alle ringene samlet med partall/odde-regelen, så hull blir hull. */
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
 * PNG med indeksert palett (4 bit). Kartet har bare noen få grånyanser, så det
 * blir mye mindre enn 8-bits gråtone, og Android leser det som vanlig.
 */
function encodePng(r: Raster): Buffer {
  const levels = [...new Set(r.data)].sort((a, b) => a - b);
  if (levels.length > 16) {
    throw new Error('For mange gråtoner for 4-bits palett');
  }
  const index = new Map(levels.map((v, i) => [v, i]));
  const rowBytes = Math.ceil(r.w / 2);
  const raw = Buffer.alloc((rowBytes + 1) * r.h);
  for (let y = 0; y < r.h; y++) {
    const o = y * (rowBytes + 1);
    raw[o] = 0; // filter: ingen
    for (let x = 0; x < r.w; x++) {
      const v = index.get(r.data[y * r.w + x])!;
      raw[o + 1 + (x >> 1)] |= x & 1 ? v : v << 4;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(r.w, 0);
  ihdr.writeUInt32BE(r.h, 4);
  ihdr[8] = 4; // bitdybde
  ihdr[9] = 3; // indeksert farge
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

/** Enklaver der en prikk bare ville rotet til kartet. */
const NO_DOT = new Set(['VA', 'SM', 'MC', 'LI', 'AD']);

/** Lager en funksjon som projiserer en ring (lengde, bredde) til piksler i kartbildet. */
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

  /** Prosjekterer en ring. På verdenskartet holdes ringen samlet selv om den krysser kanten. */
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
    // Lengde relativt til midtmeridianen, uten hopp mellom nabopunkter.
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
      // Små øystater forsvinner ellers: tegn en liten øy-prikk.
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
        continue; // hopp over kanter som krysser hele kartet
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

/** Landkoden et Natural Earth-objekt teller som, eller null. */
function codeOf(f: any): CountryCode | null {
  const p = f.properties;
  if (p.ADM0_A3 === 'SOL') {
    return 'SO'; // Somaliland regnes som en del av Somalia.
  }
  if (p.ADM0_A3 === 'CYN') {
    return 'CY'; // Nord-Kypros regnes som en del av Kypros.
  }
  const code = p.ISO_A2_EH as CountryCode;
  if (!(code in CONTINENT_OF)) {
    return null;
  }
  // Australias småterritorier (Christmas Island m.fl.) har også koden AU.
  return code === 'AU' && p.ADM0_A3 !== 'AUS' ? null : code;
}

/** Størrelsen på en rute i landrutenettet, i bildepiksler. */
const CELL = 4;
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const b62 = (v: number) => {
  if (v < 0 || v >= 62 * 62) {
    throw new Error(`Utenfor base62: ${v}`);
  }
  return B62[Math.floor(v / 62)] + B62[v % 62];
};

/**
 * Landrutenett for kartet: hvilket land (i regionen) hver rute på CELL×CELL
 * piksler hører til, kodet som rader med løp («id, lengde» i base62). Brukes
 * til å rette landmodusen. Gir også et etikettpunkt per land: ruta som ligger
 * lengst unna andre land, innenfor kartet.
 */
function cellIndex(def: RegionDef, meta: MapMeta, ne: any) {
  const codes = COUNTRY_CODES.filter(c => def.region === 'ALL' || CONTINENT_OF[c] === def.region);
  const idOf = new Map(codes.map((c, k) => [c, k + 1]));
  const cols = Math.ceil(meta.width / CELL);
  const rows = Math.ceil(meta.height / CELL);
  const grid = new Raster(cols, rows, 0);
  const projectRing = projector(def, meta);
  const tiny: Array<[number, number, number]> = [];
  // Polygonene fylles fra størst til minst, så små land ikke overskrives av naboene.
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
  // Små øyer og mikrostater får minst én rute, tegnet til slutt så de ikke overskrives.
  for (const [x, y, id] of tiny) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) {
      grid.data[cy * cols + cx] = id;
    }
  }
  // Smale land (Gambia på verdenskartet) kan falle mellom rutesentrene: stemple midten
  // av landets største polygon.
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
      throw new Error(`${c} har ingen ruter i ${def.file}`);
    }
  }

  // Avstand (i ruter) til nærmeste rute med et annet land, med to-pass chamfer.
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
    `// Generert av scripts/gen-maps.ts – ikke rediger for hånd.
/**
 * Landrutenett for kartene, til landmodusen. For hvert kart:
 * - cell: rutestørrelse i bildepiksler; cols × rows ruter.
 * - codes: landene i regionen; id k i rutenettet er codes[k - 1], 0 er hav/andre land.
 * - labels: per land et punkt (bildepiksler) godt inne i landet, for fasitmerket.
 * - runs: radene etter hverandre som løp «id, lengde», to base62-tegn hver.
 * Kilde: Natural Earth 1:50m (public domain), projisert som kartbildet.
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
    // Skalaen til poengkurven: 1/20 av kartets diagonal, rundet til nærmeste 10 km.
    meta.scaleKm = Math.round(diagonalKm(meta) / 20 / 10) * 10;
    const png = encodePng(render(def, meta, ne));
    fs.writeFileSync(path.join(ROOT, `assets/maps/${def.file}.png`), png);
    console.log(
      `${def.file}.png ${width}×${height}, ${(png.length / 1024).toFixed(
        0,
      )} kB, skala ${meta.scaleKm} km`,
    );
    metas[def.region] = meta;
    const cells = cellIndex(def, meta, ne);
    cellData.push({region: def.region, ...cells});
    console.log(`  landrutenett ${cells.cols}×${cells.rows}, ${cells.count} løp, ${(cells.runs.length / 1024).toFixed(0)} kB`);
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
    `// Generert av scripts/gen-maps.ts – ikke rediger for hånd.
/**
 * Kartene i assets/maps/: projeksjon, utsnitt (projeksjonskoordinater på en
 * enhetskule) og bildestørrelse. Se src/core/projection.ts for formlene.
 */
import type {MapMeta} from '../core/projection';
import type {Region} from '../core/sheet';

/** Antall hovedsteder på ett kartark; bildene er laget i full størrelse for denne layouten. */
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
