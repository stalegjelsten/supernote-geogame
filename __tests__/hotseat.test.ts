import {getLanguage, LANGUAGES} from '../src/i18n';
import {hotSeatTexts} from '../src/i18n/hotseat';
import {
  parseGameTag,
  parseRowLabel,
  passFirstPage,
  passPageCount,
  passPageIndex,
  playerAt,
  rowLabel,
  sharedCount,
  sumScores,
  winners,
} from '../src/core/hotseat';
import {mapSubtitle, parseMapTitle, pickFairMapCountries, pickMapCountries} from '../src/core/mapSheet';
import {parseSheetTitle, pickCountries, pickFairCountries} from '../src/core/sheet';
import {fairDraw, familiarity, levelPool} from '../src/core/fairDraw';
import {COUNTRY_CODES} from '../src/data/countries';

const nb = getLanguage('nb')!;

describe('merkelapp for flerspiller', () => {
  it('leses tilbake fra undertittelen på alle språk', () => {
    for (const lang of LANGUAGES) {
      const hs = hotSeatTexts(lang);
      expect(parseGameTag(hs.tablePass(2, 3))).toEqual({mode: 'pass', player: 2, players: 3});
      expect(parseGameTag(hs.tableShared(4))).toEqual({mode: 'shared', player: 0, players: 4});
      expect(parseGameTag(mapSubtitle(lang, 'both', 'capital', {mode: 'pass', player: 1, players: 2}))).toEqual({
        mode: 'pass',
        player: 1,
        players: 2,
      });
      expect(parseGameTag(mapSubtitle(lang, 'both', 'country', {mode: 'shared', player: 0, players: 2}))).toEqual({
        mode: 'shared',
        player: 0,
        players: 2,
      });
    }
  });

  it('forveksles ikke med vanlig tekst på arket', () => {
    for (const lang of LANGUAGES) {
      expect(parseGameTag(lang.sheet.subtitle)).toBeNull();
      // Undertittelen må ikke se ut som en overskrift.
      expect(parseSheetTitle(hotSeatTexts(lang).tablePass(1, 2))).toBeNull();
      expect(parseMapTitle(hotSeatTexts(lang).mapShared(2))).toBeNull();
    }
    expect(parseGameTag('Spiller 5 av 3')).toBeNull();
    expect(parseGameTag('Duell for 1')).toBeNull();
  });

  it('beholder andre linje i kartets bruksanvisning', () => {
    const plain = mapSubtitle(nb, 'both', 'capital');
    const tagged = mapSubtitle(nb, 'both', 'capital', {mode: 'pass', player: 2, players: 2});
    expect(tagged.split('\n')[1]).toBe(plain.split('\n')[1]);
    expect(tagged.startsWith('Spiller 2 av 2 · ')).toBe(true);
  });
});

describe('send rundt', () => {
  it('legger spillerne etter hverandre med en side imellom', () => {
    // 2 spillere, 2 sider hver: S1 S1 | gi videre | S2 S2
    expect(passPageCount(2, 2)).toBe(5);
    expect(passPageIndex(10, 1, 1, 2)).toBe(10);
    expect(passPageIndex(10, 1, 2, 2)).toBe(11);
    expect(passPageIndex(10, 2, 1, 2)).toBe(13);
    expect(passPageIndex(10, 2, 2, 2)).toBe(14);
  });

  it('finner første side fra hvilken som helst spillerside', () => {
    for (const parts of [1, 2, 3]) {
      for (let p = 1; p <= 4; p++) {
        for (let k = 1; k <= parts; k++) {
          expect(passFirstPage(passPageIndex(7, p, k, parts), p, k, parts)).toBe(7);
        }
      }
    }
  });
});

describe('bytt på', () => {
  it('gir alle like mange oppgaver', () => {
    expect(sharedCount(20, 3)).toBe(18);
    expect(sharedCount(5, 2)).toBe(4);
    expect(sharedCount(20, 2, 13)).toBe(12);
    expect(sharedCount(1, 2)).toBe(2);
  });

  it('lar spillerne svare annenhver gang', () => {
    expect([0, 1, 2, 3, 4].map(i => playerAt(i, 2))).toEqual([1, 2, 1, 2, 1]);
    expect([0, 1, 2, 3].map(i => playerAt(i, 3))).toEqual([1, 2, 3, 1]);
  });

  it('leser tallet i svarruta', () => {
    expect(parseRowLabel(rowLabel(2), 2)).toBe(2);
    expect(parseRowLabel('3', 2)).toBeNull();
    expect(parseRowLabel('Oslo', 2)).toBeNull();
  });
});

describe('poeng', () => {
  it('summerer per spiller', () => {
    expect(
      sumScores([
        {player: 2, points: 3, max: 5},
        {player: 1, points: 4, max: 5},
        {player: 2, points: 1, max: 5},
      ]),
    ).toEqual([
      {player: 1, points: 4, max: 5},
      {player: 2, points: 4, max: 10},
    ]);
  });

  it('kårer vinner etter andel, og gir uavgjort ved likt', () => {
    expect(winners([{player: 1, points: 4, max: 5}, {player: 2, points: 4, max: 10}])).toEqual([1]);
    expect(winners([{player: 1, points: 3, max: 5}, {player: 2, points: 3, max: 5}])).toEqual([1, 2]);
  });
});

describe('rettferdig trekning', () => {
  /** Enkel deterministisk tilfeldighet for testene. */
  const seeded = (seed: number) => () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const spread = (scores: number[], players: number) => {
    const totals = Array.from({length: players}, () => 0);
    scores.forEach((s, i) => (totals[playerAt(i, players) - 1] += s));
    return Math.max(...totals) - Math.min(...totals);
  };

  it('gir like mange til alle, uten duplikater', () => {
    const pool = Array.from({length: 50}, (_, i) => i);
    const out = fairDraw(pool, 7, 3, x => x, {random: seeded(1)});
    expect(out).toHaveLength(21);
    expect(new Set(out).size).toBe(21);
  });

  it('jevner ut kjentheten mye bedre enn tilfeldig trekning', () => {
    const pool = Array.from({length: 60}, (_, i) => i * i);
    let fair = 0;
    let naive = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const r = seeded(seed);
      fair += spread(fairDraw(pool, 10, 2, x => x, {random: r}), 2);
      const shuffled = [...pool].sort(() => r() - 0.5).slice(0, 20);
      naive += spread(shuffled, 2);
    }
    expect(fair).toBeLessThan(naive / 3);
  });

  it('respekterer kompatibilitet når det går, og slakker når det må', () => {
    const pool = Array.from({length: 20}, (_, i) => i);
    // Ingen to naboer.
    const notAdjacent = (x: number, chosen: number[]) => chosen.every(c => Math.abs(c - x) > 1);
    const out = fairDraw(pool, 4, 2, x => x, {random: seeded(3), compatible: notAdjacent});
    expect(out).toHaveLength(8);
    const sorted = [...out].sort((a, b) => a - b);
    expect(sorted.every((x, i) => i === 0 || x - sorted[i - 1] > 1)).toBe(true);
    // For strengt krav: alle skal likevel få oppgaver.
    expect(fairDraw(pool, 10, 2, x => x, {random: seeded(3), compatible: () => false})).toHaveLength(20);
  });

  it('har kjenthet for alle land og hovedsteder', () => {
    for (const code of COUNTRY_CODES) {
      expect(familiarity(code, 'country')).toBeGreaterThan(0);
      expect(familiarity(code, 'capital')).toBeGreaterThan(0);
    }
    // Sanity: Paris er mer kjent enn Funafuti.
    expect(familiarity('FR', 'capital')).toBeGreaterThan(familiarity('TV', 'capital'));
  });

  it('trekker land og kartbyer i spillerekkefølge', () => {
    const t = pickFairCountries(nb, 'EU', 10, 2, seeded(5));
    expect(t).toHaveLength(10);
    expect(new Set(t.map(c => c.code)).size).toBe(10);
    const m = pickFairMapCountries(nb, 'AF', 10, 2, 'capital', seeded(5));
    expect(m).toHaveLength(10);
  });
});

describe('nivå', () => {
  const pool = Array.from({length: 30}, (_, i) => i);
  const id = (x: number) => x;

  it('velger tredjedeler etter kjenthet', () => {
    expect(levelPool(pool, 'easy', 5, id)).toEqual([29, 28, 27, 26, 25, 24, 23, 22, 21, 20]);
    expect(levelPool(pool, 'hard', 5, id)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    expect(levelPool(pool, 'medium', 5, id)).toEqual([19, 18, 17, 16, 15, 14, 13, 12, 11, 10]);
    expect(levelPool(pool, 'mixed', 5, id)).toBe(pool);
  });

  it('utvider vinduet når det trengs flere', () => {
    expect(levelPool(pool, 'hard', 20, id)).toHaveLength(20);
    expect(levelPool(pool, 'hard', 20, id)).toContain(0);
    expect(levelPool(pool, 'easy', 8, id, 1.5)).toHaveLength(12);
    expect(levelPool(pool, 'easy', 40, id)).toBe(pool);
  });

  it('gir lettere land på lett enn på vanskelig', () => {
    const avg = (cs: Array<{code: Parameters<typeof familiarity>[0]}>) =>
      cs.reduce((a, c) => a + familiarity(c.code, 'capital'), 0) / cs.length;
    for (const region of ['EU', 'AF', 'ALL'] as const) {
      const easy = pickCountries(nb, region, 10, Math.random, undefined, 'easy');
      const hard = pickCountries(nb, region, 10, Math.random, undefined, 'hard');
      expect(easy).toHaveLength(10);
      expect(hard).toHaveLength(10);
      expect(avg(easy)).toBeGreaterThan(avg(hard));
    }
    const mapEasy = pickMapCountries(nb, 'EU', 10, Math.random, 0.03, undefined, 'easy');
    const mapHard = pickMapCountries(nb, 'EU', 10, Math.random, 0.03, undefined, 'hard');
    expect(mapEasy).toHaveLength(10);
    expect(avg(mapEasy)).toBeGreaterThan(avg(mapHard));
    expect(pickFairCountries(nb, 'AS', 10, 2, Math.random, 'hard')).toHaveLength(10);
  });
});
