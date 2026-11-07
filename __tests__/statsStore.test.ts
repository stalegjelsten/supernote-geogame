/**
 * Storage against a fake file system that behaves like RTNFileModule.java:
 * listFiles returns objects {path, type}, and null for an empty folder.
 */
const mockDirs = new Set<string>();

jest.mock('sn-plugin-lib', () => ({
  PluginManager: {getPluginDirPath: async () => '/plugin'},
  FileUtils: {
    exists: async (p: string) => mockDirs.has(p),
    makeDir: async (p: string) => {
      mockDirs.add(p);
      return true;
    },
    deleteDir: async (p: string) => {
      for (const d of [...mockDirs]) {
        if (d === p || d.startsWith(p + '/')) {
          mockDirs.delete(d);
        }
      }
      return true;
    },
    listFiles: async (p: string) => {
      if (!mockDirs.has(p)) {
        throw new Error('Dir is not exists');
      }
      const children = [...mockDirs].filter(d => d.startsWith(p + '/') && !d.slice(p.length + 1).includes('/'));
      return children.length ? children.map(path => ({path, type: 0})) : null;
    },
  },
}));

import {clearRecords, forgetCache, loadRecords, saveRecord} from '../src/sdk/statsStore';
import type {SheetRecord} from '../src/core/stats';

const T0 = Date.UTC(2026, 10, 1);
const rec = (key: string, time: number, score: number): SheetRecord => ({
  skill: 'capital',
  time,
  key,
  attempts: [{code: 'NO', score}, {code: 'SE', score: 1}],
});

beforeEach(() => {
  mockDirs.clear();
  forgetCache();
});

test('the entries survive a restart', async () => {
  expect(await saveRecord(rec('aaaaaaaaaaaaaa', T0, 0))).toBe(true);
  expect(await saveRecord(rec('bbbbbbbbbbbbbb', T0 + 1000, 1))).toBe(true);
  forgetCache();
  const loaded = await loadRecords();
  expect(loaded.map(r => r.key).sort()).toEqual(['aaaaaaaaaaaaaa', 'bbbbbbbbbbbbbb']);
});

test('regrading the same sheet replaces the old one, also after a restart', async () => {
  await saveRecord(rec('aaaaaaaaaaaaaa', T0, 0));
  forgetCache();
  await saveRecord(rec('aaaaaaaaaaaaaa', T0 + 60_000, 1));
  forgetCache();
  const loaded = await loadRecords();
  expect(loaded).toHaveLength(1);
  expect(loaded[0].attempts[0].score).toBe(1);
  expect([...mockDirs].filter(d => d.startsWith('/plugin/stats/'))).toHaveLength(1);
});

test('reset deletes everything', async () => {
  await saveRecord(rec('aaaaaaaaaaaaaa', T0, 0));
  await clearRecords();
  forgetCache();
  expect(await loadRecords()).toEqual([]);
});
