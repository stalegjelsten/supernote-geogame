/**
 * A small hidden ID on each sheet, written when the sheet is made. The statistics use it to
 * tell a new grading of the same sheet (which replaces the old result) from a new sheet with
 * the same countries (which counts again). Without it, every sheet with all the countries of a
 * small region (South America, Oceania) got the same key, and only the last one counted.
 */
import type {Draft} from './draft';
import type {Size} from './layout';

export const SHEET_ID_PREFIX = 'ID s1.';
const ID_PATTERN = /^[0-9a-z]{4,16}$/;

/** Creation time in base 36 and two random characters: unique per sheet, and short. */
export function newSheetId(now: number = Date.now(), random: () => number = Math.random): string {
  const rand = Math.floor(random() * 36 * 36)
    .toString(36)
    .padStart(2, '0');
  return now.toString(36) + rand;
}

export const isSheetId = (id: string) => ID_PATTERN.test(id);

export function parseSheetId(text: string): string | null {
  const t = text.trim();
  if (!t.startsWith(SHEET_ID_PREFIX)) {
    return null;
  }
  const id = t.slice(SHEET_ID_PREFIX.length);
  return isSheetId(id) ? id : null;
}

/** The first sheet ID among the texts on a page, or null (sheets made before the ID existed). */
export function sheetIdIn(texts: Array<string | null | undefined>): string | null {
  for (const t of texts) {
    const id = t ? parseSheetId(t) : null;
    if (id) {
      return id;
    }
  }
  return null;
}

/** The ID in tiny print at the very bottom right, below the score and the footnotes. */
export function sheetIdDraft(size: Size, id: string): Draft {
  const {width: W, height: H} = size;
  const marginX = Math.max(W * 0.09, 150);
  return {
    kind: 'text',
    text: SHEET_ID_PREFIX + id,
    rect: {
      left: Math.round(W / 2),
      top: Math.round(H * 0.986),
      right: Math.round(W - marginX),
      bottom: Math.round(H * 0.999),
    },
    fontSize: 16,
    align: 2,
    locked: true,
  };
}
