/** What notes.ts does when the device fails a call: never silently wrong. */
const mockDevice = {batchFails: false, insertedImages: 0, jumps: 0};

jest.mock('react-native', () => ({I18nManager: {getConstants: () => ({localeIdentifier: 'en_US'})}}));
jest.mock('sn-plugin-lib', () => ({
  PluginManager: {registerLangListener: () => {}},
  PluginCommAPI: {
    createElement: async (type: number) => ({success: true, result: {type}}),
    insertPageElements: async () =>
      mockDevice.batchFails ? {success: false, error: {code: 1, message: 'nope'}} : {success: true, result: true},
    jumpToPage: async () => {
      mockDevice.jumps++;
      return {success: true, result: true};
    },
    insertGeometry: async () => ({success: true, result: true}),
  },
  PluginNoteAPI: {
    insertImage: async () => {
      mockDevice.insertedImages++;
      return {success: true, result: true};
    },
    insertText: async () => ({success: true, result: true}),
  },
}));

import {insertDrafts, strokePointsAll, type PageElement} from '../src/sdk/notes';
import type {Draft} from '../src/core/draft';

const ref = {notePath: '/n.note', page: 0, size: {width: 1404, height: 1872}};
const picture: Draft = {kind: 'picture', path: '/map.png', rect: {left: 0, top: 0, right: 100, bottom: 100}};
const line: Draft = {kind: 'line', a: {x: 0, y: 0}, b: {x: 10, y: 0}, color: 0, width: 100};

beforeEach(() => {
  mockDevice.batchFails = false;
  mockDevice.insertedImages = 0;
  mockDevice.jumps = 0;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

test('a picture that must lie exactly is not handed to the device to place', async () => {
  mockDevice.batchFails = true;
  await expect(insertDrafts(ref, [picture, line], {exactPictures: true})).rejects.toThrow('insertPageElements');
  expect(mockDevice.insertedImages).toBe(0);
});

test('otherwise a failed batch falls back to one element at a time', async () => {
  mockDevice.batchFails = true;
  await insertDrafts(ref, [picture, line]);
  expect(mockDevice.insertedImages).toBe(1);
});

function stroke(failures: number): PageElement {
  let left = failures;
  return {
    uuid: '', type: 0, numInPage: 0, layerNum: 0,
    stroke: {
      points: {
        size: async () => {
          if (left-- > 0) {
            throw new Error('busy');
          }
          return 1;
        },
        getRange: async () => [{x: 1, y: 2}],
      },
    },
  };
}

test('a stroke that fails once is read again', async () => {
  expect(await strokePointsAll([stroke(0), stroke(1)])).toEqual([[{x: 1, y: 2}], [{x: 1, y: 2}]]);
});

test('a stroke that cannot be read stops the grading instead of being skipped', async () => {
  await expect(strokePointsAll([stroke(0), stroke(5)])).rejects.toThrow('(1/2)');
});
