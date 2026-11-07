/**
 * Felles form for alle språk. Et nytt språk legges til ved å lage `<kode>.ts`
 * og `countries/<kode>.ts` med denne typen, og føre det opp i `index.ts`.
 */
import type {Continent, CountryCode} from '../data/countries';
import type {MenuStrings} from './menu/types';

/** [land, hovedstad, alternative svar som også godtas] */
export type CountryEntry = readonly [name: string, capital: string, alternatives?: readonly string[]];

/** Alle land må ha navn på hvert språk; TypeScript klager hvis ett mangler. */
export type CountryNames = Record<CountryCode, CountryEntry>;

export interface Language {
  /** Språkkode, f.eks. 'nb' eller 'en'. */
  code: string;
  /** Navnet på språket, skrevet på språket selv (vises i språkvalget). */
  label: string;
  /** Språkkoder fra enheten som skal gi dette språket, f.eks. ['nb', 'no', 'nn']. */
  locales: string[];

  /** Oversatte menytekster for språk som ikke er skrevet for hånd (se menu/types.ts). */
  menu?: MenuStrings;

  countries: CountryNames;
  continents: Record<Continent, string>;
  world: string;

  /** Tekst som skrives på arket. */
  sheet: {
    /** Overskriften starter med dette; brukes til å kjenne igjen arket og språket. */
    titlePrefix: string;
    /** « · side 2 av 3» */
    partSuffix: (part: number, parts: number) => string;
    /** Leser [part, parts] fra slutten av overskriften. */
    partPattern: RegExp;
    subtitle: string;
    colCountry: string;
    colAnswer: string;
    colResult: string;
    /** Starten på poengteksten nederst, f.eks. «Poeng:». */
    scorePrefix: string;
    score: (points: number, total: number) => string;
    /** Hva gjenkjenningen leste, under et feil svar. */
    read: (text: string) => string;
    /** Eldre tekster i resultatkolonnen som også skal fjernes ved ny retting. */
    legacyResultPrefixes?: string[];
  };

  /** Tekst i menyen. */
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

  /** Fremdriftsmeldinger mens arket lages eller rettes. */
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
