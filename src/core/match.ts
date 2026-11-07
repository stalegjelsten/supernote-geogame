/**
 * Sammenligning av gjenkjent håndskrift mot fasit.
 *
 * Gjenkjenningen er ikke perfekt, så vi er rause: store/små bokstaver,
 * aksenter, mellomrom og tegnsetting ignoreres, og noen få skrivefeil
 * godtas avhengig av ordlengde.
 */

export type Verdict = 'correct' | 'close' | 'wrong' | 'blank';

export interface MatchResult {
  verdict: Verdict;
  /** Hvilken skrivemåte svaret ble sammenlignet best med. */
  matched?: string;
  distance: number;
}

/**
 * Bokstaver som beholdes etter normalisering: a–z, 0–9 og bokstavene i skriftene
 * Supernote gjenkjenner (latinsk utvidet, gresk, kyrillisk, armensk, georgisk,
 * hangul, kana og CJK). Alt annet (mellomrom, tegnsetting, symboler) fjernes.
 * Bevisst uten \p{L}, som ikke er sikkert støttet i Hermes.
 */
const NOT_LETTER =
  /[^a-z0-9\u00df-\u00f6\u00f8-\u024f\u0370-\u03ff\u0400-\u052f\u0531-\u0587\u10a0-\u10ff\u1100-\u11ff\u3041-\u30fa\u30fc-\u30ff\u3131-\u318e\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]/g;

/** Gjør om til små bokstaver uten aksenter, mellomrom og tegnsetting. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/ß/g, 'ss')
    .replace(/œ/g, 'oe')
    .replace(/þ/g, 'th')
    .replace(/ð/g, 'd')
    .replace(/[łı]/g, m => (m === 'ł' ? 'l' : 'i'))
    .replace(/đ/g, 'd')
    .replace(/ς/g, 'σ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(NOT_LETTER, '');
}

const normCache = new Map<string, string>();

/** Som normalize, men husker resultatet (fasitlistene er store med mange språk). */
export function normalizeCached(text: string): string {
  let n = normCache.get(text);
  if (n === undefined) {
    n = normalize(text);
    normCache.set(text, n);
  }
  return n;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) {return 0;}
  if (!a.length) {return b.length;}
  if (!b.length) {return a.length;}
  let prev = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Hvor mange skrivefeil vi tåler for et fasitord av gitt (normalisert) lengde.
 * Rause grenser: både stavefeil og feillesing fra håndskriftgjenkjenningen skal godtas.
 */
export function allowedErrors(length: number): number {
  if (length <= 3) {
    return 0;
  }
  if (length <= 5) {
    return 1;
  }
  if (length <= 8) {
    return 2;
  }
  return 3;
}

/**
 * @param accepted Skrivemåter som godtas, også med noen skrivefeil.
 * @param rejected Svar som aldri skal godtas som «nesten», typisk hovedstedene i
 *   andre land. Skriver du nøyaktig en annen hovedstad, er det feil selv om den
 *   ligner på fasiten. Et Set regnes som allerede normalisert.
 * @param exactOnly Skrivemåter som bare godtas helt riktig (f.eks. på andre språk).
 */
export function matchAnswer(
  recognized: string,
  accepted: string[],
  rejected: string[] | ReadonlySet<string> = [],
  exactOnly: string[] = [],
): MatchResult {
  const answer = normalize(recognized);
  if (!answer) {return {verdict: 'blank', distance: Infinity};}
  const exact = [...accepted, ...exactOnly].find(a => normalizeCached(a) === answer);
  if (exact !== undefined) {
    return {verdict: 'correct', matched: exact, distance: 0};
  }
  const isRejected = Array.isArray(rejected)
    ? rejected.some(r => normalizeCached(r) === answer)
    : (rejected as ReadonlySet<string>).has(answer);
  if (isRejected) {
    return {verdict: 'wrong', distance: Infinity};
  }

  let best: MatchResult = {verdict: 'wrong', distance: Infinity};
  for (const option of accepted) {
    const target = normalizeCached(option);
    if (!target) {continue;}
    const d = levenshtein(answer, target);
    if (d === 0) {return {verdict: 'correct', matched: option, distance: 0};}
    if (d < best.distance) {
      const verdict = d <= allowedErrors(target.length) ? 'close' : 'wrong';
      best = {verdict, matched: option, distance: d};
    }
  }
  return best;
}
