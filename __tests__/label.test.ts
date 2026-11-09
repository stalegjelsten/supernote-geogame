import {getLanguage, LANGUAGES} from '../src/i18n';
import {countryIn} from '../src/core/countries';
import type {Rect} from '../src/core/layout';
import {
  LABEL_COUNTS,
  LABEL_REGIONS,
  gradeLabel,
  labelCapacity,
  labelCountsFor,
  labelKey,
  labelLayout,
  labelResultDrafts,
  labelSeparation,
  labelSheetDrafts,
  labelStyleFor,
  parseLabelKey,
  pickLabelCountries,
  segmentsCross,
  spreadTops,
} from '../src/core/labelSheet';
import {parseOutlineKey} from '../src/core/outlineSheet';
import {countryLabel} from '../src/core/countryCells';
import {hasLines} from '../src/core/mapLines';

const nb = getLanguage('nb')!;
const PAGES = [
  {width: 1920, height: 2560},
  {width: 1404, height: 1872},
];

let seed = 3;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const within = (a: Rect, page: {width: number; height: number}) =>
  a.left >= 0 && a.top >= 0 && a.right <= page.width && a.bottom <= page.height;

describe('label sheet layout', () => {
  for (const page of PAGES) {
    for (const region of LABEL_REGIONS) {
      it(`fits the largest sheet in ${region} on ${page.width}×${page.height}`, () => {
        expect(labelCapacity(page, region)).toBeGreaterThanOrEqual(
          Math.max(...LABEL_COUNTS),
        );
      });

      for (const count of labelCountsFor(page)) {
        it(`${region}, ${count} countries on ${page.width}: boxes apart, inside the page, lines not crossing`, () => {
          for (let round = 0; round < 5; round++) {
            const codes = pickLabelCountries(
              nb,
              region,
              count,
              random,
              undefined,
              'mixed',
              labelSeparation(page),
            ).map(c => c.code);
            // New sheets are numbered; boxes (version 1 on large pages) must still be laid out
            // the same way for grading old sheets.
            const style = labelStyleFor(page, 1);
            for (const L of [
              labelLayout(page, region, codes),
              labelLayout(page, region, codes, style),
            ]) {
              expect(L.slots).toHaveLength(codes.length);
              L.slots.forEach((s, i) => {
                expect(s.code).toBe(codes[i]);
                expect(within(s.box, page)).toBe(true);
                expect(within(s.result, page)).toBe(true);
                expect(overlaps(s.box, L.map)).toBe(false);
                // The dot is on the map.
                expect(s.anchor.x).toBeGreaterThanOrEqual(L.map.left);
                expect(s.anchor.x).toBeLessThanOrEqual(L.map.right);
                expect(s.anchor.y).toBeGreaterThanOrEqual(L.map.top);
                expect(s.anchor.y).toBeLessThanOrEqual(L.map.bottom);
                for (const o of L.slots.slice(i + 1)) {
                  expect(overlaps(s.band, o.band)).toBe(false);
                  if (s.line && o.line) {
                    expect(
                      segmentsCross(s.line[0], s.line[1], o.line[0], o.line[1]),
                    ).toBe(false);
                  }
                }
                if (L.style === 'numbered') {
                  // The number on the map is on the map, and covers no other number and no dot.
                  const tag = s.tag!;
                  expect(
                    within(tag, {width: L.map.right, height: L.map.bottom}),
                  ).toBe(true);
                  expect(tag.left >= L.map.left && tag.top >= L.map.top).toBe(
                    true,
                  );
                  for (const o of L.slots) {
                    if (o !== s) {
                      expect(overlaps(tag, o.tag!)).toBe(false);
                    }
                    const d = {
                      left: o.anchor.x - 2,
                      top: o.anchor.y - 2,
                      right: o.anchor.x + 2,
                      bottom: o.anchor.y + 2,
                    };
                    expect(overlaps(tag, d)).toBe(false);
                  }
                }
              });
              // The map keeps a useful size: at least 40 % of the page width, or (tall maps)
              // 38 % of the page height.
              if (codes.length <= 10 || L.style === 'leader') {
                const wide = L.map.right - L.map.left > page.width * 0.4;
                const tall = L.map.bottom - L.map.top > page.height * 0.38;
                expect(wide || tall).toBe(true);
              }
              // The bands don't reach the score or the title.
              expect(L.slots.every(s => s.band.bottom <= L.score.top)).toBe(
                true,
              );
              expect(L.slots.every(s => s.band.top >= L.subtitle.bottom)).toBe(
                true,
              );
            }
          }
        });
      }
    }
  }

  it('the layout is the same every time (grading computes it again)', () => {
    const codes = pickLabelCountries(nb, 'EU', 15, random).map(c => c.code);
    expect(labelLayout(PAGES[0], 'EU', codes)).toEqual(
      labelLayout(PAGES[0], 'EU', codes),
    );
  });
});

describe('number of countries', () => {
  it('stops at 15 on small pages and offers all on large ones', () => {
    expect(labelCountsFor(PAGES[0])).toEqual([...LABEL_COUNTS]);
    expect(labelCountsFor(PAGES[1])).toEqual([10, 15]);
  });
});

describe('spreadTops', () => {
  it('keeps wished tops that have room', () => {
    expect(spreadTops([0, 100, 300], 50, 0, 1000)).toEqual([0, 100, 300]);
  });
  it('pushes crowded boxes apart and back from the bottom', () => {
    expect(spreadTops([900, 900, 900], 100, 0, 1000)).toEqual([700, 800, 900]);
  });
});

describe('label key', () => {
  it('round-trips language, region, countries and sheet id', () => {
    const codes = pickLabelCountries(nb, 'AF', 20, random).map(c => c.code);
    for (const lang of LANGUAGES) {
      expect(parseLabelKey(labelKey(lang, 'AF', codes, 'abc123'))).toEqual({
        version: 2,
        lang,
        region: 'AF',
        codes,
        sheetId: 'abc123',
      });
    }
    expect(parseLabelKey(labelKey(nb, 'AF', codes))).toEqual({
      version: 2,
      lang: nb,
      region: 'AF',
      codes,
    });
  });
  it('reads keys from version 1, and grades their Manta sheets with boxes as they were drawn', () => {
    const v1 = labelKey(nb, 'AS', ['CN', 'IN']).replace('ID l2.', 'ID l1.');
    expect(parseLabelKey(v1)?.version).toBe(1);
    expect(labelStyleFor(PAGES[0], 1)).toBe('leader');
    expect(labelStyleFor(PAGES[1], 1)).toBe('numbered');
    expect(labelStyleFor(PAGES[0])).toBe('numbered');
    expect(labelStyleFor(PAGES[1])).toBe('numbered');
  });
  it('is not taken for an outline key, and the other way round', () => {
    const key = labelKey(nb, 'EU', ['NO', 'SE']);
    expect(parseOutlineKey(key)).toBeNull();
    expect(parseLabelKey('ID o1.nb.KFUD')).toBeNull();
    expect(parseLabelKey(key.replace('.EU.', '.ALL.'))).toBeNull();
  });
});

describe('drawing and grading', () => {
  it('draws the map, a number and a writing line for each country, and the key', () => {
    const codes = pickLabelCountries(nb, 'SA', 10, random).map(c => c.code);
    const drafts = labelSheetDrafts(
      PAGES[0],
      nb,
      'SA',
      codes,
      '/x/sa.png',
      'abc123',
    );
    expect(drafts.filter(d => d.kind === 'picture')).toHaveLength(1);
    // A writing line per country, and maybe a line from a dot to a number moved away from it.
    expect(drafts.filter(d => d.kind === 'line').length).toBeGreaterThanOrEqual(
      codes.length,
    );
    // Numbers on the map and a numbered list, on large and small pages alike.
    for (const page of PAGES) {
      const texts = labelSheetDrafts(page, nb, 'SA', codes, '/x/sa.png')
        .filter(d => d.kind === 'text')
        .map(d => (d.kind === 'text' ? d.text : ''));
      for (let n = 1; n <= codes.length; n++) {
        expect(texts).toContain(String(n));
        expect(texts).toContain(`${n}.`);
      }
    }
    const key = drafts.find(
      d => d.kind === 'text' && d.text.startsWith('ID l2.'),
    );
    expect(
      key && key.kind === 'text' && parseLabelKey(key.text)?.codes,
    ).toEqual(codes);
  });

  it('accepts the name in the sheet language, in English and with a typo', () => {
    const no = countryIn(nb, 'DE');
    expect(gradeLabel(no, 'Tyskland', nb).verdict).toBe('correct');
    expect(gradeLabel(no, 'Germany', nb).verdict).toBe('correct');
    expect(gradeLabel(no, 'Tyskladn', nb).verdict).toBe('close');
    expect(gradeLabel(no, 'Frankrike', nb).verdict).toBe('wrong');
  });

  it('writes the results in the strips under the boxes and the score', () => {
    const codes = pickLabelCountries(nb, 'EU', 10, random).map(c => c.code);
    const L = labelLayout(PAGES[0], 'EU', codes);
    const graded = codes.map((c, i) => {
      const country = countryIn(nb, c);
      const recognized = i % 2 ? country.name : '';
      return {
        index: i,
        country,
        recognized,
        result: gradeLabel(country, recognized, nb),
      };
    });
    const drafts = labelResultDrafts(PAGES[0], nb, 'EU', codes, graded);
    const score = drafts.find(
      d => d.kind === 'text' && d.text.startsWith(nb.sheet.scorePrefix),
    );
    expect(score).toBeDefined();
    // The answer is written for each empty box, inside its result strip.
    for (const [i, g] of graded.entries()) {
      if (g.recognized) {
        continue;
      }
      const name = drafts.find(
        d => d.kind === 'text' && d.text === g.country.name,
      );
      expect(
        name && name.kind === 'text' && overlaps(name.rect, L.slots[i].result),
      ).toBe(true);
    }
  });
});

describe('lines on the map', () => {
  it('finds borders and coasts, and none in the middle of a large country', () => {
    const au = countryLabel('OC', 'AU')!;
    expect(
      hasLines('OC', {
        left: au.x - 10,
        top: au.y - 10,
        right: au.x + 10,
        bottom: au.y + 10,
      }),
    ).toBe(false);
    // The frame and everything outside the image count as lines.
    expect(hasLines('OC', {left: -5, top: 100, right: 20, bottom: 120})).toBe(
      true,
    );
    // The border between Indonesia (outside Oceania) and Papua New Guinea.
    const pg = countryLabel('OC', 'PG')!;
    expect(
      hasLines('OC', {
        left: pg.x - 120,
        top: pg.y - 30,
        right: pg.x,
        bottom: pg.y + 30,
      }),
    ).toBe(true);
  });
});
