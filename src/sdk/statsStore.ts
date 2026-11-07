/**
 * Stores the answer history on the device.
 *
 * The SDK cannot write regular files, only create and delete folders and list
 * the contents of a folder. Each record (one graded sheet, see core/stats.ts) is therefore
 * stored as an empty folder with the record encoded in its name, in `<plugin folder>/stats/`.
 * Reading everything is one call to listFiles; saving a sheet is one makeDir, plus
 * one deleteDir if the sheet has been graded before.
 *
 * Saving is a convenience: if something fails, we lose the statistics for that
 * sheet, but the grading proceeds as before.
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

/** Older records are deleted when there are more than this, so the list stays fast. */
export const MAX_RECORDS = 3000;

interface Stored {
  name: string;
  record: SheetRecord;
}

let cache: Stored[] | null = null;
let dirPath: string | null = null;

/** Forgets what has been read in, as on a restart of the plugin (used in tests). */
export function forgetCache(): void {
  cache = null;
  dirPath = null;
}

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

/**
 * The names in a folder. The types in sn-plugin-lib say that listFiles returns strings,
 * but the Java code returns objects `{path, type}` (type 0 = folder), and null for an
 * empty folder. We accept both.
 */
async function listNames(dir: string): Promise<string[]> {
  const entries = ((await FileUtils.listFiles(dir)) ?? []) as unknown[];
  return entries.flatMap(e => {
    const path = typeof e === 'string' ? e : (e as {path?: unknown} | null)?.path;
    return typeof path === 'string' ? [baseName(path)] : [];
  });
}

async function loadStored(): Promise<Stored[]> {
  if (cache) {
    return cache;
  }
  const dir = await statsDir();
  if (!dir) {
    return [];
  }
  const out: Stored[] = [];
  for (const name of await listNames(dir)) {
    const record = decodeRecord(name);
    if (record) {
      out.push({name, record});
    }
  }
  cache = out;
  return out;
}

/** All stored records. Empty list if the storage is not available. */
export async function loadRecords(): Promise<SheetRecord[]> {
  try {
    return (await loadStored()).map(s => s.record);
  } catch {
    return [];
  }
}

/**
 * Saves a graded sheet. If the same sheet has been graded before, the previous grading is replaced.
 * Never throws; returns false if saving failed.
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
    // Unknown state on disk; read again next time.
    cache = null;
    return false;
  }
}

/** Deletes all stored statistics. */
export async function clearRecords(): Promise<void> {
  const dir = await statsDir();
  cache = null;
  if (!dir) {
    return;
  }
  // Delete the records one by one; deleteDir may not handle folders with contents.
  for (const name of await listNames(dir)) {
    await FileUtils.deleteDir(`${dir}/${name}`);
  }
}
