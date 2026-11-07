/**
 * Tynt lag rundt sn-plugin-lib. Alle kall pakkes ut fra APIResponse,
 * og feil kastes som vanlige Error med en lesbar melding.
 */
import {FileUtils, PluginCommAPI, PluginFileAPI, PluginManager, PluginNoteAPI} from 'sn-plugin-lib';
import type {Draft} from '../core/draft';
import type {Rect, Size} from '../core/layout';
import {currentLanguage} from '../i18n';

interface Resp<T> {
  success: boolean;
  result: T | null;
  error?: {code: number; message: string} | null;
}

function unwrap<T>(res: unknown, what: string): T {
  const r = res as Resp<T> | null | undefined;
  if (!r || !r.success) {
    const e = r?.error;
    throw new Error(`${currentLanguage().errors.failed(what)}${e ? ` (${e.code}: ${e.message})` : ''}`);
  }
  return r.result as T;
}

export interface PageRef {
  notePath: string;
  page: number;
  size: Size;
}

export async function currentPage(): Promise<PageRef> {
  const notePath = unwrap<string>(await PluginCommAPI.getCurrentFilePath(), 'getCurrentFilePath');
  if (!notePath || !notePath.toLowerCase().endsWith('.note')) {
    throw new Error(currentLanguage().errors.openNote);
  }
  const page = unwrap<number>(await PluginCommAPI.getCurrentPageNum(), 'getCurrentPageNum');
  const size = unwrap<Size>(await PluginFileAPI.getPageSize(notePath, page), 'getPageSize');
  return {notePath, page, size};
}

/** Standardmalen for helt hvit bakgrunn på Supernote. */
const WHITE_TEMPLATE = 'White';

/**
 * Kandidater for sidemal til en ny side, i prioritert rekkefølge:
 * 1. «White» (helt hvit bakgrunn) – skrevet slik enheten oppgir den, ellers som «White»,
 * 2. malen til siden du står på,
 * 3. andre systemmaler, med blanke maler først.
 */
async function templateCandidates(ref: PageRef): Promise<string[]> {
  let system: Array<{name?: string; vUri?: string}> = [];
  try {
    const raw = (await PluginCommAPI.getNoteSystemTemplates()) as unknown;
    // Returnerer enten en liste direkte eller en APIResponse med liste.
    system = (Array.isArray(raw) ? raw : (raw as Resp<unknown[]>)?.result ?? []) as typeof system;
  } catch {
    // Ingen systemmaler tilgjengelig.
  }

  const out: string[] = [];
  const whiteNames = system.map(t => t.name ?? '').filter(n => n.toLowerCase() === 'white');
  out.push(...whiteNames, WHITE_TEMPLATE);

  try {
    const cur = unwrap<{name?: string} | null>(
      await PluginFileAPI.getNotePageTemplate(ref.notePath, ref.page),
      'getNotePageTemplate',
    );
    if (cur?.name) {
      out.push(cur.name);
    }
  } catch {
    // Hopp over.
  }

  const isBlank = (n: string) => /blank|empty|tom|white/i.test(n);
  const sorted = [...system].sort((a, b) => Number(isBlank(b.name ?? '')) - Number(isBlank(a.name ?? '')));
  for (const t of sorted) {
    if (t.name) {
      out.push(t.name);
    }
  }
  for (const t of sorted) {
    if (t.vUri) {
      out.push(t.vUri.replace(/^file:\/\//, ''));
    }
  }
  return [...new Set(out)];
}

/** Malen som virket sist, så vi slipper å prøve oss frem for hver side. */
let workingTemplate: string | null = null;

/**
 * Setter inn `count` nye, tomme sider fra og med sideindeks `at` i notatet.
 * Går ikke til sidene; bruk jumpToPage etterpå.
 */
export async function insertBlankPages(ref: PageRef, at: number, count: number): Promise<void> {
  if (count <= 0) {
    return;
  }
  const insertOne = async (template: string) =>
    (await PluginFileAPI.insertNotePage({notePath: ref.notePath, page: at, template})) as Resp<boolean>;
  const reload = async () => {
    try {
      await PluginCommAPI.reloadFile();
    } catch {
      // Ikke alle versjoner trenger dette.
    }
  };

  const before = await totalPages(ref.notePath);
  const target = before + count;
  // Alle sidene settes inn på samme indeks (`at`), så de skyves bakover etter hvert.
  // Den indeksen er alltid gyldig. Etter hver innsetting lastes notatet på nytt, og vi
  // teller sidene i stedet for å stole på at innsettingen faktisk ga en ny side.
  // Tidligere ble side 3 av 3 borte når innsettinger på økende indekser ble ignorert.
  for (let attempt = 0; attempt < count * 2; attempt++) {
    const have = await totalPages(ref.notePath);
    if (have >= target) {
      return;
    }
    if (workingTemplate && (await insertOne(workingTemplate))?.success) {
      await reload();
      continue;
    }
    const candidates = await templateCandidates(ref);
    const errors: string[] = [];
    let ok = false;
    for (const template of candidates.slice(0, 6)) {
      const res = await insertOne(template);
      if (res?.success) {
        workingTemplate = template;
        ok = true;
        break;
      }
      errors.push(`«${template}»: ${res?.error?.code ?? '?'} ${res?.error?.message ?? ''}`.trim());
    }
    if (!ok) {
      throw new Error(
        candidates.length
          ? currentLanguage().errors.newPageTemplates(errors.join('\n'))
          : currentLanguage().errors.newPageNoTemplates,
      );
    }
    await reload();
  }
  const have = await totalPages(ref.notePath);
  if (have < target) {
    throw new Error(`Klarte bare å lage ${have - before} av ${count} nye sider.`);
  }
}

export async function jumpToPage(page: number): Promise<void> {
  unwrap(await PluginCommAPI.jumpToPage(page), 'jumpToPage');
}

export async function totalPages(notePath: string): Promise<number> {
  return unwrap<number>(await PluginFileAPI.getNoteTotalPageNum(notePath), 'getNoteTotalPageNum');
}

/** Samme notat, en annen side. */
export async function pageRefAt(ref: PageRef, page: number): Promise<PageRef> {
  const size = unwrap<Size>(await PluginFileAPI.getPageSize(ref.notePath, page), 'getPageSize');
  return {notePath: ref.notePath, page, size};
}

const PERMISSIONS = ['plugin.permission.FILE:READ', 'plugin.permission.FILE:WRITE'];

let permissionsChecked = false;

/** Ber om lese-/skrivetilgang til notater hvis vi ikke har den. Sjekkes bare én gang per økt. */
export async function ensurePermissions(): Promise<void> {
  if (permissionsChecked) {
    return;
  }
  permissionsChecked = true;
  for (const p of PERMISSIONS) {
    try {
      if ((await PluginManager.hasPermission(p)) === 1) {
        continue;
      }
      await PluginManager.requestPermission(p, currentLanguage().errors.permission);
    } catch {
      // Ikke alle fastvareversjoner krever dette; prøv videre.
    }
  }
}

/** Elementtyper fra sn-plugin-lib (Element.TYPE_*). */
export const TYPE_STROKE = 0;
export const TYPE_PICTURE = 200;
export const TYPE_TEXT = 500;
export const TYPE_GEO = 700;

export interface PageElement {
  uuid: string;
  type: number;
  numInPage: number;
  layerNum: number;
  textBox?: {textContentFull: string | null; textRect: Rect} | null;
  geometry?: {type: string; points: Array<{x: number; y: number}> | null} | null;
  picture?: {picturePath: string; rect: Rect} | null;
  stroke?: {
    points: {size(): Promise<number>; getRange(start: number, count: number): Promise<Array<{x: number; y: number}>>};
  } | null;
}

export async function getPageElements(ref: PageRef): Promise<PageElement[]> {
  return unwrap<PageElement[]>(await PluginFileAPI.getElements(ref.page, ref.notePath), 'getElements') ?? [];
}

/**
 * Henter punktene for mange strøk samtidig. Kallene sendes parallelt i stedet for
 * å vente på svar fra hvert strøk før neste spørres, noe som sparer mye tid.
 */
export async function strokePointsAll(els: PageElement[]): Promise<Array<Array<{x: number; y: number}>>> {
  return Promise.all(els.map(el => strokePoints(el).catch(() => [])));
}

export async function strokePoints(el: PageElement): Promise<Array<{x: number; y: number}>> {
  const pts = el.stroke?.points;
  if (!pts) {
    return [];
  }
  const n = await pts.size();
  if (n <= 0) {
    return [];
  }
  return pts.getRange(0, n);
}

export const COLOR_BLACK = 0;
export const COLOR_DARK_GRAY = 0x9d;
const PEN_FINELINER = 10;

/** Noe som skal tegnes på siden; se src/core/draft.ts. */
export type {Draft};

function textBoxOf(d: Extract<Draft, {kind: 'text'}>) {
  return {
    textContentFull: d.text,
    textRect: d.rect,
    fontSize: d.fontSize,
    textAlign: d.align ?? 0,
    textBold: d.bold ? 1 : 0,
    textItalics: 0,
    textFrameWidthType: 0,
    textFrameStyle: 0,
    textEditable: d.locked ? 1 : 0,
  };
}

function geometryOf(d: Extract<Draft, {kind: 'line'} | {kind: 'path'}>) {
  const shape =
    d.kind === 'line' ? {type: 'straightLine', points: [d.a, d.b]} : {type: 'GEO_polygon', points: d.points};
  return {
    showLassoAfterInsert: false,
    penColor: d.color,
    penType: PEN_FINELINER,
    // penWidth har minimum 100 i SDK-en.
    penWidth: Math.max(100, d.width),
    ...shape,
    ellipseCenterPoint: null,
    ellipseMajorAxisRadius: 0,
    ellipseMinorAxisRadius: 0,
    ellipseAngle: 0,
  };
}

/**
 * Setter inn alle elementene i ett kall (insertPageElements).
 * Det er mye raskere enn ett insertText/insertGeometry-kall per element.
 * Hvis batch-innsetting feiler, faller vi tilbake til ett og ett element.
 */
export async function insertDrafts(ref: PageRef, drafts: Draft[]): Promise<void> {
  if (!drafts.length) {
    return;
  }
  try {
    const elements: object[] = [];
    for (const d of drafts) {
      const type = d.kind === 'text' ? TYPE_TEXT : d.kind === 'picture' ? TYPE_PICTURE : TYPE_GEO;
      const el = unwrap<Record<string, unknown>>(await PluginCommAPI.createElement(type), 'createElement');
      el.pageNum = ref.page;
      el.layerNum = 0;
      if (d.kind === 'text') {
        el.textBox = textBoxOf(d);
      } else if (d.kind === 'picture') {
        el.picture = {picturePath: d.path, rect: d.rect};
      } else {
        el.geometry = geometryOf(d);
      }
      elements.push(el);
    }
    unwrap(await PluginCommAPI.insertPageElements(elements, ref.page, 0), 'insertPageElements');
  } catch (e) {
    console.warn('Batch-innsetting feilet, prøver ett og ett element', e);
    // insertText/insertGeometry virker bare på siden som vises.
    await jumpToPage(ref.page);
    await insertOneByOne(drafts);
  }
}

async function insertOneByOne(drafts: Draft[]): Promise<void> {
  for (const d of drafts) {
    if (d.kind === 'text') {
      unwrap(await PluginNoteAPI.insertText(textBoxOf(d)), `insertText «${d.text}»`);
    } else if (d.kind === 'picture') {
      // Reserve: plasseringen bestemmes av enheten. Rettingen leser den faktiske
      // plasseringen fra bildeelementet, så koordinatene blir likevel riktige.
      unwrap(await PluginNoteAPI.insertImage(d.path), 'insertImage');
    } else {
      const g = geometryOf(d);
      const res = (await PluginCommAPI.insertGeometry(g)) as Resp<boolean>;
      if (!res?.success && d.kind === 'path') {
        unwrap(res, 'insertGeometry');
      } else if (!res?.success && d.kind === 'line') {
        // Reserve hvis straightLine ikke støttes: en «polygon» frem og tilbake.
        unwrap(
          await PluginCommAPI.insertGeometry({...g, type: 'GEO_polygon', points: [d.a, d.b, d.a]}),
          'insertGeometry',
        );
      }
    }
  }
}

export async function deleteElements(ref: PageRef, numsInPage: number[]): Promise<void> {
  if (!numsInPage.length) {
    return;
  }
  unwrap(await PluginCommAPI.deletePageElements(numsInPage, ref.page, 0), 'deletePageElements');
}

export async function recognize(elements: PageElement[], size: Size): Promise<string> {
  if (!elements.length) {
    return '';
  }
  return unwrap<string>(await PluginCommAPI.recognizeElements(elements, size), 'recognizeElements') ?? '';
}

export async function saveNote(): Promise<void> {
  try {
    await PluginNoteAPI.saveCurrentNote();
  } catch {
    // Lagring er en bonus; notatet lagres uansett av systemet.
  }
}

/** Finnes fila på enheten? */
async function fileExists(path: string): Promise<boolean> {
  try {
    return !!(await FileUtils.exists(path));
  } catch {
    return false;
  }
}

/**
 * Full sti til et bilde som RN-byggingen har lagt i pluginpakken.
 * `buildPlugin.sh` legger bildene i `drawable-mdpi/assets_<mappe>_<navn>.png`,
 * og pakken pakkes ut i pluginmappen (`PluginManager.getPluginDirPath()`).
 * Finnes den ikke der, letes det i pluginmappen og undermappene.
 */
export async function bundledImagePath(fileName: string): Promise<string> {
  const dir = (await PluginManager.getPluginDirPath())?.replace(/\/+$/, '');
  if (!dir) {
    throw new Error('getPluginDirPath');
  }
  for (const candidate of [`${dir}/drawable-mdpi/${fileName}`, `${dir}/${fileName}`]) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  const queue = [dir];
  for (let depth = 0; queue.length && depth < 40; depth++) {
    const current = queue.shift()!;
    let files: string[] = [];
    try {
      files = (await FileUtils.listFiles(current)) ?? [];
    } catch {
      continue;
    }
    for (const f of files) {
      const full = f.startsWith('/') ? f : `${current}/${f}`;
      if (full.endsWith(`/${fileName}`)) {
        return full;
      }
      if (!/\.[a-z0-9]+$/i.test(full)) {
        queue.push(full);
      }
    }
  }
  throw new Error(`${dir}/drawable-mdpi/${fileName}`);
}
