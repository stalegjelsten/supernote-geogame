/** The saved language choice (folders lang-<code> in the plugin folder) against a fake SDK. */
const mockDirs = new Set<string>(['/plugin/lang-sv']);
const mockGate: {open?: () => void} = {};

jest.mock('react-native', () => ({I18nManager: {getConstants: () => ({localeIdentifier: 'en_US'})}}));
jest.mock('sn-plugin-lib', () => ({
  PluginManager: {
    getPluginDirPath: async () => '/plugin',
    registerLangListener: () => {},
  },
  FileUtils: {
    // The first check waits until the test opens the gate, as if the device were slow.
    exists: async (p: string) => {
      if (mockGate.open === undefined) {
        await new Promise<void>(resolve => (mockGate.open = resolve));
      }
      return mockDirs.has(p);
    },
    makeDir: async (p: string) => {
      mockDirs.add(p);
      return true;
    },
    deleteDir: async (p: string) => {
      mockDirs.delete(p);
      return true;
    },
  },
}));

import {startLanguageTracking} from '../src/i18n/device';
import {languageChoice, setLanguageChoice} from '../src/i18n';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test('a language chosen while the saved one is being loaded wins and is saved', async () => {
  startLanguageTracking();
  await flush();
  setLanguageChoice('de');
  mockGate.open!();
  for (let i = 0; i < 200 && !mockDirs.has('/plugin/lang-de'); i++) {
    await flush();
  }
  expect(languageChoice()).toBe('de');
  expect(mockDirs.has('/plugin/lang-de')).toBe(true);
  expect(mockDirs.has('/plugin/lang-sv')).toBe(false);
});
