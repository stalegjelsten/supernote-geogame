/**
 * Basis for training modes: which countries a new sheet should have, based on
 * the statistics in stats.ts. Pure logic, without the SDK.
 *
 * Each strategy gives each country a weight. The countries are then drawn randomly, but
 * without replacement and in proportion to the weight, so the sheets vary even
 * if the same countries are prioritized.
 */
import type {CountryCode} from '../data/countries';
import {overdue, type CountryStats, KNOWN_BOX} from './stats';

/**
 * - random: as before, all countries equally likely
 * - smart: a mix of countries for review, weak countries and some new ones
 * - weak: the countries you struggle with most
 * - due: the countries that are overdue per the review schedule
 * - new: countries you have never practiced
 */
export type Strategy = 'random' | 'smart' | 'weak' | 'due' | 'new';

export const STRATEGIES: Strategy[] = ['random', 'smart', 'weak', 'due', 'new'];

/** The weight a country gets; higher = more likely. Always > 0, so no country is excluded entirely. */
export function weight(s: CountryStats | undefined, strategy: Strategy, now: number): number {
  if (strategy === 'random') {
    return 1;
  }
  const unseen = !s;
  const weakness = s ? 1 - s.mastery : 1;
  const late = s ? overdue(s, now) : 0;
  const isDue = !!s && late >= 0;
  const known = !!s && s.box >= KNOWN_BOX;
  switch (strategy) {
    case 'new':
      return unseen ? 20 : 1 / (1 + s!.attempts);
    case 'weak':
      // Unseen countries only fill up when there are few weak countries.
      if (unseen) {
        return 0.3;
      }
      return known ? 0.1 : 1 + 20 * weakness;
    case 'due':
      if (unseen) {
        return 0.5;
      }
      return isDue ? 4 + Math.min(late, 4) + 4 * weakness : 0.1;
    case 'smart':
    default:
      if (unseen) {
        return 2;
      }
      if (isDue) {
        return 4 + Math.min(late, 3) + 6 * weakness;
      }
      // Not overdue: a bit of chance anyway, mostly for the uncertain ones.
      return known ? 0.2 : 0.5 + 2 * weakness;
  }
}

/**
 * Random order where each element ends up early in proportion to its weight
 * (Efraimidis–Spirakis: key = u^(1/w), sorted descending).
 */
export function weightedOrder<T>(items: readonly T[], weightOf: (item: T) => number, random: () => number): T[] {
  return items
    .map(item => {
      const w = Math.max(weightOf(item), 1e-9);
      const u = Math.max(random(), 1e-12);
      return {item, key: Math.log(u) / w};
    })
    .sort((a, b) => b.key - a.key)
    .map(x => x.item);
}

/**
 * Orders the countries for a new sheet by the strategy. Take the first `count`
 * (or pass the list on to a selection with its own requirements, such as distance on the map).
 */
export function orderForTraining<T extends {code: CountryCode}>(
  pool: readonly T[],
  stats: ReadonlyMap<CountryCode, CountryStats>,
  strategy: Strategy,
  now: number,
  random: () => number = Math.random,
): T[] {
  return weightedOrder(pool, c => weight(stats.get(c.code), strategy, now), random);
}
