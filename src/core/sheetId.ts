/**
 * A small hidden ID on each sheet, written when the sheet is made. The statistics use it to
 * tell a new grading of the same sheet (which replaces the old result) from a new sheet with
 * the same countries (which counts again). Without it, every sheet with all the countries of a
 * small region (South America, Oceania) got the same key, and only the last one counted.
 *
 * The sheet's language goes after the ID ("ID s1.lx2k1a7q.sr-Latn"): the heading is the same in
 * some languages (Bosnian, Croatian and Serbian: "Glavni gradovi"), and the names on the sheet
 * don't always tell them apart.
 */
import {getLanguage, type Language} from '../i18n';
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

export interface SheetStamp {
  id: string;
  /** The language the sheet was made in, if it is one of the included languages. */
  lang?: Language;
}

export function parseSheetStamp(text: string): SheetStamp | null {
  const t = text.trim();
  if (!t.startsWith(SHEET_ID_PREFIX)) {
    return null;
  }
  const [id, code, ...rest] = t.slice(SHEET_ID_PREFIX.length).split('.');
  if (!isSheetId(id) || rest.length) {
    return null;
  }
  const lang = code ? getLanguage(code) : undefined;
  return lang ? {id, lang} : {id};
}

export const parseSheetId = (text: string) => parseSheetStamp(text)?.id ?? null;

/** The first sheet stamp among the texts on a page, or null (sheets made before the ID existed). */
export function sheetStampIn(texts: Array<string | null | undefined>): SheetStamp | null {
  for (const t of texts) {
    const stamp = t ? parseSheetStamp(t) : null;
    if (stamp) {
      return stamp;
    }
  }
  return null;
}

export const sheetIdIn = (texts: Array<string | null | undefined>) => sheetStampIn(texts)?.id ?? null;

/** The ID in tiny print at the very bottom right, below the score and the footnotes. */
export function sheetIdDraft(size: Size, id: string, lang?: Language): Draft {
  const {width: W, height: H} = size;
  const marginX = Math.max(W * 0.09, 150);
  return {
    kind: 'text',
    text: SHEET_ID_PREFIX + id + (lang ? `.${lang.code}` : ''),
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
