/** insertBlankPages must not hang when the device never answers a call. */
const mockDevice = {
  pages: 1,
  inserts: 0,
  reloads: 0,
  /** Insertion number (1-based) that does its job but never answers. */
  silentInsert: 0,
  /** reloadFile never answers. */
  silentReload: false,
};

const never = () => new Promise<never>(() => {});

jest.mock('react-native', () => ({I18nManager: {getConstants: () => ({localeIdentifier: 'en_US'})}}));
jest.mock('sn-plugin-lib', () => ({
  PluginManager: {registerLangListener: () => {}},
  PluginCommAPI: {
    getNoteSystemTemplates: async () => [{name: 'White'}],
    reloadFile: () => {
      mockDevice.reloads++;
      return mockDevice.silentReload ? never() : Promise.resolve({success: true, result: true});
    },
  },
  PluginFileAPI: {
    getNotePageTemplate: async () => ({success: true, result: {name: 'White'}}),
    getNoteTotalPageNum: async () => ({success: true, result: mockDevice.pages}),
    insertNotePage: () => {
      mockDevice.pages++;
      mockDevice.inserts++;
      return mockDevice.inserts === mockDevice.silentInsert ? never() : Promise.resolve({success: true, result: true});
    },
  },
}));

import {insertBlankPages} from '../src/sdk/notes';

const ref = {notePath: '/n.note', page: 0, size: {width: 1404, height: 1872}};

beforeEach(() => {
  jest.useFakeTimers();
  Object.assign(mockDevice, {pages: 1, inserts: 0, reloads: 0, silentInsert: 0, silentReload: false});
});
afterEach(() => jest.useRealTimers());

async function run(count: number, onPage?: (done: number, n: number) => void) {
  const p = insertBlankPages(ref, 1, count, onPage);
  let settled = false;
  p.then(
    () => (settled = true),
    () => (settled = true),
  );
  for (let i = 0; i < 200 && !settled; i++) {
    await jest.advanceTimersByTimeAsync(1000);
  }
  return p;
}

test('10 pages, reloading only once when the count goes up by itself', async () => {
  const seen: number[] = [];
  await run(10, done => seen.push(done));
  expect(mockDevice.pages).toBe(11);
  expect(mockDevice.inserts).toBe(10);
  expect(mockDevice.reloads).toBe(1);
  expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('does not hang when reloadFile never answers', async () => {
  mockDevice.silentReload = true;
  await run(10);
  expect(mockDevice.pages).toBe(11);
});

test('does not hang, or make an extra page, when one insertion never answers', async () => {
  mockDevice.silentInsert = 4;
  await run(10);
  expect(mockDevice.pages).toBe(11);
  expect(mockDevice.inserts).toBe(10);
});
