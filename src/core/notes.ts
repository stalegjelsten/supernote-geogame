/**
 * Fotnoter om hovedsteder på tabellarket: et lite tall i resultatcellen og
 * merknaden nederst på siden, til venstre for (eller under) poengsummen.
 *
 * Plassen er knapp på en full side, så merknadene krympes ned til `minFont`.
 * Får de fortsatt ikke plass, droppes merknader fra bunnen av arket, først for
 * land som ble besvart riktig.
 */
import {LINE_HEIGHT, fitFontSize, type Rect} from './layout';

const SUPERSCRIPT = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

/** 12 → «¹²» */
export function noteMarker(n: number): string {
  return String(n)
    .split('')
    .map(d => SUPERSCRIPT[Number(d)])
    .join('');
}

/** Fotnoteteksten starter med et hevet tall; brukes til å fjerne den ved ny retting. */
export function isNotesText(text: string): boolean {
  return SUPERSCRIPT.includes(text.trimStart().charAt(0));
}

export interface NoteItem {
  row: number;
  text: string;
  /** Svaret var ikke riktig; disse merknadene beholdes lengst. */
  important: boolean;
}

export interface NotesPlan {
  /** Radene som får fotnote, med tallet som skal stå i resultatcellen. */
  markers: Map<number, string>;
  text: string;
  rect: Rect;
  fontSize: number;
}

function linesFor(items: NoteItem[]): string[] {
  return items.map((it, i) => `${noteMarker(i + 1)} ${it.text}`);
}

export function planNotes(items: NoteItem[], area: Rect, maxFont: number, minFont: number): NotesPlan | null {
  if (area.right - area.left <= 0 || area.bottom - area.top <= 0) {
    return null;
  }
  let shown = [...items].sort((a, b) => a.row - b.row);
  while (shown.length) {
    const text = linesFor(shown).join('\n');
    const fontSize = fitFontSize(text, area, maxFont);
    if (fontSize >= minFont) {
      const h = Math.ceil(shown.length * fontSize * LINE_HEIGHT);
      return {
        markers: new Map(shown.map((it, i) => [it.row, noteMarker(i + 1)])),
        text,
        rect: {...area, bottom: Math.min(area.bottom, area.top + h)},
        fontSize,
      };
    }
    // Dropp den nederste merknaden for et riktig svar, ellers den nederste av alle.
    let drop = -1;
    for (let i = shown.length - 1; i >= 0; i--) {
      if (!shown[i].important) {
        drop = i;
        break;
      }
    }
    shown = shown.filter((_, i) => i !== (drop >= 0 ? drop : shown.length - 1));
  }
  return null;
}
