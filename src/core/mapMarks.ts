/**
 * Fra pennestrøk på kartet til merker, og fra merker til hovedsteder.
 *
 * Brukeren merker byene i samme rekkefølge som lista. Strøkene kommer i
 * tegnerekkefølge (`numInPage` øker for hvert nytt strøk). Ett merke er
 * - ett strøk (prikk, ring, lite kryss tegnet i ett), eller
 * - to rette strøk som krysser hverandre (et vanlig kryss), eller
 * - en ring med en prikk inni.
 * Alt annet er ett merke per strøk. Reglene er bevisst strenge, så to merker
 * som ligger tett (Roma og Vatikanstaten) ikke slås sammen ved en feil.
 */
import type {Point} from './marks';

export interface MapMark {
  /** Indeksene til strøkene merket består av. */
  strokes: number[];
  /** Stedet merket peker på: krysningspunktet for et kryss, ellers midten. */
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

/** Et omtrent rett strøk: avstanden mellom endene er nesten like lang som streken. */
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
 * Skjæringspunktet mellom to linjestykker, der hvert stykke er forlenget med
 * `extend` (andel av lengden) i begge ender. Null hvis de ikke krysser.
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

/** Krysningspunktet hvis to strøk danner et kryss, ellers null. */
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
  // Strekene må stå på skrå mot hverandre, ikke nesten parallelt.
  const ax = a[a.length - 1].x - a[0].x;
  const ay = a[a.length - 1].y - a[0].y;
  const bx = b[b.length - 1].x - b[0].x;
  const by = b[b.length - 1].y - b[0].y;
  const sin =
    Math.abs(ax * by - ay * bx) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
  return sin >= 0.5 ? p : null;
}

/** En liten prikk inni en ring: ringens boks rommer prikken, og prikken er mye mindre. */
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
 * Samler strøk (i tegnerekkefølge) til merker. Tomme strøk hoppes over.
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

/** Hva det koster å la et merke stå ubrukt (antatt ekstra strek), i tapte poeng. */
export const UNUSED_MARK_COST = 250;
/** Hva det koster å la en by stå umerket: alle poengene for den. */
export const UNMARKED_ENTRY_COST = 1000;

export interface MarkAlignment {
  byEntry: Assignment[];
  /** Merker som ikke ble koblet til noen by (antatt ekstra streker). */
  unused: number[];
}

/**
 * Kobler merkene (i tegnerekkefølge) til byene i lista (i listerekkefølge),
 * hoppet over de som er strøket ut.
 *
 * Rekkefølgen beholdes, men koblingen er «smart»: som en diff finner den
 * justeringen med lavest samlet kostnad, der
 * - et merke koblet til en by koster `cost(merke, by)` (tapte poeng, 0–1000),
 * - et merke som står ubrukt koster `UNUSED_MARK_COST`,
 * - en by uten merke koster `UNMARKED_ENTRY_COST`.
 * En ekstra strek midt i forskyver dermed ikke resten: det er billigere å
 * forkaste den enn å koble alle senere merker til feil by. Et merke som bommer
 * kraftig, blir likevel koblet til sin by, fordi «ubrukt + umerket» koster mer
 * enn et bom. Uten `cost` blir koblingen ren rekkefølge, og overskytende merker
 * på slutten står ubrukt.
 */
export function assignMarks(
  markCount: number,
  skipped: boolean[],
  cost: (mark: number, entry: number) => number = () => 0,
): MarkAlignment {
  const active = skipped.flatMap((skip, k) => (skip ? [] : [k]));
  const n = markCount;
  const m = active.length;
  // E[i][j] = lavest kostnad for merkene i.. og byene j.. (regnet bakfra, så
  // gjenoppbyggingen forfra kan foretrekke tidlige koblinger ved likhet).
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
