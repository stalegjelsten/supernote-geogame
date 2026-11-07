/**
 * Menu text for the statistics. Norwegian and English are written by hand; the
 * other languages get English (like the map mode in map.ts).
 */
import type {Skill} from '../core/stats';
import type {Language} from './types';

export interface StatsTexts {
  section: string;
  show: string;
  hide: string;
  /** The skill the statistics apply to, by selected game. */
  skill: Record<Skill, string>;
  loading: string;
  none: string;
  sheets: (sheets: number, answers: number, percent: number) => string;
  /** "Europe: 12 known, 5 learning, 29 new" */
  region: (name: string, known: number, learning: number, fresh: number) => string;
  due: (n: number) => string;
  weakest: string;
  /** One country in the list of weak countries. */
  weakItem: (country: string, answer: string, percent: number, attempts: number) => string;
  reset: string;
  confirmReset: string;
  confirm: string;
  cancel: string;
  resetDone: string;
}

const nb: StatsTexts = {
  section: 'Statistikk',
  show: 'Vis statistikk',
  hide: 'Skjul statistikk',
  skill: {
    capital: 'Skrive hovedsteder',
    mapCapital: 'Hovedsteder på kartet',
    mapCountry: 'Land på kartet',
  },
  loading: 'Henter statistikk …',
  none: 'Ingen rettede ark ennå. Statistikken fylles ut når du retter.',
  sheets: (sheets, answers, percent) =>
    `${sheets} ark rettet, ${answers} svar, ${percent} % riktig i snitt.`,
  region: (name, known, learning, fresh) => `${name}: ${known} kan, ${learning} øver på, ${fresh} nye`,
  due: n => (n === 1 ? 'Ett land til repetisjon.' : `${n} land til repetisjon.`),
  weakest: 'Øv mer på',
  weakItem: (country, answer, percent, attempts) =>
    `${country} – ${answer} (${percent} %, ${attempts} ${attempts === 1 ? 'gang' : 'ganger'})`,
  reset: 'Nullstill statistikk',
  confirmReset: 'Slette all statistikk? Det kan ikke angres.',
  confirm: 'Slett',
  cancel: 'Avbryt',
  resetDone: 'Statistikken er slettet.',
};

const en: StatsTexts = {
  section: 'Statistics',
  show: 'Show statistics',
  hide: 'Hide statistics',
  skill: {
    capital: 'Writing capitals',
    mapCapital: 'Capitals on the map',
    mapCountry: 'Countries on the map',
  },
  loading: 'Loading statistics …',
  none: 'No graded sheets yet. Statistics fill in as you grade.',
  sheets: (sheets, answers, percent) =>
    `${sheets} ${sheets === 1 ? 'sheet' : 'sheets'} graded, ${answers} answers, ${percent} % right on average.`,
  region: (name, known, learning, fresh) => `${name}: ${known} known, ${learning} learning, ${fresh} new`,
  due: n => (n === 1 ? 'One country due for review.' : `${n} countries due for review.`),
  weakest: 'Practise more',
  weakItem: (country, answer, percent, attempts) =>
    `${country} – ${answer} (${percent} %, ${attempts} ${attempts === 1 ? 'time' : 'times'})`,
  reset: 'Reset statistics',
  confirmReset: 'Delete all statistics? This cannot be undone.',
  confirm: 'Delete',
  cancel: 'Cancel',
  resetDone: 'Statistics deleted.',
};

const OWN: Record<string, StatsTexts> = {nb, en};

export function statsTexts(lang: Language): StatsTexts {
  return OWN[lang.code] ?? en;
}
