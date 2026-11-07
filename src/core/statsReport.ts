/**
 * The statistics as the menu shows them: summary per continent and the
 * weakest countries, with names in the menu language.
 */
import {CONTINENT_OF, CONTINENTS, COUNTRY_CODES, type CountryCode} from '../data/countries';
import type {Language} from '../i18n';
import {countryIn} from './countries';
import type {Region} from './sheet';
import {computeStats, sessions, summarize, weakest, type SessionSummary, type SheetRecord, type Skill, type Summary} from './stats';

export interface WeakCountry {
  code: CountryCode;
  name: string;
  /** What was to be answered: the capital (or the country, for the country map). */
  answer: string;
  /** Mastery in percent. */
  percent: number;
  attempts: number;
}

export interface StatsReport {
  skill: Skill;
  sessions: SessionSummary;
  regions: Array<{region: Region; summary: Summary}>;
  /** Summary for the region selected in the menu. */
  focus: {region: Region; summary: Summary};
  weakest: WeakCountry[];
}

export function codesIn(region: Region): CountryCode[] {
  return COUNTRY_CODES.filter(c => region === 'ALL' || CONTINENT_OF[c] === region);
}

export function statsReport(
  records: readonly SheetRecord[],
  skill: Skill,
  lang: Language,
  focus: Region,
  now: number,
  weakLimit = 5,
): StatsReport {
  const stats = computeStats(records, skill);
  const regions = [...CONTINENTS, 'ALL' as const].map(region => ({region, summary: summarize(stats, codesIn(region), now)}));
  return {
    skill,
    sessions: sessions(records, skill),
    regions,
    focus: regions.find(r => r.region === focus)!,
    weakest: weakest(stats, codesIn(focus), weakLimit).map(s => {
      const c = countryIn(lang, s.code);
      return {
        code: s.code,
        name: c.name,
        answer: skill === 'mapCountry' ? c.name : c.capital,
        percent: Math.round(100 * s.mastery),
        attempts: s.attempts,
      };
    }),
  };
}
