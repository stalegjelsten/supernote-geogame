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

/** Enkel, forutsigbar pseudotilfeldig generator. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('koding av poster', () => {
  test('tur-retur gir samme post (med sekundoppløsning og kvantisert score)', () => {
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

  test('ugyldige navn avvises', () => {
    for (const name of ['', 'lang-nb', 'g1.x.abc.key.no0', 'g1.t.abc.key.qq0', 'g1.t.abc.key.no', 'g2.t.a.b.no0']) {
      expect(decodeRecord(name)).toBeNull();
    }
  });

  test('alle ferdigheter kan kodes', () => {
    for (const skill of ['capital', 'mapCapital', 'mapCountry'] as const) {
      expect(decodeRecord(encodeRecord(rec(T0, [['FR', 0.5]], 'abc', skill)))!.skill).toBe(skill);
    }
  });

  test('nøkkelen avhenger av notat og land, ikke rekkefølge', () => {
    const a = sheetKey('/x.note', 'capital', ['NO', 'SE']);
    expect(a).toHaveLength(KEY_LENGTH);
    expect(sheetKey('/x.note', 'capital', ['SE', 'NO'])).toBe(a);
    expect(sheetKey('/y.note', 'capital', ['NO', 'SE'])).not.toBe(a);
    expect(sheetKey('/x.note', 'mapCapital', ['NO', 'SE'])).not.toBe(a);
  });

  test('et helt verdensark deles i poster som får plass i et mappenavn', () => {
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

  test('et vanlig ark på 20 land får plass i én post', () => {
    const r = rec(T0, COUNTRY_CODES.slice(0, 20).map(c => [c, 1]), sheetKey('/x', 'capital', COUNTRY_CODES.slice(0, 20)));
    expect(splitRecord(r)).toHaveLength(1);
  });
});

describe('score', () => {
  test('tabell og kart', () => {
    expect(verdictScore('correct')).toBe(1);
    expect(verdictScore('close')).toBeGreaterThan(0.7);
    expect(verdictScore('wrong')).toBe(0);
    expect(verdictScore('blank')).toBe(0);
    expect(mapPointsScore(1000)).toBe(1);
    expect(mapPointsScore(500)).toBe(0.5);
    expect(mapPointsScore(-5)).toBe(0);
  });
});

describe('statistikk', () => {
  test('boks og rekke følger riktige og feile svar', () => {
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

  test('tre riktige på rad = kan', () => {
    const stats = computeStats([0, 1, 2].map(d => rec(T0 + d * DAY, [['SE', 1]])), 'capital');
    expect(levelOf(stats.get('SE'))).toBe('known');
    expect(levelOf(stats.get('NO'))).toBe('new');
  });

  test('ny retting av samme ark erstatter den forrige', () => {
    const stats = computeStats([rec(T0, [['NO', 0]], 'same'), rec(T0 + 60_000, [['NO', 1]], 'same')], 'capital');
    expect(stats.get('NO')!.attempts).toBe(1);
    expect(stats.get('NO')!.lastScore).toBe(1);
  });

  test('ferdighetene holdes adskilt', () => {
    const records = [rec(T0, [['NO', 1]], 'a', 'capital'), rec(T0, [['NO', 0]], 'b', 'mapCountry')];
    expect(computeStats(records, 'capital').get('NO')!.lastScore).toBe(1);
    expect(computeStats(records, 'mapCountry').get('NO')!.lastScore).toBe(0);
    expect(computeStats(records, 'mapCapital').size).toBe(0);
  });

  test('oppsummering og svakeste land', () => {
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

  test('rapport for menyen', () => {
    const r = statsReport([rec(T0, [['NO', 0], ['FR', 1]])], 'capital', getLanguage('nb')!, 'EU', T0);
    expect(r.focus.region).toBe('EU');
    expect(r.regions).toHaveLength(7);
    expect(r.weakest[0]).toMatchObject({code: 'NO', name: 'Norge', answer: 'Oslo', percent: 0, attempts: 1});
  });
});

describe('treningsutvalg', () => {
  const now = T0 + 30 * DAY;
  const stats = computeStats(
    [
      // NO: kan godt, nylig øvd.
      ...[0, 1, 2, 3].map(d => rec(now - (4 - d) * 60_000, [['NO', 1]])),
      // SE: alltid feil, lenge siden.
      rec(T0, [['SE', 0]]),
      rec(T0 + DAY, [['SE', 0]]),
    ],
    'capital',
  );

  test('vektene prioriterer riktig', () => {
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

  test('vektet rekkefølge er en permutasjon og følger vektene', () => {
    const items = ['a', 'b', 'c', 'd'];
    const out = weightedOrder(items, () => 1, seeded(1));
    expect([...out].sort()).toEqual(items);
    // «a» med stor vekt havner nesten alltid først.
    const rnd = seeded(7);
    let first = 0;
    for (let i = 0; i < 200; i++) {
      first += weightedOrder(items, x => (x === 'a' ? 100 : 1), rnd)[0] === 'a' ? 1 : 0;
    }
    expect(first).toBeGreaterThan(180);
  });

  test('svake land kommer oftere med på arket', () => {
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

  test('kartutvalget tar imot en rekkefølge', () => {
    const nb = getLanguage('nb')!;
    const order = (pool: ReturnType<typeof pickCountries>) => {
      const first = pool.filter(c => c.code === 'SE');
      return [...first, ...pool.filter(c => c.code !== 'SE')];
    };
    expect(pickMapCountries(nb, 'EU', 5, seeded(1), undefined, order)[0].code).toBe('SE');
  });

  test('standard trekning er uendret: like mange land og ingen duplikater', () => {
    const nb = getLanguage('nb')!;
    const picked = pickCountries(nb, 'AF', 10, seeded(5));
    expect(new Set(picked.map(c => c.code)).size).toBe(10);
  });
});
