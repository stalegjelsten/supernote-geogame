/**
 * Building block for languages where only the sheet is translated. The menu, progress
 * and error messages come from English until they are translated.
 *
 * Page numbers are written language-neutrally as " · 2/3", and the score as "Punkte: 12/20".
 */
import en from './en';
import type {CountryNames, Language} from './types';
import type {Continent} from '../data/countries';

export interface SheetLanguageDef {
  code: string;
  label: string;
  locales: string[];
  countries: CountryNames;
  continents: Record<Continent, string>;
  world: string;
  titlePrefix: string;
  subtitle: string;
  colCountry: string;
  colAnswer: string;
  colResult: string;
  /** "Score" without the colon. */
  scoreWord: string;
  /** "read", used as "(read: “Oslo”)". */
  readWord: string;
  ui?: Partial<Language['ui']>;
  progress?: Partial<Language['progress']>;
  errors?: Partial<Language['errors']>;
}

export const NEUTRAL_PART_PATTERN = /·\s*(\d+)\/(\d+)\s*$/;

export function sheetLanguage(d: SheetLanguageDef): Language {
  const scorePrefix = `${d.scoreWord}:`;
  return {
    code: d.code,
    label: d.label,
    locales: d.locales,
    countries: d.countries,
    continents: d.continents,
    world: d.world,
    sheet: {
      titlePrefix: d.titlePrefix,
      partSuffix: (part, parts) => ` · ${part}/${parts}`,
      partPattern: NEUTRAL_PART_PATTERN,
      subtitle: d.subtitle,
      colCountry: d.colCountry,
      colAnswer: d.colAnswer,
      colResult: d.colResult,
      scorePrefix,
      score: (points, total) => `${scorePrefix} ${points}/${total}`,
      read: text => `(${d.readWord}: “${text}”)`,
    },
    ui: {...en.ui, ...d.ui},
    progress: {...en.progress, ...d.progress},
    errors: {...en.errors, ...d.errors},
  };
}
