/**
 * Menu texts for the languages that are not written by hand (all except nb and en).
 *
 * Each text is a template where `{name}` is replaced with a value. Keys ending
 * in `_one` are used when the number is 1 (singular); otherwise the key without
 * `_one` is used. The placeholders must match those in menu/en.ts (checked in
 * __tests__/menuTexts.test.ts).
 *
 * Text written on the sheet is not here: it is read back when grading and must
 * stay stable (see map.ts and hotseat.ts).
 */
export interface MenuStrings {
  /** Thousands separator in large numbers: ',', '.' or '\u00a0' (no-break space). */
  thousandsSep: string;
  /** Decimal separator, '.' or ','. */
  decimalSep: string;

  // Menu (Language.ui)
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
  checkAnswers: string;
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

  // Progress (Language.progress)
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

  // Error messages (Language.errors)
  noSheet: string;
  noCountries: string;
  openNote: string;
  failed: string; // {what}
  newPageTemplates: string; // {details}
  newPageNoTemplates: string;
  permission: string;

  // Map mode (map.ts: ui, progress, errors)
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

  // Multiplayer (hotseat.ts: ui)
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
  /** "player 2" inside a sentence, used in hsTie and hsMissingPages. */
  hsPlayer: string; // {k}
  /** The separator in a list, e.g. ', ' or '、'. */
  hsListSep: string;
  /** What goes between the last two items in a list, with spaces, e.g. ' and ' (or 'と' without). */
  hsAnd: string;
  hsTie: string; // {players}
  hsPlayerScore: string; // {k} {points} {max} {percent}
  hsMissingPages: string; // {players}

  // Level (level.ts)
  levelLabel: string;
  levelMixed: string;
  levelEasy: string;
  levelMedium: string;
  levelHard: string;
  levelHint: string;

  // Training (training.ts)
  trainingLabel: string;
  trainingRandom: string;
  trainingSmart: string;
  trainingWeak: string;
  trainingDue: string;
  trainingNew: string;
  trainingRandomHint: string;
  trainingSmartHint: string;
  trainingWeakHint: string;
  trainingDueHint: string;
  trainingNewHint: string;

  // Statistics (stats.ts)
  statsSection: string;
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
  statsRecent: string;
  statsSkillOutline: string;

  // Outline mode (outline.ts). Outline sheets are recognized by the key at the bottom,
  // not by the title, so the title and instructions on the sheet can be translated here.
  outlineMode: string;
  outlineHint: string;
  outlineTitle: string;
  outlineSubtitle: string;
  outlineSize: string;
  outlineSizeLarge: string;
  outlineSizeMedium: string;
  outlineSizeSmall: string;
  outlineScale: string;
  outlineScaleFit: string;
  outlineScaleBar: string;
  outlineScaleSame: string;
  outlineScaleHint: string;
  outlineRotation: string;
  outlineRotationNone: string;
  outlineRotationSome: string;
  outlineRotationAny: string;
  outlineMade: string; // {count}
  outlineResult: string; // {correct} {total} {percent}

  // Sources (sources.ts), in the language tab. Dataset and license names stay in English.
  sourcesTitle: string;
  sourcesIntro: string;
  sourcesNames: string;
  sourcesCapitals: string;
  sourcesMaps: string;
  sourcesSmall: string;
  sourcesChanged: string; // {url}
}
