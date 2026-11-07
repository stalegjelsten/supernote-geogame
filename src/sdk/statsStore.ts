/**
 * Lagrer svarhistorikken på enheten.
 *
 * SDK-en kan ikke skrive vanlige filer, bare lage og slette mapper og liste
 * innholdet i en mappe. Hver post (ett rettet ark, se core/stats.ts) lagres
 * derfor som en tom mappe med posten kodet i navnet, i `<pluginmappe>/stats/`.
 * Å lese alt er ett kall til listFiles; å lagre et ark er én makeDir, pluss
 * én deleteDir hvis arket er rettet før.
 *
 * Lagring er en bekvemmelighet: feiler noe, mister vi statistikken for det
 * arket, men rettingen går som før.
 */
import {FileUtils, PluginManager} from 'sn-plugin-lib';
import {
  decodeRecord,
  encodeRecord,
  sameSheet,
  splitRecord,
  type SheetRecord,
} from '../core/stats';

const STATS_DIR = 'stats';

/** Eldre poster slettes når det blir flere enn dette, så listen holder seg rask. */
export const MAX_RECORDS = 3000;

interface Stored {
  name: string;
  record: SheetRecord;
}

let cache: Stored[] | null = null;
let dirPath: string | null = null;

async function statsDir(): Promise<string | null> {
  if (dirPath) {
    return dirPath;
  }
  const plugin = await PluginManager.getPluginDirPath();
  if (!plugin) {
    return null;
  }
  const dir = `${plugin}/${STATS_DIR}`;
  if (!(await FileUtils.exists(dir))) {
    await FileUtils.makeDir(dir);
  }
  dirPath = dir;
  return dir;
}

const baseName = (path: string) => path.replace(/\/+$/, '').split('/').pop() ?? path;

async function loadStored(): Promise<Stored[]> {
  if (cache) {
    return cache;
  }
  const dir = await statsDir();
  if (!dir) {
    return [];
  }
  const names = (await FileUtils.listFiles(dir)) ?? [];
  const out: Stored[] = [];
  for (const path of names) {
    const name = baseName(path);
    const record = decodeRecord(name);
    if (record) {
      out.push({name, record});
    }
  }
  cache = out;
  return out;
}

/** Alle lagrede poster. Tom liste hvis lagringen ikke er tilgjengelig. */
export async function loadRecords(): Promise<SheetRecord[]> {
  try {
    return (await loadStored()).map(s => s.record);
  } catch {
    return [];
  }
}

/**
 * Lagrer et rettet ark. Er samme ark rettet før, erstattes den forrige rettingen.
 * Kaster aldri; returnerer false hvis lagringen feilet.
 */
export async function saveRecord(record: SheetRecord): Promise<boolean> {
  if (!record.attempts.length) {
    return true;
  }
  try {
    const dir = await statsDir();
    if (!dir) {
      return false;
    }
    const stored = await loadStored();
    const parts = splitRecord(record);
    const fresh: Stored[] = [];
    for (const part of parts) {
      const name = encodeRecord(part);
      await FileUtils.makeDir(`${dir}/${name}`);
      fresh.push({name, record: part});
    }
    const newNames = new Set(fresh.map(f => f.name));
    const keep: Stored[] = [];
    for (const s of stored) {
      if (s.record.skill === record.skill && sameSheet(s.record.key, record.key) && !newNames.has(s.name)) {
        await FileUtils.deleteDir(`${dir}/${s.name}`);
      } else if (!newNames.has(s.name)) {
        keep.push(s);
      }
    }
    let all = [...keep, ...fresh];
    if (all.length > MAX_RECORDS) {
      all.sort((a, b) => a.record.time - b.record.time);
      const drop = all.slice(0, all.length - MAX_RECORDS);
      for (const s of drop) {
        await FileUtils.deleteDir(`${dir}/${s.name}`);
      }
      all = all.slice(drop.length);
    }
    cache = all;
    return true;
  } catch {
    // Ukjent tilstand på disk; les på nytt neste gang.
    cache = null;
    return false;
  }
}

/** Sletter all lagret statistikk. */
export async function clearRecords(): Promise<void> {
  const dir = await statsDir();
  cache = null;
  if (!dir) {
    return;
  }
  // Slett postene én for én; det er ikke sikkert deleteDir tar mapper med innhold.
  for (const path of (await FileUtils.listFiles(dir)) ?? []) {
    await FileUtils.deleteDir(`${dir}/${baseName(path)}`);
  }
}
