import {LANGUAGES} from '../src/i18n';
import {hotSeatTexts} from '../src/i18n/hotseat';
import {levelTexts} from '../src/i18n/level';
import {mapTexts} from '../src/i18n/map';
import enMenu from '../src/i18n/menu/en';
import {statsTexts} from '../src/i18n/stats';

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
const generated = LANGUAGES.filter(l => l.code !== 'en' && l.code !== 'nb');

test('all generated languages have translated menu texts', () => {
  for (const lang of generated) {
    expect([lang.code, Boolean(lang.menu)]).toEqual([lang.code, true]);
  }
});

test('menu texts have the same keys and placeholders as English', () => {
  const keys = Object.keys(enMenu).sort();
  for (const lang of generated) {
    const m = lang.menu as unknown as Record<string, string>;
    expect([lang.code, Object.keys(m).sort()]).toEqual([lang.code, keys]);
    for (const key of keys) {
      expect([lang.code, key, placeholders(m[key])]).toEqual([
        lang.code,
        key,
        placeholders((enMenu as unknown as Record<string, string>)[key]),
      ]);
      const text = key === 'thousandsSep' ? m[key] : m[key].trim();
      expect([lang.code, key, text.length > 0]).toEqual([lang.code, key, true]);
    }
  }
});

test('finished menu texts have no placeholders left', () => {
  for (const lang of generated) {
    const m = mapTexts(lang);
    const hs = hotSeatTexts(lang);
    const st = statsTexts(lang);
    const texts = [
      lang.ui.all(20),
      lang.ui.spread(150, 3),
      lang.ui.result(12, 20, 60),
      lang.ui.pageScore(2, 12, 20),
      lang.ui.gradedIn('3.5'),
      lang.ui.automatic('Deutsch'),
      lang.progress.newPages(1),
      lang.progress.newPages(3),
      lang.progress.drawingPage(1, 3),
      lang.errors.failed('insertElements'),
      m.ui.result(12345, 50000, 25),
      m.ui.countryResult(5, 10, 50),
      m.errors.mapFile('x'),
      hs.ui.sharedHint(5, hs.ui.unitCountries),
      hs.ui.tie([1, 2, 3]),
      hs.ui.missingPages([2]),
      hs.ui.playerScore(1, '12', '20', 60),
      hs.ui.made(2, 4),
      levelTexts(lang).hint,
      st.sheets(1, 20, 75),
      st.sheets(4, 80, 75),
      st.due(1),
      st.due(7),
      st.weakItem('A', 'B', 30, 1),
      st.weakItem('A', 'B', 30, 4),
      st.region('X', 1, 2, 3),
    ];
    for (const t of texts) {
      expect([lang.code, t]).toEqual([lang.code, expect.not.stringMatching(/\{\w+\}/)]);
    }
    expect(lang.ui.title).toBe('World Capitals Quiz');
    expect(m.ui.result(12345, 50000, 25)).toContain(`12${lang.menu!.thousandsSep}345`);
  }
});

test('sheet text stays English for multiplayer and map, so it is recognized', () => {
  const de = LANGUAGES.find(l => l.code === 'de')!;
  const en = LANGUAGES.find(l => l.code === 'en')!;
  expect(hotSeatTexts(de).passTag(1, 2)).toBe(hotSeatTexts(en).passTag(1, 2));
  expect(mapTexts(de).totalPrefix).toBe(mapTexts(en).totalPrefix);
  expect(mapTexts(de).titlePrefix).toBe('Hauptstädte · map');
});
