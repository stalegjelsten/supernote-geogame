/**
 * Statistikken slik menyen viser den: oppsummering per verdensdel og de
 * svakeste landene, med navn på menyspråket.
 */
import {CONTINENT_OF, CONTINENTS, COUNTRY_CODES, type CountryCode} from '../data/countries';
import type {Language} from '../i18n';
import {countryIn} from './countries';
import type {Region} from './sheet';
import {computeStats, sessions, summarize, weakest, type SessionSummary, type SheetRecord, type Skill, type Summary} from './stats';

export interface WeakCountry {
  code: CountryCode;
  name: string;
  /** Det som skulle svares: hovedstaden (eller landet, for landkartet). */
  answer: string;
  /** Mastery i prosent. */
  percent: number;
  attempts: number;
}

export interface StatsReport {
  skill: Skill;
  sessions: SessionSummary;
  regions: Array<{region: Region; summary: Summary}>;
  /** Oppsummering for regionen som er valgt i menyen. */
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
