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
import {mapSubtitle} from '../src/core/mapSheet';
import {parseMapTitle} from '../src/core/mapSheet';
import {parseSheetTitle} from '../src/core/sheet';

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
