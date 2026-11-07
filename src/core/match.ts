/**
 * Comparison of recognized handwriting against the answer key.
 *
 * Recognition is not perfect, so we are lenient: upper/lower case,
 * accents, spaces and punctuation are ignored, and a few typos
 * are accepted depending on word length.
 */

export type Verdict = 'correct' | 'close' | 'wrong' | 'blank';

export interface MatchResult {
  verdict: Verdict;
  /** Which spelling the answer was best compared with. */
  matched?: string;
  distance: number;
}

/**
 * Letters kept after normalization: a–z, 0–9 and the letters in the scripts
 * Supernote recognizes (extended Latin, Greek, Cyrillic, Armenian, Georgian,
 * Hangul, kana and CJK). Everything else (spaces, punctuation, symbols) is removed.
 * Deliberately without \p{L}, which is not guaranteed to be supported in Hermes.
 */
const NOT_LETTER =
  /[^a-z0-9\u00df-\u00f6\u00f8-\u024f\u0370-\u03ff\u0400-\u052f\u0531-\u0587\u10a0-\u10ff\u1100-\u11ff\u3041-\u30fa\u30fc-\u30ff\u3131-\u318e\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]/g;

/** The ヴ sounds are just as often written with the バ row (サラエヴォ/サラエボ). */
const VU: Record<string, string> = {ァ: 'バ', ィ: 'ビ', ェ: 'ベ', ォ: 'ボ'};

/**
 * Japanese spellings that mean the same: hiragana as katakana, ヴ as the バ row,
 * and without the long vowel mark (カーブル/カブール), which is also often misread as 一.
 */
function foldKana(text: string): string {
  return text
    .replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60))
    .replace(/ヴ([ァィェォ]?)/g, (_, small: string) => (small ? VU[small] : 'ブ'))
    .replace(/ー/g, '');
}

/** Converts to lowercase without accents, spaces and punctuation. */
export function normalize(text: string): string {
  return foldKana(text)
    .toLowerCase()
    .replace(/臺/g, '台')
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

/** Like normalize, but remembers the result (the answer lists are large with many languages). */
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
 * How many typos we tolerate for an answer word of a given (normalized) length.
 * Lenient limits: both misspellings and misreadings by the handwriting recognition should be accepted.
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
 * Latin letters that look exactly like Cyrillic or Greek
 * ones (A/А, B/В, E/Е, K/К, O/О, P/Р, C/С, T/Т, X/Х …), after normalization to
 * lowercase. Recognition often mixes the scripts for such characters.
 * Letters that merely resemble each other (N for И, R for Я) are real typos and
 * are not converted.
 */
const LATIN_TO_CYRILLIC: Record<string, string> = {
  a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о',
  p: 'р', t: 'т', x: 'х', y: 'у', '3': 'з',
};
const LATIN_TO_GREEK: Record<string, string> = {
  a: 'α', b: 'β', e: 'ε', h: 'η', i: 'ι', k: 'κ', m: 'μ', n: 'ν', o: 'ο',
  p: 'ρ', t: 'τ', x: 'χ', y: 'υ', z: 'ζ',
};
const CYRILLIC = /[\u0400-\u052f]/;
const GREEK = /[\u0370-\u03ff]/;
const LATIN = /[a-z]/;

function mapChars(text: string, table: Record<string, string>): string {
  let out = '';
  for (const ch of text) {
    out += table[ch] ?? ch;
  }
  return out;
}

/**
 * The answer as read, plus variants where Latin letters are converted
 * to Cyrillic or Greek, when the answer key is written in that script.
 */
function readings(answer: string, targets: string[]): string[] {
  const out = [answer];
  if (!LATIN.test(answer) && !/3/.test(answer)) {
    return out;
  }
  if (targets.some(t => CYRILLIC.test(t))) {
    out.push(mapChars(answer, LATIN_TO_CYRILLIC));
  }
  if (targets.some(t => GREEK.test(t))) {
    out.push(mapChars(answer, LATIN_TO_GREEK));
  }
  return [...new Set(out)];
}

/**
 * @param accepted Spellings that are accepted, also with some typos.
 * @param rejected Answers that should never be accepted as "almost", typically the capitals of
 *   other countries. If you write exactly another capital, it is wrong even if it
 *   resembles the answer key. A Set is treated as already normalized.
 * @param exactOnly Spellings that are only accepted when exactly right (e.g. in other languages).
 */
export function matchAnswer(
  recognized: string,
  accepted: string[],
  rejected: string[] | ReadonlySet<string> = [],
  exactOnly: string[] = [],
): MatchResult {
  const answer = normalize(recognized);
  if (!answer) {return {verdict: 'blank', distance: Infinity};}
  const answers = readings(answer, accepted.map(normalizeCached));
  const exact = [...accepted, ...exactOnly].find(a => answers.includes(normalizeCached(a)));
  if (exact !== undefined) {
    return {verdict: 'correct', matched: exact, distance: 0};
  }
  const isRejected = (a: string) =>
    Array.isArray(rejected)
      ? rejected.some(r => normalizeCached(r) === a)
      : (rejected as ReadonlySet<string>).has(a);
  if (answers.some(isRejected)) {
    return {verdict: 'wrong', distance: Infinity};
  }

  let best: MatchResult = {verdict: 'wrong', distance: Infinity};
  for (const option of accepted) {
    const target = normalizeCached(option);
    if (!target) {continue;}
    for (const a of answers) {
      const d = levenshtein(a, target);
      if (d < best.distance) {
        const verdict = d <= allowedErrors(target.length) ? 'close' : 'wrong';
        best = {verdict, matched: option, distance: d};
      }
    }
  }
  return best;
}
