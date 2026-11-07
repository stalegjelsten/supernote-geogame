/**
 * Grading a table sheet against a fake SDK: the page is a list of elements, and what the
 * plugin inserts and saves is recorded.
 */
const mockPages = new Map<number, unknown[]>();
const mockInserted: Array<{page: number; elements: any[]}> = [];
const mockDirs = new Set<string>();
const mockState = {page: 0};
const ok = (result: unknown) => ({success: true, result});

jest.mock('sn-plugin-lib', () => ({
  PluginManager: {
    getPluginDirPath: async () => '/plugin',
    hasPermission: async () => 1,
    requestPermission: async () => true,
  },
  PluginCommAPI: {
    getCurrentFilePath: async () => ok('/notes/test.note'),
    getCurrentPageNum: async () => ok(mockState.page),
    createElement: async (type: number) => ok({type}),
    insertPageElements: async (elements: any[], page: number) => {
      mockInserted.push({page, elements});
      return ok(true);
    },
    deletePageElements: async () => ok(true),
    recognizeElements: async () => ok(''),
  },
  PluginFileAPI: {
    getPageSize: async () => ok({width: 1920, height: 2560}),
    getElements: async (page: number) => ok(mockPages.get(page) ?? []),
  },
  PluginNoteAPI: {saveCurrentNote: async () => ok(true)},
  FileUtils: {
    exists: async (p: string) => mockDirs.has(p),
    makeDir: async (p: string) => {
      mockDirs.add(p);
      return true;
    },
    deleteDir: async (p: string) => {
      mockDirs.delete(p);
      return true;
    },
    listFiles: async (p: string) =>
      [...mockDirs].filter(d => d.startsWith(p + '/')).map(path => ({path, type: 0})),
  },
}));

import {gradeSheet} from '../src/actions';
import {ENGLISH as MAYBE_ENGLISH} from '../src/i18n';
import {hotSeatTexts} from '../src/i18n/hotseat';
import {computeLayout, type Rect} from '../src/core/layout';
import {sheetTitle} from '../src/core/sheet';
import {countryIn} from '../src/core/countries';
import {forgetCache} from '../src/sdk/statsStore';
import type {CountryCode} from '../src/data/countries';

const ENGLISH = MAYBE_ENGLISH!;
const SIZE = {width: 1920, height: 2560};
let num = 0;
const text = (t: string, rect: Rect) => ({uuid: String(num), type: 500, numInPage: num++, layerNum: 0, textBox: {textContentFull: t, textRect: rect}});

/** A table sheet as createSheet draws it (only the texts that grading reads). */
function sheetPage(codes: CountryCode[], subtitle = ENGLISH.sheet.subtitle) {
  const L = computeLayout(SIZE, codes.length);
  return [
    text(sheetTitle(ENGLISH, 'EU', codes.length), L.title),
    text(subtitle, L.subtitle),
    ...codes.map((c, i) => text(countryIn(ENGLISH, c).name, L.rows[i].country)),
  ];
}

const insertedTexts = (): Array<{textContentFull: string; textRect: Rect}> => mockInserted.flatMap(i => i.elements).flatMap(e => (e.textBox ? [e.textBox] : []));
const statsRecords = () => [...mockDirs].filter(d => d.startsWith('/plugin/stats/'));

beforeEach(() => {
  mockPages.clear();
  mockInserted.length = 0;
  mockDirs.clear();
  mockState.page = 0;
  forgetCache();
});

test('regrading: an answer key spelled like a country does not count as an extra row', async () => {
  const codes: CountryCode[] = [
    'NO', 'SE', 'DK', 'FI', 'IS', 'DE', 'FR', 'ES', 'PT', 'IT',
    'NL', 'BE', 'AT', 'CH', 'PL', 'CZ', 'SK', 'HU', 'IE', 'LU',
  ];
  const L = computeLayout(SIZE, codes.length);
  const last = codes.length - 1;
  // From the first grading: blank answer for Luxembourg, so the answer key "Luxembourg" is in the result column.
  mockPages.set(0, [...sheetPage(codes), text('Luxembourg', L.rows[last].result)]);
  const r = await gradeSheet('page', () => {});
  expect(r.total).toBe(codes.length);
  // Every row is blank, so each gets its answer key, which must sit in that row.
  const texts = insertedTexts();
  codes.forEach((c, i) => {
    const key = texts.find(t => t.textContentFull.split(/ [⁰-⁹¹²³]+$/)[0] === countryIn(ENGLISH, c).capital);
    expect(key).toBeDefined();
    const mid = (key!.textRect.top + key!.textRect.bottom) / 2;
    const {top, bottom} = L.rows[i].band;
    expect([c, Math.abs(mid - (top + bottom) / 2) < (bottom - top) * 0.15]).toEqual([c, true]);
  });
});

test('a single-player sheet is saved in the statistics', async () => {
  mockPages.set(0, sheetPage(['NO', 'SE']));
  await gradeSheet('page', () => {});
  expect(statsRecords().length).toBe(1);
});

test('pass around: grading the whole set saves no statistics', async () => {
  const hs = hotSeatTexts(ENGLISH);
  // Player 1 on page 0, handover on page 1, player 2 on page 2.
  mockPages.set(0, sheetPage(['NO', 'SE'], hs.tablePass(1, 2)));
  mockPages.set(2, sheetPage(['NO', 'SE'], hs.tablePass(2, 2)));
  const r = await gradeSheet('set', () => {});
  expect(r.players?.map(p => p.player)).toEqual([1, 2]);
  expect(r.missing).toEqual([]);
  expect(statsRecords()).toEqual([]);
});
