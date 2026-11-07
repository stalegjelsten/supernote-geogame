import {computeLayout, textWidthEm, titleFontSize} from '../src/core/layout';
import {mapLayoutFor, mapSheetTitle} from '../src/core/mapSheet';
import {sheetTitle, type Region} from '../src/core/sheet';
import {CONTINENTS} from '../src/data/countries';
import {LANGUAGES} from '../src/i18n';

const SIZES = [
  {width: 1920, height: 2560},
  {width: 1404, height: 1872},
];
const REGIONS: Region[] = ['ALL', ...CONTINENTS];

/** The title fits on one line when its estimated bold width is within the rectangle. */
function fitsOnOneLine(title: string, rect: {left: number; right: number}, maxSize: number) {
  const size = titleFontSize(title, {...rect, top: 0, bottom: 1000}, maxSize);
  return size * textWidthEm(title) * 1.1 <= rect.right - rect.left + 1;
}

test('the longest table titles fit on one line in every language', () => {
  for (const page of SIZES) {
    const L = computeLayout(page, 20);
    const max = Math.round(L.fontSize * 1.4);
    for (const lang of LANGUAGES) {
      for (const region of REGIONS) {
        const title = sheetTitle(lang, region, 199, 10, 10);
        expect([lang.code, title, fitsOnOneLine(title, L.title, max)]).toEqual([lang.code, title, true]);
      }
    }
  }
});

test('the longest map titles fit on one line in every language', () => {
  for (const page of SIZES) {
    for (const region of REGIONS) {
      const L = mapLayoutFor(page, region);
      const max = Math.round(L.fontSize * 1.4);
      for (const lang of LANGUAGES) {
        for (const target of ['capital', 'country'] as const) {
          const title = mapSheetTitle(lang, region, target);
          expect([lang.code, title, fitsOnOneLine(title, L.title, max)]).toEqual([lang.code, title, true]);
        }
      }
    }
  }
});

test('short titles keep the full size', () => {
  const L = computeLayout({width: 1920, height: 2560}, 20);
  const max = Math.round(L.fontSize * 1.4);
  expect(titleFontSize('Hovedsteder – Europa (20)', L.title, max)).toBe(max);
});
