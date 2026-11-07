import {CAPITAL_LONLAT} from '../src/data/capitals';
import {CONTINENT_OF, COUNTRY_CODES} from '../src/data/countries';
import {MAPS, MAP_SHEET_COUNT} from '../src/data/maps';
import {getLanguage, LANGUAGES} from '../src/i18n';
import {mapTexts} from '../src/i18n/map';
import {SAFE_MARGIN, computeMapLayout} from '../src/core/mapLayout';
import {countryAt, countryLabel, hitsCountry} from '../src/core/countryCells';
import {
  assignMarks,
  groupMarks,
  isStraight,
  segmentIntersection,
} from '../src/core/mapMarks';
import {
  capitalsIn,
  fitEntry,
  MAP_COUNTS,
  MAP_ENTRY_STYLES,
  MAP_REGIONS,
  entryText,
  gradeMap,
  mapLayoutFor,
  mapSheetDrafts,
  mapSheetTitle,
  parseEntry,
  parseMapTitle,
  pickMapCountries,
  ringStroke,
} from '../src/core/mapSheet';
import {
  haversineKm,
  imageToLonLat,
  lonLatToImage,
  lonLatToPage,
  pageToLonLat,
  project,
  unproject,
} from '../src/core/projection';
import {MAX_POINTS, mapPoints} from '../src/core/scoring';
import {parseSheetTitle} from '../src/core/sheet';
import type {Point} from '../src/core/marks';

const nb = getLanguage('nb')!;
const en = getLanguage('en')!;
const MANTA = {width: 1920, height: 2560};
const A5X = {width: 1404, height: 1872};

/** Deterministisk tilfeldighet for tester. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('projeksjon', () => {
  it('går frem og tilbake for alle kart', () => {
    for (const region of MAP_REGIONS) {
      const m = MAPS[region];
      for (const code of COUNTRY_CODES) {
        const [lon, lat] = CAPITAL_LONLAT[code];
        const p = lonLatToImage(m, lon, lat);
        const back = imageToLonLat(m, p.x, p.y);
        if (region === 'ALL' || CONTINENT_OF[code] === region) {
          expect(back.lat).toBeCloseTo(lat, 6);
          expect(Math.abs(((back.lon - lon + 540) % 360) - 180)).toBeLessThan(
            1e-6,
          );
        }
      }
    }
  });

  it('LAEA og Equal Earth er inverse av hverandre i hele området', () => {
    const projections = [
      {kind: 'laea' as const, lon0: 15, lat0: 52},
      {kind: 'laea' as const, lon0: 160, lat0: -14},
      {kind: 'equalEarth' as const, lon0: 10},
    ];
    for (const p of projections) {
      for (let lat = -80; lat <= 80; lat += 20) {
        for (let lon = -170; lon <= 170; lon += 40) {
          const xy = project(p, lon, lat);
          const back = unproject(p, xy.x, xy.y);
          expect(back.lat).toBeCloseTo(lat, 6);
          expect(back.lon).toBeCloseTo(lon, 6);
        }
      }
    }
  });

  it('regner side ↔ lengde/bredde med kartets plassering på siden', () => {
    const m = MAPS.EU;
    const rect = {
      left: 100,
      top: 300,
      right: 100 + m.width / 2,
      bottom: 300 + m.height / 2,
    };
    const p = lonLatToPage(m, rect, 10.75, 59.91);
    const back = pageToLonLat(m, rect, p.x, p.y);
    expect(back.lon).toBeCloseTo(10.75, 6);
    expect(back.lat).toBeCloseTo(59.91, 6);
  });

  it('haversine gir kjente avstander', () => {
    const oslo = {lon: 10.739, lat: 59.913};
    const stockholm = {lon: 18.069, lat: 59.329};
    expect(haversineKm(oslo, stockholm)).toBeGreaterThan(410);
    expect(haversineKm(oslo, stockholm)).toBeLessThan(420);
    expect(haversineKm(oslo, oslo)).toBe(0);
    // En kvart omkrets langs ekvator.
    expect(haversineKm({lon: 0, lat: 0}, {lon: 90, lat: 0})).toBeCloseTo(
      10007.5,
      0,
    );
  });
});

describe('hovedsteder på kartene', () => {
  it('har koordinater for alle 197 land', () => {
    expect(COUNTRY_CODES).toHaveLength(197);
    for (const code of COUNTRY_CODES) {
      const [lon, lat] = CAPITAL_LONLAT[code];
      expect(Math.abs(lon)).toBeLessThanOrEqual(180);
      expect(Math.abs(lat)).toBeLessThanOrEqual(90);
    }
  });

  it.each(MAP_REGIONS)('hver hovedstad i %s ligger innenfor kartet', region => {
    const m = MAPS[region];
    const margin = 8;
    for (const code of COUNTRY_CODES) {
      if (region !== 'ALL' && CONTINENT_OF[code] !== region) {
        continue;
      }
      const [lon, lat] = CAPITAL_LONLAT[code];
      const p = lonLatToImage(m, lon, lat);
      const ok =
        p.x >= margin &&
        p.x <= m.width - margin &&
        p.y >= margin &&
        p.y <= m.height - margin;
      if (!ok) {
        throw new Error(
          `${code} (${lon}, ${lat}) havner på ${p.x.toFixed(0)}, ${p.y.toFixed(
            0,
          )} i ${m.file}.png`,
        );
      }
    }
  });

  it('noen kjente steder stemmer med fasit', () => {
    expect(CAPITAL_LONLAT.NO[1]).toBeCloseTo(59.91, 1);
    expect(CAPITAL_LONLAT.NO[0]).toBeCloseTo(10.74, 1);
    expect(CAPITAL_LONLAT.AU[1]).toBeCloseTo(-35.29, 1);
    expect(CAPITAL_LONLAT.WS[0]).toBeCloseTo(-171.83, 1);
  });
});

describe('poengkurve', () => {
  it('gir full pott for treff og nær treff', () => {
    expect(mapPoints(0, 300)).toBe(MAX_POINTS);
    expect(mapPoints(30, 300)).toBe(MAX_POINTS);
  });

  it('avtar jevnt og holder seg mellom 0 og 1000', () => {
    let last = MAX_POINTS;
    for (let d = 0; d <= 20000; d += 25) {
      const p = mapPoints(d, 300);
      expect(p).toBeLessThanOrEqual(last);
      expect(p).toBeGreaterThanOrEqual(0);
      last = p;
    }
    expect(mapPoints(20000, 300)).toBe(0);
  });

  it('er strengere på små kart enn på store', () => {
    expect(mapPoints(300, MAPS.EU.scaleKm)).toBeLessThan(
      mapPoints(300, MAPS.ALL.scaleKm),
    );
    expect(MAPS.EU.scaleKm).toBeLessThan(MAPS.AS.scaleKm);
    expect(MAPS.ALL.scaleKm).toBe(1000);
  });

  it('har kjente verdier', () => {
    expect(mapPoints(300, 300)).toBe(407);
    expect(mapPoints(300, 1000)).toBe(819);
  });

  it('tåler ugyldige verdier', () => {
    expect(mapPoints(NaN, 300)).toBe(0);
    expect(mapPoints(-1, 300)).toBe(0);
    expect(mapPoints(10, 0)).toBe(0);
  });
});

/** Et rett strøk fra a til b med noen mellompunkter. */
function line(a: Point, b: Point, n = 6): Point[] {
  return Array.from({length: n + 1}, (_, i) => ({
    x: a.x + ((b.x - a.x) * i) / n,
    y: a.y + ((b.y - a.y) * i) / n,
  }));
}

function cross(c: Point, r = 12): Point[][] {
  return [
    line({x: c.x - r, y: c.y - r}, {x: c.x + r, y: c.y + r}),
    line({x: c.x + r, y: c.y - r}, {x: c.x - r, y: c.y + r}),
  ];
}

function circle(c: Point, r = 15): Point[] {
  return Array.from({length: 25}, (_, i) => ({
    x: c.x + r * Math.cos((i / 24) * 2 * Math.PI),
    y: c.y + r * Math.sin((i / 24) * 2 * Math.PI),
  }));
}

describe('merker på kartet', () => {
  it('kjenner igjen rette strøk og skjæringspunkter', () => {
    expect(isStraight(line({x: 0, y: 0}, {x: 10, y: 10}))).toBe(true);
    expect(isStraight(circle({x: 0, y: 0}))).toBe(false);
    expect(
      segmentIntersection(
        {x: 0, y: 0},
        {x: 10, y: 10},
        {x: 10, y: 0},
        {x: 0, y: 10},
      ),
    ).toEqual({x: 5, y: 5});
    expect(
      segmentIntersection(
        {x: 0, y: 0},
        {x: 10, y: 0},
        {x: 0, y: 5},
        {x: 10, y: 5},
      ),
    ).toBeNull();
  });

  it('slår sammen to kryssende streker til ett merke med krysningspunktet som midte', () => {
    const marks = groupMarks([
      ...cross({x: 100, y: 100}),
      ...cross({x: 300, y: 200}),
    ]);
    expect(marks).toHaveLength(2);
    expect(marks[0].strokes).toEqual([0, 1]);
    expect(marks[0].center.x).toBeCloseTo(100);
    expect(marks[0].center.y).toBeCloseTo(100);
    expect(marks[1].center.x).toBeCloseTo(300);
  });

  it('holder to kryss rett ved siden av hverandre adskilt (Roma og Vatikanet)', () => {
    const marks = groupMarks([
      ...cross({x: 100, y: 100}),
      ...cross({x: 103, y: 101}),
    ]);
    expect(marks).toHaveLength(2);
  });

  it('regner prikker, ringer og ring med prikk som ett merke hver', () => {
    const dot = [
      {x: 50, y: 50},
      {x: 51, y: 51},
    ];
    const marks = groupMarks([
      dot,
      circle({x: 200, y: 200}),
      circle({x: 400, y: 400}),
      [
        {x: 401, y: 402},
        {x: 402, y: 401},
      ],
      [],
    ]);
    expect(marks).toHaveLength(3);
    expect(marks[0].center).toEqual({x: 50.5, y: 50.5});
    expect(marks[1].center.x).toBeCloseTo(200, 0);
    expect(marks[2].strokes).toEqual([2, 3]);
    expect(marks[2].center).toEqual({x: 401.5, y: 401.5});
  });

  it('slår ikke sammen to parallelle streker', () => {
    const marks = groupMarks([
      line({x: 0, y: 0}, {x: 20, y: 0}),
      line({x: 0, y: 3}, {x: 20, y: 3}),
    ]);
    expect(marks).toHaveLength(2);
  });

  it('kobler merker til byene i rekkefølge og hopper over overstrøkne byer', () => {
    const {byEntry, unused} = assignMarks(3, [false, true, false, false]);
    expect(byEntry).toEqual([
      {kind: 'mark', mark: 0},
      {kind: 'skipped'},
      {kind: 'mark', mark: 1},
      {kind: 'mark', mark: 2},
    ]);
    expect(unused).toEqual([]);
  });

  it('melder fra om for få og for mange merker', () => {
    expect(
      assignMarks(1, [false, false, false]).byEntry.map(a => a.kind),
    ).toEqual(['mark', 'missing', 'missing']);
    expect(assignMarks(5, [false, false]).unused).toEqual([2, 3, 4]);
  });
});

describe('kartark', () => {
  it('kjenner igjen overskriften på kartark, og tabellarket forveksles ikke', () => {
    for (const lang of [nb, en, getLanguage('de')!]) {
      for (const region of MAP_REGIONS) {
        const info = parseMapTitle(mapSheetTitle(lang, region));
        expect(info?.region).toBe(region);
        expect(mapTexts(info!.lang).titlePrefix).toBe(
          mapTexts(lang).titlePrefix,
        );
      }
    }
    expect(parseMapTitle('Hovedsteder – Europa (20)')).toBeNull();
    expect(parseSheetTitle('Hovedsteder – Europa (20)')).not.toBeNull();
  });

  it('alle språk har en egen overskrift for kartark', () => {
    for (const lang of LANGUAGES) {
      const prefix = mapTexts(lang).titlePrefix;
      expect(prefix.length).toBeGreaterThan(0);
      expect(prefix).not.toBe(lang.sheet.titlePrefix);
    }
  });

  it('leser oppføringene i lista tilbake', () => {
    const [c] = pickMapCountries(nb, 'EU', 1, seeded(1));
    const parsed = parseEntry(entryText(nb, 7, c), nb);
    expect(parsed?.n).toBe(7);
    expect(parsed?.country.code).toBe(c.code);
    expect(parseEntry('Hovedsteder på kartet – Europa', nb)).toBeNull();
  });

  it('trekker byer som ikke ligger oppå hverandre', () => {
    for (let seed = 1; seed < 30; seed++) {
      const picked = pickMapCountries(nb, 'EU', MAP_SHEET_COUNT, seeded(seed));
      expect(picked).toHaveLength(MAP_SHEET_COUNT);
      expect(new Set(picked.map(c => c.code)).size).toBe(MAP_SHEET_COUNT);
      const pts = picked.map(c =>
        lonLatToImage(MAPS.EU, ...CAPITAL_LONLAT[c.code]),
      );
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          expect(
            Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y),
          ).toBeGreaterThanOrEqual(0.03 * MAPS.EU.width);
        }
      }
    }
  });

  it.each([
    ['Manta', MANTA],
    ['A5X', A5X],
  ])('layouten passer på siden (%s)', (_, page) => {
    for (const region of MAP_REGIONS) {
      const L = mapLayoutFor(page, region);
      const m = MAPS[region];
      const w = L.map.right - L.map.left;
      const h = L.map.bottom - L.map.top;
      expect(Math.abs(w / h - m.width / m.height)).toBeLessThan(0.01);
      expect(L.entries).toHaveLength(MAP_SHEET_COUNT);
      for (const e of [...L.entries.map(x => x.band), L.total, L.note, L.map]) {
        expect(e.left).toBeGreaterThanOrEqual(0);
        expect(e.right).toBeLessThanOrEqual(page.width);
        expect(e.bottom).toBeLessThanOrEqual(page.height);
      }
      // Lista ligger ikke oppå kartet.
      for (const e of L.entries) {
        const overlaps =
          e.band.left < L.map.right &&
          e.band.right > L.map.left &&
          e.band.top < L.map.bottom &&
          e.band.bottom > L.map.top;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('bildene er laget i full størrelse for Manta', () => {
    for (const region of MAP_REGIONS) {
      const m = MAPS[region];
      const L = computeMapLayout(MANTA, m.width / m.height, MAP_SHEET_COUNT);
      expect(Math.abs(L.map.right - L.map.left - m.width)).toBeLessThanOrEqual(
        2,
      );
    }
  });

  it('lager kartbilde, ruter og nummerert liste', () => {
    const countries = pickMapCountries(nb, 'AF', MAP_SHEET_COUNT, seeded(3));
    const drafts = mapSheetDrafts(
      MANTA,
      nb,
      'AF',
      countries,
      '/x/assets_maps_af.png',
    );
    expect(drafts.filter(d => d.kind === 'picture')).toHaveLength(1);
    expect(drafts.filter(d => d.kind === 'path')).toHaveLength(MAP_SHEET_COUNT);
    const texts = drafts
      .filter(d => d.kind === 'text')
      .map(d => (d.kind === 'text' ? d.text : ''));
    expect(texts).toContain(mapSheetTitle(nb, 'AF'));
    expect(texts.some(t => t.startsWith('10. '))).toBe(true);
    for (const d of drafts) {
      if (d.kind === 'path' || d.kind === 'line') {
        expect(d.width).toBeGreaterThanOrEqual(200);
      }
    }
  });
});

describe('retting av kartark', () => {
  const region = 'EU' as const;
  const countries = pickMapCountries(nb, region, 4, seeded(5));
  const entries = countries.map((country, i) => ({n: i + 1, country}));
  const L = mapLayoutFor(MANTA, region, 4);
  const truth = (i: number) =>
    lonLatToPage(MAPS.EU, L.map, ...CAPITAL_LONLAT[countries[i].code]);

  it('gir full pott for kryss rett på byene', () => {
    const strokes = [0, 1, 2, 3].flatMap(i => cross(truth(i)));
    const g = gradeMap(MANTA, nb, region, L.map, entries, strokes, []);
    expect(g.points).toBe(4000);
    expect(g.max).toBe(4000);
    expect(g.note).toBeNull();
    expect(g.results.every(r => r.distanceKm! < 5)).toBe(true);
  });

  it('gir færre poeng jo lenger unna, og hopper over overstrøkne byer', () => {
    const off = (p: Point, dx: number) => ({x: p.x + dx, y: p.y});
    const strokes = [
      ...cross(off(truth(0), 40)),
      ...cross(off(truth(2), 200)),
      ...cross(truth(3)),
    ];
    const g = gradeMap(MANTA, nb, region, L.map, entries, strokes, [
      false,
      true,
      false,
      false,
    ]);
    expect(g.results.map(r => r.assignment.kind)).toEqual([
      'mark',
      'skipped',
      'mark',
      'mark',
    ]);
    expect(g.results[0].points).toBeGreaterThan(g.results[2].points);
    expect(g.results[1].points).toBe(0);
    expect(g.results[3].points).toBe(1000);
    const texts = g.drafts
      .filter(d => d.kind === 'text')
      .map(d => (d.kind === 'text' ? d.text : ''));
    expect(texts).toContain('hoppet over');
    expect(texts.some(t => t.startsWith('Poeng på kartet:'))).toBe(true);
  });

  it('skriver en merknad når det mangler merker', () => {
    const g = gradeMap(MANTA, nb, region, L.map, entries, cross(truth(0)), []);
    expect(g.results.map(r => r.assignment.kind)).toEqual([
      'mark',
      'missing',
      'missing',
      'missing',
    ]);
    expect(g.note).toContain('3 byer fikk ikke noe merke');
  });

  it('tegner riktig plassering og en strek fra gjetningen', () => {
    const g = gradeMap(
      MANTA,
      nb,
      region,
      L.map,
      entries,
      cross({x: truth(0).x + 150, y: truth(0).y}),
      [false, true, true, true],
    );
    expect(g.drafts.filter(d => d.kind === 'line')).toHaveLength(1);
    // En ring per by, også de som er hoppet over.
    expect(g.drafts.filter(d => d.kind === 'path')).toHaveLength(4);
  });

  it('ringen er en åpen, håndtegnet strek rundt punktet', () => {
    const r = ringStroke({x: 100, y: 100}, 20, 3);
    for (const p of r) {
      expect(Math.hypot(p.x - 100, p.y - 100)).toBeGreaterThan(16);
      expect(Math.hypot(p.x - 100, p.y - 100)).toBeLessThan(24);
    }
  });
});

describe('oppføringer der by og land heter det samme', () => {
  it('skriver navnet én gang og leser det tilbake', () => {
    for (const code of ['SG', 'VA', 'SM', 'MC', 'LU', 'DJ'] as const) {
      const c = pickMapCountries(nb, 'ALL', 197, seeded(2)).find(
        x => x.code === code,
      )!;
      const t = entryText(nb, 4, c);
      expect(parseEntry(t, nb)?.country.code).toBe(code);
      if (c.capital === c.name) {
        expect(t).toBe(`4. ${c.name}`);
      }
    }
  });
});

describe('trygge marger', () => {
  it.each([
    ['Manta', MANTA],
    ['A5X', A5X],
  ])(
    'holder kartarket unna verktøylinja på sidene og i toppen (%s)',
    (_, page) => {
      for (const region of MAP_REGIONS) {
        const L = mapLayoutFor(page, region);
        const rects = [
          L.title,
          L.subtitle,
          L.map,
          L.total,
          L.note,
          ...L.entries.flatMap(e => [e.box, e.label, e.points]),
        ];
        for (const r of rects) {
          expect(r.left).toBeGreaterThanOrEqual(
            Math.floor(page.width * SAFE_MARGIN.side) - 1,
          );
          expect(r.right).toBeLessThanOrEqual(
            Math.ceil(page.width * (1 - SAFE_MARGIN.side)) + 1,
          );
          expect(r.top).toBeGreaterThanOrEqual(
            Math.floor(page.height * SAFE_MARGIN.top) - 1,
          );
        }
      }
    },
  );
});

describe('lange oppføringer', () => {
  it('flytter landet ned på linje to når skriften ellers blir for liten, og leses tilbake', () => {
    const c = pickMapCountries(nb, 'NA', 197, seeded(4)).find(
      x => x.code === 'TT',
    )!;
    const cell = {left: 0, top: 0, right: 420, bottom: 80};
    const t = fitEntry(entryText(nb, 2, c), cell, 32);
    expect(t).toContain('\n(');
    expect(parseEntry(t, nb)?.country.code).toBe('TT');
    expect(fitEntry('1. Oslo (Norge)', cell, 32)).toBe('1. Oslo (Norge)');
  });
});

describe('valg for kartark', () => {
  it.each(['nb', 'en'])(
    'leser alle tre listeformer tilbake for alle land (%s)',
    code => {
      const lang = getLanguage(code)!;
      const all = pickMapCountries(lang, 'ALL', 197, seeded(9));
      for (const style of MAP_ENTRY_STYLES) {
        for (const c of all) {
          const parsed = parseEntry(entryText(lang, 3, c, style), lang);
          if (parsed?.country.code !== c.code) {
            throw new Error(
              `${style}: «${entryText(lang, 3, c, style)}» ble lest som ${
                parsed?.country.code
              }`,
            );
          }
        }
      }
    },
  );

  it('bare byen eller bare landet står alene i lista', () => {
    const c = pickMapCountries(nb, 'ALL', 197, seeded(9)).find(
      x => x.code === 'NO',
    )!;
    expect(entryText(nb, 1, c, 'capital')).toBe('1. Oslo');
    expect(entryText(nb, 1, c, 'country')).toBe('1. Norge');
    expect(entryText(nb, 1, c, 'both')).toBe('1. Oslo (Norge)');
  });

  it('underteksten forteller hva som skal merkes', () => {
    const t = mapTexts(nb);
    expect(t.subtitle('country')).toContain('hovedstaden i hvert land');
    expect(t.subtitle('both')).toContain('hver by');
    const drafts = mapSheetDrafts(
      MANTA,
      nb,
      'EU',
      pickMapCountries(nb, 'EU', 5, seeded(1)),
      '/x.png',
      'country',
    );
    const texts = drafts.flatMap(d => (d.kind === 'text' ? [d.text] : []));
    expect(texts).toContain(t.subtitle('country'));
  });

  it.each(MAP_COUNTS)('layouten fungerer med %i byer', n => {
    for (const page of [MANTA, A5X]) {
      for (const region of MAP_REGIONS) {
        const L = mapLayoutFor(page, region, n);
        expect(L.map.left).toBeGreaterThanOrEqual(150);
        expect(L.title.top).toBeGreaterThanOrEqual(150);
        expect(L.entries).toHaveLength(n);
        // Med minimumsmarger i piksler blir kartet litt smalere på små sider (A5X/Nomad, 15 byer: ~50 %).
        expect(L.map.right - L.map.left).toBeGreaterThan(page.width * 0.45);
        for (const e of L.entries) {
          expect(e.band.bottom).toBeLessThanOrEqual(page.height);
          const overlaps =
            e.band.left < L.map.right &&
            e.band.right > L.map.left &&
            e.band.top < L.map.bottom &&
            e.band.bottom > L.map.top;
          expect(overlaps).toBe(false);
        }
        expect(L.total.bottom).toBeLessThanOrEqual(page.height);
      }
    }
  });

  it('retter et ark med 15 byer', () => {
    const countries = pickMapCountries(nb, 'AF', 15, seeded(11));
    const L = mapLayoutFor(MANTA, 'AF', 15);
    const strokes = countries.flatMap(c =>
      cross(lonLatToPage(MAPS.AF, L.map, ...CAPITAL_LONLAT[c.code])),
    );
    const g = gradeMap(
      MANTA,
      nb,
      'AF',
      L.map,
      countries.map((country, i) => ({n: i + 1, country})),
      strokes,
      [],
    );
    expect(g.points).toBe(15000);
    expect(g.max).toBe(15000);
  });
});

describe('smart kobling av merker', () => {
  const region = 'EU' as const;
  const countries = pickMapCountries(nb, region, 6, seeded(21));
  const entries = countries.map((country, i) => ({n: i + 1, country}));
  const L = mapLayoutFor(MANTA, region, 6);
  const truth = (i: number) =>
    lonLatToPage(MAPS.EU, L.map, ...CAPITAL_LONLAT[countries[i].code]);

  it('forkaster en ekstra strek midt i, så resten ikke forskyves', () => {
    const stray = [
      {x: L.map.left + 30, y: L.map.top + 30},
      {x: L.map.left + 32, y: L.map.top + 31},
    ];
    const strokes = [
      ...cross(truth(0)),
      ...cross(truth(1)),
      stray,
      ...cross(truth(2)),
      ...cross(truth(3)),
      ...cross(truth(4)),
      ...cross(truth(5)),
    ];
    const g = gradeMap(MANTA, nb, region, L.map, entries, strokes, []);
    expect(g.points).toBe(6000);
    expect(g.unused).toEqual([2]);
    expect(g.note).toContain('Ett merke passet ikke');
    expect(g.drafts.some(d => d.kind === 'text' && d.text === '?')).toBe(true);
  });

  it('kobler det siste merket til den siste byen når et merke mangler midt i', () => {
    const strokes = [0, 1, 3, 4, 5].flatMap(i => cross(truth(i)));
    const g = gradeMap(MANTA, nb, region, L.map, entries, strokes, []);
    expect(g.results.map(r => r.assignment.kind)).toEqual([
      'mark',
      'mark',
      'missing',
      'mark',
      'mark',
      'mark',
    ]);
    expect(g.points).toBe(5000);
  });

  it('kobler et kraftig bom til sin by i stedet for å forkaste det', () => {
    const far = {x: truth(2).x + 400, y: truth(2).y};
    const strokes = [
      ...cross(truth(0)),
      ...cross(truth(1)),
      ...cross(far),
      ...cross(truth(3)),
      ...cross(truth(4)),
      ...cross(truth(5)),
    ];
    const g = gradeMap(MANTA, nb, region, L.map, entries, strokes, []);
    expect(g.results.map(r => r.assignment.kind)).toEqual([
      'mark',
      'mark',
      'mark',
      'mark',
      'mark',
      'mark',
    ]);
    expect(g.unused).toEqual([]);
  });

  it('justeringen velger lavest samlet kostnad og beholder rekkefølgen', () => {
    // Merke 1 passer by 0 og merke 2 passer by 1; merke 0 passer ingen.
    const cost = (mk: number, e: number) => (mk === e + 1 ? 0 : 1000);
    const r = assignMarks(3, [false, false], cost);
    expect(r.byEntry).toEqual([
      {kind: 'mark', mark: 1},
      {kind: 'mark', mark: 2},
    ]);
    expect(r.unused).toEqual([0]);
  });
});

describe('landmodus', () => {
  it.each(MAP_REGIONS)(
    'hver hovedstad ligger i sitt eget land i rutenettet (%s)',
    region => {
      const m = MAPS[region];
      const misses: string[] = [];
      for (const code of capitalsIn(region)) {
        const p = lonLatToImage(m, ...CAPITAL_LONLAT[code]);
        if (!hitsCountry(region, code, p, 12)) {
          misses.push(`${code} (${countryAt(region, p) ?? 'hav'})`);
        }
      }
      expect(misses).toEqual([]);
    },
  );

  it.each(MAP_REGIONS)('fasitpunktet ligger inne i landet (%s)', region => {
    for (const code of capitalsIn(region)) {
      const p = countryLabel(region, code)!;
      expect(p).not.toBeNull();
      expect(countryAt(region, p)).toBe(code);
    }
  });

  it('kjenner igjen overskriften og skiller den fra hovedstadsark', () => {
    for (const lang of [nb, en, getLanguage('de')!]) {
      const info = parseMapTitle(mapSheetTitle(lang, 'AF', 'country'));
      expect(info?.target).toBe('country');
      expect(info?.region).toBe('AF');
      expect(parseMapTitle(mapSheetTitle(lang, 'AF'))?.target).toBe('capital');
    }
    expect(mapSheetTitle(nb, 'EU', 'country')).toBe('Land på kartet – Europa');
  });

  const region = 'AF' as const;
  const countries = pickMapCountries(nb, region, 5, seeded(31));
  const entries = countries.map((country, i) => ({n: i + 1, country}));
  const L = mapLayoutFor(MANTA, region, 5);
  const m = MAPS[region];
  const toPage = (p: {x: number; y: number}) => ({
    x: L.map.left + (p.x / m.width) * (L.map.right - L.map.left),
    y: L.map.top + (p.y / m.height) * (L.map.bottom - L.map.top),
  });
  const inside = (i: number) =>
    toPage(countryLabel(region, countries[i].code)!);

  it('gir riktig for kryss inne i landene, med haker i lista', () => {
    const strokes = [0, 1, 2, 3, 4].flatMap(i => cross(inside(i)));
    const g = gradeMap(
      MANTA,
      nb,
      region,
      L.map,
      entries,
      strokes,
      [],
      'country',
    );
    expect(g.points).toBe(5);
    expect(g.max).toBe(5);
    expect(g.results.every(r => r.correct)).toBe(true);
    const texts = g.drafts.flatMap(d => (d.kind === 'text' ? [d.text] : []));
    expect(texts).toContain('Riktige land: 5 av 5');
    // Ingen fasitringer eller streker når alt er riktig: bare haker i lista (ett strøk hver).
    expect(g.drafts.filter(d => d.kind === 'line')).toHaveLength(0);
    expect(g.drafts.filter(d => d.kind === 'path')).toHaveLength(5);
  });

  it('gir galt for kryss i et annet land, og viser hvor landet ligger', () => {
    const strokes = [
      ...cross(inside(1)),
      ...cross(inside(1)),
      ...cross(inside(2)),
      ...cross(inside(3)),
      ...cross(inside(4)),
    ];
    const g = gradeMap(
      MANTA,
      nb,
      region,
      L.map,
      entries,
      strokes,
      [],
      'country',
    );
    expect(g.results[0].correct).toBe(false);
    expect(g.points).toBe(4);
    expect(g.drafts.filter(d => d.kind === 'line')).toHaveLength(1);
  });

  it('lista viser bare landet', () => {
    const drafts = mapSheetDrafts(
      MANTA,
      nb,
      region,
      countries,
      '/x.png',
      'both',
      'country',
    );
    const texts = drafts.flatMap(d => (d.kind === 'text' ? [d.text] : []));
    expect(texts).toContain(`1. ${countries[0].name}`);
    expect(texts).toContain(mapTexts(nb).countrySubtitle);
  });
});

describe('lange navn uten parentes', () => {
  it('bryter ved et mellomrom og leses tilbake', () => {
    const c = pickMapCountries(nb, 'AF', 197, seeded(4)).find(
      x => x.code === 'CF',
    )!;
    const cell = {left: 0, top: 0, right: 380, bottom: 80};
    const t = fitEntry(entryText(nb, 6, c, 'country'), cell, 32);
    expect(t).toContain('\n');
    expect(t.startsWith('6. ')).toBe(true);
    expect(parseEntry(t, nb)?.country.code).toBe('CF');
  });
});
