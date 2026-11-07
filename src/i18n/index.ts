/**
 * The languages bundled into the plugin.
 *
 * Only the languages imported here end up in the bundle. Remove an import and
 * its line in LANGUAGES to build without a language (English must stay, since the
 * other languages borrow the menu texts from it).
 *
 * nb and en are written by hand. The others are the languages Supernote can
 * recognize handwriting in, and are generated with `node scripts/gen-languages.js`.
 */
import af from './af';
import az from './az';
import be from './be';
import bg from './bg';
import bs from './bs';
import ca from './ca';
import ceb from './ceb';
import cs from './cs';
import da from './da';
import de from './de';
import el from './el';
import en from './en';
import es from './es';
import et from './et';
import eu from './eu';
import fi from './fi';
import fil from './fil';
import fr from './fr';
import ga from './ga';
import gl from './gl';
import hr from './hr';
import hu from './hu';
import hy from './hy';
import id from './id';
import is from './is';
import it from './it';
import ja from './ja';
import ka from './ka';
import kk from './kk';
import ko from './ko';
import lt from './lt';
import lv from './lv';
import mg from './mg';
import mk from './mk';
import mn from './mn';
import ms from './ms';
import nb from './nb';
import nl from './nl';
import pl from './pl';
import pt from './pt';
import ro from './ro';
import ru from './ru';
import sk from './sk';
import sl from './sl';
import sq from './sq';
import srCyrl from './sr-Cyrl';
import srLatn from './sr-Latn';
import sv from './sv';
import sw from './sw';
import tr from './tr';
import tt from './tt';
import uk from './uk';
import vi from './vi';
import zhHans from './zh-Hans';
import zhHant from './zh-Hant';
import {normalize} from '../core/match';
import type {Language} from './types';

export type {Language} from './types';

/**
 * Included languages. The first is the fallback for unknown device languages,
 * and the order breaks ties when a sheet's language is recognized.
 * The menu uses MENU_LANGUAGES.
 */
export const LANGUAGES: readonly Language[] = [
  en, nb, da, sv, fi, is, de, fr, es, it, pt, nl,
  af, sq, hy, az, eu, be, bs, bg, ca, ceb, zhHans, zhHant, hr, cs, et, fil, gl, ka, el, hu,
  id, ga, ja, kk, ko, lv, lt, mk, mg, ms, mn, pl, ro, ru, srCyrl, srLatn, sk, sl, sw, tt,
  tr, uk, vi,
];

/**
 * The languages as the menu shows them: English first, then the rest sorted by
 * the language's own name. Accents are ignored (Čeština under C, Íslenska
 * under I); Latin names come before Greek, Cyrillic, Armenian, Georgian,
 * Chinese, Japanese and Korean.
 */
/** Extended Cyrillic letters sort as their base letter (Қазақ under К). */
function menuSortKey(label: string): string {
  return normalize(label).replace(/[қҚ]/g, 'к').replace(/[ңҢ]/g, 'н').replace(/[үҮұҰ]/g, 'у').replace(/[өӨ]/g, 'о');
}

export const MENU_LANGUAGES: readonly Language[] = [...LANGUAGES].sort((a, b) => {
  if (a.code === 'en' || b.code === 'en') {
    return a.code === 'en' ? (b.code === 'en' ? 0 : -1) : 1;
  }
  const keyA = menuSortKey(a.label);
  const keyB = menuSortKey(b.label);
  return keyA < keyB ? -1 : keyA > keyB ? 1 : a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
});

/** English is used as an extra answer key if it is included. */
export const ENGLISH: Language | undefined = LANGUAGES.find(l => l.code === 'en');

export function getLanguage(code: string | null | undefined): Language | undefined {
  return LANGUAGES.find(l => l.code === code);
}

/**
 * Finds the language that best matches a device language code, e.g. 'nb_NO',
 * 'nb-NO', 'no', 'en_US', 'zh_TW', 'zh-Hant-TW' or Android's 'sr_RS_#Latn'.
 * Script and region are tried before the language itself, so zh_TW gives Traditional Chinese.
 */
export function resolveLocale(locale: string | null | undefined): Language {
  const tokens = (locale ?? '').trim().toLowerCase().replace(/#/g, '').split(/[-_]+/).filter(Boolean);
  const [primary, ...rest] = tokens;
  if (!primary) {
    return LANGUAGES[0];
  }
  for (const key of [...rest.map(t => `${primary}_${t}`), primary]) {
    const found = LANGUAGES.find(l => l.locales.includes(key));
    if (found) {
      return found;
    }
  }
  return LANGUAGES[0];
}

/** Extracts a language code from the event, whether it is a string or an object. */
export function localeFromEvent(msg: unknown): string | undefined {
  if (typeof msg === 'string') {
    return msg;
  }
  if (msg && typeof msg === 'object') {
    const o = msg as Record<string, unknown>;
    for (const key of ['lang', 'language', 'locale', 'data']) {
      const found = localeFromEvent(o[key]);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

/** 'auto' follows the device language; otherwise a language code chosen in the menu. */
export type LanguageChoice = 'auto' | string;

let deviceLocale: string | undefined;
let choice: LanguageChoice = 'auto';
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(l => l());
}

export function setDeviceLocale(locale: string | null | undefined) {
  if (locale && locale !== deviceLocale) {
    deviceLocale = locale;
    notify();
  }
}

export function deviceLanguage(): Language {
  return resolveLocale(deviceLocale);
}

export function setLanguageChoice(next: LanguageChoice) {
  const valid = next === 'auto' || getLanguage(next) ? next : 'auto';
  if (valid !== choice) {
    choice = valid;
    notify();
  }
}

export function languageChoice(): LanguageChoice {
  return choice;
}

/** The language used in the menu, in error messages and on new sheets. */
export function currentLanguage(): Language {
  return (choice !== 'auto' && getLanguage(choice)) || deviceLanguage();
}

export function onLanguageChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
