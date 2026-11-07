import countries from './countries/nb';
import type {Language} from './types';

const nb: Language = {
  code: 'nb',
  label: 'Norsk',
  locales: ['nb', 'no', 'nn'],

  countries,
  continents: {
    EU: 'Europa',
    AS: 'Asia',
    AF: 'Afrika',
    NA: 'Nord- og Mellom-Amerika',
    SA: 'Sør-Amerika',
    OC: 'Oseania',
  },
  world: 'Hele verden',

  sheet: {
    titlePrefix: 'Hovedsteder',
    partSuffix: (part, parts) => ` · side ${part} av ${parts}`,
    partPattern: /side (\d+) av (\d+)\s*$/,
    subtitle: 'Skriv hovedstaden i midtkolonnen. Rett arket fra World Capitals Quiz-menyen når du er ferdig.',
    colCountry: 'Land',
    colAnswer: 'Hovedstad',
    colResult: 'Resultat',
    scorePrefix: 'Poeng:',
    score: (points, total) => `Poeng: ${points} av ${total}`,
    read: text => `(leste «${text}»)`,
    legacyResultPrefixes: ['Riktig', 'Nesten', 'Fasit:'],
  },

  ui: {
    title: 'World Capitals Quiz',
    newSheet: 'Nytt arbeidsark',
    region: 'Verdensdel',
    count: 'Antall land',
    all: n => `Alle (${n})`,
    spread: (n, pages) => `${n} land fordelt på ${pages} sider.`,
    make: 'Lag arket',
    pageHasContent: n => `Denne siden har allerede innhold (${n} elementer).`,
    makeOnNewPage: 'Lag på ny side',
    putOnThisPage: 'Legg oppå denne siden',
    cancel: 'Avbryt',
    checkAnswers: 'Rett svarene',
    gradePage: 'Rett denne siden',
    gradeSet: 'Rett hele settet',
    showSheet: 'Vis arket',
    somethingWrong: m => `Noe gikk galt: ${m}`,
    language: 'Språk',
    automatic: label => `Automatisk (${label})`,
    allLanguages: n => `Alle språk (${n}) …`,
    fewerLanguages: 'Færre språk',
    checkingPage: 'Sjekker siden …',
    startingGrading: 'Starter retting …',
    made: (n, pages) => `Laget ark med ${n} land på ${pages} sider.`,
    result: (points, total, percent) => `Du fikk ${points} av ${total} riktige (${percent} %).`,
    pageScore: (part, points, total) => `Side ${part}: ${points} av ${total}`,
    gradedIn: seconds => `Rettet på ${seconds.replace('.', ',')} s.`,
  },

  progress: {
    newPages: n => (n === 1 ? 'Lager ny side …' : `Lager ${n} nye sider …`),
    drawing: 'Tegner arket …',
    drawingPage: (k, n) => `Tegner side ${k} av ${n} …`,
    readingPage: 'Leser siden …',
    pagePrefix: (k, n) => `Side ${k} av ${n}: `,
    findingInk: 'Finner håndskriften …',
    readingInk: 'Leser håndskriften …',
    rereadingRow: row => `Leser rad ${row} på nytt …`,
    writingResults: 'Skriver resultater …',
  },

  errors: {
    noSheet: 'Fant ikke et World Capitals Quiz-ark på denne siden. Lag et nytt ark først.',
    noCountries: 'Fant ingen land på arket.',
    openNote: 'Åpne en notatside (.note) først.',
    failed: what => `${what} feilet`,
    newPageTemplates: details => `Klarte ikke å lage ny side. Prøvde maler:\n${details}`,
    newPageNoTemplates: 'Klarte ikke å lage ny side: fant ingen sidemaler på enheten.',
    permission: 'World Capitals Quiz leser og skriver arbeidsarket på siden.',
  },
};

export default nb;
