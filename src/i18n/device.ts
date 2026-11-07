/**
 * Kobler språkvalget til enheten.
 *
 * sn-plugin-lib har ingen funksjon som gir språket direkte: `registerLangListener`
 * melder bare fra når systemspråket endres (hendelsen `plugin_event_lang`, som i
 * Java-koden ser ut til å sendes som en ren streng, f.eks. "en"). Startverdien
 * hentes derfor fra React Native (I18nManager / Intl), og lytteren oppdaterer den.
 *
 * Språkvalget i menyen lagres som en tom mappe `lang-<kode>` i pluginmappen,
 * siden SDK-en ikke kan skrive vanlige filer. Går det ikke, huskes valget bare
 * så lenge pluginen kjører.
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
    // Ikke tilgjengelig; prøv Intl.
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
      // Lagring er bare en bekvemmelighet.
    }
  }
}

let started = false;

/** Kalles én gang ved oppstart (index.js). */
export function startLanguageTracking(): void {
  if (started) {
    return;
  }
  started = true;
  setDeviceLocale(initialLocale());
  try {
    PluginManager.registerLangListener({onMsg: msg => setDeviceLocale(localeFromEvent(msg))});
  } catch {
    // Eldre SDK uten språklytter.
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
