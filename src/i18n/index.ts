/**
 * Språkene som bygges inn i pluginen.
 *
 * Bare språkene som er importert her havner i bundelen. Fjern en import og
 * linja i LANGUAGES for å bygge uten et språk (engelsk må være med, siden de
 * andre språkene låner menytekstene derfra).
 *
 * nb og en er skrevet for hånd. De andre er språkene Supernote kan gjenkjenne
 * håndskrift på, og lages med `node scripts/gen-languages.js`.
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
import type {Language} from './types';

export type {Language} from './types';

/**
 * Inkluderte språk, i den rekkefølgen de vises i menyen.
 * Det første er reservespråket for ukjente språk på enheten.
 */
export const LANGUAGES: readonly Language[] = [
  en, nb, da, sv, fi, is, de, fr, es, it, pt, nl,
  af, sq, hy, az, eu, be, bs, bg, ca, ceb, zhHans, zhHant, hr, cs, et, fil, gl, ka, el, hu,
  id, ga, ja, kk, ko, lv, lt, mk, mg, ms, mn, pl, ro, ru, srCyrl, srLatn, sk, sl, sw, tt,
  tr, uk, vi,
];

/** Engelsk brukes som ekstra fasit hvis det er inkludert. */
export const ENGLISH: Language | undefined = LANGUAGES.find(l => l.code === 'en');

export function getLanguage(code: string | null | undefined): Language | undefined {
  return LANGUAGES.find(l => l.code === code);
}

/**
 * Finner språket som passer best til en språkkode fra enheten, f.eks. 'nb_NO',
 * 'nb-NO', 'no', 'en_US', 'zh_TW', 'zh-Hant-TW' eller Androids 'sr_RS_#Latn'.
 * Skrift og region prøves før selve språket, så zh_TW gir tradisjonell kinesisk.
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

/** Trekker ut en språkkode fra hendelsen, uansett om den er en streng eller et objekt. */
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

/** 'auto' følger enhetens språk; ellers en språkkode valgt i menyen. */
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

/** Språket som brukes i menyen, i feilmeldinger og på nye ark. */
export function currentLanguage(): Language {
  return (choice !== 'auto' && getLanguage(choice)) || deviceLanguage();
}

export function onLanguageChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
