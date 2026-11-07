import {getLanguage} from '../src/i18n';
import {countryIn} from '../src/core/countries';
import {gradeAnswer} from '../src/core/sheet';
import {textWidthEm} from '../src/core/layout';
import type {CountryCode} from '../src/data/countries';

const grade = (lang: string, code: CountryCode, answer: string) =>
  gradeAnswer(countryIn(getLanguage(lang)!, code), answer).verdict;

describe('latinske tegn som ser like ut som kyrilliske og greske', () => {
  test('identiske tegn gjøres om', () => {
    expect(grade('ru', 'RU', 'MOCKBA')).toBe('correct');
    expect(grade('ru', 'UA', 'KИEB')).toBe('correct');
    expect(grade('el', 'GR', 'AΘHNA')).toBe('correct');
  });

  test('N for И er en skrivefeil, ikke en feillesing', () => {
    expect(grade('ru', 'UA', 'KNEB')).toBe('close');
  });

  test('latinsk svar på kyrillisk ark virker som før', () => {
    expect(grade('ru', 'RU', 'Moskva')).toBe('correct');
    expect(grade('ru', 'FR', 'Paris')).toBe('correct');
    expect(grade('ru', 'NO', 'Stockholm')).toBe('wrong');
  });
});

test('kyrillisk tekst regnes som bredere enn latinsk', () => {
  expect(textWidthEm('Бухарест')).toBeGreaterThan(textWidthEm('Bukarest'));
  expect(textWidthEm('Oslo')).toBeCloseTo(4 * 0.55);
});
