/* eslint-disable no-bitwise -- PNG decoding */
/**
 * Makes src/data/mapLines.ts: for each map image in assets/maps/, a grid of which cells have a
 * line in them (a border, a coast or the frame). Used to place the numbers on label sheets
 * where no line runs through them. Read from the images themselves, so every line that is
 * drawn counts, also the coasts of countries outside the region (Indonesia on the Oceania map).
 *
 *   node --no-warnings --import ./scripts/ts-resolve.mjs scripts/gen-map-lines.ts
 *
 * Run again whenever the maps are made again (scripts/gen-maps.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {MAPS} from '../src/data/maps.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Cell size in image pixels (as the country grid). */
const CELL = 4;
/** Gray levels darker than this are lines; the sea is light gray and land white. */
const LINE_BELOW = 140;

interface Gray {
  w: number;
  h: number;
  data: Uint8Array;
}

/** Decodes the 8-bit gray value of each pixel of an indexed or grayscale PNG. */
function decodePng(buf: Buffer): Gray {
  let pos = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let colorType = 0;
  let palette: number[] = [];
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      depth = body[8];
      colorType = body[9];
      if (body[12] !== 0) {
        throw new Error('Interlaced PNG is not supported');
      }
    } else if (type === 'PLTE') {
      palette = [];
      for (let i = 0; i < body.length; i += 3) {
        palette.push(Math.round((body[i] + body[i + 1] + body[i + 2]) / 3));
      }
    } else if (type === 'IDAT') {
      idat.push(body);
    }
    pos += 12 + len;
  }
  if (!((colorType === 3 || colorType === 0) && depth <= 8)) {
    throw new Error(
      `Unsupported PNG (color type ${colorType}, depth ${depth})`,
    );
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rowBytes = Math.ceil((w * depth) / 8);
  const bpp = 1;
  const prev = new Uint8Array(rowBytes);
  const cur = new Uint8Array(rowBytes);
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * (rowBytes + 1);
    const filter = raw[o];
    for (let i = 0; i < rowBytes; i++) {
      const x = raw[o + 1 + i];
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v: number;
      switch (filter) {
        case 0:
          v = x;
          break;
        case 1:
          v = x + a;
          break;
        case 2:
          v = x + b;
          break;
        case 3:
          v = x + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`Unknown PNG filter ${filter}`);
      }
      cur[i] = v & 0xff;
    }
    for (let px = 0; px < w; px++) {
      const bit = px * depth;
      const byte = cur[bit >> 3];
      const value =
        depth === 8
          ? byte
          : (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
      data[y * w + px] =
        colorType === 3
          ? palette[value]
          : Math.round((value * 255) / ((1 << depth) - 1));
    }
    prev.set(cur);
  }
  return {w, h, data};
}

const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const two = (n: number) => B62[Math.floor(n / 62)] + B62[n % 62];

const out: string[] = [];
for (const [region, meta] of Object.entries(MAPS)) {
  const img = decodePng(
    fs.readFileSync(path.join(ROOT, `assets/maps/${meta.file}.png`)),
  );
  if (img.w !== meta.width || img.h !== meta.height) {
    throw new Error(
      `${meta.file}.png is ${img.w}×${img.h}, maps.ts says ${meta.width}×${meta.height}`,
    );
  }
  const cols = Math.ceil(img.w / CELL);
  const rows = Math.ceil(img.h / CELL);
  const grid = new Uint8Array(cols * rows);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (img.data[y * img.w + x] < LINE_BELOW) {
        grid[Math.floor(y / CELL) * cols + Math.floor(x / CELL)] = 1;
      }
    }
  }
  // Runs, alternating: no line, line, no line … (starting with "no line"), each two base62 characters.
  const runs: number[] = [];
  let value = 0;
  let len = 0;
  for (const v of grid) {
    if (v === value) {
      len++;
    } else {
      runs.push(len);
      value = v;
      len = 1;
    }
  }
  runs.push(len);
  // A run longer than 62² − 1 is split with a zero-length run of the other value.
  const parts: string[] = [];
  for (const run of runs) {
    let rest = run;
    while (rest > 3843) {
      parts.push(two(3843), two(0));
      rest -= 3843;
    }
    parts.push(two(rest));
  }
  out.push(
    `  ${region}: {cell: ${CELL}, cols: ${cols}, rows: ${rows}, runs: '${parts.join(
      '',
    )}'},`,
  );
  console.log(
    `${meta.file}: ${cols}×${rows} cells, ${grid.reduce(
      (s, v) => s + v,
      0,
    )} with lines`,
  );
}

const file = `// Generated by scripts/gen-map-lines.ts – do not edit by hand.
/**
 * Where the map images have lines (borders, coasts, the frame), as a grid of cells of
 * \`cell\` image pixels. \`runs\` alternates between cells without and with a line, starting
 * with "without", each run two base62 characters. Read from the images in assets/maps/.
 */
import type {Region} from '../core/sheet';

export interface MapLineData {
  cell: number;
  cols: number;
  rows: number;
  runs: string;
}

export const MAP_LINES: Record<Region, MapLineData> = {
${out.join('\n')}
};
`;
fs.writeFileSync(path.join(ROOT, 'src/data/mapLines.ts'), file);
console.log('src/data/mapLines.ts');
