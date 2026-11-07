/**
 * Grading a table sheet against a fake SDK: the page is a list of elements, and what the
 * plugin inserts and saves is recorded.
 */
const mockPages = new Map<number, unknown[]>();
const mockInserted: Array<{page: number; elements: any[]}> = [];
const mockDeleted: number[] = [];
const mockNote = {path: '/notes/test.note'};
const mockDirs = new Set<string>();
const mockState = {page: 0, pages: 10};
const ok = (result: unknown) => ({success: true, result});

jest.mock('sn-plugin-lib', () => ({
  PluginManager: {
    getPluginDirPath: async () => '/plugin',
    hasPermission: async () => 1,
    requestPermission: async () => true,
  },
  PluginCommAPI: {
    getCurrentFilePath: async () => ok(mockNote.path),
    getCurrentPageNum: async () => ok(mockState.page),
    createElement: async (type: number) => ok({type}),
    insertPageElements: async (elements: any[], page: number) => {
      mockInserted.push({page, elements});
      return ok(true);
    },
    deletePageElements: async (nums: number[]) => {
      mockDeleted.push(...nums);
      return ok(true);
    },
    recognizeElements: async () => ok(''),
  },
  PluginFileAPI: {
    getPageSize: async (_: string, page: number) =>
      page >= 0 && page < mockState.pages ? ok({width: 1920, height: 2560}) : {success: false, error: {message: 'no such page'}},
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
import {ENGLISH as MAYBE_ENGLISH, getLanguage} from '../src/i18n';
import {hotSeatTexts} from '../src/i18n/hotseat';
import {rowLabel} from '../src/core/hotseat';
import {computeLayout, type Rect} from '../src/core/layout';
import {sheetTitle} from '../src/core/sheet';
import {countryIn} from '../src/core/countries';
import {forgetCache} from '../src/sdk/statsStore';
import {sheetIdDraft} from '../src/core/sheetId';
import type {CountryCode} from '../src/data/countries';

const ENGLISH = MAYBE_ENGLISH!;
const SIZE = {width: 1920, height: 2560};
let num = 0;
const text = (t: string, rect: Rect) => ({uuid: String(num), type: 500, numInPage: num++, layerNum: 0, textBox: {textContentFull: t, textRect: rect}});

/** A table sheet as createSheet draws it (only the texts that grading reads). */
function sheetPage(codes: CountryCode[], subtitle = ENGLISH.sheet.subtitle, part = 1, parts = 1) {
  const L = computeLayout(SIZE, codes.length);
  return [
    text(sheetTitle(ENGLISH, 'EU', codes.length, part, parts), L.title),
    text(subtitle, L.subtitle),
    ...codes.map((c, i) => text(countryIn(ENGLISH, c).name, L.rows[i].country)),
  ];
}

const insertedTexts = (): Array<{textContentFull: string; textRect: Rect}> => mockInserted.flatMap(i => i.elements).flatMap(e => (e.textBox ? [e.textBox] : []));
const statsRecords = () => [...mockDirs].filter(d => d.startsWith('/plugin/stats/'));

beforeEach(() => {
  mockPages.clear();
  mockInserted.length = 0;
  mockDeleted.length = 0;
  mockNote.path = '/notes/test.note';
  mockDirs.clear();
  mockState.page = 0;
  mockState.pages = 10;
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

test('grading the whole set skips pages that are no longer in the note', async () => {
  // Page 1 of 3 has been deleted, so "page 2 of 3" is now the first page of the note,
  // and the note ends after page 3.
  mockState.pages = 2;
  mockPages.set(0, sheetPage(['NO', 'SE'], undefined, 2, 3));
  mockPages.set(1, sheetPage(['DK', 'FI'], undefined, 3, 3));
  const r = await gradeSheet('set', () => {});
  expect(r.pages.map(p => p.part)).toEqual([2, 3]);
  expect(r.total).toBe(4);
});

/** The hidden sheet ID as createSheet writes it. */
function idText(id: string) {
  const d = sheetIdDraft(SIZE, id);
  if (d.kind !== 'text') {
    throw new Error('not text');
  }
  return text(d.text, d.rect);
}

test('two sheets with the same countries in the same note both count in the statistics', async () => {
  mockPages.set(0, [...sheetPage(['NO', 'SE']), idText('lx2k1a00')]);
  await gradeSheet('page', () => {});
  mockPages.set(0, [...sheetPage(['NO', 'SE']), idText('lx2k1b00')]);
  await gradeSheet('page', () => {});
  expect(statsRecords().length).toBe(2);
});

test('regrading the same sheet replaces the result, also after the note is renamed', async () => {
  const id = idText('lx2k1a00');
  mockPages.set(0, [...sheetPage(['NO', 'SE']), id]);
  await gradeSheet('page', () => {});
  mockNote.path = '/notes/renamed.note';
  await gradeSheet('page', () => {});
  expect(statsRecords().length).toBe(1);
  // The ID is never removed as an old result.
  expect(mockDeleted).not.toContain(id.numInPage);
});

test('a Serbian (Latin) sheet is graded in Serbian, not Bosnian, thanks to the stamp', async () => {
  const sr = getLanguage('sr-Latn')!;
  const codes: CountryCode[] = ['AR', 'EC'];
  const L = computeLayout(SIZE, codes.length);
  const stamp = sheetIdDraft(SIZE, 'lx2k1a00', sr);
  mockPages.set(0, [
    text(sheetTitle(sr, 'SA', codes.length), L.title),
    text(sr.sheet.subtitle, L.subtitle),
    ...codes.map((c, i) => text(countryIn(sr, c).name, L.rows[i].country)),
    ...(stamp.kind === 'text' ? [text(stamp.text, stamp.rect)] : []),
  ]);
  await gradeSheet('page', () => {});
  const keys = insertedTexts().map(t => t.textContentFull.split(/ [⁰-⁹¹²³]+$/)[0]);
  expect(keys).toEqual(expect.arrayContaining(['Buenos Ajres', 'Kito']));
});

test('shared sheet, page 2: a row whose player number cannot be read keeps the turn order', async () => {
  const hs = hotSeatTexts(ENGLISH);
  const codes: CountryCode[] = ['NO', 'SE', 'DK'];
  const L = computeLayout(SIZE, codes.length);
  // Page 1 had an odd number of rows, so page 2 starts with player 2: 2, 1, 2.
  // The label in the middle row is missing.
  const label = (row: number, player: number) => {
    const a = L.rows[row].answer;
    return text(rowLabel(player), {...a, right: a.left + 30});
  };
  mockPages.set(0, [...sheetPage(codes, hs.tableShared(2), 2, 2), label(0, 2), label(2, 2)]);
  const r = await gradeSheet('page', () => {});
  expect(r.players?.map(p => [p.player, p.max])).toEqual([
    [1, 1],
    [2, 2],
  ]);
});
