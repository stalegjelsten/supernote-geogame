/**
 * Tekst for nivåvalget i menyen. Norsk og engelsk er skrevet for hånd; de andre
 * språkene får engelsk, som kartmodusen og flerspiller.
 */
import type {Level} from '../core/fairDraw';
import type {Language} from './types';

export interface LevelTexts {
  label: string;
  names: Record<Level, string>;
  hint: string;
}

const nb: LevelTexts = {
  label: 'Nivå',
  names: {mixed: 'Blandet', easy: 'Lett', medium: 'Middels', hard: 'Vanskelig'},
  hint: 'Nivået bestemmes av hvor kjent hovedstaden (eller landet) er, målt i sidevisninger på Wikipedia.',
};

const en: LevelTexts = {
  label: 'Level',
  names: {mixed: 'Mixed', easy: 'Easy', medium: 'Medium', hard: 'Hard'},
  hint: 'The level depends on how well known the capital (or country) is, measured by Wikipedia page views.',
};

const OWN: Record<string, LevelTexts> = {nb, en};

export function levelTexts(lang: Language): LevelTexts {
  return OWN[lang.code] ?? en;
}
