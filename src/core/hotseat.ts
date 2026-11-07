/**
 * Flerspiller på én enhet (hot seat). Ren logikk uten SDK.
 *
 * To måter å spille på:
 *  - 'pass' (send rundt): enheten skjules for de andre. Hver spiller får egne
 *    sider med de samme landene, i rekkefølge, med en «gi enheten videre»-side
 *    mellom spillerne. Sammenlignbart, siden alle får samme oppgaver.
 *  - 'shared' (bytt på): alle ser enheten. Ett felles ark der spillerne svarer
 *    annenhver gang. Hver spiller har egne land, så det hjelper ikke å kikke.
 *
 * Hvilket spill en side hører til, står først i undertittelen
 * («Spiller 2 av 3 · …» eller «Duell for 2 · …»).
 */
import {ALL_HOTSEAT_TEXTS} from '../i18n/hotseat';

export type PlayMode = 'pass' | 'shared';

export const PLAYER_COUNTS = [1, 2, 3, 4] as const;
export const MAX_PLAYERS = 4;

export interface Game {
  mode: PlayMode;
  players: number;
}

/** Merkelappen på en side. `player` er 0 på et felles ark. */
export interface GameTag extends Game {
  player: number;
}

export function parseGameTag(text: string): GameTag | null {
  const s = text.trim();
  for (const t of ALL_HOTSEAT_TEXTS) {
    const p = s.match(t.passTagPattern);
    if (p) {
      const player = Number(p[1]);
      const players = Number(p[2]);
      if (players >= 2 && players <= MAX_PLAYERS && player >= 1 && player <= players) {
        return {mode: 'pass', player, players};
      }
    }
    const sh = s.match(t.sharedTagPattern);
    if (sh) {
      const players = Number(sh[1]);
      if (players >= 2 && players <= MAX_PLAYERS) {
        return {mode: 'shared', player: 0, players};
      }
    }
  }
  return null;
}

/** Felles ark: hvor mange oppgaver totalt, så alle får like mange (minst én hver). */
export function sharedCount(count: number, players: number, available = count): number {
  const n = Math.min(count, available);
  return Math.max(players, Math.floor(n / players) * players);
}

/** Felles ark: hvem som svarer på oppgave nr. `index` (fra 0). Spiller 1 begynner. */
export function playerAt(index: number, players: number): number {
  return (index % players) + 1;
}

/** Tallet som står i svarruta på et felles tabellark. */
export function rowLabel(player: number): string {
  return String(player);
}

/** Leser tallet i svarruta tilbake; null hvis teksten ikke er et spillertall. */
export function parseRowLabel(text: string, players: number): number | null {
  const m = text.trim().match(/^(\d)$/);
  const k = m ? Number(m[1]) : NaN;
  return k >= 1 && k <= players ? k : null;
}

/**
 * Send rundt: sidene ligger slik i notatet, med `parts` sider per spiller:
 *   [S1 side 1..parts] [gi videre] [S2 side 1..parts] [gi videre] … [Sn …]
 * Returnerer sideindeksen der spiller `player` sin side `part` ligger,
 * gitt at spillet begynner på `first`.
 */
export function passPageIndex(first: number, player: number, part: number, parts: number): number {
  return first + (player - 1) * (parts + 1) + (part - 1);
}

/** Første side i spillet, regnet ut fra en side du står på. */
export function passFirstPage(current: number, player: number, part: number, parts: number): number {
  return current - (player - 1) * (parts + 1) - (part - 1);
}

/** Antall sider et spill tar: arksider for alle pluss sidene mellom spillerne. */
export function passPageCount(players: number, parts: number): number {
  return players * parts + (players - 1);
}

export interface PlayerScore {
  player: number;
  points: number;
  max: number;
}

/** Legger sammen poeng per spiller (f.eks. fra flere sider). */
export function sumScores(scores: PlayerScore[]): PlayerScore[] {
  const by = new Map<number, PlayerScore>();
  for (const s of scores) {
    const acc = by.get(s.player) ?? {player: s.player, points: 0, max: 0};
    acc.points += s.points;
    acc.max += s.max;
    by.set(s.player, acc);
  }
  return [...by.values()].sort((a, b) => a.player - b.player);
}

/**
 * Hvem som vant. Sammenligner andelen poeng, så det blir rettferdig også om en
 * spiller har fått færre oppgaver (f.eks. en side som mangler).
 */
export function winners(scores: PlayerScore[]): number[] {
  if (!scores.length) {
    return [];
  }
  const share = (s: PlayerScore) => (s.max ? s.points / s.max : 0);
  const best = Math.max(...scores.map(share));
  return scores.filter(s => Math.abs(share(s) - best) < 1e-9).map(s => s.player);
}
