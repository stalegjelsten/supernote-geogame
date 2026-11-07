/**
 * Fair draw when the players take turns (hot seat, "Take turns").
 *
 * Each player gets their own countries, so the draw must give everyone roughly equally difficult
 * tasks. Familiarity is measured by Wikipedia page views (src/data/familiarity.ts):
 * the capital when the task is knowing the capital, the country when the country is to be marked.
 *
 * The draw goes in rounds, one task per player per round:
 *  1. A random country is the starting point for the round.
 *  2. The rest of the round is filled with the unused countries closest in familiarity.
 *  3. The best-known country in the round goes to the player who so far has received
 *     the least known ones, and so on, so the total evens out over the game.
 * The order in the list is round by round, player 1 first (see playerAt).
 */
import {FAMILIARITY} from '../data/familiarity';
import type {CountryCode} from '../data/countries';

export type FamiliarityKind = 'country' | 'capital';

/** Familiarity on a log scale, so the difference between 1 and 10 million views counts as much as between 10,000 and 100,000. */
export function familiarity(code: CountryCode, kind: FamiliarityKind): number {
  const [country, capital] = FAMILIARITY[code];
  return Math.log10(1 + (kind === 'country' ? country : capital));
}

export interface FairDrawOptions<T> {
  random?: () => number;
  /** Can `item` go together with those already chosen? (e.g. distance on the map) */
  compatible?: (item: T, chosen: T[]) => boolean;
}

/**
 * Draws `rounds` rounds of `players` tasks from `pool`.
 * Returns the list in player order: [r1 p1, r1 p2, …, r2 p1, r2 p2, …].
 * If there are too few compatible candidates, the `compatible` requirement is relaxed.
 */
export function fairDraw<T>(
  pool: T[],
  rounds: number,
  players: number,
  score: (item: T) => number,
  {random = Math.random, compatible}: FairDrawOptions<T> = {},
): T[] {
  rounds = Math.min(rounds, Math.floor(pool.length / players));
  const unused = [...pool];
  const chosen: T[] = [];
  const out: T[] = [];
  const totals = Array.from({length: players}, () => 0);

  const takeAt = (i: number) => unused.splice(i, 1)[0];

  for (let r = 0; r < rounds; r++) {
    const ok = (x: T) => !compatible || compatible(x, chosen);
    const okIdx = unused.map((x, i) => (ok(x) ? i : -1)).filter(i => i >= 0);
    // Without enough compatible candidates: take anything.
    const strict = okIdx.length >= players;
    const candidates = strict ? okIdx : unused.map((_, i) => i);
    const anchor = unused[candidates[Math.floor(random() * candidates.length)]];
    const target = score(anchor);
    const group: T[] = [takeAt(unused.indexOf(anchor))];
    chosen.push(group[0]);
    while (group.length < players) {
      let best = -1;
      let bestD = Infinity;
      unused.forEach((x, i) => {
        if (strict && !ok(x)) {
          return;
        }
        // A bit of randomness on equal distances, so the same pair doesn't always end up together.
        const d = Math.abs(score(x) - target) + random() * 1e-6;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best < 0) {
        // No compatible ones left: take the nearest regardless.
        unused.forEach((x, i) => {
          const d = Math.abs(score(x) - target);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
      }
      const x = takeAt(best);
      group.push(x);
      chosen.push(x);
    }
    // Best known to the one who has received the least known so far.
    group.sort((a, b) => score(b) - score(a));
    const order = totals
      .map((t, p) => ({t, p, tie: random()}))
      .sort((a, b) => a.t - b.t || a.tie - b.tie)
      .map(x => x.p);
    const round: T[] = new Array(players);
    group.forEach((x, k) => {
      const p = order[k];
      round[p] = x;
      totals[p] += score(x);
    });
    out.push(...round);
  }
  return out;
}

/** Level on the sheet: mixed (all countries), or easy/medium/hard by familiarity. */
export type Level = 'mixed' | 'easy' | 'medium' | 'hard';
export const LEVELS: Level[] = ['mixed', 'easy', 'medium', 'hard'];

/**
 * The countries that can be drawn at a level. The list is sorted by familiarity, and the level
 * picks the best-known third (easy), the middle (medium) or the least
 * known (hard). If more than a third is needed, the window grows,
 * so there is always enough to draw from. `slack` gives extra room (e.g. the map,
 * where cities that lie too close are skipped).
 */
export function levelPool<T>(
  pool: T[],
  level: Level,
  count: number,
  score: (item: T) => number,
  slack = 1,
): T[] {
  if (level === 'mixed' || pool.length <= count) {
    return pool;
  }
  const sorted = [...pool].sort((a, b) => score(b) - score(a));
  const size = Math.min(sorted.length, Math.max(Math.ceil(sorted.length / 3), Math.ceil(count * slack)));
  const start =
    level === 'easy'
      ? 0
      : level === 'hard'
      ? sorted.length - size
      : Math.round((sorted.length - size) / 2);
  return sorted.slice(start, start + size);
}
