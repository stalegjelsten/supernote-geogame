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
    return (await PluginManager.getPluginDirPath()) ?? null;
  } catch {
    return null;
  }
}

async function loadChoice(): Promise<void> {
  const dir = await pluginDir();
  if (!dir) {
    return;
  }
  for (const l of LANGUAGES) {
    try {
      if (await FileUtils.exists(`${dir}/${markerName(l.code)}`)) {
        setLanguageChoice(l.code);
        return;
      }
    } catch {
      return;
    }
  }
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
  loadChoice().finally(() => {
    let last = languageChoice();
    onLanguageChange(() => {
      if (languageChoice() !== last) {
        last = languageChoice();
        saveChoice();
      }
    });
  });
}
