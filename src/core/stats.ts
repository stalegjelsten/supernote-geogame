/**
 * Answer history and statistics per country, without the SDK.
 *
 * Each corrected sheet (or each corrected page in a set) becomes one `SheetRecord`:
 * which skill was practiced, when, and how well it went for each country.
 * All statistics are computed from these records, so the model can be changed later
 * without having to rewrite anything stored.
 *
 * The records are stored as folder names (see src/sdk/statsStore.ts), because the SDK
 * cannot write ordinary files. The encoding therefore uses only lowercase letters, digits
 * and dots, and stays well under 255 characters.
 */
import {CONTINENT_OF, type CountryCode} from '../data/countries';
import type {Verdict} from './match';

/**
 * What is practiced:
 * - capital: write the capital (the table sheet)
 * - mapCapital: find the capital on the map
 * - mapCountry: find the country on the map
 * - outline: name the country from its outline
 */
export type Skill = 'capital' | 'mapCapital' | 'mapCountry' | 'outline';

export const SKILLS: Skill[] = ['capital', 'mapCapital', 'mapCountry', 'outline'];

const SKILL_CHAR: Record<Skill, string> = {capital: 't', mapCapital: 'm', mapCountry: 'c', outline: 'o'};
const CHAR_SKILL: Record<string, Skill> = {t: 'capital', m: 'mapCapital', c: 'mapCountry', o: 'outline'};

/** One answer for one country. `score` is from 0 (wrong/don't know) to 1 (fully correct). */
export interface Attempt {
  code: CountryCode;
  score: number;
}

export interface SheetRecord {
  skill: Skill;
  /** Time of the correction, ms since 1970. Stored with second resolution. */
  time: number;
  /**
   * Identifies the sheet, so a new correction of the same sheet replaces the previous one
   * instead of counting twice. See `sheetKey`.
   */
  key: string;
  attempts: Attempt[];
}

/** Score is stored as one character in base 36: 0–35. */
const LEVELS = 35;
const RECORD_PREFIX = 'g1';
/** Folder names can be up to 255 bytes; keep a good margin. */
export const MAX_NAME_LENGTH = 240;

// ---------------------------------------------------------------- score

/** Score for an answer on the table sheet. "Almost" counts as almost fully correct. */
export function verdictScore(verdict: Verdict): number {
  switch (verdict) {
    case 'correct':
      return 1;
    case 'close':
      return 0.8;
    default:
      return 0;
  }
}

/** Score for a capital on the map: the share of the full pot. */
export function mapPointsScore(points: number, max = 1000): number {
  return max > 0 ? Math.max(0, Math.min(1, points / max)) : 0;
}

/** A score of at least this counts as "knew it". */
export const PASS = 0.7;

export const passed = (score: number) => score >= PASS;

// ---------------------------------------------------------------- koding

function quantize(score: number): string {
  return Math.round(Math.max(0, Math.min(1, score)) * LEVELS).toString(36);
}

function isCountryCode(s: string): s is CountryCode {
  return Object.prototype.hasOwnProperty.call(CONTINENT_OF, s);
}

/** FNV-1a, 32 bit. */
/* eslint-disable no-bitwise */
function fnv1a(text: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
/* eslint-enable no-bitwise */

/**
 * Key for a sheet: the note and which countries are on the page. The countries are included
 * so the key doesn't change if pages are inserted or moved in the note.
 */
export const KEY_LENGTH = 14;

export function sheetKey(notePath: string, skill: Skill, codes: readonly CountryCode[]): string {
  const text = [notePath, skill, ...[...codes].sort()].join('|');
  const a = fnv1a(text).toString(36).padStart(7, '0');
  const b = fnv1a(text, 0x5ad1a7d5).toString(36).padStart(7, '0');
  return a + b;
}

/**
 * "g1.t.<time>.<key>.<country and score>", e.g. "g1.t.lx2k1a.0abc….noz.se0".
 * One record per country is three characters: the country code and the score.
 */
export function encodeRecord(r: SheetRecord): string {
  const time = Math.floor(r.time / 1000).toString(36);
  const body = r.attempts.map(a => a.code.toLowerCase() + quantize(a.score)).join('');
  return [RECORD_PREFIX, SKILL_CHAR[r.skill], time, r.key, body].join('.');
}

export function decodeRecord(name: string): SheetRecord | null {
  const parts = name.split('.');
  if (parts.length !== 5 || parts[0] !== RECORD_PREFIX) {
    return null;
  }
  const [, skillChar, time, key, body] = parts;
  const skill = CHAR_SKILL[skillChar];
  const seconds = parseInt(time, 36);
  if (!skill || !Number.isFinite(seconds) || !/^[0-9a-z]+$/.test(key) || body.length % 3 !== 0) {
    return null;
  }
  const attempts: Attempt[] = [];
  for (let i = 0; i < body.length; i += 3) {
    const code = body.slice(i, i + 2).toUpperCase();
    const level = parseInt(body[i + 2], 36);
    if (!isCountryCode(code) || !(level >= 0 && level <= LEVELS)) {
      return null;
    }
    attempts.push({code, score: level / LEVELS});
  }
  return {skill, time: seconds * 1000, key, attempts};
}

/**
 * Splits a sheet into several records if there are too many countries for one folder name.
 * The parts get their own keys (`<key>`, `<key>1`, …), so they are replaced together.
 */
export function splitRecord(r: SheetRecord): SheetRecord[] {
  const header = encodeRecord({...r, key: r.key + 'zz', attempts: []}).length;
  const perRecord = Math.max(1, Math.floor((MAX_NAME_LENGTH - header) / 3));
  if (r.attempts.length <= perRecord) {
    return [r];
  }
  const out: SheetRecord[] = [];
  for (let i = 0; i < r.attempts.length; i += perRecord) {
    const k = i / perRecord;
    out.push({...r, key: k === 0 ? r.key : r.key + k, attempts: r.attempts.slice(i, i + perRecord)});
  }
  return out;
}

/** Does the record belong to the same sheet as the key (including the parts from `splitRecord`)? */
export function sameSheet(recordKey: string, key: string): boolean {
  return recordKey.slice(0, KEY_LENGTH) === key.slice(0, KEY_LENGTH);
}

// ---------------------------------------------------------------- statistikk

/**
 * How long a country can wait before it should be practiced again, by how many times
 * in a row it has been known (Leitner boxes). Box 0 = practice now.
 */
export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30, 60];
export const MAX_BOX = BOX_INTERVAL_DAYS.length - 1;
/** From this box the country counts as "known". */
export const KNOWN_BOX = 3;

const DAY = 24 * 60 * 60 * 1000;

export interface CountryStats {
  code: CountryCode;
  attempts: number;
  /** Number of times it was known (score ≥ PASS). */
  passes: number;
  /** Moving average of the scores, weighted toward the latest attempts (0–1). */
  mastery: number;
  /** Number of times in a row it has been known, from the latest attempt backwards. */
  streak: number;
  /** Leitner box: increases by one when the country was known, falls to 0 when it wasn't. */
  box: number;
  firstSeen: number;
  lastSeen: number;
  lastScore: number;
}

/** How much the latest attempt counts in `mastery`. */
const MASTERY_WEIGHT = 0.4;

/**
 * Computes statistics per country for one skill. Records with the same key
 * (the same sheet corrected several times) count only once: the latest correction.
 */
export function computeStats(records: readonly SheetRecord[], skill: Skill): Map<CountryCode, CountryStats> {
  const latest = new Map<string, SheetRecord>();
  for (const r of records) {
    if (r.skill !== skill) {
      continue;
    }
    const old = latest.get(r.key);
    if (!old || r.time >= old.time) {
      latest.set(r.key, r);
    }
  }
  const sorted = [...latest.values()].sort((a, b) => a.time - b.time);
  const stats = new Map<CountryCode, CountryStats>();
  for (const r of sorted) {
    for (const a of r.attempts) {
      const s = stats.get(a.code);
      const ok = passed(a.score);
      if (!s) {
        stats.set(a.code, {
          code: a.code,
          attempts: 1,
          passes: ok ? 1 : 0,
          mastery: a.score,
          streak: ok ? 1 : 0,
          box: ok ? 1 : 0,
          firstSeen: r.time,
          lastSeen: r.time,
          lastScore: a.score,
        });
        continue;
      }
      s.attempts++;
      s.passes += ok ? 1 : 0;
      s.mastery = s.mastery + MASTERY_WEIGHT * (a.score - s.mastery);
      s.streak = ok ? s.streak + 1 : 0;
      s.box = ok ? Math.min(MAX_BOX, s.box + 1) : 0;
      s.lastSeen = r.time;
      s.lastScore = a.score;
    }
  }
  return stats;
}

/** When the country should next be practiced (ms). */
export function dueAt(s: CountryStats): number {
  return s.lastSeen + BOX_INTERVAL_DAYS[s.box] * DAY;
}

/** How many intervals the country is overdue (0 = right now, negative = not yet). */
export function overdue(s: CountryStats, now: number): number {
  const interval = Math.max(BOX_INTERVAL_DAYS[s.box] * DAY, DAY / 4);
  return (now - dueAt(s)) / interval;
}

/** new = never practiced, learning = practiced but not sure yet, known = known several times in a row. */
export type Level = 'new' | 'learning' | 'known';

export function levelOf(s: CountryStats | undefined): Level {
  if (!s) {
    return 'new';
  }
  return s.box >= KNOWN_BOX ? 'known' : 'learning';
}

export interface Summary {
  countries: number;
  new: number;
  learning: number;
  known: number;
  /** For review now: practiced before and overdue. */
  due: number;
  attempts: number;
  /** Average of `mastery` for the countries that have been practiced, or null. */
  mastery: number | null;
}

/** Summary for a selection of countries (e.g. a continent). */
export function summarize(
  stats: ReadonlyMap<CountryCode, CountryStats>,
  codes: readonly CountryCode[],
  now: number,
): Summary {
  const out: Summary = {countries: codes.length, new: 0, learning: 0, known: 0, due: 0, attempts: 0, mastery: null};
  let masterySum = 0;
  let seen = 0;
  for (const code of codes) {
    const s = stats.get(code);
    out[levelOf(s)]++;
    if (s) {
      seen++;
      out.attempts += s.attempts;
      masterySum += s.mastery;
      if (overdue(s, now) >= 0) {
        out.due++;
      }
    }
  }
  out.mastery = seen ? masterySum / seen : null;
  return out;
}

/** The countries that have been practiced, weakest first (low mastery, then most attempts). */
export function weakest(
  stats: ReadonlyMap<CountryCode, CountryStats>,
  codes: readonly CountryCode[],
  limit: number,
): CountryStats[] {
  return codes
    .flatMap(c => {
      const s = stats.get(c);
      return s && s.box < KNOWN_BOX ? [s] : [];
    })
    .sort((a, b) => a.mastery - b.mastery || b.attempts - a.attempts)
    .slice(0, limit);
}

export interface SessionSummary {
  sheets: number;
  attempts: number;
  /** Average score over all attempts, or null. */
  score: number | null;
  last: number | null;
}

/** How many sheets have been corrected for a skill. */
export function sessions(records: readonly SheetRecord[], skill: Skill): SessionSummary {
  const latest = new Map<string, SheetRecord>();
  for (const r of records) {
    const old = latest.get(r.key);
    if (r.skill === skill && (!old || old.time <= r.time)) {
      latest.set(r.key, r);
    }
  }
  const rs = [...latest.values()];
  const attempts = rs.reduce((n, r) => n + r.attempts.length, 0);
  const total = rs.reduce((n, r) => n + r.attempts.reduce((m, a) => m + a.score, 0), 0);
  // Parts of the same sheet (splitRecord) count as one sheet.
  const sheets = new Set(rs.map(r => r.key.slice(0, KEY_LENGTH))).size;
  return {
    sheets,
    attempts,
    score: attempts ? total / attempts : null,
    last: rs.length ? Math.max(...rs.map(r => r.time)) : null,
  };
}

export interface SheetResult {
  time: number;
  /** Average score on the sheet (0–1). */
  score: number;
  answers: number;
}

/**
 * The result of each graded sheet for a skill, oldest first, at most `limit` (the latest).
 * Regrading replaces the earlier result, and the parts of a split sheet count as one sheet.
 */
export function recentSheets(records: readonly SheetRecord[], skill: Skill, limit: number): SheetResult[] {
  const latest = new Map<string, SheetRecord>();
  for (const r of records) {
    const old = latest.get(r.key);
    if (r.skill === skill && (!old || old.time <= r.time)) {
      latest.set(r.key, r);
    }
  }
  const sheets = new Map<string, {time: number; total: number; answers: number}>();
  for (const r of latest.values()) {
    const id = r.key.slice(0, KEY_LENGTH);
    const s = sheets.get(id) ?? {time: r.time, total: 0, answers: 0};
    s.time = Math.max(s.time, r.time);
    s.answers += r.attempts.length;
    s.total += r.attempts.reduce((m, a) => m + a.score, 0);
    sheets.set(id, s);
  }
  return [...sheets.values()]
    .filter(s => s.answers > 0)
    .sort((a, b) => a.time - b.time)
    .slice(-limit)
    .map(s => ({time: s.time, score: s.total / s.answers, answers: s.answers}));
}
