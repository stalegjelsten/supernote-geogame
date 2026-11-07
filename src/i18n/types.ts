/**
 * Shared shape for all languages. A new language is added by creating `<code>.ts`
 * and `countries/<code>.ts` with this type, and listing it in `index.ts`.
 */
import type {Continent, CountryCode} from '../data/countries';
import type {MenuStrings} from './menu/types';

/** [country, capital, alternative answers that are also accepted] */
export type CountryEntry = readonly [name: string, capital: string, alternatives?: readonly string[]];

/** Every country must have a name in each language; TypeScript complains if one is missing. */
export type CountryNames = Record<CountryCode, CountryEntry>;

export interface Language {
  /** Language code, e.g. 'nb' or 'en'. */
  code: string;
  /** The language's name, written in the language itself (shown in the language picker). */
  label: string;
  /** Device language codes that should map to this language, e.g. ['nb', 'no', 'nn']. */
  locales: string[];

  /** Translated menu texts for languages not written by hand (see menu/types.ts). */
  menu?: MenuStrings;

  countries: CountryNames;
  continents: Record<Continent, string>;
  world: string;

  /** Text written on the sheet. */
  sheet: {
    /** The title starts with this; used to recognize the sheet and its language. */
    titlePrefix: string;
    /** " · page 2 of 3" */
    partSuffix: (part: number, parts: number) => string;
    /** Reads [part, parts] from the end of the title. */
    partPattern: RegExp;
    subtitle: string;
    colCountry: string;
    colAnswer: string;
    colResult: string;
    /** Start of the score text at the bottom, e.g. "Score:". */
    scorePrefix: string;
    score: (points: number, total: number) => string;
    /** What recognition read, below a wrong answer. */
    read: (text: string) => string;
    /** Older texts in the result column that should also be removed when regrading. */
    legacyResultPrefixes?: string[];
  };

  /** Menu text. */
  ui: {
    title: string;
    newSheet: string;
    region: string;
    count: string;
    all: (n: number) => string;
    spread: (countries: number, pages: number) => string;
    make: string;
    pageHasContent: (elements: number) => string;
    makeOnNewPage: string;
    putOnThisPage: string;
    cancel: string;
    doneWriting: string;
    gradePage: string;
    gradeSet: string;
    showSheet: string;
    somethingWrong: (message: string) => string;
    language: string;
    automatic: (label: string) => string;
    allLanguages: (n: number) => string;
    fewerLanguages: string;
    checkingPage: string;
    startingGrading: string;
    made: (countries: number, pages: number) => string;
    result: (points: number, total: number, percent: number) => string;
    pageScore: (part: number, points: number, total: number) => string;
    gradedIn: (seconds: string) => string;
  };

  /** Progress messages while the sheet is created or graded. */
  progress: {
    newPages: (n: number) => string;
    drawing: string;
    drawingPage: (k: number, n: number) => string;
    readingPage: string;
    pagePrefix: (k: number, n: number) => string;
    findingInk: string;
    readingInk: string;
    rereadingRow: (row: number) => string;
    writingResults: string;
  };

  errors: {
    noSheet: string;
    noCountries: string;
    openNote: string;
    failed: (what: string) => string;
    newPageTemplates: (details: string) => string;
    newPageNoTemplates: string;
    permission: string;
  };
}
