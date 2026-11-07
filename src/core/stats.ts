/**
 * Svarhistorikk og statistikk per land, uten SDK.
 *
 * Hvert rettet ark (eller hver rettet side i et sett) blir én `SheetRecord`:
 * hvilken ferdighet som ble øvd, når, og hvor godt det gikk med hvert land.
 * All statistikk regnes ut fra disse postene, så modellen kan endres senere
 * uten at noe lagret må skrives om.
 *
 * Postene lagres som mappenavn (se src/sdk/statsStore.ts), fordi SDK-en ikke
 * kan skrive vanlige filer. Kodingen bruker derfor bare små bokstaver, sifre
 * og punktum, og holder seg godt under 255 tegn.
 */
import {CONTINENT_OF, type CountryCode} from '../data/countries';
import type {Verdict} from './match';

/**
 * Det som øves:
 * - capital: skrive hovedstaden (tabellarket)
 * - mapCapital: finne hovedstaden på kartet
 * - mapCountry: finne landet på kartet
 */
export type Skill = 'capital' | 'mapCapital' | 'mapCountry';

export const SKILLS: Skill[] = ['capital', 'mapCapital', 'mapCountry'];

const SKILL_CHAR: Record<Skill, string> = {capital: 't', mapCapital: 'm', mapCountry: 'c'};
const CHAR_SKILL: Record<string, Skill> = {t: 'capital', m: 'mapCapital', c: 'mapCountry'};

/** Ett svar på ett land. `score` er fra 0 (feil/vet ikke) til 1 (helt riktig). */
export interface Attempt {
  code: CountryCode;
  score: number;
}

export interface SheetRecord {
  skill: Skill;
  /** Tidspunkt for rettingen, ms siden 1970. Lagres med sekundoppløsning. */
  time: number;
  /**
   * Identifiserer arket, så en ny retting av samme ark erstatter den forrige
   * i stedet for å telle dobbelt. Se `sheetKey`.
   */
  key: string;
  attempts: Attempt[];
}

/** Score lagres som ett tegn i base 36: 0–35. */
const LEVELS = 35;
const RECORD_PREFIX = 'g1';
/** Mappenavn kan være opptil 255 byte; hold god avstand. */
export const MAX_NAME_LENGTH = 240;

// ---------------------------------------------------------------- score

/** Score for et svar på tabellarket. «Nesten» teller som nesten helt riktig. */
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

/** Score for en hovedstad på kartet: andelen av full pott. */
export function mapPointsScore(points: number, max = 1000): number {
  return max > 0 ? Math.max(0, Math.min(1, points / max)) : 0;
}

/** En score på minst dette regnes som «kunne det». */
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
 * Nøkkel for et ark: notatet og hvilke land som står på siden. Landene er med
 * så nøkkelen ikke endres om sider settes inn eller flyttes i notatet.
 */
export const KEY_LENGTH = 14;

export function sheetKey(notePath: string, skill: Skill, codes: readonly CountryCode[]): string {
  const text = [notePath, skill, ...[...codes].sort()].join('|');
  const a = fnv1a(text).toString(36).padStart(7, '0');
  const b = fnv1a(text, 0x5ad1a7d5).toString(36).padStart(7, '0');
  return a + b;
}

/**
 * «g1.t.<tid>.<nøkkel>.<land og score>», f.eks. «g1.t.lx2k1a.0abc….noz.se0».
 * Én post per land er tre tegn: landkoden og scoren.
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
 * Deler et ark i flere poster hvis det er for mange land for ett mappenavn.
 * Delene får egne nøkler (`<nøkkel>`, `<nøkkel>1`, …), så de erstattes sammen.
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

/** Hører posten til samme ark som nøkkelen (inkludert delene fra `splitRecord`)? */
export function sameSheet(recordKey: string, key: string): boolean {
  return recordKey.slice(0, KEY_LENGTH) === key.slice(0, KEY_LENGTH);
}

// ---------------------------------------------------------------- statistikk

/**
 * Hvor lenge et land kan vente før det bør øves igjen, etter hvor mange ganger
 * på rad det er kunnet (Leitner-bokser). Boks 0 = øv nå.
 */
export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30, 60];
export const MAX_BOX = BOX_INTERVAL_DAYS.length - 1;
/** Fra denne boksen regnes landet som «kan». */
export const KNOWN_BOX = 3;

const DAY = 24 * 60 * 60 * 1000;

export interface CountryStats {
  code: CountryCode;
  attempts: number;
  /** Antall ganger det ble kunnet (score ≥ PASS). */
  passes: number;
  /** Glidende snitt av scorene, vektet mot de siste forsøkene (0–1). */
  mastery: number;
  /** Antall ganger på rad det er kunnet, fra det siste forsøket og bakover. */
  streak: number;
  /** Leitner-boks: øker med én når landet kunnes, faller til 0 når det ikke gjør det. */
  box: number;
  firstSeen: number;
  lastSeen: number;
  lastScore: number;
}

/** Hvor mye det siste forsøket teller i `mastery`. */
const MASTERY_WEIGHT = 0.4;

/**
 * Regner ut statistikk per land for én ferdighet. Poster med samme nøkkel
 * (samme ark rettet flere ganger) teller bare én gang: den siste rettingen.
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

/** Når landet bør øves neste gang (ms). */
export function dueAt(s: CountryStats): number {
  return s.lastSeen + BOX_INTERVAL_DAYS[s.box] * DAY;
}

/** Hvor mange intervaller landet er på overtid (0 = akkurat nå, negativ = ikke ennå). */
export function overdue(s: CountryStats, now: number): number {
  const interval = Math.max(BOX_INTERVAL_DAYS[s.box] * DAY, DAY / 4);
  return (now - dueAt(s)) / interval;
}

/** new = aldri øvd, learning = øvd men ikke sikker ennå, known = kunnet flere ganger på rad. */
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
  /** Til repetisjon nå: øvd før og på overtid. */
  due: number;
  attempts: number;
  /** Snitt av `mastery` for landene som er øvd, eller null. */
  mastery: number | null;
}

/** Oppsummering for et utvalg land (f.eks. en verdensdel). */
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

/** De landene som er øvd, svakest først (lav mastery, så flest forsøk). */
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
  /** Snittscore over alle forsøk, eller null. */
  score: number | null;
  last: number | null;
}

/** Hvor mange ark som er rettet for en ferdighet. */
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
  // Deler av samme ark (splitRecord) telles som ett ark.
  const sheets = new Set(rs.map(r => r.key.slice(0, KEY_LENGTH))).size;
  return {
    sheets,
    attempts,
    score: attempts ? total / attempts : null,
    last: rs.length ? Math.max(...rs.map(r => r.time)) : null,
  };
}
