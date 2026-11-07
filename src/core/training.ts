/**
 * Grunnlag for treningsmoduser: hvilke land et nytt ark bør ha, ut fra
 * statistikken i stats.ts. Ren logikk, uten SDK.
 *
 * Hver strategi gir hvert land en vekt. Landene trekkes så tilfeldig, men
 * uten tilbakelegging og i forhold til vekten, så arkene blir variert selv
 * om de samme landene prioriteres.
 */
import type {CountryCode} from '../data/countries';
import {overdue, type CountryStats, KNOWN_BOX} from './stats';

/**
 * - random: som før, alle land like sannsynlige
 * - smart: blanding av land til repetisjon, svake land og noen nye
 * - weak: landene du sliter mest med
 * - due: landene som er på overtid etter repetisjonsplanen
 * - new: land du aldri har øvd på
 */
export type Strategy = 'random' | 'smart' | 'weak' | 'due' | 'new';

export const STRATEGIES: Strategy[] = ['random', 'smart', 'weak', 'due', 'new'];

/** Vekten et land får; høyere = mer sannsynlig. Alltid > 0, så ingen land utelukkes helt. */
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
      // Usette land fyller bare opp når det er få svake land.
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
      // Ikke på overtid: litt sjanse likevel, mest for de usikre.
      return known ? 0.2 : 0.5 + 2 * weakness;
  }
}

/**
 * Tilfeldig rekkefølge der hvert element havner tidlig i forhold til vekten
 * (Efraimidis–Spirakis: nøkkel = u^(1/w), sortert synkende).
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
 * Ordner landene for et nytt ark etter strategien. Ta de første `count`
 * (eller send lista videre til et utvalg med egne krav, som avstand på kartet).
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
