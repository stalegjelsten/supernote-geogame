import {COUNTRY_CODES, CONTINENT_OF} from '../src/data/countries';
import {computeLayout, maxRowsPerPage} from '../src/core/layout';
import {isNotesText, noteMarker, planNotes} from '../src/core/notes';
import {gradeAnswer, isResultText} from '../src/core/sheet';
import {countryIn} from '../src/core/countries';
import type {CountryCode} from '../src/data/countries';
import {getLanguage} from '../src/i18n';
import {ALL_CAPITAL_NOTES, capitalNotes} from '../src/i18n/notes';

describe('merknader om hovedsteder', () => {
  const nb = ALL_CAPITAL_NOTES.nb;
  const en = ALL_CAPITAL_NOTES.en;

  test('norsk og engelsk har merknader for de samme landene', () => {
    expect(Object.keys(nb).sort()).toEqual(Object.keys(en).sort());
  });

  test('alle landkodene finnes, og merknadene er korte', () => {
    for (const notes of Object.values(ALL_CAPITAL_NOTES)) {
      for (const [code, text] of Object.entries(notes)) {
        expect(COUNTRY_CODES).toContain(code);
        expect(text!.length).toBeLessThanOrEqual(70);
        expect(isNotesText(text!)).toBe(false);
      }
    }
  });

  test('Tanzania nevner Dar es Salaam', () => {
    expect(nb.TZ).toContain('Dar es Salaam');
    expect(en.TZ).toContain('Dar es Salaam');
  });

  test('språk uten egne merknader får engelsk', () => {
    expect(capitalNotes(getLanguage('de')!)).toBe(en);
    expect(capitalNotes(getLanguage('nb')!)).toBe(nb);
  });
});

describe('fotnoter', () => {
  test('hevede tall', () => {
    expect(noteMarker(1)).toBe('¹');
    expect(noteMarker(12)).toBe('¹²');
    expect(isNotesText('¹ Dar es Salaam …')).toBe(true);
    expect(isNotesText('Dodoma')).toBe(false);
  });

  test('fotnoteteksten forveksles ikke med poengsummen', () => {
    expect(isResultText('¹ Lagos was capital until 1991')).toBe(false);
  });

  const area = {left: 0, top: 0, right: 1000, bottom: 200};

  test('nummererer i rekkefølgen på arket', () => {
    const plan = planNotes(
      [
        {row: 5, text: 'B', important: false},
        {row: 2, text: 'A', important: true},
      ],
      area,
      30,
      20,
    )!;
    expect(plan.text).toBe('¹ A\n² B');
    expect(plan.markers.get(2)).toBe('¹');
    expect(plan.markers.get(5)).toBe('²');
    expect(plan.rect.bottom).toBeLessThanOrEqual(area.bottom);
  });

  test('dropper merknader for riktige svar først når plassen er for liten', () => {
    const items = Array.from({length: 8}, (_, i) => ({row: i, text: `Note ${i}`, important: i === 7}));
    const plan = planNotes(items, {left: 0, top: 0, right: 1000, bottom: 60}, 30, 20)!;
    expect(plan.markers.has(7)).toBe(true);
    expect(plan.markers.size).toBeLessThan(8);
    expect(plan.fontSize).toBeGreaterThanOrEqual(20);
  });

  test('ingen plass gir ingen fotnoter', () => {
    expect(planNotes([{row: 0, text: 'A', important: true}], {left: 0, top: 0, right: 0, bottom: 0}, 30, 20)).toBeNull();
  });

  test('en full side med afrikanske land på Manta får plass til flere merknader', () => {
    const size = {width: 1920, height: 2560};
    const n = maxRowsPerPage(size);
    const L = computeLayout(size, n);
    const african = COUNTRY_CODES.filter(c => CONTINENT_OF[c] === 'AF' && ALL_CAPITAL_NOTES.en[c]).slice(0, n);
    const items = african.map((c, row) => ({row, text: ALL_CAPITAL_NOTES.en[c]!, important: true}));
    const fullArea = {left: L.score.left, top: L.score.top, right: L.score.right - 450, bottom: Math.round(size.height * 0.985)};
    const plan = planNotes(items, fullArea, L.smallFontSize, 20)!;
    expect(plan.markers.size).toBeGreaterThanOrEqual(3);
  });
});

describe('de facto-hovedsteder godtas, avskaffede hovedsteder ikke', () => {
  const en = getLanguage('en')!;
  const nbLang = getLanguage('nb')!;
  const de = getLanguage('de')!;

  test.each([
    ['TZ', 'Dar es Salaam'],
    ['IL', 'Tel Aviv'],
    ['NG', 'Lagos'],
    ['KZ', 'Almaty'],
    ['MM', 'Yangon'],
    ['BR', 'Rio de Janeiro'],
  ])('%s: %s er feil', (code, answer) => {
    for (const lang of [en, nbLang, de]) {
      expect(gradeAnswer(countryIn(lang, code as CountryCode), answer).verdict).toBe('wrong');
    }
  });

  test.each([
    ['ZA', 'Cape Town'],
    ['ZA', 'Bloemfontein'],
    ['BO', 'La Paz'],
    ['SZ', 'Lobamba'],
    ['CI', 'Abidjan'],
    ['BJ', 'Cotonou'],
    ['BI', 'Bujumbura'],
    ['MY', 'Putrajaya'],
    ['LK', 'Colombo'],
    ['PS', 'Ramallah'],
    ['NL', 'The Hague'],
    ['TZ', 'Dodoma'],
  ])('%s: %s er riktig', (code, answer) => {
    for (const lang of [en, nbLang, de]) {
      expect(gradeAnswer(countryIn(lang, code as CountryCode), answer).verdict).toBe('correct');
    }
  });

  test('på tysk godtas Kapstadt og Den Haag', () => {
    expect(gradeAnswer(countryIn(de, 'ZA'), 'Kapstadt').verdict).toBe('correct');
    expect(gradeAnswer(countryIn(de, 'NL'), 'Den Haag').verdict).toBe('correct');
  });
});
