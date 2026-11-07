import type {Rect} from './layout';

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boxOf(points: Array<{x: number; y: number}>): Box | null {
  if (!points.length) {return null;}
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) {minX = p.x;}
    if (p.y < minY) {minY = p.y;}
    if (p.x > maxX) {maxX = p.x;}
    if (p.y > maxY) {maxY = p.y;}
  }
  return {minX, minY, maxX, maxY};
}

/**
 * Fordeler strøk på rader ut fra strøkets midtpunkt.
 * Bare strøk med midtpunkt i svarkolonnen telles med; kladd andre steder ignoreres.
 * Returnerer for hver rad indeksene til strøkene som hører til den.
 */
export function assignToRows(
  boxes: Array<Box | null>,
  rows: Array<{answer: Rect; band: {top: number; bottom: number}}>,
  answerColumn: {left: number; right: number},
): number[][] {
  const result: number[][] = rows.map(() => []);
  boxes.forEach((b, i) => {
    if (!b) {return;}
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    if (cx < answerColumn.left || cx > answerColumn.right) {return;}
    const row = rows.findIndex(r => cy >= r.band.top && cy < r.band.bottom);
    if (row >= 0) {result[row].push(i);}
  });
  return result;
}

/** Finner raden hvis landcelle ligger nærmest tekstboksens midtpunkt. */
export function nearestRow(rect: Rect, rows: Array<{country: Rect}>): number {
  const cy = (rect.top + rect.bottom) / 2;
  let best = -1;
  let bestD = Infinity;
  rows.forEach((r, i) => {
    const d = Math.abs((r.country.top + r.country.bottom) / 2 - cy);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}
