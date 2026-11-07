/**
 * Compact text encoding of the country outlines (src/data/outlines.ts).
 *
 * Each ring is a list of integer points; the first point is stored as is and the rest as
 * differences from the previous point. Every number is zigzag-encoded (so negative numbers
 * become positive) and written as base-32 digits with a continuation flag, six bits per
 * character from a 64-character alphabet. Rings are separated by a space.
 */

/** The largest side of each outline, in grid units. */
export const OUTLINE_GRID = 1000;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const VALUE = new Map([...ALPHABET].map((ch, i) => [ch, i]));

function encodeNumber(n: number): string {
  // Zigzag: 0, -1, 1, -2, 2 … → 0, 1, 2, 3, 4 …
  let v = n < 0 ? -2 * n - 1 : 2 * n;
  let out = '';
  do {
    const digit = v % 32;
    v = Math.floor(v / 32);
    out += ALPHABET[digit + (v > 0 ? 32 : 0)];
  } while (v > 0);
  return out;
}

export function encodeRings(rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>): string {
  return rings
    .map(ring => {
      let px = 0;
      let py = 0;
      let s = '';
      for (const [x, y] of ring) {
        s += encodeNumber(x - px) + encodeNumber(y - py);
        px = x;
        py = y;
      }
      return s;
    })
    .join(' ');
}

export function decodeRings(text: string): Array<Array<[number, number]>> {
  return text.split(' ').map(part => {
    const nums: number[] = [];
    let v = 0;
    let mul = 1;
    for (const ch of part) {
      const d = VALUE.get(ch);
      if (d === undefined) {
        throw new Error(`Bad outline character «${ch}»`);
      }
      v += (d % 32) * mul;
      if (d >= 32) {
        mul *= 32;
        continue;
      }
      nums.push(v % 2 ? -(v + 1) / 2 : v / 2);
      v = 0;
      mul = 1;
    }
    const ring: Array<[number, number]> = [];
    let x = 0;
    let y = 0;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      x += nums[i];
      y += nums[i + 1];
      ring.push([x, y]);
    }
    return ring;
  });
}
