/**
 * Text for label mode ("write the names on the map"). Prototype: Norwegian and English are
 * written by hand, the other languages use English for now. Label sheets are recognized by
 * the key at the bottom (core/labelSheet.ts), not by the title, so the text can be translated later.
 */
import type {Language} from './types';

export interface LabelTexts {
  /** Start of the title on the sheet. */
  titlePrefix: string;
  /** Instructions below the title, two lines separated by \n. */
  subtitle: string;
  /** The same for the numbered sheet on small pages. */
  subtitleNumbered: string;
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
    'Skriv navnet på landet i boksen streken går til.\n' + 'Rett siden fra World Capitals Quiz-menyen.',
  subtitleNumbered:
    'Skriv navnet på landet med samme nummer på lista under kartet.\n' + 'Rett siden fra World Capitals Quiz-menyen.',
  ui: {
    mode: 'Navn på kart',
    hint: 'Skriv navnene på landene som er merket på kartet.',
    made: count => `Laget kart med ${count} land.`,
    result: (correct, total, percent) => `Du plasserte ${correct} av ${total} land (${percent} %).`,
  },
};

const en: OwnTexts = {
  titlePrefix: 'Name the countries',
  subtitle: 'Write the name of the country in the box the line leads to.\nGrade the page from the World Capitals Quiz menu.',
  subtitleNumbered:
    'Write the name of each numbered country on the line with the same number below the map.\nGrade the page from the World Capitals Quiz menu.',
  ui: {
    mode: 'Label map',
    hint: 'Write the names of the countries marked on the map.',
    made: count => `Made a map with ${count} countries.`,
    result: (correct, total, percent) => `You placed ${correct} of ${total} countries (${percent} %).`,
  },
};

const cache = new Map<string, LabelTexts>();

export function labelTexts(lang: Language): LabelTexts {
  let t = cache.get(lang.code);
  if (!t) {
    const own = lang.code === 'nb' ? nb : en;
    // The score is the same as on the table sheet, so it is recognized and removed in the same way.
    t = {...own, scorePrefix: lang.sheet.scorePrefix, score: lang.sheet.score};
    cache.set(lang.code, t);
  }
  return t;
}
