/**
 * Text for outline mode ("which country is this?"). Norwegian and English are written by
 * hand; the other languages get their text from menu/<code>.ts. Outline sheets are
 * recognized by the key at the bottom (core/outlineSheet.ts), not by the title, so all the
 * text on the sheet can be translated.
 */
import type {OutlineRotation, OutlineScale, OutlineSize} from '../core/outlineSheet';
import {fmt} from './menu/build';
import EN_MENU from './menu/en';
import type {MenuStrings} from './menu/types';
import type {Language} from './types';

export interface OutlineTexts {
  /** Start of the title on the sheet. */
  titlePrefix: string;
  /** Instructions below the title, two lines separated by \n. */
  subtitle: string;
  /** Start of the score, e.g. "Poeng:"; used to remove it when regrading. */
  scorePrefix: string;
  score: (points: number, total: number) => string;
  ui: {
    mode: string;
    hint: string;
    size: string;
    sizes: Record<OutlineSize, string>;
    scale: string;
    scales: Record<OutlineScale, string>;
    scaleHint: string;
    rotation: string;
    rotations: Record<OutlineRotation, string>;
    made: (count: number) => string;
    result: (correct: number, total: number, percent: number) => string;
  };
}

type OwnTexts = Omit<OutlineTexts, 'scorePrefix' | 'score'>;

const nb: OwnTexts = {
  titlePrefix: 'Land etter omriss',
  subtitle:
    'Skriv navnet på landet på linja i hver rute.\n' + 'Rett siden fra World Capitals Quiz-menyen.',
  ui: {
    mode: 'Omriss',
    hint: 'Skriv navnet på landet under hvert omriss.',
    size: 'Størrelse',
    sizes: {large: 'Stor', medium: 'Middels', small: 'Liten'},
    scale: 'Målestokk',
    scales: {fit: 'Fyll ruta', bar: 'Fyll ruta, med målestokk', log: 'Relativ størrelse'},
    scaleHint:
      'Landene tegnes i forhold til hverandre på en logaritmisk skala: et land som er ti ganger så langt, tegnes omtrent 1,4 ganger så stort, så også små land synes.',
    rotation: 'Rotasjon',
    rotations: {none: 'Ingen', some: 'Litt', any: 'Hvilken som helst'},
    made: count => `Laget omrissark med ${count} land.`,
    result: (correct, total, percent) => `Du kjente igjen ${correct} av ${total} land (${percent} %).`,
  },
};

function fromMenu(m: MenuStrings): OwnTexts {
  return {
    titlePrefix: m.outlineTitle,
    subtitle: m.outlineSubtitle,
    ui: {
      mode: m.outlineMode,
      hint: m.outlineHint,
      size: m.outlineSize,
      sizes: {large: m.outlineSizeLarge, medium: m.outlineSizeMedium, small: m.outlineSizeSmall},
      scale: m.outlineScale,
      scales: {fit: m.outlineScaleFit, bar: m.outlineScaleBar, log: m.outlineScaleSame},
      scaleHint: m.outlineScaleHint,
      rotation: m.outlineRotation,
      rotations: {none: m.outlineRotationNone, some: m.outlineRotationSome, any: m.outlineRotationAny},
      made: count => fmt(m.outlineMade, {count}),
      result: (correct, total, percent) => fmt(m.outlineResult, {correct, total, percent}),
    },
  };
}

const cache = new Map<string, OutlineTexts>();

export function outlineTexts(lang: Language): OutlineTexts {
  let t = cache.get(lang.code);
  if (!t) {
    // English is in menu/en.ts as well; it is not passed as lang.menu, so it is read from there.
    const own: OwnTexts = lang.code === 'nb' ? nb : fromMenu(lang.menu ?? EN_MENU);
    // The score is the same as on the table sheet, so it is recognized and removed in the same way.
    t = {...own, scorePrefix: lang.sheet.scorePrefix, score: lang.sheet.score};
    cache.set(lang.code, t);
  }
  return t;
}
