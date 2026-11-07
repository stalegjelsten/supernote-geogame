import {LANGUAGES, MENU_LANGUAGES} from '../src/i18n';

test('menyen viser engelsk først og resten etter navn', () => {
  expect(MENU_LANGUAGES).toHaveLength(LANGUAGES.length);
  expect(MENU_LANGUAGES[0].code).toBe('en');
  const labels = MENU_LANGUAGES.map(l => l.label);
  // Noen stikkprøver på rekkefølgen.
  const at = (label: string) => labels.indexOf(label);
  expect(at('Afrikaans')).toBe(1);
  expect(at('Čeština')).toBeLessThan(at('Dansk'));
  expect(at('Íslenska')).toBeLessThan(at('Italiano'));
  expect(at('Norsk')).toBeLessThan(at('Polski'));
  expect(at('Tiếng Việt')).toBeLessThan(at('Ελληνικά'));
  expect(at('Ελληνικά')).toBeLessThan(at('Русский'));
  expect(at('Қазақ тілі')).toBeLessThan(at('Македонски'));
  // Reservespråket er uendret.
  expect(LANGUAGES[0].code).toBe('en');
});
