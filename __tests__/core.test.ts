import {COUNTRY_CODES} from '../src/data/countries';
import {countriesIn, findCountryByName as findIn} from '../src/core/countries';
import {
  LANGUAGES,
  currentLanguage,
  getLanguage,
  localeFromEvent,
  resolveLocale,
  setDeviceLocale,
  setLanguageChoice,
} from '../src/i18n';
import {pickSheetLanguage} from '../src/core/countries';
import {
  centeredTextRect,
  computeLayout,
  fitFontSize,
  guessLayoutVersion,
  maxRowsPerPage,
  MIN_ROW_PX,
} from '../src/core/layout';
import {assignToRows, boxOf, nearestRow} from '../src/core/grouping';
import {splitByRows} from '../src/core/lines';
import {inside, markColor, markLayout, markStrokes, strokeAsPolygon} from '../src/core/marks';
import {levenshtein, matchAnswer, normalize} from '../src/core/match';
import {
  gradeAnswer,
  isResultText,
  parseSheetTitle,
  pickCountries,
  regionSize,
  resultMark,
  resultText,
  sheetTitle,
  splitIntoPages,
} from '../src/core/sheet';

const nb = getLanguage('nb')!;
const en = getLanguage('en')!;
const COUNTRIES = countriesIn(nb);
const findCountryByName = (name: string) => findIn(name, nb);

describe('country data', () => {
  it('has unique country names', () => {
    const names = COUNTRIES.map(c => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has the right number of countries per continent', () => {
    const count = (c: string) => COUNTRIES.filter(x => x.continent === c).length;
    expect(count('AF')).toBe(54);
    expect(count('SA')).toBe(12);
    expect(count('NA')).toBe(23);
    expect(count('OC')).toBe(14);
  });

  it('finds a country by name', () => {
    expect(findCountryByName(' Peru ')?.capital).toBe('Lima');
  });
});

describe('normalize and levenshtein', () => {
  it('removes accents, capital letters and symbols', () => {
    expect(normalize('Brasília')).toBe('brasilia');
    expect(normalize('København')).toBe('kobenhavn');
    expect(normalize("N'Djamena")).toBe('ndjamena');
    expect(normalize('Washington D.C.')).toBe('washingtondc');
    expect(normalize('Reykjavík\n')).toBe('reykjavik');
  });

  it('counts edit distance', () => {
    expect(levenshtein('lima', 'lina')).toBe(1);
    expect(levenshtein('oslo', 'oslo')).toBe(0);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('matchAnswer', () => {
  const peru = findCountryByName('Peru')!;
  const kina = findCountryByName('Kina')!;
  const island = findCountryByName('Island')!;

  it('accepts exact answer and alternatives', () => {
    expect(gradeAnswer(peru, 'Lima').verdict).toBe('correct');
    expect(gradeAnswer(kina, 'peking').verdict).toBe('correct');
    expect(gradeAnswer(island, 'Reykjavik').verdict).toBe('correct');
  });

  it('is lenient with typos, but stricter on short names', () => {
    expect(gradeAnswer(island, 'Reikjavik').verdict).toBe('close');
    expect(gradeAnswer(findCountryByName('Burkina Faso')!, 'Ouagadugoo').verdict).toBe('close');
    expect(gradeAnswer(peru, 'Lina').verdict).toBe('close');
    expect(gradeAnswer(peru, 'Lome').verdict).toBe('wrong');
    expect(gradeAnswer(findCountryByName('Cuba')!, 'Bern').verdict).toBe('wrong');
  });

  it('does not accept another country\'s capital even if it looks similar', () => {
    // Bern (Switzerland) is only two edits away from Berlin, but is a different capital.
    expect(gradeAnswer(findCountryByName('Tyskland')!, 'Bern').verdict).toBe('wrong');
  });

  it('recognizes blank answers', () => {
    expect(matchAnswer('  ', ['Oslo']).verdict).toBe('blank');
  });

  it('creates mark and result text', () => {
    const wrongResult = gradeAnswer(peru, 'Cusco');
    expect(resultMark(wrongResult)).toBe('cross');
    expect(resultText(peru, 'Cusco', wrongResult, nb)).toBe('Lima\n(leste «Cusco»)');
    const right = gradeAnswer(peru, 'Lima');
    expect(resultMark(right)).toBe('check');
    expect(resultText(peru, 'Lima', right, nb)).toBe('');
    const almost = gradeAnswer(island, 'Reikjavik');
    expect(resultMark(almost)).toBe('almost');
    expect(resultText(island, 'Reikjavik', almost, nb)).toBe('Reykjavík');
    expect(resultMark(gradeAnswer(peru, ''))).toBe('cross');
  });

  it('recognizes results from older versions', () => {
    expect(isResultText('❌ Lima\n(leste «Cusco»)')).toBe(true);
    expect(isResultText('✅')).toBe(true);
    expect(isResultText('Fasit: Lima')).toBe(true); // from version 0.1
    expect(isResultText('Peru')).toBe(false);
  });
});

describe('pickCountries', () => {
  it('draws unique countries from the right continent', () => {
    const picked = pickCountries(nb, 'SA', 20);
    expect(picked).toHaveLength(12);
    expect(picked.every(c => c.continent === 'SA')).toBe(true);
    expect(new Set(picked.map(c => c.name)).size).toBe(12);
  });
});

describe('layout and row distribution', () => {
  const manta = {width: 1920, height: 2560};
  const layout = computeLayout(manta, 20);

  it('keeps the table within the page', () => {
    expect(layout.rows).toHaveLength(20);
    expect(layout.lineY).toHaveLength(22);
    expect(layout.score.bottom).toBeLessThanOrEqual(manta.height);
    expect(layout.columnX[3]).toBeLessThanOrEqual(manta.width);
  });

  it('shrinks text for long country names', () => {
    const cell = layout.rows[0].country;
    expect(fitFontSize('Den sentralafrikanske republikk', cell, layout.fontSize)).toBeLessThan(
      fitFontSize('Peru', cell, layout.fontSize),
    );
  });

  it('assigns strokes to rows and ignores scribbles outside the answer column', () => {
    const answerColumn = {left: layout.columnX[1], right: layout.columnX[2]};
    const row3 = layout.rows[3].answer;
    const midX = (row3.left + row3.right) / 2;
    const midY = (row3.top + row3.bottom) / 2;
    const boxes = [
      boxOf([
        {x: midX - 40, y: midY - 10},
        {x: midX + 40, y: midY + 10},
      ]),
      boxOf([{x: layout.columnX[0] + 20, y: midY}]), // in the country column
      null,
    ];
    const rows = assignToRows(boxes, layout.rows, answerColumn);
    expect(rows[3]).toEqual([0]);
    expect(rows.flat()).toEqual([0]);
  });

  it('centres text vertically in the cell', () => {
    const cell = layout.rows[0].country;
    const rect = centeredTextRect('Peru', cell, 30);
    expect(rect.top - cell.top).toBeCloseTo(cell.bottom - rect.bottom, -1);
    expect(rect.bottom - rect.top).toBeLessThan(cell.bottom - cell.top);
  });

  it('gives the answer column the most space', () => {
    const [c0, c1, c2, c3] = layout.columnX;
    expect(c2 - c1).toBeGreaterThan(c1 - c0);
    expect(c2 - c1).toBeGreaterThan(c3 - c2);
  });

  it('finds the nearest row for a text box', () => {
    expect(nearestRow(layout.rows[7].country, layout.rows)).toBe(7);
  });
});

describe('splitByRows', () => {
  it('matches lines to rows in order', () => {
    const m = splitByRows('Oslo\n\nLima \nBern', [0, 4, 7]);
    expect(m && [...m.entries()]).toEqual([
      [0, 'Oslo'],
      [4, 'Lima'],
      [7, 'Bern'],
    ]);
  });

  it('gives up when the number of lines does not match', () => {
    expect(splitByRows('Oslo Lima', [0, 4])).toBeNull();
  });
});

describe('multiple pages', () => {
  it('splits evenly with at most 20 per page', () => {
    const sizes = (n: number) => splitIntoPages(Array.from({length: n}, (_, i) => i)).map(p => p.length);
    expect(sizes(54)).toEqual([18, 18, 18]);
    expect(sizes(46)).toEqual([16, 15, 15]);
    expect(sizes(20)).toEqual([20]);
    expect(sizes(197)).toEqual([20, 20, 20, 20, 20, 20, 20, 19, 19, 19]);
    expect(splitIntoPages([1, 2, 3]).flat()).toEqual([1, 2, 3]);
  });

  it('writes and reads the page number in the heading', () => {
    const t = sheetTitle(nb, 'AF', 18, 2, 3);
    expect(t).toBe('Hovedsteder – Afrika (18) · side 2 av 3');
    expect(parseSheetTitle(t)).toMatchObject({part: 2, parts: 3, lang: nb});
    expect(parseSheetTitle(sheetTitle(nb, 'EU', 20))).toMatchObject({part: 1, parts: 1, lang: nb});
    expect(parseSheetTitle('Noe annet')).toBeNull();
  });

  it('knows the size of the regions', () => {
    expect(regionSize('AF')).toBe(54);
    expect(regionSize('ALL')).toBe(197);
  });
});

describe('languages', () => {
  it('has names for all countries in all languages, without duplicate country names', () => {
    for (const lang of LANGUAGES) {
      const names = COUNTRY_CODES.map(code => lang.countries[code][0]);
      expect(names).toHaveLength(197);
      expect(new Set(names).size).toBe(names.length);
      expect(names.every(n => n.trim() === n && n.length > 0)).toBe(true);
    }
  });

  it('includes the languages Supernote recognizes handwriting in', () => {
    const codes = LANGUAGES.map(l => l.code);
    expect(codes).toHaveLength(55);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.slice(0, 2)).toEqual(['en', 'nb']);
    for (const c of ['de', 'fr', 'sv', 'da', 'ja', 'ko', 'zh-Hans', 'zh-Hant', 'sr-Latn', 'sr-Cyrl', 'ka', 'tt']) {
      expect(codes).toContain(c);
    }
  });

  it('has complete and unambiguous sheet texts in all languages', () => {
    for (const lang of LANGUAGES) {
      const s = lang.sheet;
      for (const text of [s.titlePrefix, s.subtitle, s.colCountry, s.colAnswer, s.colResult, s.scorePrefix, lang.world]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
      expect(Object.values(lang.continents).every(c => c.trim().length > 0)).toBe(true);
      // The score text must be recognized as a result, but not as a country name.
      expect(isResultText(s.score(3, 20))).toBe(true);
      for (const code of COUNTRY_CODES) {
        expect(isResultText(lang.countries[code][0])).toBe(false);
      }
      // Each heading with a page number is read back with the right language as a candidate.
      const info = parseSheetTitle(sheetTitle(lang, 'AF', 18, 2, 3));
      expect(info).toMatchObject({part: 2, parts: 3});
      expect(info!.candidates).toContain(lang);
      expect(lang.ui.make.length).toBeGreaterThan(0); // menu borrowed from English where it is missing
    }
  });

  it('normalizes answers in all scripts without emptying them', () => {
    for (const lang of LANGUAGES) {
      for (const code of COUNTRY_CODES) {
        expect(normalize(lang.countries[code][1]).length).toBeGreaterThan(0);
      }
    }
    expect(normalize('Москва')).toBe('москва');
    expect(normalize('Αθήνα')).toBe(normalize('ΑΘΗΝΑ'));
    expect(normalize('東京')).toBe('東京');
    expect(normalize('Ankara, ')).toBe('ankara');
    expect(normalize('Reykjavík')).toBe(normalize('Reykjavik'));
  });

  it('picks language from the device language code', () => {
    expect(resolveLocale('nb_NO').code).toBe('nb');
    expect(resolveLocale('nb-NO').code).toBe('nb');
    expect(resolveLocale('no').code).toBe('nb');
    expect(resolveLocale('nn_NO').code).toBe('nb');
    expect(resolveLocale('en_US').code).toBe('en');
    expect(resolveLocale('de_DE').code).toBe('de');
    expect(resolveLocale('xx_YY').code).toBe('en'); // unknown → English
    expect(resolveLocale(undefined).code).toBe('en');
    expect(resolveLocale('zh_CN').code).toBe('zh-Hans');
    expect(resolveLocale('zh_TW').code).toBe('zh-Hant');
    expect(resolveLocale('zh-Hant-HK').code).toBe('zh-Hant');
    expect(resolveLocale('zh_CN_#Hans').code).toBe('zh-Hans');
    expect(resolveLocale('sr_RS_#Latn').code).toBe('sr-Latn');
    expect(resolveLocale('sr_RS').code).toBe('sr-Cyrl');
    expect(resolveLocale('in_ID').code).toBe('id');
    expect(resolveLocale('pt_BR').code).toBe('pt');
  });

  it('reads the language code from the language event', () => {
    expect(localeFromEvent('en')).toBe('en');
    expect(localeFromEvent({lang: 'nb_NO'})).toBe('nb_NO');
    expect(localeFromEvent({data: {locale: 'en'}})).toBe('en');
    expect(localeFromEvent(null)).toBeUndefined();
  });

  it('lets the menu choice override the device language', () => {
    setDeviceLocale('nb_NO');
    expect(currentLanguage().code).toBe('nb');
    setLanguageChoice('en');
    expect(currentLanguage().code).toBe('en');
    setLanguageChoice('xx'); // not included → automatic
    expect(currentLanguage().code).toBe('nb');
    setLanguageChoice('auto');
  });

  it('looks up the same country with a stable key in both languages', () => {
    const no = findIn('Tyskland', nb)!;
    const de = findIn('Germany', en)!;
    expect(no.code).toBe('DE');
    expect(de.code).toBe('DE');
    expect(de.capital).toBe('Berlin');
    expect(findIn('Iceland', en)?.code).toBe('IS');
    expect(findIn('Island', nb)?.code).toBe('IS');
    // Without the right language, the lookup falls back to the other languages.
    expect(findIn('Norway', nb)?.code).toBe('NO');
  });
});

describe('grading an English sheet', () => {
  const germany = findIn('Germany', en)!;
  const denmark = findIn('Denmark', en)!;
  const italy = findIn('Italy', en)!;

  it('recognizes English heading with page number', () => {
    const t = sheetTitle(en, 'EU', 15, 3, 4);
    expect(t).toBe('Capitals – Europe (15) · page 3 of 4');
    expect(parseSheetTitle(t)).toMatchObject({part: 3, parts: 4, lang: en});
    expect(parseSheetTitle(sheetTitle(en, 'ALL', 20))).toMatchObject({part: 1, parts: 1, lang: en});
  });

  it('accepts English and Norwegian capital and alternatives', () => {
    expect(gradeAnswer(denmark, 'Copenhagen').verdict).toBe('correct');
    expect(gradeAnswer(denmark, 'København').verdict).toBe('correct');
    expect(gradeAnswer(italy, 'Rome').verdict).toBe('correct');
    expect(gradeAnswer(italy, 'Roma').verdict).toBe('correct');
    expect(gradeAnswer(germany, 'Berln').verdict).toBe('close');
    expect(gradeAnswer(germany, 'Bern').verdict).toBe('wrong');
  });

  it('accepts English capital on a Norwegian sheet', () => {
    expect(gradeAnswer(findCountryByName('Hellas')!, 'Athens').verdict).toBe('correct');
    expect(gradeAnswer(findCountryByName('Østerrike')!, 'Vienna').verdict).toBe('correct');
    expect(gradeAnswer(findCountryByName('Polen')!, 'Warsaw').verdict).toBe('correct');
  });

  it('writes results in English that are removed on regrading', () => {
    const wrong = resultText(italy, 'Milan', gradeAnswer(italy, 'Milan'), en);
    expect(wrong).toBe('Rome\n(read “Milan”)');
    expect(isResultText(en.sheet.score(3, 5))).toBe(true);
    expect(isResultText(nb.sheet.score(3, 5))).toBe(true);
    expect(isResultText('Italy')).toBe(false);
    expect(isResultText(en.sheet.colResult)).toBe(false);
  });

  it('grades sheets made before language support (Norwegian heading and Norwegian names)', () => {
    const info = parseSheetTitle('Hovedsteder – Europa (20)');
    expect(info?.lang.code).toBe('nb');
    const c = findIn('Russland', info!.lang)!;
    expect(c.capital).toBe('Moskva');
    expect(isResultText('Riktig')).toBe(true);
  });
});

describe('hand-drawn marks', () => {
  const cell = {left: 1300, top: 400, right: 1700, bottom: 500};

  it('keeps the marks within their box and identical from run to run', () => {
    for (const kind of ['check', 'cross', 'almost'] as const) {
      const {mark, text} = markLayout(cell, kind);
      expect(text.left).toBeGreaterThan(mark.right);
      const strokes = markStrokes(kind, mark, 3);
      expect(strokes.length).toBe({check: 1, cross: 2, almost: 3}[kind]);
      const pad = {left: mark.left - 5, top: mark.top - 5, right: mark.right + 5, bottom: mark.bottom + 5};
      expect(strokes.flat().every(p => inside(p, pad))).toBe(true);
      expect(markStrokes(kind, mark, 3)).toEqual(strokes);
    }
  });

  it('draws "almost" in grey', () => {
    expect(markColor('check')).toBe(0);
    expect(markColor('cross')).toBe(0);
    expect(markColor('almost')).toBe(0x9d);
  });

  it('varies slightly between rows', () => {
    const {mark} = markLayout(cell, 'check');
    expect(markStrokes('check', mark, 1)).not.toEqual(markStrokes('check', mark, 2));
  });

  it('creates open strokes as a polygon there and back', () => {
    const poly = strokeAsPolygon([
      {x: 0, y: 0},
      {x: 1, y: 1},
      {x: 2, y: 0},
    ]);
    expect(poly).toEqual([
      {x: 0, y: 0},
      {x: 1, y: 1},
      {x: 2, y: 0},
      {x: 1, y: 1},
      {x: 0, y: 0},
    ]);
  });
});

describe('other languages', () => {
  const de = getLanguage('de')!;
  const fr = getLanguage('fr')!;
  const es = getLanguage('es')!;
  const ja = getLanguage('ja')!;
  const zhHans = getLanguage('zh-Hans')!;
  const ru = getLanguage('ru')!;

  it('grades a German sheet with German, English and Norwegian capitals', () => {
    const dk = findIn('Dänemark', de)!;
    expect(dk.code).toBe('DK');
    expect(gradeAnswer(dk, 'Kopenhagen').verdict).toBe('correct');
    expect(gradeAnswer(dk, 'Kopenhagn').verdict).toBe('close');
    expect(gradeAnswer(dk, 'Copenhagen').verdict).toBe('correct');
    expect(gradeAnswer(dk, 'København').verdict).toBe('correct');
    expect(gradeAnswer(dk, 'Stockholm').verdict).toBe('wrong');
    expect(resultText(dk, 'Oslo', gradeAnswer(dk, 'Oslo'), de)).toBe(`${dk.capital}\n(gelesen: “Oslo”)`);
    expect(de.sheet.score(12, 20)).toBe('Punkte: 12/20');
  });

  it('grades in Cyrillic and Japanese', () => {
    const no = findIn('Норвегия', ru)!;
    expect(no.code).toBe('NO');
    expect(gradeAnswer(no, 'Осло').verdict).toBe('correct');
    expect(gradeAnswer(no, 'Oslo').verdict).toBe('correct');
    const jp = findIn('日本', ja)!;
    expect(jp.code).toBe('JP');
    expect(gradeAnswer(jp, jp.capital).verdict).toBe('correct');
    expect(gradeAnswer(jp, 'Tokyo').verdict).toBe('correct');
  });

  it('accepts Chinese, Japanese and Korean capitals without administrative affixes', () => {
    const grade = (lang: string, code: string, answer: string) =>
      gradeAnswer(countriesIn(getLanguage(lang)!).find(c => c.code === code)!, answer).verdict;
    // Wikidata has 東京都, 北京市, ソウル特別市 etc.; nobody writes the affix.
    for (const [lang, code, answer] of [
      ['ja', 'JP', '東京'], ['ja', 'CN', '北京'], ['ja', 'KR', 'ソウル'], ['ja', 'TW', '台北'],
      ['ja', 'NR', 'ヤレン'], ['ja', 'US', 'ワシントン'],
      ['zh-Hans', 'JP', '东京'], ['zh-Hans', 'CN', '北京'], ['zh-Hans', 'BD', '达卡'], ['zh-Hans', 'US', '华盛顿'],
      ['zh-Hant', 'TW', '台北'], ['zh-Hant', 'TW', '臺北'], ['zh-Hant', 'JP', '东京'],
      ['ko', 'KR', '서울'], ['ko', 'VA', '바티칸'],
    ]) {
      expect([lang, code, answer, grade(lang, code, answer)]).toEqual([lang, code, answer, 'correct']);
    }
    // Names that merely end in such a character are not shortened.
    expect(grade('ko', 'GE', '트빌리')).not.toBe('correct');
    expect(grade('zh-Hans', 'NP', '加德满')).not.toBe('correct');
    // One character off is still a different place.
    expect(grade('ja', 'JP', '北京')).toBe('wrong');
  });

  it('accepts kana, ヴ/バ and spellings with and without the long vowel mark', () => {
    const grade = (code: string, answer: string) =>
      gradeAnswer(countriesIn(ja).find(c => c.code === code)!, answer).verdict;
    expect(grade('JP', 'とうきょう')).toBe('correct');
    expect(grade('CN', 'ペキン')).toBe('correct');
    expect(grade('KP', 'ピョンヤン')).toBe('correct');
    expect(grade('BA', 'サラエボ')).toBe('correct');
    expect(grade('LT', 'ビリニュス')).toBe('correct');
    expect(grade('IS', 'レイキャビク')).toBe('correct');
    expect(grade('AF', 'カブール')).toBe('correct');
    expect(grade('UA', 'キエフ')).toBe('correct');
    expect(normalize('ヴィエンチャン')).toBe(normalize('ビエンチャン'));
    expect(normalize('マナーマ')).toBe(normalize('マナマ'));
  });

  it('accepts capitals without the "city" affix in Greek, Mongolian, Tatar and Irish', () => {
    const grade = (lang: string, code: string, answer: string) =>
      gradeAnswer(countriesIn(getLanguage(lang)!).find(c => c.code === code)!, answer).verdict;
    for (const [lang, code, answer] of [
      ['el', 'MX', 'Μεξικό'], ['el', 'GT', 'Γουατεμάλα'], ['el', 'PA', 'Παναμάς'], ['el', 'SM', 'Σαν Μαρίνο'],
      ['mn', 'AL', 'Тиран'], ['mn', 'YE', 'Санаа'], ['mn', 'CI', 'Ямусукро'],
      ['tt', 'AE', 'Әбү-Дәби'], ['tt', 'LY', 'Триполи'],
      ['ga', 'BE', 'an Bhruiséil'], ['ga', 'KW', 'Cuáit'], ['ga', 'MX', 'Meicsiceo'],
    ]) {
      expect([lang, code, answer, grade(lang, code, answer)]).toEqual([lang, code, answer, 'correct']);
    }
  });

  it('accepts Jerusalem for Palestine in every language', () => {
    for (const lang of LANGUAGES) {
      const ps = countriesIn(lang).find(c => c.code === 'PS')!;
      const il = countriesIn(lang).find(c => c.code === 'IL')!;
      expect([lang.code, gradeAnswer(ps, il.capital).verdict]).toEqual([lang.code, 'correct']);
    }
  });

  it('tells apart languages that share a heading using the country names', () => {
    const title = sheetTitle(es, 'EU', 3);
    const info = parseSheetTitle(title)!;
    expect(info.candidates).toEqual(expect.arrayContaining([es, fr]));
    // The region name in the heading decides here (Europa vs Europe).
    expect(info.lang).toBe(es);
    const spanish = ['DE', 'FR', 'IT'].map(c => es.countries[c as 'DE'][0]);
    expect(pickSheetLanguage([title, ...spanish], info.candidates)).toBe(es);

    const zh = parseSheetTitle(sheetTitle(zhHans, 'AS', 2))!;
    expect(zh.candidates).toEqual(expect.arrayContaining([zhHans, ja]));
    const japanese = ['CN', 'KR'].map(c => ja.countries[c as 'CN'][0]);
    expect(pickSheetLanguage(japanese, zh.candidates)).toBe(ja);
  });

  it('reads language-neutral page number', () => {
    expect(sheetTitle(de, 'AF', 18, 2, 3)).toBe('Hauptstädte – Afrika (18) · 2/3');
    expect(parseSheetTitle('Hauptstädte – Afrika (18) · 2/3')).toMatchObject({part: 2, parts: 3, lang: de});
  });
});

describe('safe margins and layout versions', () => {
  const manta = {width: 1920, height: 2560};

  it('keeps the table away from the toolbar on the sides and top', () => {
    const L = computeLayout(manta, 20);
    expect(L.columnX[0]).toBeGreaterThanOrEqual(160);
    expect(manta.width - L.columnX[3]).toBeGreaterThanOrEqual(160);
    expect(L.title.top).toBeGreaterThanOrEqual(160);
    expect(L.score.bottom).toBeLessThanOrEqual(manta.height);
  });

  it('recognizes sheets made with old and new layout', () => {
    for (const v of [1, 3] as const) {
      const L = computeLayout(manta, 16, v);
      const lefts = L.rows.map(r => r.country.left);
      expect(guessLayoutVersion(manta, 16, lefts)).toBe(v);
    }
  });
});

describe('Nomad and other small pages', () => {
  const manta = {width: 1920, height: 2560};
  const nomad = {width: 1404, height: 1872};

  it('gives Manta 20 rows and Nomad fewer, but tall enough rows', () => {
    expect(maxRowsPerPage(manta)).toBe(20);
    const n = maxRowsPerPage(nomad);
    expect(n).toBeLessThan(20);
    expect(n).toBeGreaterThanOrEqual(12);
    const L = computeLayout(nomad, n);
    expect(L.rows[0].band.bottom - L.rows[0].band.top).toBeGreaterThanOrEqual(MIN_ROW_PX);
  });

  it('keeps at least 150 px margin to the toolbar on Nomad too', () => {
    const L = computeLayout(nomad, maxRowsPerPage(nomad));
    expect(L.columnX[0]).toBeGreaterThanOrEqual(150);
    expect(nomad.width - L.columnX[3]).toBeGreaterThanOrEqual(150);
    expect(L.title.top).toBeGreaterThanOrEqual(150);
    expect(L.score.bottom).toBeLessThanOrEqual(nomad.height);
    expect(L.fontSize).toBeGreaterThanOrEqual(30);
  });

  it('does not change the Manta layout', () => {
    expect(computeLayout(manta, 20, 3)).toEqual(computeLayout(manta, 20, 2));
  });

  it('recognizes Nomad sheets', () => {
    const n = maxRowsPerPage(nomad);
    const lefts = computeLayout(nomad, n).rows.map(r => r.country.left);
    expect(guessLayoutVersion(nomad, n, lefts)).toBe(3);
  });
});
