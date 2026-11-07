/**
 * Text for multiplayer (hot seat). Norwegian and English are written by hand; the
 * other languages get their menu text from menu/<code>.ts and English text on the
 * sheet, like the map mode (see map.ts).
 *
 * The label ("Player 2 of 3", "Duel for 2") comes first in the sheet's subtitle
 * and is read back when grading, so its form must stay stable.
 */
import {fmt, list as menuList} from './menu/build';
import type {MenuStrings} from './menu/types';
import type {Language} from './types';

export interface HotSeatTexts {
  player: (k: number) => string;
  /** Label on each player's own pages when the device is passed around. */
  passTag: (k: number, n: number) => string;
  /** Reads [player, count] from the start of a text. */
  passTagPattern: RegExp;
  /** Label on a shared sheet where the players take turns. */
  sharedTag: (n: number) => string;
  /** Reads [count] from the start of a text. */
  sharedTagPattern: RegExp;

  /** Subtitle on the table sheet. */
  tablePass: (k: number, n: number) => string;
  tableShared: (n: number) => string;
  /** First line of the instructions on the map sheet (the second line is unchanged). */
  mapPass: (k: number, n: number, firstLine: string) => string;
  mapShared: (n: number) => string;

  /** The page between two players. */
  handover: (k: number) => string;
  handoverHint: string;

  /** The score line at the bottom of a shared sheet, after `scorePrefix`. */
  scoreLine: (scores: Array<{player: number; points: number; max: number}>) => string;

  ui: {
    players: string;
    solo: string;
    howToPlay: string;
    pass: string;
    shared: string;
    passHint: string;
    sharedHint: (each: number, unit: string) => string;
    unitCountries: string;
    unitCities: string;
    made: (players: number, pages: number) => string;
    winner: (k: number) => string;
    tie: (players: number[]) => string;
    playerScore: (k: number, points: string, max: string, percent: number) => string;
    missingPages: (players: number[]) => string;
  };
}

const list = (xs: string[], and: string) =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${and} ${xs[xs.length - 1]}`;

const nb: HotSeatTexts = {
  player: k => `Spiller ${k}`,
  passTag: (k, n) => `Spiller ${k} av ${n}`,
  passTagPattern: /^Spiller (\d+) av (\d+)/,
  sharedTag: n => `Duell for ${n}`,
  sharedTagPattern: /^Duell for (\d+)/,
  tablePass: (k, n) =>
    `Spiller ${k} av ${n} · skriv hovedstaden i midtkolonnen. Bla om og gi enheten videre når du er ferdig.`,
  tableShared: n =>
    `Duell for ${n} · bytt på å svare. Tallet i svarruta viser hvem sin tur det er.`,
  mapPass: (k, n, firstLine) => `Spiller ${k} av ${n} · ${firstLine}`,
  mapShared: n =>
    `Duell for ${n} · bytt på å sette kryss i listens rekkefølge: Spiller 1 tar nr. 1, Spiller 2 nr. 2 osv.`,
  handover: k => `Gi enheten til Spiller ${k}`,
  handoverHint: 'Bla om når du er klar. Ikke se på de andres svar!',
  scoreLine: scores => scores.map(s => `S${s.player} ${s.points}/${s.max}`).join(' · '),
  ui: {
    players: 'Spillere',
    solo: 'Alene',
    howToPlay: 'Hvordan spiller dere?',
    pass: 'Send rundt',
    shared: 'Bytt på',
    passHint:
      'Hver spiller får sine egne sider med de samme landene. Gi enheten videre og ikke se på de andres svar.',
    sharedHint: (each, unit) =>
      `Dere deler ett ark og bytter på å svare. Hver spiller får sine egne ${unit} (${each} hver), så det hjelper ikke å se på den andres svar.`,
    unitCountries: 'land',
    unitCities: 'byer',
    made: (players, pages) => `Laget spill for ${players} spillere på ${pages} sider.`,
    winner: k => `Spiller ${k} vant!`,
    tie: ks => `Uavgjort mellom ${list(ks.map(k => `Spiller ${k}`), 'og')}!`,
    playerScore: (k, points, max, percent) => `Spiller ${k}: ${points} av ${max} (${percent} %)`,
    missingPages: ks =>
      `Fant ikke sidene til ${list(ks.map(k => `Spiller ${k}`), 'og')}. Er de flyttet eller slettet?`,
  },
};

const en: HotSeatTexts = {
  player: k => `Player ${k}`,
  passTag: (k, n) => `Player ${k} of ${n}`,
  passTagPattern: /^Player (\d+) of (\d+)/,
  sharedTag: n => `Duel for ${n}`,
  sharedTagPattern: /^Duel for (\d+)/,
  tablePass: (k, n) =>
    `Player ${k} of ${n} · write the capital in the middle column. Turn the page and pass the device on when you are done.`,
  tableShared: n =>
    `Duel for ${n} · take turns answering. The number in the answer box shows whose turn it is.`,
  mapPass: (k, n, firstLine) => `Player ${k} of ${n} · ${firstLine}`,
  mapShared: n =>
    `Duel for ${n} · take turns putting a cross in list order: player 1 takes no. 1, player 2 no. 2, and so on.`,
  handover: k => `Pass the device to player ${k}`,
  handoverHint: "Turn the page when you are ready. Don't look at the others' answers!",
  scoreLine: scores => scores.map(s => `P${s.player} ${s.points}/${s.max}`).join(' · '),
  ui: {
    players: 'Players',
    solo: 'Alone',
    howToPlay: 'How do you play?',
    pass: 'Pass around',
    shared: 'Take turns',
    passHint:
      'Each player gets their own pages with the same countries. Pass the device on and don\'t look at the others\' answers.',
    sharedHint: (each, unit) =>
      `You share one sheet and take turns answering. Each player gets their own ${unit} (${each} each), so looking at the other answers does not help.`,
    unitCountries: 'countries',
    unitCities: 'cities',
    made: (players, pages) => `Made a game for ${players} players on ${pages} pages.`,
    winner: k => `Player ${k} won!`,
    tie: ks => `A tie between ${list(ks.map(k => `player ${k}`), 'and')}!`,
    playerScore: (k, points, max, percent) => `Player ${k}: ${points} of ${max} (${percent} %)`,
    missingPages: ks =>
      `Could not find the pages of ${list(ks.map(k => `player ${k}`), 'and')}. Were they moved or deleted?`,
  },
};

const OWN: Record<string, HotSeatTexts> = {nb, en};

function menuUi(m: MenuStrings): HotSeatTexts['ui'] {
  const players = (ks: number[]) => menuList(m, ks.map(k => fmt(m.hsPlayer, {k})));
  return {
    players: m.hsPlayers,
    solo: m.hsSolo,
    howToPlay: m.hsHowToPlay,
    pass: m.hsPass,
    shared: m.hsShared,
    passHint: m.hsPassHint,
    sharedHint: (each, unit) => fmt(m.hsSharedHint, {each, unit}),
    unitCountries: m.hsUnitCountries,
    unitCities: m.hsUnitCities,
    made: (n, pages) => fmt(m.hsMade, {players: n, pages}),
    winner: k => fmt(m.hsWinner, {k}),
    tie: ks => fmt(m.hsTie, {players: players(ks)}),
    playerScore: (k, points, max, percent) => fmt(m.hsPlayerScore, {k, points, max, percent}),
    missingPages: ks => fmt(m.hsMissingPages, {players: players(ks)}),
  };
}

const cache = new Map<string, HotSeatTexts>();

/** Own texts for nb and en; otherwise English on the sheet and a translated menu. */
export function hotSeatTexts(lang: Language): HotSeatTexts {
  const own = OWN[lang.code];
  if (own) {
    return own;
  }
  if (!lang.menu) {
    return en;
  }
  let t = cache.get(lang.code);
  if (!t) {
    t = {...en, ui: menuUi(lang.menu)};
    cache.set(lang.code, t);
  }
  return t;
}

/** All variants of the text, so the label is recognized in any language. */
export const ALL_HOTSEAT_TEXTS: HotSeatTexts[] = [nb, en];
