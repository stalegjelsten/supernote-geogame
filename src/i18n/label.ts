/**
 * Text for label mode ("write the names of the countries marked on the map"). Norwegian is
 * written by hand; the other languages get their text from menu/<code>.ts (English from
 * menu/en.ts). Label sheets are recognized by the key at the bottom (core/labelSheet.ts),
 * not by the title, so all the text on the sheet can be translated.
 */
import {fmt} from './menu/build';
import EN_MENU from './menu/en';
import type {MenuStrings} from './menu/types';
import type {Language} from './types';

export interface LabelTexts {
  /** Start of the title on the sheet. */
  titlePrefix: string;
  /** Instructions below the title, two lines separated by \n. */
  subtitle: string;
  /** Start of the score, e.g. "Poeng:"; used to remove it when regrading. */
  scorePrefix: string;
  score: (points: number, total: number) => string;
  ui: {
    mode: string;
    hint: string;
    made: (count: number) => string;
    result: (correct: number, total: number, percent: number) => string;
  };
}

type OwnTexts = Omit<LabelTexts, 'scorePrefix' | 'score'>;

const nb: OwnTexts = {
  titlePrefix: 'Navn på kartet',
  subtitle:
    'Skriv navnet på hvert nummererte land på linja med samme nummer.\n' +
    'Rett siden fra World Capitals Quiz-menyen.',
  ui: {
    mode: 'Navn på kart',
    hint: 'Skriv navnene på landene som er merket på kartet.',
    made: count => `Laget kart med ${count} land.`,
    result: (correct, total, percent) => `Du kjente igjen ${correct} av ${total} land (${percent} %).`,
  },
};

function fromMenu(m: MenuStrings): OwnTexts {
  return {
    titlePrefix: m.labelTitle,
    subtitle: m.labelSubtitle,
    ui: {
      mode: m.labelMode,
      hint: m.labelHint,
      made: count => fmt(m.labelMade, {count}),
      // The same result as on the outline sheet: how many countries you named.
      result: (correct, total, percent) => fmt(m.outlineResult, {correct, total, percent}),
    },
  };
}

const cache = new Map<string, LabelTexts>();

export function labelTexts(lang: Language): LabelTexts {
  let t = cache.get(lang.code);
  if (!t) {
    // English is in menu/en.ts as well; it is not passed as lang.menu, so it is read from there.
    const own: OwnTexts = lang.code === 'nb' ? nb : fromMenu(lang.menu ?? EN_MENU);
    // The score is the same as on the table sheet, so it is recognized and removed in the same way.
    t = {...own, scorePrefix: lang.sheet.scorePrefix, score: lang.sheet.score};
    cache.set(lang.code, t);
  }
  return t;
}
