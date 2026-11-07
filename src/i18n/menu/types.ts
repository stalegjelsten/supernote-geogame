/**
 * Menytekster for språkene som ikke er skrevet for hånd (alle utenom nb og en).
 *
 * Hver tekst er en mal der `{navn}` byttes ut med en verdi. Nøkler som slutter
 * på `_one` brukes når tallet er 1 (entall); ellers brukes nøkkelen uten
 * `_one`. Plassholderne må være de samme som i menu/en.ts (det sjekkes i
 * __tests__/menuTexts.test.ts).
 *
 * Tekst som skrives på arket står ikke her: den leses tilbake ved retting og
 * må holdes stabil (se map.ts og hotseat.ts).
 */
export interface MenuStrings {
  /** Tusenskille i store tall: ',', '.' eller '\u00a0' (hardt mellomrom). */
  thousandsSep: string;
  /** Desimaltegn, '.' eller ','. */
  decimalSep: string;

  // Menyen (Language.ui)
  newSheet: string;
  region: string;
  count: string;
  all: string; // {n}
  spread: string; // {n} {pages}
  make: string;
  pageHasContent: string; // {n}
  makeOnNewPage: string;
  putOnThisPage: string;
  cancel: string;
  doneWriting: string;
  gradePage: string;
  gradeSet: string;
  showSheet: string;
  somethingWrong: string; // {message}
  language: string;
  automatic: string; // {label}
  allLanguages: string; // {n}
  fewerLanguages: string;
  checkingPage: string;
  startingGrading: string;
  made: string; // {n} {pages}
  result: string; // {points} {total} {percent}
  pageScore: string; // {part} {points} {total}
  gradedIn: string; // {seconds}

  // Fremdrift (Language.progress)
  newPages_one: string;
  newPages: string; // {n}
  drawing: string;
  drawingPage: string; // {k} {n}
  readingPage: string;
  pagePrefix: string; // {k} {n}
  findingInk: string;
  readingInk: string;
  rereadingRow: string; // {row}
  writingResults: string;

  // Feilmeldinger (Language.errors)
  noSheet: string;
  noCountries: string;
  openNote: string;
  failed: string; // {what}
  newPageTemplates: string; // {details}
  newPageNoTemplates: string;
  permission: string;

  // Kartmodus (map.ts: ui, progress, errors)
  mapMode: string;
  mapModeTable: string;
  mapModeMap: string;
  mapHint: string;
  mapShow: string;
  mapShowBoth: string;
  mapShowCapital: string;
  mapShowCountry: string;
  mapCount: string;
  mapTarget: string;
  mapTargetCapital: string;
  mapTargetCountry: string;
  mapMade: string; // {count}
  mapCountryMade: string; // {count}
  mapResult: string; // {points} {max} {percent}
  mapCountryResult: string; // {correct} {total} {percent}
  mapFindingMap: string;
  mapFindingMarks: string;
  mapFile: string; // {detail}
  mapNoEntries: string;

  // Flerspiller (hotseat.ts: ui)
  hsPlayers: string;
  hsSolo: string;
  hsHowToPlay: string;
  hsPass: string;
  hsShared: string;
  hsPassHint: string;
  hsSharedHint: string; // {unit} {each}
  hsUnitCountries: string;
  hsUnitCities: string;
  hsMade: string; // {players} {pages}
  hsWinner: string; // {k}
  /** «Spiller 2» inne i en setning, brukt i hsTie og hsMissingPages. */
  hsPlayer: string; // {k}
  /** Skilletegnet i en liste, f.eks. ', ' eller '、'. */
  hsListSep: string;
  /** Det som står mellom de to siste i en liste, med mellomrom, f.eks. ' og ' (eller 'と' uten). */
  hsAnd: string;
  hsTie: string; // {players}
  hsPlayerScore: string; // {k} {points} {max} {percent}
  hsMissingPages: string; // {players}

  // Nivå (level.ts)
  levelLabel: string;
  levelMixed: string;
  levelEasy: string;
  levelMedium: string;
  levelHard: string;
  levelHint: string;

  // Statistikk (stats.ts)
  statsSection: string;
  statsShow: string;
  statsHide: string;
  statsSkillCapital: string;
  statsSkillMapCapital: string;
  statsSkillMapCountry: string;
  statsLoading: string;
  statsNone: string;
  statsSheets: string; // {sheets} {sheetUnit} {answers} {percent}
  statsSheetUnit_one: string;
  statsSheetUnit: string;
  statsRegion: string; // {name} {known} {learning} {fresh}
  statsDue_one: string;
  statsDue: string; // {n}
  statsWeakest: string;
  statsWeakItem: string; // {country} {answer} {percent} {attempts} {timeUnit}
  statsTimeUnit_one: string;
  statsTimeUnit: string;
  statsReset: string;
  statsConfirmReset: string;
  statsConfirm: string;
  statsResetDone: string;
}
