/**
 * «Håndtegnede» rettemerker: svart hake (riktig), grå hake med spørsmålstegn (nesten) og kryss (feil).
 *
 * Hvert merke er en eller flere streker (polylinjer) i sidekoordinater. De tegnes som
 * geometri på siden, ikke som tekst/emoji. Små, faste avvik i vinkler og en svak bue
 * gjør at merkene ser håndtegnet ut, men er like fra gang til gang (styrt av `seed`).
 */
import type {Rect} from './layout';

export type MarkKind = 'check' | 'cross' | 'almost';

export interface Point {
  x: number;
  y: number;
}

/** Deterministisk «tilfeldig» tall i [-1, 1] ut fra seed og indeks. */
function wobble(seed: number, i: number): number {
  const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

/** Punkter langs en kvadratisk bue fra a til b, bøyd med `bend` (andel av lengden). */
function curve(a: Point, b: Point, bend: number, steps = 6): Point[] {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Kontrollpunkt vinkelrett på linja.
  const c = {x: mx - dy * bend, y: my + dx * bend};
  const out: Point[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const u = 1 - t;
    out.push({x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y});
  }
  return out;
}

/** Fra enhetskoordinater (0–1) i en boks til sidekoordinater. */
function inBox(box: Rect, ux: number, uy: number): Point {
  return {x: box.left + ux * (box.right - box.left), y: box.top + uy * (box.bottom - box.top)};
}

function checkStroke(box: Rect, seed: number): Point[] {
  const j = (i: number) => wobble(seed, i) * 0.04;
  const start = inBox(box, 0.08 + j(1), 0.5 + j(2));
  const corner = inBox(box, 0.36 + j(3), 0.88 + j(4));
  const end = inBox(box, 0.94 + j(5), 0.06 + j(6));
  // Kort nedstrek, så en lengre, litt buet oppstrek.
  return [...curve(start, corner, 0.05, 3), ...curve(corner, end, -0.08 + j(7), 6).slice(1)];
}

function crossStrokes(box: Rect, seed: number): Point[][] {
  const j = (i: number) => wobble(seed, i) * 0.05;
  return [
    curve(inBox(box, 0.12 + j(1), 0.1 + j(2)), inBox(box, 0.88 + j(3), 0.9 + j(4)), 0.05 + j(5)),
    curve(inBox(box, 0.86 + j(6), 0.12 + j(7)), inBox(box, 0.14 + j(8), 0.88 + j(9)), -0.04 + j(10)),
  ];
}

/** Spørsmålstegn: en bue som går over i en kort loddrett strek, og en prikk under. */
function questionStrokes(box: Rect, seed: number): Point[][] {
  const j = (i: number) => wobble(seed, 20 + i) * 0.03;
  const hook: Point[] = [];
  const steps = 9;
  // Halvsirkel fra venstre, over toppen og ned på høyre side.
  for (let s = 0; s <= steps; s++) {
    const a = Math.PI * (1.05 - (1.45 * s) / steps);
    hook.push(inBox(box, 0.5 + Math.cos(a) * 0.3 + j(s % 3), 0.28 - Math.sin(a) * 0.2));
  }
  // Ned mot midten og en kort strek nedover.
  hook.push(inBox(box, 0.52 + j(4), 0.56));
  hook.push(inBox(box, 0.5 + j(5), 0.7));
  const dot = [inBox(box, 0.49, 0.86), inBox(box, 0.51 + j(6), 0.9)];
  return [hook, dot];
}

/** Bredde på merket i forhold til høyden: «nesten» har spørsmålstegnet ved siden av haken. */
export function markAspect(kind: MarkKind): number {
  return kind === 'almost' ? 1.6 : 1;
}

/**
 * Strekene for et merke som skal få plass i `box`.
 * Boksen bør ha forholdet `markAspect(kind)` mellom bredde og høyde.
 */
export function markStrokes(kind: MarkKind, box: Rect, seed = 0): Point[][] {
  if (kind === 'cross') {
    return crossStrokes(box, seed);
  }
  if (kind === 'check') {
    return [checkStroke(box, seed)];
  }
  const h = box.bottom - box.top;
  const checkBox = {left: box.left, top: box.top, right: box.left + h, bottom: box.bottom};
  const qBox = {left: box.left + h * 0.95, top: box.top, right: box.left + h * 1.6, bottom: box.bottom};
  return [checkStroke(checkBox, seed), ...questionStrokes(qBox, seed)];
}

/** Pennfarger på Supernote: 0 = svart, 0x9d = mørk grå, 0xc9 = lys grå. */
export const MARK_COLOR_BLACK = 0;
export const MARK_COLOR_GRAY = 0x9d;

/** «Nesten» (hake + spørsmålstegn) tegnes i grått, så den skiller seg fra en helt riktig, svart hake. */
export function markColor(kind: MarkKind): number {
  return kind === 'almost' ? MARK_COLOR_GRAY : MARK_COLOR_BLACK;
}

/**
 * En åpen strek som polygon: frem langs punktene og tilbake igjen, slik at
 * polygonet ikke får en lukkende linje fra siste til første punkt.
 */
export function strokeAsPolygon(points: Point[]): Point[] {
  const r = (p: Point) => ({x: Math.round(p.x), y: Math.round(p.y)});
  const there = points.map(r);
  return [...there, ...there.slice(0, -1).reverse()];
}

/**
 * Deler en resultatcelle i merke (til venstre, loddrett midtstilt) og tekst (resten).
 */
export function markLayout(cell: Rect, kind: MarkKind): {mark: Rect; text: Rect} {
  const cellH = cell.bottom - cell.top;
  const h = Math.round(cellH * 0.7);
  const w = Math.round(h * markAspect(kind));
  const top = Math.round(cell.top + (cellH - h) / 2);
  const mark = {left: cell.left + 4, top, right: cell.left + 4 + w, bottom: top + h};
  const gap = Math.round(h * 0.25);
  return {mark, text: {...cell, left: Math.min(mark.right + gap, cell.right - 1)}};
}

/** Er et punkt innenfor området (med kantene som grense)? */
export function inside(p: Point, r: Rect): boolean {
  return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
}
