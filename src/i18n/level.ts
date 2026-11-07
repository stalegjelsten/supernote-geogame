/**
 * Text for the level choice in the menu. Norwegian and English are written by hand; the
 * other languages get their text from menu/<code>.ts.
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
  const m = lang.menu;
  return (
    OWN[lang.code] ??
    (m
      ? {
          label: m.levelLabel,
          names: {mixed: m.levelMixed, easy: m.levelEasy, medium: m.levelMedium, hard: m.levelHard},
          hint: m.levelHint,
        }
      : en)
  );
}
