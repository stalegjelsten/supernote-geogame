/**
 * Text for the training choice in the menu (which countries a new sheet gets, see
 * core/training.ts). Norwegian and English are written by hand; the other languages
 * get their text from menu/<code>.ts.
 */
import type {Strategy} from '../core/training';
import type {Language} from './types';

export interface TrainingTexts {
  label: string;
  names: Record<Strategy, string>;
  /** What the choice does; shown under the buttons. */
  hints: Record<Strategy, string>;
}

const nb: TrainingTexts = {
  label: 'Trening',
  names: {random: 'Tilfeldig', smart: 'Smart', weak: 'Svake', due: 'Repetisjon', new: 'Nye'},
  hints: {
    random: 'Alle land er like sannsynlige. Statistikken brukes ikke.',
    smart: 'Ut fra statistikken: land som skal repeteres, land du sliter med og noen nye.',
    weak: 'Landene du oftest svarer feil på. Fylles opp med nye hvis det er få.',
    due: 'Landene som skal repeteres nå, etter planen 1, 3, 7, 14 … dager.',
    new: 'Land du ikke har øvd på ennå.',
  },
};

const en: TrainingTexts = {
  label: 'Practice',
  names: {random: 'Random', smart: 'Smart', weak: 'Weak', due: 'Review', new: 'New'},
  hints: {
    random: 'All countries are equally likely. The statistics are not used.',
    smart: 'Based on your statistics: countries due for review, countries you struggle with and a few new ones.',
    weak: 'The countries you get wrong most often. Filled up with new ones if there are few.',
    due: 'The countries due for review now, on the schedule 1, 3, 7, 14 … days.',
    new: 'Countries you have not practiced yet.',
  },
};

const OWN: Record<string, TrainingTexts> = {nb, en};

export function trainingTexts(lang: Language): TrainingTexts {
  const m = lang.menu;
  if (OWN[lang.code] || !m) {
    return OWN[lang.code] ?? en;
  }
  return {
    label: m.trainingLabel,
    names: {
      random: m.trainingRandom,
      smart: m.trainingSmart,
      weak: m.trainingWeak,
      due: m.trainingDue,
      new: m.trainingNew,
    },
    hints: {
      random: m.trainingRandomHint,
      smart: m.trainingSmartHint,
      weak: m.trainingWeakHint,
      due: m.trainingDueHint,
      new: m.trainingNewHint,
    },
  };
}
