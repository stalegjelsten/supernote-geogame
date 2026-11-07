import {getLanguage} from '../src/i18n';
import {countryIn} from '../src/core/countries';
import {gradeAnswer} from '../src/core/sheet';
import {textWidthEm} from '../src/core/layout';
import type {CountryCode} from '../src/data/countries';

const grade = (lang: string, code: CountryCode, answer: string) =>
  gradeAnswer(countryIn(getLanguage(lang)!, code), answer).verdict;

describe('Latin characters that look like Cyrillic and Greek ones', () => {
  test('identical characters are converted', () => {
    expect(grade('ru', 'RU', 'MOCKBA')).toBe('correct');
    expect(grade('ru', 'UA', 'KИEB')).toBe('correct');
    expect(grade('el', 'GR', 'AΘHNA')).toBe('correct');
  });

  test('N for И is a typo, not a misreading', () => {
    expect(grade('ru', 'UA', 'KNEB')).toBe('close');
  });

  test('Latin answer on a Cyrillic sheet works as before', () => {
    expect(grade('ru', 'RU', 'Moskva')).toBe('correct');
    expect(grade('ru', 'FR', 'Paris')).toBe('correct');
    expect(grade('ru', 'NO', 'Stockholm')).toBe('wrong');
  });
});

test('Cyrillic text is counted as wider than Latin', () => {
  expect(textWidthEm('Бухарест')).toBeGreaterThan(textWidthEm('Bukarest'));
  expect(textWidthEm('Oslo')).toBeCloseTo(4 * 0.55);
});
