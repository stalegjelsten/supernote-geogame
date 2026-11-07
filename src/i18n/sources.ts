/**
 * The "Sources" section in the language tab: the open data the plugin uses, with the credits
 * their licenses require. Norwegian is written by hand; the other languages get the labels from
 * menu/<code>.ts. Dataset and license names are the same in every language.
 */
import {fmt} from './menu/build';
import EN_MENU from './menu/en';
import type {MenuStrings} from './menu/types';
import type {Language} from './types';

export const SOURCES_URL = 'github.com/stalegjelsten/supernote-geogame';

export interface SourcesTexts {
  title: string;
  intro: string;
  /** Label and credit per line. */
  lines: Array<[label: string, credit: string]>;
  changed: string;
}

interface Labels {
  title: string;
  intro: string;
  names: string;
  capitals: string;
  maps: string;
  small: string;
  changed: string;
}

const nb: Labels = {
  title: 'Kilder',
  intro: 'Pluginen bruker åpne data. Alt følger med pluginen, og ingenting sendes noe sted.',
  names: 'Landnavn',
  capitals: 'Hovedsteder og koordinater',
  maps: 'Kart og landomriss',
  small: 'Omriss av små land',
  changed: 'Kartene og omrissene er projisert på nytt og forenklet. Lisenstekster og detaljer: {url}',
};

const fromMenu = (m: MenuStrings): Labels => ({
  title: m.sourcesTitle,
  intro: m.sourcesIntro,
  names: m.sourcesNames,
  capitals: m.sourcesCapitals,
  maps: m.sourcesMaps,
  small: m.sourcesSmall,
  changed: m.sourcesChanged,
});

export function sourcesTexts(lang: Language): SourcesTexts {
  const l = lang.code === 'nb' ? nb : fromMenu(lang.menu ?? EN_MENU);
  return {
    title: l.title,
    intro: l.intro,
    lines: [
      [l.names, 'Unicode CLDR (Unicode License v3)'],
      [l.capitals, 'Wikidata (CC0)'],
      [l.maps, 'Natural Earth (public domain)'],
      [
        l.small,
        'geoBoundaries: © OpenStreetMap contributors (ODbL 1.0); Wikimedia Commons (CC BY 2.5 and public domain); ' +
          'OCHA ROP (CC BY 3.0 IGO); Sentinel-2 Land Use/Land Cover (CC BY 4.0)',
      ],
    ],
    changed: fmt(l.changed, {url: SOURCES_URL}),
  };
}
