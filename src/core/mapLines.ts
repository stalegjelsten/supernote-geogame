/**
 * Lookup in the line grid (src/data/mapLines.ts): does a border, a coast or the frame run
 * through a part of the map image? Used to keep the numbers on label sheets clear of lines.
 */
import {MAP_LINES} from '../data/mapLines';
import type {Region} from './sheet';

const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const cache = new Map<Region, Uint8Array>();

function grid(region: Region): Uint8Array {
  let g = cache.get(region);
  if (!g) {
    const src = MAP_LINES[region];
    g = new Uint8Array(src.cols * src.rows);
    let pos = 0;
    let value = 0;
    for (let k = 0; k < src.runs.length; k += 2) {
      const len = B62.indexOf(src.runs[k]) * 62 + B62.indexOf(src.runs[k + 1]);
      g.fill(value, pos, pos + len);
      pos += len;
      value = 1 - value;
    }
    if (pos !== g.length) {
      throw new Error(
        `The line grid for ${region} is broken (${pos} of ${g.length} cells)`,
      );
    }
    cache.set(region, g);
  }
  return g;
}

/** Does any line run through the rectangle (in map image pixels)? Outside the image counts as a line. */
export function hasLines(
  region: Region,
  rect: {left: number; top: number; right: number; bottom: number},
): boolean {
  const {cell, cols, rows} = MAP_LINES[region];
  const g = grid(region);
  const x0 = Math.floor(rect.left / cell);
  const x1 = Math.floor(rect.right / cell);
  const y0 = Math.floor(rect.top / cell);
  const y1 = Math.floor(rect.bottom / cell);
  if (x0 < 0 || y0 < 0 || x1 >= cols || y1 >= rows) {
    return true;
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (g[y * cols + x]) {
        return true;
      }
    }
  }
  return false;
}
