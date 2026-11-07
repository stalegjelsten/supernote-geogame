/**
 * Oppslag i landrutenettet (src/data/countryCells.ts): hvilket land ligger et
 * punkt i kartbildet i? Brukes til å rette landmodusen.
 */
import {COUNTRY_CELLS} from '../data/countryCells';
import type {CountryCode} from '../data/countries';
import type {XY} from './projection';
import type {Region} from './sheet';

const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

interface Decoded {
  cell: number;
  cols: number;
  rows: number;
  grid: Uint8Array;
  idOf: Map<CountryCode, number>;
  labels: Map<CountryCode, XY>;
}

const cache = new Map<Region, Decoded>();

function decode(region: Region): Decoded {
  let d = cache.get(region);
  if (d) {
    return d;
  }
  const src = COUNTRY_CELLS[region];
  const grid = new Uint8Array(src.cols * src.rows);
  const v = (k: number) =>
    B62.indexOf(src.runs[k]) * 62 + B62.indexOf(src.runs[k + 1]);
  let pos = 0;
  for (let k = 0; k < src.runs.length; k += 4) {
    const id = v(k);
    const len = v(k + 2);
    grid.fill(id, pos, pos + len);
    pos += len;
  }
  if (pos !== grid.length) {
    throw new Error(
      `Landrutenettet for ${region} er ødelagt (${pos} av ${grid.length} ruter)`,
    );
  }
  d = {
    cell: src.cell,
    cols: src.cols,
    rows: src.rows,
    grid,
    idOf: new Map(src.codes.map((c, k) => [c, k + 1])),
    labels: new Map(
      src.codes.map((c, k) => [c, {x: src.labels[k][0], y: src.labels[k][1]}]),
    ),
  };
  cache.set(region, d);
  return d;
}

/** Landet (i regionen) i et punkt i kartbildet, eller null for hav og land utenfor regionen. */
export function countryAt(region: Region, p: XY): CountryCode | null {
  const d = decode(region);
  const x = Math.floor(p.x / d.cell);
  const y = Math.floor(p.y / d.cell);
  if (x < 0 || y < 0 || x >= d.cols || y >= d.rows) {
    return null;
  }
  const id = d.grid[y * d.cols + x];
  return id ? COUNTRY_CELLS[region].codes[id - 1] : null;
}

/**
 * Ligger punktet i landet, eller høyst `tolerancePx` bildepiksler fra det?
 * Slingringsmonnet gjør at små land (Malta, Luxembourg, øystater) kan treffes med et kryss.
 */
export function hitsCountry(
  region: Region,
  code: CountryCode,
  p: XY,
  tolerancePx: number,
): boolean {
  const d = decode(region);
  const id = d.idOf.get(code);
  if (!id) {
    return false;
  }
  const cx = Math.floor(p.x / d.cell);
  const cy = Math.floor(p.y / d.cell);
  const r = Math.ceil(tolerancePx / d.cell);
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= d.cols || y >= d.rows) {
        continue;
      }
      const dx = (x + 0.5) * d.cell - p.x;
      const dy = (y + 0.5) * d.cell - p.y;
      // Rutas nærmeste punkt kan ligge en halv rute nærmere enn midten.
      if (
        Math.hypot(dx, dy) <= tolerancePx + d.cell * 0.71 &&
        d.grid[y * d.cols + x] === id
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Et punkt godt inne i landet (bildepiksler), for fasitmerket. */
export function countryLabel(region: Region, code: CountryCode): XY | null {
  return decode(region).labels.get(code) ?? null;
}
