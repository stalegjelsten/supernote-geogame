/**
 * Multiplayer on one device (hot seat). Pure logic, no SDK.
 *
 * Two ways to play:
 *  - 'pass' (pass it around): the device is hidden from the others. Each player gets their own
 *    pages with the same countries, in order, with a "hand over the device" page
 *    between the players. Comparable, since everyone gets the same tasks.
 *  - 'shared' (take turns): everyone sees the device. One shared sheet where the players answer
 *    in turn. Each player has their own countries, so peeking doesn't help.
 *
 * Which game a page belongs to is stated first in the subtitle
 * ("Player 2 of 3 · …" or "Duel for 2 · …").
 */
import {ALL_HOTSEAT_TEXTS} from '../i18n/hotseat';

export type PlayMode = 'pass' | 'shared';

export const PLAYER_COUNTS = [1, 2, 3, 4] as const;
export const MAX_PLAYERS = 4;

export interface Game {
  mode: PlayMode;
  players: number;
}

/** The label on a page. `player` is 0 on a shared sheet. */
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

/** Shared sheet: how many tasks in total, so everyone gets the same number (at least one each). */
export function sharedCount(count: number, players: number, available = count): number {
  const n = Math.min(count, available);
  return Math.max(players, Math.floor(n / players) * players);
}

/** Shared sheet: who answers task no. `index` (from 0). Player 1 starts. */
export function playerAt(index: number, players: number): number {
  return (index % players) + 1;
}

/** The number written in the answer cell on a shared table sheet. */
export function rowLabel(player: number): string {
  return String(player);
}

/** Reads the number in the answer cell back; null if the text is not a player number. */
export function parseRowLabel(text: string, players: number): number | null {
  const m = text.trim().match(/^(\d)$/);
  const k = m ? Number(m[1]) : NaN;
  return k >= 1 && k <= players ? k : null;
}

/**
 * Pass it around: the pages lie like this in the note, with `parts` pages per player:
 *   [P1 page 1..parts] [hand over] [P2 page 1..parts] [hand over] … [Pn …]
 * Returns the page index where player `player`'s page `part` is,
 * given that the game starts at `first`.
 */
export function passPageIndex(first: number, player: number, part: number, parts: number): number {
  return first + (player - 1) * (parts + 1) + (part - 1);
}

/** First page of the game, computed from a page you are on. */
export function passFirstPage(current: number, player: number, part: number, parts: number): number {
  return current - (player - 1) * (parts + 1) - (part - 1);
}

/** Number of pages a game takes: sheet pages for everyone plus the pages between players. */
export function passPageCount(players: number, parts: number): number {
  return players * parts + (players - 1);
}

export interface PlayerScore {
  player: number;
  points: number;
  max: number;
}

/** Adds up points per player (e.g. from several pages). */
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
 * Who won. Compares the share of points, so it is fair even if a
 * player got fewer tasks (e.g. a page that is missing).
 */
export function winners(scores: PlayerScore[]): number[] {
  if (!scores.length) {
    return [];
  }
  const share = (s: PlayerScore) => (s.max ? s.points / s.max : 0);
  const best = Math.max(...scores.map(share));
  return scores.filter(s => Math.abs(share(s) - best) < 1e-9).map(s => s.player);
}
