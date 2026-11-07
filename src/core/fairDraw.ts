/**
 * Rettferdig trekning når spillerne bytter på (hot seat, «Bytt på»).
 *
 * Hver spiller får egne land, så trekningen må gi alle omtrent like vanskelige
 * oppgaver. Kjenthet måles med sidevisninger på Wikipedia (src/data/familiarity.ts):
 * hovedstaden når oppgaven er å kunne hovedstaden, landet når landet skal merkes.
 *
 * Trekningen går i runder, én oppgave per spiller per runde:
 *  1. Et tilfeldig land er utgangspunktet for runden.
 *  2. Resten av runden fylles med de ubrukte landene som er nærmest i kjenthet.
 *  3. Det mest kjente landet i runden går til spilleren som så langt har fått
 *     de minst kjente, og så videre, så summen jevnes ut over spillet.
 * Rekkefølgen i lista blir runde for runde, spiller 1 først (se playerAt).
 */
import {FAMILIARITY} from '../data/familiarity';
import type {CountryCode} from '../data/countries';

export type FamiliarityKind = 'country' | 'capital';

/** Kjenthet på log-skala, så forskjellen mellom 1 og 10 millioner visninger teller like mye som mellom 10 000 og 100 000. */
export function familiarity(code: CountryCode, kind: FamiliarityKind): number {
  const [country, capital] = FAMILIARITY[code];
  return Math.log10(1 + (kind === 'country' ? country : capital));
}

export interface FairDrawOptions<T> {
  random?: () => number;
  /** Kan `item` stå sammen med de som allerede er valgt? (f.eks. avstand på kartet) */
  compatible?: (item: T, chosen: T[]) => boolean;
}

/**
 * Trekker `rounds` runder à `players` oppgaver fra `pool`.
 * Returnerer lista i spillerekkefølge: [r1 s1, r1 s2, …, r2 s1, r2 s2, …].
 * Er det for få kompatible kandidater, slakkes kravet i `compatible`.
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
    // Uten nok kompatible kandidater: ta hva som helst.
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
        // Litt tilfeldighet ved like avstander, så samme par ikke alltid kommer sammen.
        const d = Math.abs(score(x) - target) + random() * 1e-6;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best < 0) {
        // Ingen kompatible igjen: ta nærmeste uansett.
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
    // Mest kjent til den som har fått minst kjente så langt.
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

/** Nivå på arket: blandet (alle land), eller lett/middels/vanskelig etter kjenthet. */
export type Level = 'mixed' | 'easy' | 'medium' | 'hard';
export const LEVELS: Level[] = ['mixed', 'easy', 'medium', 'hard'];

/**
 * Landene som kan trekkes på et nivå. Lista sorteres etter kjenthet, og nivået
 * velger den mest kjente tredjedelen (lett), midten (middels) eller den minst
 * kjente (vanskelig). Trengs det flere enn en tredjedel, blir vinduet større,
 * så det alltid er nok å trekke fra. `slack` gir ekstra plass (f.eks. kartet,
 * der byer som ligger for tett, hoppes over).
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
