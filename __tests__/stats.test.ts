import {COUNTRY_CODES, type CountryCode} from '../src/data/countries';
import {getLanguage} from '../src/i18n';
import {pickCountries} from '../src/core/sheet';
import {pickMapCountries} from '../src/core/mapSheet';
import {
  KEY_LENGTH,
  MAX_NAME_LENGTH,
  computeStats,
  decodeRecord,
  dueAt,
  encodeRecord,
  levelOf,
  recentSheets,
  mapPointsScore,
  sameSheet,
  sessions,
  sheetKey,
  splitRecord,
  summarize,
  verdictScore,
  weakest,
  type SheetRecord,
} from '../src/core/stats';
import {orderForTraining, weight, weightedOrder} from '../src/core/training';
import {statsReport} from '../src/core/statsReport';

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 10, 1);

function rec(time: number, attempts: Array<[CountryCode, number]>, key = 'k' + time, skill: SheetRecord['skill'] = 'capital'): SheetRecord {
  return {skill, time, key, attempts: attempts.map(([code, score]) => ({code, score}))};
}

/** Simple, predictable pseudo-random generator. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('encoding of entries', () => {
  test('round trip gives the same entry (with second resolution and quantized score)', () => {
    const r = rec(T0 + 234, [['NO', 1], ['SE', 0], ['XK', 0.8]], sheetKey('/a.note', 'capital', ['NO', 'SE', 'XK']));
    const name = encodeRecord(r);
    expect(name).toMatch(/^[0-9a-z.]+$/);
    const back = decodeRecord(name)!;
    expect(back.skill).toBe('capital');
    expect(back.time).toBe(T0);
    expect(back.key).toBe(r.key);
    expect(back.attempts.map(a => a.code)).toEqual(['NO', 'SE', 'XK']);
    expect(back.attempts[0].score).toBe(1);
    expect(back.attempts[1].score).toBe(0);
    expect(back.attempts[2].score).toBeCloseTo(0.8, 1);
  });

  test('invalid names are rejected', () => {
    for (const name of ['', 'lang-nb', 'g1.x.abc.key.no0', 'g1.t.abc.key.qq0', 'g1.t.abc.key.no', 'g2.t.a.b.no0']) {
      expect(decodeRecord(name)).toBeNull();
    }
  });

  test('all skills can be encoded', () => {
    for (const skill of ['capital', 'mapCapital', 'mapCountry'] as const) {
      expect(decodeRecord(encodeRecord(rec(T0, [['FR', 0.5]], 'abc', skill)))!.skill).toBe(skill);
    }
  });

  test('the key depends on note and country, not order', () => {
    const a = sheetKey('/x.note', 'capital', ['NO', 'SE']);
    expect(a).toHaveLength(KEY_LENGTH);
    expect(sheetKey('/x.note', 'capital', ['SE', 'NO'])).toBe(a);
    expect(sheetKey('/y.note', 'capital', ['NO', 'SE'])).not.toBe(a);
    expect(sheetKey('/x.note', 'mapCapital', ['NO', 'SE'])).not.toBe(a);
  });

  test('a whole world sheet is split into entries that fit in a folder name', () => {
    const key = sheetKey('/x.note', 'capital', COUNTRY_CODES);
    const all = rec(T0, COUNTRY_CODES.map(c => [c, 1]), key);
    const parts = splitRecord(all);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(encodeRecord(p).length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
      expect(sameSheet(p.key, key)).toBe(true);
    }
    expect(parts.flatMap(p => p.attempts)).toHaveLength(COUNTRY_CODES.length);
    expect(sessions(parts, 'capital').sheets).toBe(1);
  });

  test('a regular sheet of 20 countries fits in one entry', () => {
    const r = rec(T0, COUNTRY_CODES.slice(0, 20).map(c => [c, 1]), sheetKey('/x', 'capital', COUNTRY_CODES.slice(0, 20)));
    expect(splitRecord(r)).toHaveLength(1);
  });
});

describe('score', () => {
  test('table and map', () => {
    expect(verdictScore('correct')).toBe(1);
    expect(verdictScore('close')).toBeGreaterThan(0.7);
    expect(verdictScore('wrong')).toBe(0);
    expect(verdictScore('blank')).toBe(0);
    expect(mapPointsScore(1000)).toBe(1);
    expect(mapPointsScore(500)).toBe(0.5);
    expect(mapPointsScore(-5)).toBe(0);
  });
});

describe('statistics', () => {
  test('box and streak follow correct and wrong answers', () => {
    const stats = computeStats(
      [rec(T0, [['NO', 1]]), rec(T0 + DAY, [['NO', 1]]), rec(T0 + 2 * DAY, [['NO', 0]]), rec(T0 + 3 * DAY, [['NO', 1]])],
      'capital',
    );
    const no = stats.get('NO')!;
    expect(no.attempts).toBe(4);
    expect(no.passes).toBe(3);
    expect(no.streak).toBe(1);
    expect(no.box).toBe(1);
    expect(no.lastScore).toBe(1);
    expect(levelOf(no)).toBe('learning');
    expect(dueAt(no)).toBe(T0 + 4 * DAY);
  });

  test('three correct in a row = known', () => {
    const stats = computeStats([0, 1, 2].map(d => rec(T0 + d * DAY, [['SE', 1]])), 'capital');
    expect(levelOf(stats.get('SE'))).toBe('known');
    expect(levelOf(stats.get('NO'))).toBe('new');
  });

  test('regrading the same sheet replaces the previous one', () => {
    const stats = computeStats([rec(T0, [['NO', 0]], 'same'), rec(T0 + 60_000, [['NO', 1]], 'same')], 'capital');
    expect(stats.get('NO')!.attempts).toBe(1);
    expect(stats.get('NO')!.lastScore).toBe(1);
  });

  test('the skills are kept separate', () => {
    const records = [rec(T0, [['NO', 1]], 'a', 'capital'), rec(T0, [['NO', 0]], 'b', 'mapCountry')];
    expect(computeStats(records, 'capital').get('NO')!.lastScore).toBe(1);
    expect(computeStats(records, 'mapCountry').get('NO')!.lastScore).toBe(0);
    expect(computeStats(records, 'mapCapital').size).toBe(0);
  });

  test('summary and weakest countries', () => {
    const records = [
      rec(T0, [['NO', 1], ['SE', 0], ['DK', 0.5]]),
      rec(T0 + DAY, [['NO', 1], ['SE', 0], ['DK', 1]]),
    ];
    const stats = computeStats(records, 'capital');
    const s = summarize(stats, ['NO', 'SE', 'DK', 'FI'], T0 + 10 * DAY);
    expect(s).toMatchObject({countries: 4, new: 1, learning: 3, known: 0, attempts: 6, due: 3});
    expect(weakest(stats, ['NO', 'SE', 'DK', 'FI'], 2).map(x => x.code)).toEqual(['SE', 'DK']);
    expect(sessions(records, 'capital')).toMatchObject({sheets: 2, attempts: 6});
  });

  test('report for the menu', () => {
    const r = statsReport([rec(T0, [['NO', 0], ['FR', 1]])], 'capital', getLanguage('nb')!, 'EU', T0);
    expect(r.focus.region).toBe('EU');
    expect(r.regions).toHaveLength(7);
    expect(r.weakest[0]).toMatchObject({code: 'NO', name: 'Norge', answer: 'Oslo', percent: 0, attempts: 1});
  });
});

describe('latest sheets', () => {
  test('one result per sheet, oldest first, regrading replaces and split parts are merged', () => {
    const key = 'a'.repeat(KEY_LENGTH);
    const records = [
      rec(T0 + 2 * DAY, [['NO', 1], ['SE', 0]], 'b'.repeat(KEY_LENGTH)),
      rec(T0, [['NO', 0]], key),
      rec(T0 + DAY, [['NO', 1]], key), // regrading of the same sheet
      rec(T0 + DAY, [['FR', 0]], key + '1'), // second part of the same sheet
      rec(T0 + 3 * DAY, [['NO', 1]], 'c'.repeat(KEY_LENGTH), 'mapCapital'),
    ];
    expect(recentSheets(records, 'capital', 10)).toEqual([
      {time: T0 + DAY, score: 0.5, answers: 2},
      {time: T0 + 2 * DAY, score: 0.5, answers: 2},
    ]);
    expect(recentSheets(records, 'capital', 1)).toEqual([{time: T0 + 2 * DAY, score: 0.5, answers: 2}]);
  });
});

describe('training selection', () => {
  const now = T0 + 30 * DAY;
  const stats = computeStats(
    [
      // NO: knows well, recently practised.
      ...[0, 1, 2, 3].map(d => rec(now - (4 - d) * 60_000, [['NO', 1]])),
      // SE: always wrong, long ago.
      rec(T0, [['SE', 0]]),
      rec(T0 + DAY, [['SE', 0]]),
    ],
    'capital',
  );

  test('the weights prioritize correctly', () => {
    const no = stats.get('NO');
    const se = stats.get('SE');
    expect(weight(no, 'random', now)).toBe(weight(se, 'random', now));
    expect(weight(se, 'smart', now)).toBeGreaterThan(weight(undefined, 'smart', now));
    expect(weight(undefined, 'smart', now)).toBeGreaterThan(weight(no, 'smart', now));
    expect(weight(undefined, 'new', now)).toBeGreaterThan(weight(se, 'new', now));
    expect(weight(se, 'weak', now)).toBeGreaterThan(weight(no, 'weak', now));
    expect(weight(se, 'due', now)).toBeGreaterThan(weight(no, 'due', now));
    for (const strategy of ['random', 'smart', 'weak', 'due', 'new'] as const) {
      expect(weight(no, strategy, now)).toBeGreaterThan(0);
    }
  });

  test('weighted order is a permutation and follows the weights', () => {
    const items = ['a', 'b', 'c', 'd'];
    const out = weightedOrder(items, () => 1, seeded(1));
    expect([...out].sort()).toEqual(items);
    // "a" with a large weight almost always ends up first.
    const rnd = seeded(7);
    let first = 0;
    for (let i = 0; i < 200; i++) {
      first += weightedOrder(items, x => (x === 'a' ? 100 : 1), rnd)[0] === 'a' ? 1 : 0;
    }
    expect(first).toBeGreaterThan(180);
  });

  test('weak countries appear more often on the sheet', () => {
    const nb = getLanguage('nb')!;
    const rnd = seeded(3);
    let se = 0;
    let no = 0;
    for (let i = 0; i < 100; i++) {
      const picked = pickCountries(nb, 'EU', 5, rnd, pool => orderForTraining(pool, stats, 'weak', now, rnd)).map(c => c.code);
      expect(new Set(picked).size).toBe(5);
      se += picked.includes('SE') ? 1 : 0;
      no += picked.includes('NO') ? 1 : 0;
    }
    expect(se).toBeGreaterThan(80);
    expect(no).toBeLessThan(20);
  });

  test('the map selection accepts an order', () => {
    const nb = getLanguage('nb')!;
    const order = (pool: ReturnType<typeof pickCountries>) => {
      const first = pool.filter(c => c.code === 'SE');
      return [...first, ...pool.filter(c => c.code !== 'SE')];
    };
    expect(pickMapCountries(nb, 'EU', 5, seeded(1), undefined, order)[0].code).toBe('SE');
  });

  test('default draw is unchanged: same number of countries and no duplicates', () => {
    const nb = getLanguage('nb')!;
    const picked = pickCountries(nb, 'AF', 10, seeded(5));
    expect(new Set(picked.map(c => c.code)).size).toBe(10);
  });
});
