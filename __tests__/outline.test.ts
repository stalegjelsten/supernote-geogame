import {COUNTRY_CODES} from '../src/data/countries';
import {OUTLINES} from '../src/data/outlines';
import {getLanguage, LANGUAGES} from '../src/i18n';
import {countryIn} from '../src/core/countries';
import {decodeRings, encodeRings, OUTLINE_GRID} from '../src/core/outlineCodec';
import {
  OUTLINE_COUNTS,
  gradeCountryName,
  logShares,
  outlineKey,
  outlineLayout,
  outlineSheetDrafts,
  outlineShapes,
  parseOutlineKey,
  pickOutlineCountries,
  outlineCredit,
  roundKm,
} from '../src/core/outlineSheet';
import {outlineTexts} from '../src/i18n/outline';
import {SOURCES_URL, sourcesTexts} from '../src/i18n/sources';
import type {Rect} from '../src/core/layout';

const nb = getLanguage('nb')!;
const MANTA = {width: 1920, height: 2560};
const NOMAD = {width: 1404, height: 1872};

const inside = (p: {x: number; y: number}, r: Rect) =>
  p.x >= r.left - 1 && p.x <= r.right + 1 && p.y >= r.top - 1 && p.y <= r.bottom + 1;

test('the codec round-trips negative and large numbers', () => {
  const rings = [
    [
      [0, 0],
      [1000, 3],
      [5, 999],
      [17, 17],
    ],
    [
      [400, 400],
      [399, 401],
      [0, 1000],
    ],
  ] as Array<Array<[number, number]>>;
  expect(decodeRings(encodeRings(rings))).toEqual(rings);
});

test('every country has an outline that decodes inside the grid', () => {
  for (const code of COUNTRY_CODES) {
    const [km, w, h, text] = OUTLINES[code];
    const rings = decodeRings(text);
    expect([code, rings[0].length >= 3]).toEqual([code, true]);
    expect(km).toBeGreaterThan(0);
    // Simplification may drop the outermost point, so the shape can be a little smaller than the grid.
    expect(Math.max(w, h)).toBeGreaterThan(OUTLINE_GRID * 0.97);
    expect(Math.max(w, h)).toBeLessThanOrEqual(OUTLINE_GRID);
    for (const [x, y] of rings.flat()) {
      expect([code, x >= 0 && x <= w && y >= 0 && y <= h]).toEqual([code, true]);
    }
  }
});

test('the key round-trips language and countries, and does not show the codes', () => {
  const codes = ['NO', 'SE', 'DK', 'FI', 'IS', 'NO'] as const;
  const key = outlineKey(nb, [...codes]);
  expect(key).not.toContain('NOSE');
  expect(parseOutlineKey(key)).toEqual({lang: nb, codes: [...codes]});
  for (const lang of LANGUAGES) {
    expect(parseOutlineKey(outlineKey(lang, ['BR']))?.lang.code).toBe(lang.code);
  }
  expect(parseOutlineKey('ID o1.nb.ZZ')).toBeNull();
  expect(parseOutlineKey('Poeng: 3 av 4')).toBeNull();
});

test('grading accepts the name in the sheet language and in English, not another country', () => {
  const no = countryIn(nb, 'NO');
  expect(gradeCountryName(no, 'Norge', nb).verdict).toBe('correct');
  expect(gradeCountryName(no, 'Norway', nb).verdict).toBe('correct');
  expect(gradeCountryName(no, 'Nerge', nb).verdict).toBe('close');
  expect(gradeCountryName(no, '', nb).verdict).toBe('blank');
  // Writing exactly another country is wrong, even if it looks like the answer.
  const ng = countryIn(nb, 'NG');
  expect(gradeCountryName(ng, 'Niger', nb).verdict).toBe('wrong');
});

test('the cells fit on the page and do not overlap', () => {
  for (const size of [MANTA, NOMAD]) {
    for (const n of OUTLINE_COUNTS) {
      const L = outlineLayout(size, n);
      expect(L.cells).toHaveLength(n);
      for (const c of L.cells) {
        expect(c.band.right).toBeLessThanOrEqual(size.width);
        expect(c.band.bottom).toBeLessThan(L.score.top);
        expect(c.shape.bottom).toBeLessThan(c.lineY);
        expect(c.shape.top).toBeGreaterThanOrEqual(c.result.bottom);
      }
    }
  }
});

test('the outlines stay inside their cells for every size, scale and rotation', () => {
  const countries = pickOutlineCountries(nb, 'ALL', 20, () => 0.37);
  for (const scale of ['fit', 'bar', 'log'] as const) {
    for (const angle of [0, 33, 90, 217]) {
      const placements = countries.map(c => ({code: c.code, angle}));
      const L = outlineLayout(MANTA, placements.length);
      const shapes = outlineShapes(
        placements,
        L.cells.map(c => c.shape),
        0.96,
        scale,
      );
      shapes.forEach((s, i) => {
        for (const p of s.rings.flat()) {
          expect([scale, angle, i, inside(p, L.cells[i].shape)]).toEqual([scale, angle, i, true]);
        }
      });
      const drafts = outlineSheetDrafts(MANTA, nb, 'ALL', placements, {size: 'large', scale});
      expect(drafts.some(d => d.kind === 'text' && d.text.startsWith('ID o1.nb.'))).toBe(true);
    }
  }
});

test('log scale: the largest country is full size, ten times shorter is 0.7', () => {
  expect(logShares([1000, 100, 10, 0.1])).toEqual([1, 0.7, expect.closeTo(0.4, 6), 0.15]);
});

test('scale bars have round lengths', () => {
  expect(roundKm(730)).toBe(500);
  expect(roundKm(260)).toBe(200);
  expect(roundKm(19)).toBe(10);
  expect(roundKm(1)).toBe(1);
});

test('every language has outline texts', () => {
  for (const lang of LANGUAGES) {
    const t = outlineTexts(lang);
    expect([lang.code, t.titlePrefix.length > 0, t.ui.result(3, 4, 75).includes('{')]).toEqual([
      lang.code,
      true,
      false,
    ]);
  }
});

test('sheets with countries under a credit license get a credit line, others none', () => {
  expect(outlineCredit(['NO', 'SE', 'VA', 'AD'])).toBeNull();
  expect(outlineCredit(['NO', 'MC', 'SM', 'BB'])).toBe(
    'geoBoundaries: © OpenStreetMap contributors (ODbL) · Wikimedia Commons (CC BY 2.5)',
  );
  const drafts = outlineSheetDrafts(MANTA, nb, 'EU', [{code: 'MC', angle: 0}], {size: 'large', scale: 'fit'});
  expect(drafts.some(d => d.kind === 'text' && d.text.includes('OpenStreetMap'))).toBe(true);
});

test('every language has a sources section with the link filled in', () => {
  for (const lang of LANGUAGES) {
    const s = sourcesTexts(lang);
    expect([lang.code, s.changed.includes(SOURCES_URL), s.changed.includes('{')]).toEqual([lang.code, true, false]);
    expect(s.lines.some(([, credit]) => credit.includes('OpenStreetMap'))).toBe(true);
  }
});
