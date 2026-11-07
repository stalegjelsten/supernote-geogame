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

describe('landdata', () => {
  it('har unike landnavn', () => {
    const names = COUNTRIES.map(c => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('har riktig antall land per verdensdel', () => {
    const count = (c: string) => COUNTRIES.filter(x => x.continent === c).length;
    expect(count('AF')).toBe(54);
    expect(count('SA')).toBe(12);
    expect(count('NA')).toBe(23);
    expect(count('OC')).toBe(14);
  });

  it('finner land på navn', () => {
    expect(findCountryByName(' Peru ')?.capital).toBe('Lima');
  });
});

describe('normalize og levenshtein', () => {
  it('fjerner aksenter, store bokstaver og tegn', () => {
    expect(normalize('Brasília')).toBe('brasilia');
    expect(normalize('København')).toBe('kobenhavn');
    expect(normalize("N'Djamena")).toBe('ndjamena');
    expect(normalize('Washington D.C.')).toBe('washingtondc');
    expect(normalize('Reykjavík\n')).toBe('reykjavik');
  });

  it('teller redigeringsavstand', () => {
    expect(levenshtein('lima', 'lina')).toBe(1);
    expect(levenshtein('oslo', 'oslo')).toBe(0);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('matchAnswer', () => {
  const peru = findCountryByName('Peru')!;
  const kina = findCountryByName('Kina')!;
  const island = findCountryByName('Island')!;

  it('godtar eksakt svar og alternativer', () => {
    expect(gradeAnswer(peru, 'Lima').verdict).toBe('correct');
    expect(gradeAnswer(kina, 'peking').verdict).toBe('correct');
    expect(gradeAnswer(island, 'Reykjavik').verdict).toBe('correct');
  });

  it('er snill med skrivefeil, men strengere på korte navn', () => {
    expect(gradeAnswer(island, 'Reikjavik').verdict).toBe('close');
    expect(gradeAnswer(findCountryByName('Burkina Faso')!, 'Ouagadugoo').verdict).toBe('close');
    expect(gradeAnswer(peru, 'Lina').verdict).toBe('close');
    expect(gradeAnswer(peru, 'Lome').verdict).toBe('wrong');
    expect(gradeAnswer(findCountryByName('Cuba')!, 'Bern').verdict).toBe('wrong');
  });

  it('godtar ikke et annet lands hovedstad selv om den ligner', () => {
    // Bern (Sveits) ligger bare to feil unna Berlin, men er en annen hovedstad.
    expect(gradeAnswer(findCountryByName('Tyskland')!, 'Bern').verdict).toBe('wrong');
  });

  it('gjenkjenner blanke svar', () => {
    expect(matchAnswer('  ', ['Oslo']).verdict).toBe('blank');
  });

  it('lager merke og resultattekst', () => {
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

  it('kjenner igjen resultater fra eldre versjoner', () => {
    expect(isResultText('❌ Lima\n(leste «Cusco»)')).toBe(true);
    expect(isResultText('✅')).toBe(true);
    expect(isResultText('Fasit: Lima')).toBe(true); // fra versjon 0.1
    expect(isResultText('Peru')).toBe(false);
  });
});

describe('pickCountries', () => {
  it('trekker unike land fra riktig verdensdel', () => {
    const picked = pickCountries(nb, 'SA', 20);
    expect(picked).toHaveLength(12);
    expect(picked.every(c => c.continent === 'SA')).toBe(true);
    expect(new Set(picked.map(c => c.name)).size).toBe(12);
  });
});

describe('layout og radfordeling', () => {
  const manta = {width: 1920, height: 2560};
  const layout = computeLayout(manta, 20);

  it('holder tabellen innenfor siden', () => {
    expect(layout.rows).toHaveLength(20);
    expect(layout.lineY).toHaveLength(22);
    expect(layout.score.bottom).toBeLessThanOrEqual(manta.height);
    expect(layout.columnX[3]).toBeLessThanOrEqual(manta.width);
  });

  it('krymper skrift for lange landnavn', () => {
    const cell = layout.rows[0].country;
    expect(fitFontSize('Den sentralafrikanske republikk', cell, layout.fontSize)).toBeLessThan(
      fitFontSize('Peru', cell, layout.fontSize),
    );
  });

  it('fordeler strøk på rader og ignorerer kladd utenfor svarkolonnen', () => {
    const answerColumn = {left: layout.columnX[1], right: layout.columnX[2]};
    const row3 = layout.rows[3].answer;
    const midX = (row3.left + row3.right) / 2;
    const midY = (row3.top + row3.bottom) / 2;
    const boxes = [
      boxOf([
        {x: midX - 40, y: midY - 10},
        {x: midX + 40, y: midY + 10},
      ]),
      boxOf([{x: layout.columnX[0] + 20, y: midY}]), // i landkolonnen
      null,
    ];
    const rows = assignToRows(boxes, layout.rows, answerColumn);
    expect(rows[3]).toEqual([0]);
    expect(rows.flat()).toEqual([0]);
  });

  it('midtstiller tekst loddrett i cellen', () => {
    const cell = layout.rows[0].country;
    const rect = centeredTextRect('Peru', cell, 30);
    expect(rect.top - cell.top).toBeCloseTo(cell.bottom - rect.bottom, -1);
    expect(rect.bottom - rect.top).toBeLessThan(cell.bottom - cell.top);
  });

  it('gir svarkolonnen mest plass', () => {
    const [c0, c1, c2, c3] = layout.columnX;
    expect(c2 - c1).toBeGreaterThan(c1 - c0);
    expect(c2 - c1).toBeGreaterThan(c3 - c2);
  });

  it('finner nærmeste rad for en tekstboks', () => {
    expect(nearestRow(layout.rows[7].country, layout.rows)).toBe(7);
  });
});

describe('splitByRows', () => {
  it('kobler linjer til rader i rekkefølge', () => {
    const m = splitByRows('Oslo\n\nLima \nBern', [0, 4, 7]);
    expect(m && [...m.entries()]).toEqual([
      [0, 'Oslo'],
      [4, 'Lima'],
      [7, 'Bern'],
    ]);
  });

  it('gir opp når antall linjer ikke stemmer', () => {
    expect(splitByRows('Oslo Lima', [0, 4])).toBeNull();
  });
});

describe('flere sider', () => {
  it('deler jevnt med høyst 20 per side', () => {
    const sizes = (n: number) => splitIntoPages(Array.from({length: n}, (_, i) => i)).map(p => p.length);
    expect(sizes(54)).toEqual([18, 18, 18]);
    expect(sizes(46)).toEqual([16, 15, 15]);
    expect(sizes(20)).toEqual([20]);
    expect(sizes(197)).toEqual([20, 20, 20, 20, 20, 20, 20, 19, 19, 19]);
    expect(splitIntoPages([1, 2, 3]).flat()).toEqual([1, 2, 3]);
  });

  it('skriver og leser sidenummer i overskriften', () => {
    const t = sheetTitle(nb, 'AF', 18, 2, 3);
    expect(t).toBe('Hovedsteder – Afrika (18) · side 2 av 3');
    expect(parseSheetTitle(t)).toMatchObject({part: 2, parts: 3, lang: nb});
    expect(parseSheetTitle(sheetTitle(nb, 'EU', 20))).toMatchObject({part: 1, parts: 1, lang: nb});
    expect(parseSheetTitle('Noe annet')).toBeNull();
  });

  it('kjenner størrelsen på regionene', () => {
    expect(regionSize('AF')).toBe(54);
    expect(regionSize('ALL')).toBe(197);
  });
});

describe('språk', () => {
  it('har navn på alle land på alle språk, uten doble landnavn', () => {
    for (const lang of LANGUAGES) {
      const names = COUNTRY_CODES.map(code => lang.countries[code][0]);
      expect(names).toHaveLength(197);
      expect(new Set(names).size).toBe(names.length);
      expect(names.every(n => n.trim() === n && n.length > 0)).toBe(true);
    }
  });

  it('bygger inn språkene Supernote gjenkjenner håndskrift på', () => {
    const codes = LANGUAGES.map(l => l.code);
    expect(codes).toHaveLength(55);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.slice(0, 2)).toEqual(['en', 'nb']);
    for (const c of ['de', 'fr', 'sv', 'da', 'ja', 'ko', 'zh-Hans', 'zh-Hant', 'sr-Latn', 'sr-Cyrl', 'ka', 'tt']) {
      expect(codes).toContain(c);
    }
  });

  it('har fullstendige og entydige arktekster på alle språk', () => {
    for (const lang of LANGUAGES) {
      const s = lang.sheet;
      for (const text of [s.titlePrefix, s.subtitle, s.colCountry, s.colAnswer, s.colResult, s.scorePrefix, lang.world]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
      expect(Object.values(lang.continents).every(c => c.trim().length > 0)).toBe(true);
      // Poengteksten må kjennes igjen som resultat, men ikke et landnavn.
      expect(isResultText(s.score(3, 20))).toBe(true);
      for (const code of COUNTRY_CODES) {
        expect(isResultText(lang.countries[code][0])).toBe(false);
      }
      // Hver overskrift med sidenummer leses tilbake med riktig språk som kandidat.
      const info = parseSheetTitle(sheetTitle(lang, 'AF', 18, 2, 3));
      expect(info).toMatchObject({part: 2, parts: 3});
      expect(info!.candidates).toContain(lang);
      expect(lang.ui.make.length).toBeGreaterThan(0); // meny lånt fra engelsk der den mangler
    }
  });

  it('normaliserer svar i alle skrifter uten å tømme dem', () => {
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

  it('velger språk ut fra enhetens språkkode', () => {
    expect(resolveLocale('nb_NO').code).toBe('nb');
    expect(resolveLocale('nb-NO').code).toBe('nb');
    expect(resolveLocale('no').code).toBe('nb');
    expect(resolveLocale('nn_NO').code).toBe('nb');
    expect(resolveLocale('en_US').code).toBe('en');
    expect(resolveLocale('de_DE').code).toBe('de');
    expect(resolveLocale('xx_YY').code).toBe('en'); // ukjent → engelsk
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

  it('leser språkkoden fra språkhendelsen', () => {
    expect(localeFromEvent('en')).toBe('en');
    expect(localeFromEvent({lang: 'nb_NO'})).toBe('nb_NO');
    expect(localeFromEvent({data: {locale: 'en'}})).toBe('en');
    expect(localeFromEvent(null)).toBeUndefined();
  });

  it('lar menyvalget overstyre enhetens språk', () => {
    setDeviceLocale('nb_NO');
    expect(currentLanguage().code).toBe('nb');
    setLanguageChoice('en');
    expect(currentLanguage().code).toBe('en');
    setLanguageChoice('xx'); // ikke inkludert → automatisk
    expect(currentLanguage().code).toBe('nb');
    setLanguageChoice('auto');
  });

  it('slår opp samme land med stabil nøkkel på begge språk', () => {
    const no = findIn('Tyskland', nb)!;
    const de = findIn('Germany', en)!;
    expect(no.code).toBe('DE');
    expect(de.code).toBe('DE');
    expect(de.capital).toBe('Berlin');
    expect(findIn('Iceland', en)?.code).toBe('IS');
    expect(findIn('Island', nb)?.code).toBe('IS');
    // Uten riktig språk faller oppslaget tilbake på de andre språkene.
    expect(findIn('Norway', nb)?.code).toBe('NO');
  });
});

describe('retting på engelsk ark', () => {
  const germany = findIn('Germany', en)!;
  const denmark = findIn('Denmark', en)!;
  const italy = findIn('Italy', en)!;

  it('kjenner igjen engelsk overskrift med sidenummer', () => {
    const t = sheetTitle(en, 'EU', 15, 3, 4);
    expect(t).toBe('Capitals – Europe (15) · page 3 of 4');
    expect(parseSheetTitle(t)).toMatchObject({part: 3, parts: 4, lang: en});
    expect(parseSheetTitle(sheetTitle(en, 'ALL', 20))).toMatchObject({part: 1, parts: 1, lang: en});
  });

  it('godtar engelsk og norsk hovedstad og alternativer', () => {
    expect(gradeAnswer(denmark, 'Copenhagen').verdict).toBe('correct');
    expect(gradeAnswer(denmark, 'København').verdict).toBe('correct');
    expect(gradeAnswer(italy, 'Rome').verdict).toBe('correct');
    expect(gradeAnswer(italy, 'Roma').verdict).toBe('correct');
    expect(gradeAnswer(germany, 'Berln').verdict).toBe('close');
    expect(gradeAnswer(germany, 'Bern').verdict).toBe('wrong');
  });

  it('godtar engelsk hovedstad på norsk ark', () => {
    expect(gradeAnswer(findCountryByName('Hellas')!, 'Athens').verdict).toBe('correct');
    expect(gradeAnswer(findCountryByName('Østerrike')!, 'Vienna').verdict).toBe('correct');
    expect(gradeAnswer(findCountryByName('Polen')!, 'Warsaw').verdict).toBe('correct');
  });

  it('skriver resultater på engelsk som fjernes ved ny retting', () => {
    const wrong = resultText(italy, 'Milan', gradeAnswer(italy, 'Milan'), en);
    expect(wrong).toBe('Rome\n(read “Milan”)');
    expect(isResultText(en.sheet.score(3, 5))).toBe(true);
    expect(isResultText(nb.sheet.score(3, 5))).toBe(true);
    expect(isResultText('Italy')).toBe(false);
    expect(isResultText(en.sheet.colResult)).toBe(false);
  });

  it('retter ark laget før språkstøtten (norsk overskrift og norske navn)', () => {
    const info = parseSheetTitle('Hovedsteder – Europa (20)');
    expect(info?.lang.code).toBe('nb');
    const c = findIn('Russland', info!.lang)!;
    expect(c.capital).toBe('Moskva');
    expect(isResultText('Riktig')).toBe(true);
  });
});

describe('håndtegnede merker', () => {
  const cell = {left: 1300, top: 400, right: 1700, bottom: 500};

  it('holder merkene innenfor sin boks og er like fra gang til gang', () => {
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

  it('tegner «nesten» i grått', () => {
    expect(markColor('check')).toBe(0);
    expect(markColor('cross')).toBe(0);
    expect(markColor('almost')).toBe(0x9d);
  });

  it('varierer litt mellom rader', () => {
    const {mark} = markLayout(cell, 'check');
    expect(markStrokes('check', mark, 1)).not.toEqual(markStrokes('check', mark, 2));
  });

  it('lager åpne streker som polygon frem og tilbake', () => {
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

describe('andre språk', () => {
  const de = getLanguage('de')!;
  const fr = getLanguage('fr')!;
  const es = getLanguage('es')!;
  const ja = getLanguage('ja')!;
  const zhHans = getLanguage('zh-Hans')!;
  const ru = getLanguage('ru')!;

  it('retter et tysk ark med tyske, engelske og norske hovedsteder', () => {
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

  it('retter på kyrillisk og japansk', () => {
    const no = findIn('Норвегия', ru)!;
    expect(no.code).toBe('NO');
    expect(gradeAnswer(no, 'Осло').verdict).toBe('correct');
    expect(gradeAnswer(no, 'Oslo').verdict).toBe('correct');
    const jp = findIn('日本', ja)!;
    expect(jp.code).toBe('JP');
    expect(gradeAnswer(jp, jp.capital).verdict).toBe('correct');
    expect(gradeAnswer(jp, 'Tokyo').verdict).toBe('correct');
  });

  it('godtar kinesiske, japanske og koreanske hovedsteder uten forvaltningsledd', () => {
    const grade = (lang: string, code: string, answer: string) =>
      gradeAnswer(countriesIn(getLanguage(lang)!).find(c => c.code === code)!, answer).verdict;
    // Wikidata har 東京都, 北京市, ソウル特別市 osv.; ingen skriver leddet.
    for (const [lang, code, answer] of [
      ['ja', 'JP', '東京'], ['ja', 'CN', '北京'], ['ja', 'KR', 'ソウル'], ['ja', 'TW', '台北'],
      ['ja', 'NR', 'ヤレン'], ['ja', 'US', 'ワシントン'],
      ['zh-Hans', 'JP', '东京'], ['zh-Hans', 'CN', '北京'], ['zh-Hans', 'BD', '达卡'], ['zh-Hans', 'US', '华盛顿'],
      ['zh-Hant', 'TW', '台北'], ['zh-Hant', 'TW', '臺北'], ['zh-Hant', 'JP', '东京'],
      ['ko', 'KR', '서울'], ['ko', 'VA', '바티칸'],
    ]) {
      expect([lang, code, answer, grade(lang, code, answer)]).toEqual([lang, code, answer, 'correct']);
    }
    // Navn som bare slutter på et slikt tegn, kortes ikke av.
    expect(grade('ko', 'GE', '트빌리')).not.toBe('correct');
    expect(grade('zh-Hans', 'NP', '加德满')).not.toBe('correct');
    // Ett tegn unna er fortsatt et annet sted.
    expect(grade('ja', 'JP', '北京')).toBe('wrong');
  });

  it('godtar kana, ヴ/バ og skrivemåter med og uten langt vokaltegn', () => {
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

  it('godtar hovedsteder uten «by»-ledd på gresk, mongolsk, tatarisk og irsk', () => {
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

  it('godtar Jerusalem for Palestina på alle språk', () => {
    for (const lang of LANGUAGES) {
      const ps = countriesIn(lang).find(c => c.code === 'PS')!;
      const il = countriesIn(lang).find(c => c.code === 'IL')!;
      expect([lang.code, gradeAnswer(ps, il.capital).verdict]).toEqual([lang.code, 'correct']);
    }
  });

  it('skiller språk som deler overskrift ved hjelp av landnavnene', () => {
    const title = sheetTitle(es, 'EU', 3);
    const info = parseSheetTitle(title)!;
    expect(info.candidates).toEqual(expect.arrayContaining([es, fr]));
    // Regionnavnet i overskriften avgjør her (Europa vs Europe).
    expect(info.lang).toBe(es);
    const spanish = ['DE', 'FR', 'IT'].map(c => es.countries[c as 'DE'][0]);
    expect(pickSheetLanguage([title, ...spanish], info.candidates)).toBe(es);

    const zh = parseSheetTitle(sheetTitle(zhHans, 'AS', 2))!;
    expect(zh.candidates).toEqual(expect.arrayContaining([zhHans, ja]));
    const japanese = ['CN', 'KR'].map(c => ja.countries[c as 'CN'][0]);
    expect(pickSheetLanguage(japanese, zh.candidates)).toBe(ja);
  });

  it('leser språknøytralt sidenummer', () => {
    expect(sheetTitle(de, 'AF', 18, 2, 3)).toBe('Hauptstädte – Afrika (18) · 2/3');
    expect(parseSheetTitle('Hauptstädte – Afrika (18) · 2/3')).toMatchObject({part: 2, parts: 3, lang: de});
  });
});

describe('sikre marger og layoutversjoner', () => {
  const manta = {width: 1920, height: 2560};

  it('holder tabellen unna verktøylinja på sidene og toppen', () => {
    const L = computeLayout(manta, 20);
    expect(L.columnX[0]).toBeGreaterThanOrEqual(160);
    expect(manta.width - L.columnX[3]).toBeGreaterThanOrEqual(160);
    expect(L.title.top).toBeGreaterThanOrEqual(160);
    expect(L.score.bottom).toBeLessThanOrEqual(manta.height);
  });

  it('kjenner igjen ark laget med gammel og ny layout', () => {
    for (const v of [1, 3] as const) {
      const L = computeLayout(manta, 16, v);
      const lefts = L.rows.map(r => r.country.left);
      expect(guessLayoutVersion(manta, 16, lefts)).toBe(v);
    }
  });
});

describe('Nomad og andre små sider', () => {
  const manta = {width: 1920, height: 2560};
  const nomad = {width: 1404, height: 1872};

  it('gir Manta 20 rader og Nomad færre, men høye nok rader', () => {
    expect(maxRowsPerPage(manta)).toBe(20);
    const n = maxRowsPerPage(nomad);
    expect(n).toBeLessThan(20);
    expect(n).toBeGreaterThanOrEqual(12);
    const L = computeLayout(nomad, n);
    expect(L.rows[0].band.bottom - L.rows[0].band.top).toBeGreaterThanOrEqual(MIN_ROW_PX);
  });

  it('holder minst 150 px marg mot verktøylinja også på Nomad', () => {
    const L = computeLayout(nomad, maxRowsPerPage(nomad));
    expect(L.columnX[0]).toBeGreaterThanOrEqual(150);
    expect(nomad.width - L.columnX[3]).toBeGreaterThanOrEqual(150);
    expect(L.title.top).toBeGreaterThanOrEqual(150);
    expect(L.score.bottom).toBeLessThanOrEqual(nomad.height);
    expect(L.fontSize).toBeGreaterThanOrEqual(30);
  });

  it('endrer ikke Manta-layouten', () => {
    expect(computeLayout(manta, 20, 3)).toEqual(computeLayout(manta, 20, 2));
  });

  it('kjenner igjen Nomad-ark', () => {
    const n = maxRowsPerPage(nomad);
    const lefts = computeLayout(nomad, n).rows.map(r => r.country.left);
    expect(guessLayoutVersion(nomad, n, lefts)).toBe(3);
  });
});
