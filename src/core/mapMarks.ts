/**
 * From pen strokes on the map to marks, and from marks to capitals.
 *
 * The user marks the cities in the same order as the list. The strokes come in
 * drawing order (`numInPage` increases for each new stroke). A mark is
 * - one stroke (dot, ring, small cross drawn in one go), or
 * - two straight strokes that cross each other (an ordinary cross), or
 * - a ring with a dot inside.
 * Anything else is one mark per stroke. The rules are deliberately strict, so two marks
 * that lie close together (Rome and Vatican City) are not merged by mistake.
 */
import type {Point} from './marks';

export interface MapMark {
  /** The indices of the strokes the mark consists of. */
  strokes: number[];
  /** The place the mark points to: the crossing point for a cross, otherwise the center. */
  center: Point;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boxOf(points: Point[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {minX, minY, maxX, maxY};
}

function boxCenter(b: Box): Point {
  return {x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2};
}

function boxSize(b: Box): number {
  return Math.max(b.maxX - b.minX, b.maxY - b.minY);
}

function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
  }
  return len;
}

/** A roughly straight stroke: the distance between the ends is almost as long as the line. */
export function isStraight(points: Point[]): boolean {
  if (points.length < 2) {
    return false;
  }
  const a = points[0];
  const b = points[points.length - 1];
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  const len = pathLength(points);
  return chord > 0 && chord / len >= 0.85;
}

/**
 * The intersection of two line segments, where each segment is extended by
 * `extend` (fraction of the length) at both ends. Null if they don't cross.
 */
export function segmentIntersection(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
  extend = 0.2,
): Point | null {
  const rx = a2.x - a1.x;
  const ry = a2.y - a1.y;
  const sx = b2.x - b1.x;
  const sy = b2.y - b1.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) {
    return null;
  }
  const qx = b1.x - a1.x;
  const qy = b1.y - a1.y;
  const t = (qx * sy - qy * sx) / denom;
  const u = (qx * ry - qy * rx) / denom;
  if (t < -extend || t > 1 + extend || u < -extend || u > 1 + extend) {
    return null;
  }
  return {x: a1.x + t * rx, y: a1.y + t * ry};
}

/** The crossing point if two strokes form a cross, otherwise null. */
function crossCenter(a: Point[], b: Point[]): Point | null {
  if (!isStraight(a) || !isStraight(b)) {
    return null;
  }
  const la = pathLength(a);
  const lb = pathLength(b);
  if (Math.max(la, lb) > 3 * Math.min(la, lb)) {
    return null;
  }
  const p = segmentIntersection(a[0], a[a.length - 1], b[0], b[b.length - 1]);
  if (!p) {
    return null;
  }
  // The lines must be slanted against each other, not nearly parallel.
  const ax = a[a.length - 1].x - a[0].x;
  const ay = a[a.length - 1].y - a[0].y;
  const bx = b[b.length - 1].x - b[0].x;
  const by = b[b.length - 1].y - b[0].y;
  const sin =
    Math.abs(ax * by - ay * bx) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
  return sin >= 0.5 ? p : null;
}

/** A small dot inside a ring: the ring's box contains the dot, and the dot is much smaller. */
function dotInRing(ring: Point[], dot: Point[]): Point | null {
  if (isStraight(ring)) {
    return null;
  }
  const r = boxOf(ring);
  const d = boxOf(dot);
  const c = boxCenter(d);
  const inside = c.x > r.minX && c.x < r.maxX && c.y > r.minY && c.y < r.maxY;
  return inside && boxSize(d) <= 0.4 * boxSize(r) ? c : null;
}

/**
 * Groups strokes (in drawing order) into marks. Empty strokes are skipped.
 */
export function groupMarks(strokes: Point[][]): MapMark[] {
  const marks: MapMark[] = [];
  strokes.forEach((s, i) => {
    if (!s.length) {
      return;
    }
    const prev = marks[marks.length - 1];
    if (prev && prev.strokes.length === 1) {
      const first = strokes[prev.strokes[0]];
      const center = crossCenter(first, s) ?? dotInRing(first, s);
      if (center) {
        prev.strokes.push(i);
        prev.center = center;
        return;
      }
    }
    marks.push({strokes: [i], center: boxCenter(boxOf(s))});
  });
  return marks;
}

export type Assignment =
  | {kind: 'mark'; mark: number}
  | {kind: 'skipped'}
  | {kind: 'missing'};

/** What it costs to leave a mark unused (assumed extra stroke), in lost points. */
export const UNUSED_MARK_COST = 250;
/** What it costs to leave a city unmarked: all the points for it. */
export const UNMARKED_ENTRY_COST = 1000;

export interface MarkAlignment {
  byEntry: Assignment[];
  /** Marks that were not matched to any city (assumed extra strokes). */
  unused: number[];
}

/**
 * Matches the marks (in drawing order) to the cities in the list (in list order),
 * skipping those that are crossed out.
 *
 * The order is kept, but the matching is "smart": like a diff, it finds the
 * alignment with the lowest total cost, where
 * - a mark matched to a city costs `cost(mark, city)` (lost points, 0–1000),
 * - an unused mark costs `UNUSED_MARK_COST`,
 * - a city without a mark costs `UNMARKED_ENTRY_COST`.
 * An extra stroke in the middle thus doesn't shift the rest: it is cheaper to
 * discard it than to match all later marks to the wrong city. A mark that misses
 * badly is still matched to its city, because "unused + unmarked" costs more
 * than a miss. Without `cost` the matching is pure order, and surplus marks
 * at the end stay unused.
 */
export function assignMarks(
  markCount: number,
  skipped: boolean[],
  cost: (mark: number, entry: number) => number = () => 0,
): MarkAlignment {
  const active = skipped.flatMap((skip, k) => (skip ? [] : [k]));
  const n = markCount;
  const m = active.length;
  // E[i][j] = lowest cost for marks i.. and cities j.. (computed from the back, so
  // the reconstruction from the front can prefer early matchings on ties).
  const E: number[][] = Array.from({length: n + 1}, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n; i >= 0; i--) {
    for (let j = m; j >= 0; j--) {
      if (i === n && j === m) {
        continue;
      }
      let best = Infinity;
      if (i < n && j < m) {
        best = Math.min(best, cost(i, active[j]) + E[i + 1][j + 1]);
      }
      if (i < n) {
        best = Math.min(best, UNUSED_MARK_COST + E[i + 1][j]);
      }
      if (j < m) {
        best = Math.min(best, UNMARKED_ENTRY_COST + E[i][j + 1]);
      }
      E[i][j] = best;
    }
  }

  const byEntry: Assignment[] = skipped.map(skip =>
    skip ? {kind: 'skipped'} : {kind: 'missing'},
  );
  const unused: number[] = [];
  const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && same(E[i][j], cost(i, active[j]) + E[i + 1][j + 1])) {
      byEntry[active[j]] = {kind: 'mark', mark: i};
      i++;
      j++;
    } else if (i < n && same(E[i][j], UNUSED_MARK_COST + E[i + 1][j])) {
      unused.push(i);
      i++;
    } else {
      j++;
    }
  }
  return {byEntry, unused};
}
