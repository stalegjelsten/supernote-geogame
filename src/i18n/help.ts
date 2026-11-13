/**
 * The "How to use" section in the settings tab, and the name of that tab. Norwegian is written
 * by hand; the other languages get the texts from menu/<code>.ts (English from menu/en.ts).
 */
import {fmt} from './menu/build';
import EN_MENU from './menu/en';
import type {MenuStrings} from './menu/types';
import {SOURCES_URL} from './sources';
import type {Language} from './types';

export interface HelpTexts {
  /** Name of the tab with the language, the instructions and the sources. */
  tab: string;
  title: string;
  /** The paragraphs, in order. */
  paragraphs: string[];
}

type HelpKey =
  | 'settingsTab'
  | 'helpTitle'
  | 'helpMake'
  | 'helpTable'
  | 'helpMap'
  | 'helpOutline'
  | 'helpLabel'
  | 'helpGrade'
  | 'helpBlank'
  | 'helpStats'
  | 'helpPlayers'
  | 'helpRecognition'
  | 'helpNotebook'
  | 'helpMore';

const nb: Record<HelpKey, string> = {
  settingsTab: 'Innstillinger',
  helpTitle: 'Slik bruker du pluginen',
  helpMake:
    'Åpne en notatbok, velg spill, verdensdel og antall i fanen Nytt arbeidsark, og trykk Lag arket. Arket havner på siden du er på hvis den er tom, ellers på en ny side etter den.',
  helpTable: 'Tabell: skriv hovedstaden til hvert land i midtkolonnen.',
  helpMap: 'Kart: marker hver by eller hvert land i lista med et kryss på kartet. Vil du hoppe over en, tegner du en strek i ruta foran den.',
  helpOutline: 'Omriss: skriv navnet på landet på linja under hvert omriss.',
  helpLabel: 'Navn på kart: skriv navnet på hvert nummererte land på linja med samme nummer.',
  helpGrade:
    'Når du er ferdig, åpner du menyen igjen og trykker Rett denne siden, eller Rett hele settet for et ark over flere sider. Du kan rette svarene og rette arket på nytt; det nye resultatet erstatter det gamle.',
  helpBlank:
    'Du trenger ikke svare på alt: tomme ruter telles ikke. Vet du ikke svaret, setter du en strek i ruta, så kommer landet igjen på senere ark.',
  helpStats:
    'Hvert rettet ark for én spiller lagres i fanen Statistikk. Med Trening satt til Smart får nye ark igjen landene du sliter med og de som skal repeteres. Slå på gjestemodus når noen andre låner enheten.',
  helpPlayers:
    '2–4 spillere kan dele én enhet. Send rundt: hver spiller får egne sider med de samme landene. Bytt på: ett felles ark, der hver spiller har sine egne land.',
  helpRecognition:
    'Svarene leses av håndskriftgjenkjenningen på enheten. Velg samme språk her som gjenkjenningsspråket i innstillingene på enheten, ellers blir svarene feillest.',
  helpNotebook: 'Tips: ha en egen notatbok med blank mal til quizen, så resten av notatene dine får være i fred.',
  helpMore: 'Mer om spillene, statistikken og dataene: {url}',
};

export function helpTexts(lang: Language): HelpTexts {
  const m: Record<HelpKey, string> = lang.code === 'nb' ? nb : (lang.menu ?? EN_MENU as MenuStrings);
  return {
    tab: m.settingsTab,
    title: m.helpTitle,
    paragraphs: [
      m.helpMake,
      m.helpTable,
      m.helpMap,
      m.helpOutline,
      m.helpLabel,
      m.helpGrade,
      m.helpBlank,
      m.helpStats,
      m.helpPlayers,
      m.helpRecognition,
      m.helpNotebook,
      fmt(m.helpMore, {url: SOURCES_URL}),
    ],
  };
}
