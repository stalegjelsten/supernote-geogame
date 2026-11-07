import countries from './countries/en';
import type {Language} from './types';

const en: Language = {
  code: 'en',
  label: 'English',
  locales: ['en'],

  countries,
  continents: {
    EU: 'Europe',
    AS: 'Asia',
    AF: 'Africa',
    NA: 'North and Central America',
    SA: 'South America',
    OC: 'Oceania',
  },
  world: 'Whole world',

  sheet: {
    titlePrefix: 'Capitals',
    partSuffix: (part, parts) => ` · page ${part} of ${parts}`,
    partPattern: /page (\d+) of (\d+)\s*$/,
    subtitle: 'Write the capital in the middle column. Grade the sheet from the Geogame menu when you are done.',
    colCountry: 'Country',
    colAnswer: 'Capital',
    colResult: 'Result',
    scorePrefix: 'Score:',
    score: (points, total) => `Score: ${points} of ${total}`,
    read: text => `(read “${text}”)`,
  },

  ui: {
    title: 'Geogame – capitals',
    newSheet: 'New worksheet',
    region: 'Continent',
    count: 'Number of countries',
    all: n => `All (${n})`,
    spread: (n, pages) => `${n} countries across ${pages} pages.`,
    make: 'Make sheet',
    pageHasContent: n => `This page already has content (${n} elements).`,
    makeOnNewPage: 'Make on a new page',
    putOnThisPage: 'Put on this page',
    cancel: 'Cancel',
    doneWriting: 'Done writing?',
    gradePage: 'Grade this page',
    gradeSet: 'Grade the whole set',
    showSheet: 'Show sheet',
    somethingWrong: m => `Something went wrong: ${m}`,
    language: 'Language',
    automatic: label => `Automatic (${label})`,
    allLanguages: n => `All languages (${n}) …`,
    fewerLanguages: 'Fewer languages',
    checkingPage: 'Checking the page …',
    startingGrading: 'Starting to grade …',
    made: (n, pages) => `Made a sheet with ${n} countries on ${pages} pages.`,
    result: (points, total, percent) => `You got ${points} of ${total} right (${percent} %).`,
    pageScore: (part, points, total) => `Page ${part}: ${points} of ${total}`,
    gradedIn: seconds => `Graded in ${seconds} s.`,
  },

  progress: {
    newPages: n => (n === 1 ? 'Making a new page …' : `Making ${n} new pages …`),
    drawing: 'Drawing the sheet …',
    drawingPage: (k, n) => `Drawing page ${k} of ${n} …`,
    readingPage: 'Reading the page …',
    pagePrefix: (k, n) => `Page ${k} of ${n}: `,
    findingInk: 'Finding the handwriting …',
    readingInk: 'Reading the handwriting …',
    rereadingRow: row => `Reading row ${row} again …`,
    writingResults: 'Writing results …',
  },

  errors: {
    noSheet: 'No Geogame sheet found on this page. Make a new sheet first.',
    noCountries: 'No countries found on the sheet.',
    openNote: 'Open a note page (.note) first.',
    failed: what => `${what} failed`,
    newPageTemplates: details => `Could not make a new page. Tried templates:\n${details}`,
    newPageNoTemplates: 'Could not make a new page: no page templates found on the device.',
    permission: 'Geogame reads and writes the worksheet on the page.',
  },
};

export default en;
