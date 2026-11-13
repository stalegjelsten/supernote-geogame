/**
 * Thin layer around sn-plugin-lib. All calls are unwrapped from APIResponse,
 * and errors are thrown as plain Error with a readable message.
 */
import {FileUtils, PluginCommAPI, PluginFileAPI, PluginManager, PluginNoteAPI} from 'sn-plugin-lib';
import type {Draft} from '../core/draft';
import type {Rect, Size} from '../core/layout';
import {currentLanguage} from '../i18n';
import {pluginDirPath} from './pluginDir';

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

/**
 * The page size per note. Every page in a note has the same size, and it never changes, so it is
 * asked for once per note instead of on every call (each call to the device takes time).
 */
const sizeByNote = new Map<string, Size>();

async function noteSize(notePath: string, page: number): Promise<Size> {
  const known = sizeByNote.get(notePath);
  if (known) {
    return known;
  }
  const size = unwrap<Size>(await PluginFileAPI.getPageSize(notePath, page), 'getPageSize');
  sizeByNote.set(notePath, size);
  return size;
}

export async function currentPage(): Promise<PageRef> {
  // Both are asked for at once; the page number is only used if the file is a note.
  const [pathRes, pageRes] = await Promise.all([PluginCommAPI.getCurrentFilePath(), PluginCommAPI.getCurrentPageNum()]);
  const notePath = unwrap<string>(pathRes, 'getCurrentFilePath');
  if (!notePath || !notePath.toLowerCase().endsWith('.note')) {
    throw new Error(currentLanguage().errors.openNote);
  }
  const page = unwrap<number>(pageRes, 'getCurrentPageNum');
  const size = await noteSize(notePath, page);
  return {notePath, page, size};
}

/** The default template for a completely white background on Supernote. */
const WHITE_TEMPLATE = 'White';

/**
 * Page template candidates for a new page, in priority order:
 * 1. "White" (completely white background) – spelled the way the device reports it, otherwise as "White",
 * 2. the template of the current page,
 * 3. other system templates, with blank templates first.
 */
async function templateCandidates(ref: PageRef): Promise<string[]> {
  let system: Array<{name?: string; vUri?: string}> = [];
  try {
    const raw = (await PluginCommAPI.getNoteSystemTemplates()) as unknown;
    // Returns either a list directly or an APIResponse with a list.
    system = (Array.isArray(raw) ? raw : (raw as Resp<unknown[]>)?.result ?? []) as typeof system;
  } catch {
    // No system templates available.
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
    // Skip.
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

/**
 * The name of the page's template. Empty string if the page has no template, `null` if
 * the device did not respond (then we don't know, and treat the page as if it has a template).
 */
export async function pageTemplateName(ref: PageRef): Promise<string | null> {
  try {
    const cur = unwrap<{name?: string} | null>(
      await PluginFileAPI.getNotePageTemplate(ref.notePath, ref.page),
      'getNotePageTemplate',
    );
    return cur?.name?.trim() ?? '';
  } catch {
    return null;
  }
}

/** The template that worked last, so we don't have to try our way through for every page. */
let workingTemplate: string | null = null;

/** Marks a call to the device that never answered (see withTimeout). */
const TIMED_OUT = Symbol('timedOut');

/**
 * Waits for a call to the device, but at most `ms` milliseconds. The SDK calls have no timeout of
 * their own: if the device never answers, the promise never settles and the plugin hangs.
 */
async function withTimeout<T>(call: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>(resolve => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  try {
    return await Promise.race([call, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const INSERT_TIMEOUT_MS = 8000;
const RELOAD_TIMEOUT_MS = 8000;

/**
 * Inserts `count` new, empty pages starting at page index `at` in the note.
 * Does not go to the pages; use jumpToPage afterwards.
 * `onPage(done, count)` is called after each new page, so the caller can show progress.
 */
export async function insertBlankPages(
  ref: PageRef,
  at: number,
  count: number,
  onPage?: (done: number, count: number) => void,
): Promise<void> {
  if (count <= 0) {
    return;
  }
  /** The result of the insertion, or `null` if the device did not answer in time. */
  const insertOne = async (template: string): Promise<Resp<boolean> | null> => {
    const res = await withTimeout(
      PluginFileAPI.insertNotePage({notePath: ref.notePath, page: at, template}) as Promise<unknown>,
      INSERT_TIMEOUT_MS,
    );
    return res === TIMED_OUT ? null : (res as Resp<boolean>);
  };
  const reload = async () => {
    try {
      await withTimeout(PluginCommAPI.reloadFile() as Promise<unknown>, RELOAD_TIMEOUT_MS);
    } catch {
      // Not all versions need this.
    }
  };
  const countPages = async () => {
    const n = await withTimeout(totalPages(ref.notePath), INSERT_TIMEOUT_MS);
    return n === TIMED_OUT ? null : n;
  };

  const before = await totalPages(ref.notePath);
  const target = before + count;
  let have = before;
  // All the pages are inserted at the same index (`at`), so they are pushed back as we go.
  // That index is always valid. We count the pages instead of trusting that the insertion
  // actually produced a new page (page 3 of 3 once went missing when insertions were ignored).
  // The note is reloaded only when the count did not go up, and once at the end: reloading after
  // every page was slow, and a whole-world sheet (10 pages) hung on "Creating 10 new pages".
  for (let attempt = 0; attempt < count * 2 && have < target; attempt++) {
    // `null` = the device did not answer in time; the count below shows whether it worked anyway.
    let res: Resp<boolean> | null | undefined;
    if (workingTemplate) {
      res = await insertOne(workingTemplate);
    }
    if (res !== null && !res?.success) {
      const candidates = await templateCandidates(ref);
      const errors: string[] = [];
      for (const template of candidates.slice(0, 6)) {
        res = await insertOne(template);
        if (res === null) {
          break;
        }
        if (res.success) {
          workingTemplate = template;
          break;
        }
        errors.push(`«${template}»: ${res.error?.code ?? '?'} ${res.error?.message ?? ''}`.trim());
      }
      if (res !== null && !res?.success) {
        throw new Error(
          candidates.length
            ? currentLanguage().errors.newPageTemplates(errors.join('\n'))
            : currentLanguage().errors.newPageNoTemplates,
        );
      }
    }
    let now = await countPages();
    if (now === null || now <= have) {
      await reload();
      now = await countPages();
    }
    if (now !== null && now > have) {
      have = now;
      onPage?.(Math.min(have - before, count), count);
    }
  }
  // Once at the end, so the device shows the new pages.
  await reload();
  have = await totalPages(ref.notePath);
  if (have < target) {
    throw new Error(`${currentLanguage().errors.failed('insertNotePage')} (${have - before}/${count})`);
  }
}

export async function jumpToPage(page: number): Promise<void> {
  unwrap(await PluginCommAPI.jumpToPage(page), 'jumpToPage');
}

export async function totalPages(notePath: string): Promise<number> {
  return unwrap<number>(await PluginFileAPI.getNoteTotalPageNum(notePath), 'getNoteTotalPageNum');
}

/**
 * Same note, a different page. All the pages in a note have the same size, so the device is not
 * asked. A page past the end of the note is noticed when its elements are read.
 */
export function pageRefAt(ref: PageRef, page: number): PageRef {
  if (page < 0) {
    throw new Error(`${currentLanguage().errors.failed('getPageSize')} (${page})`);
  }
  return {notePath: ref.notePath, page, size: ref.size};
}

const PERMISSIONS = ['plugin.permission.FILE:READ', 'plugin.permission.FILE:WRITE'];

let permissionsChecked = false;

/** Requests read/write access to notes if we don't have it. Checked only once per session. */
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
      // Not all firmware versions require this; carry on.
    }
  }
}

/** Element types from sn-plugin-lib (Element.TYPE_*). */
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
 * Fetches the points for many strokes at once. The calls are sent in parallel instead of
 * waiting for the reply for each stroke before asking the next, which saves a lot of time.
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

/** Something to be drawn on the page; see src/core/draft.ts. */
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
    // penWidth has a minimum of 100 in the SDK.
    penWidth: Math.max(100, d.width),
    ...shape,
    ellipseCenterPoint: null,
    ellipseMajorAxisRadius: 0,
    ellipseMinorAxisRadius: 0,
    ellipseAngle: 0,
  };
}

/**
 * Inserts all the elements in one call (insertPageElements).
 * This is much faster than one insertText/insertGeometry call per element.
 * If batch insertion fails, we fall back to one element at a time.
 */
export async function insertDrafts(ref: PageRef, drafts: Draft[]): Promise<void> {
  if (!drafts.length) {
    return;
  }
  try {
    // Each element needs its own createElement call (it gets its own uuid), but the calls are
    // sent all at once instead of waiting for the reply to one before asking for the next.
    const created = await Promise.all(
      drafts.map(d =>
        PluginCommAPI.createElement(d.kind === 'text' ? TYPE_TEXT : d.kind === 'picture' ? TYPE_PICTURE : TYPE_GEO),
      ),
    );
    const elements: object[] = [];
    for (const [i, d] of drafts.entries()) {
      const el = unwrap<Record<string, unknown>>(created[i], 'createElement');
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
    console.warn('Batch insertion failed, trying one element at a time', e);
    // insertText/insertGeometry only work on the page that is shown.
    await jumpToPage(ref.page);
    await insertOneByOne(drafts);
  }
}

async function insertOneByOne(drafts: Draft[]): Promise<void> {
  for (const d of drafts) {
    if (d.kind === 'text') {
      unwrap(await PluginNoteAPI.insertText(textBoxOf(d)), `insertText «${d.text}»`);
    } else if (d.kind === 'picture') {
      // Fallback: the placement is decided by the device. The grading reads the actual
      // placement from the image element, so the coordinates are still correct.
      unwrap(await PluginNoteAPI.insertImage(d.path), 'insertImage');
    } else {
      const g = geometryOf(d);
      const res = (await PluginCommAPI.insertGeometry(g)) as Resp<boolean>;
      if (!res?.success && d.kind === 'path') {
        unwrap(res, 'insertGeometry');
      } else if (!res?.success && d.kind === 'line') {
        // Fallback if straightLine is not supported: a "polygon" back and forth.
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
    // Saving is a bonus; the system saves the note anyway.
  }
}

/** Does the file exist on the device? */
async function fileExists(path: string): Promise<boolean> {
  try {
    return !!(await FileUtils.exists(path));
  } catch {
    return false;
  }
}

/**
 * Full path to an image that the RN build has put in the plugin package.
 * `buildPlugin.sh` puts the images in `drawable-mdpi/assets_<mappe>_<navn>.png`,
 * and the package is unpacked into the plugin folder (`PluginManager.getPluginDirPath()`).
 * If it is not found there, the plugin folder and its subfolders are searched.
 */
export async function bundledImagePath(fileName: string): Promise<string> {
  const dir = (await pluginDirPath())?.replace(/\/+$/, '');
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
