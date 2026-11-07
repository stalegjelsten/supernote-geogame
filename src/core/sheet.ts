import {CONTINENT_OF, COUNTRY_CODES, type Continent, type CountryCode} from '../data/countries';
import {ENGLISH, LANGUAGES, type Language} from '../i18n';
import {countriesIn, type Country} from './countries';
import {fairDraw, familiarity, levelPool, type Level} from './fairDraw';
import type {MarkKind} from './marks';
import {matchAnswer, normalizeCached, type MatchResult} from './match';

/** Emojis from earlier versions; recognized and removed on re-correction. */
const LEGACY_MARKS = ['✅', '❌'];

/**
 * Everything starting like this counts as results and is removed on re-correction,
 * in all included languages and from older versions.
 */
export const RESULT_PREFIXES = [
  ...LEGACY_MARKS,
  ...LANGUAGES.flatMap(l => [l.sheet.scorePrefix, ...(l.sheet.legacyResultPrefixes ?? [])]),
];

export type Region = Continent | 'ALL';

export function regionName(region: Region, lang: Language): string {
  return region === 'ALL' ? lang.world : lang.continents[region];
}

/** At most this many countries per page; more than this is split across several pages. */
export const MAX_PER_PAGE = 20;

export function sheetTitle(lang: Language, region: Region, count: number, part = 1, parts = 1): string {
  const base = `${lang.sheet.titlePrefix} – ${regionName(region, lang)} (${count})`;
  return parts > 1 ? base + lang.sheet.partSuffix(part, parts) : base;
}

export interface SheetInfo {
  part: number;
  parts: number;
  /** Most likely language based on the heading alone. */
  lang: Language;
  /**
   * All languages the heading may be written in, best first. Several languages share a
   * heading (e.g. "Capitales" in French and Spanish, "首都" in Chinese and
   * Japanese); the language is then decided by the country names on the page.
   */
  candidates: Language[];
}

/** Recognizes a heading in one of the included languages and reads "page k of n". */
export function parseSheetTitle(title: string): SheetInfo | null {
  const scored = LANGUAGES.filter(l => title.startsWith(l.sheet.titlePrefix))
    .map(l => {
      const rest = title.slice(l.sheet.titlePrefix.length);
      const regions = [l.world, ...Object.values(l.continents)];
      const regionHit = regions.some(r => rest.startsWith(` – ${r} (`));
      return {l, score: (regionHit ? 1000 : 0) + l.sheet.titlePrefix.length};
    })
    .sort((a, b) => b.score - a.score);
  if (!scored.length) {
    return null;
  }
  const candidates = scored.map(x => x.l);
  const lang = candidates[0];
  const m = title.match(lang.sheet.partPattern);
  if (!m) {
    return {part: 1, parts: 1, lang, candidates};
  }
  const part = Number(m[1]);
  const parts = Number(m[2]);
  return part >= 1 && part <= parts ? {part, parts, lang, candidates} : null;
}

/** Distributes the countries evenly over as few pages as possible, with at most `max` per page. */
export function splitIntoPages<T>(items: T[], max = MAX_PER_PAGE): T[][] {
  if (!items.length) {
    return [];
  }
  const pages = Math.ceil(items.length / max);
  const out: T[][] = [];
  let start = 0;
  for (let i = 0; i < pages; i++) {
    // Distribute the remainder so the first pages get one extra.
    const size = Math.floor(items.length / pages) + (i < items.length % pages ? 1 : 0);
    out.push(items.slice(start, start + size));
    start += size;
  }
  return out;
}

/** Number of countries in a region. */
export function regionSize(region: Region): number {
  return COUNTRY_CODES.filter(c => region === 'ALL' || CONTINENT_OF[c] === region).length;
}

/** The order countries are drawn in; the first ones go on the sheet. See `orderForTraining` in training.ts. */
export type CountryOrder = (pool: Country[]) => Country[];

/** Random order (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Draws `count` countries from the region, randomly or in the order `order` gives
 * (a training mode). `random` can be swapped out in tests.
 */
export function pickCountries(
  lang: Language,
  region: Region,
  count: number,
  random: () => number = Math.random,
  order: CountryOrder = pool => shuffle(pool, random),
  level: Level = 'mixed',
): Country[] {
  // The level chooses which countries are included, `order` the order among them.
  const pool = levelPool(
    countriesIn(lang).filter(c => region === 'ALL' || c.continent === region),
    level,
    count,
    c => familiarity(c.code, 'capital'),
  );
  return order(pool).slice(0, Math.min(count, pool.length));
}

/**
 * Take turns: `count` countries distributed fairly across `players` players, in player order
 * (player 1, 2, …, 1, 2, …). See fairDraw.
 */
export function pickFairCountries(
  lang: Language,
  region: Region,
  count: number,
  players: number,
  random: () => number = Math.random,
  level: Level = 'mixed',
): Country[] {
  const score = (c: Country) => familiarity(c.code, 'capital');
  const pool = levelPool(
    countriesIn(lang).filter(c => region === 'ALL' || c.continent === region),
    level,
    count,
    score,
  );
  return fairDraw(pool, Math.floor(count / players), players, score, {random});
}

function answersIn(lang: Language, code: CountryCode): string[] {
  const [, capital, alternatives] = lang.countries[code];
  return [capital, ...(alternatives ?? [])];
}

/**
 * Answers accepted with some typos: the capital and the alternatives in the sheet's
 * language, and in English.
 */
export function acceptedAnswers(country: Country): string[] {
  const english = ENGLISH && ENGLISH.code !== country.lang ? answersIn(ENGLISH, country.code) : [];
  return [...new Set([country.capital, ...country.alternatives, ...english])];
}

let allAnswers: Map<CountryCode, string[]> | null = null;

/** The capital and the alternatives in all included languages. */
function answersAllLanguages(code: CountryCode): string[] {
  if (!allAnswers) {
    allAnswers = new Map(
      COUNTRY_CODES.map(c => [c, [...new Set(LANGUAGES.flatMap(l => answersIn(l, c)))]]),
    );
  }
  return allAnswers.get(code)!;
}

const rejectedCache = new Map<CountryCode, Set<string>>();

/**
 * Capitals of other countries, in all languages and normalized: if you write one of them
 * exactly, the answer is wrong. Answers that are also correct for this country are removed.
 */
function otherCapitals(country: Country): Set<string> {
  let set = rejectedCache.get(country.code);
  if (!set) {
    const own = new Set(answersAllLanguages(country.code).map(normalizeCached));
    set = new Set();
    for (const code of COUNTRY_CODES) {
      if (code !== country.code) {
        for (const a of answersAllLanguages(code)) {
          const n = normalizeCached(a);
          if (!own.has(n)) {
            set.add(n);
          }
        }
      }
    }
    rejectedCache.set(country.code, set);
  }
  return set;
}

/**
 * The correct capital in the sheet's language; the alternatives and English are accepted with some
 * typos. The capital in any other included language is accepted
 * when written correctly.
 */
export function gradeAnswer(country: Country, recognized: string): MatchResult {
  return matchAnswer(recognized, acceptedAnswers(country), otherCapitals(country), answersAllLanguages(country.code));
}

/** Which hand-drawn mark a row gets: black check, gray check with question mark (almost) or cross. */
export function resultMark(result: MatchResult): MarkKind {
  switch (result.verdict) {
    case 'correct':
      return 'check';
    case 'close':
      return 'almost';
    default:
      return 'cross';
  }
}

/**
 * The text next to the mark, in the sheet's language.
 * Correct: no text. Almost and blank: the correct spelling/answer key.
 * Wrong: the answer key, and what the recognition read on a separate line.
 */
export function resultText(country: Country, recognized: string, result: MatchResult, lang: Language): string {
  const read = recognized.trim().replace(/\s+/g, ' ');
  switch (result.verdict) {
    case 'correct':
      return '';
    case 'close':
    case 'blank':
      return country.capital;
    default:
      return `${country.capital}\n${lang.sheet.read(read)}`;
  }
}

export function isResultText(text: string): boolean {
  return RESULT_PREFIXES.some(p => text.startsWith(p));
}

/** "Almost" counts as correct in the total score. */
export function isPoint(result: MatchResult): boolean {
  return result.verdict === 'correct' || result.verdict === 'close';
}
