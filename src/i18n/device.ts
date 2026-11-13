/**
 * Connects the language choice to the device.
 *
 * sn-plugin-lib has no function that returns the language directly: `registerLangListener`
 * only reports when the system language changes (the event `plugin_event_lang`, which the
 * Java code appears to send as a plain string, e.g. "en"). The initial value is therefore
 * taken from React Native (I18nManager / Intl), and the listener updates it.
 *
 * The language chosen in the menu is stored as an empty folder `lang-<code>` in the plugin
 * folder, since the SDK cannot write regular files. If that fails, the choice is only
 * remembered while the plugin is running.
 */
import {I18nManager} from 'react-native';
import {FileUtils, PluginManager} from 'sn-plugin-lib';
import {pluginDirPath} from '../sdk/pluginDir';
import {
  LANGUAGES,
  languageChoice,
  localeFromEvent,
  onLanguageChange,
  setDeviceLocale,
  setLanguageChoice,
} from './index';

function initialLocale(): string | undefined {
  try {
    const id = I18nManager.getConstants?.().localeIdentifier;
    if (id) {
      return id;
    }
  } catch {
    // Not available; try Intl.
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

const markerName = (code: string) => `lang-${code}`;

async function pluginDir(): Promise<string | null> {
  try {
    return (await pluginDirPath()) ?? null;
  } catch {
    return null;
  }
}

/** The language saved last time, or null. */
async function loadChoice(): Promise<string | null> {
  const dir = await pluginDir();
  if (!dir) {
    return null;
  }
  for (const l of LANGUAGES) {
    try {
      if (await FileUtils.exists(`${dir}/${markerName(l.code)}`)) {
        return l.code;
      }
    } catch {
      return null;
    }
  }
  return null;
}

async function saveChoice(): Promise<void> {
  const dir = await pluginDir();
  if (!dir) {
    return;
  }
  const chosen = languageChoice();
  for (const l of LANGUAGES) {
    const path = `${dir}/${markerName(l.code)}`;
    try {
      if (l.code === chosen) {
        await FileUtils.makeDir(path);
      } else if (await FileUtils.exists(path)) {
        await FileUtils.deleteDir(path);
      }
    } catch {
      // Saving is only a convenience.
    }
  }
}

let started = false;

/** Called once at startup (index.js). */
export function startLanguageTracking(): void {
  if (started) {
    return;
  }
  started = true;
  setDeviceLocale(initialLocale());
  try {
    PluginManager.registerLangListener({onMsg: msg => setDeviceLocale(localeFromEvent(msg))});
  } catch {
    // Older SDK without a language listener.
  }
  // Listen from the start: a language chosen in the menu while the saved one is still being
  // looked for (dozens of file checks) must win and be saved, not be overwritten.
  let loading = true;
  let chosenWhileLoading = false;
  let last = languageChoice();
  onLanguageChange(() => {
    if (languageChoice() === last) {
      return;
    }
    last = languageChoice();
    if (loading) {
      chosenWhileLoading = true;
    } else {
      saveChoice();
    }
  });
  loadChoice()
    .catch(() => null)
    .then(saved => {
      if (chosenWhileLoading) {
        saveChoice();
      } else if (saved) {
        last = saved;
        setLanguageChoice(saved);
      }
    })
    .finally(() => {
      loading = false;
    });
}
