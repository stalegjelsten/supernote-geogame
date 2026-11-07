/**
 * Gjør malene i MenuStrings om til tekstfunksjonene som menyen bruker.
 */
import type {MenuStrings} from './types';

type Vars = Record<string, string | number>;

/** Bytter ut {navn} med verdien; ukjente plassholdere står igjen uendret. */
export function fmt(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => (key in vars ? String(vars[key]) : all));
}

/** Entall når tallet er 1, ellers flertall. */
export function plural(m: MenuStrings, key: 'newPages' | 'statsDue' | 'statsSheetUnit' | 'statsTimeUnit', n: number): string {
  return n === 1 ? m[`${key}_one`] : m[key];
}

/** Heltall med språkets tusenskille, f.eks. «10 000». */
export function thousands(m: MenuStrings, n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, m.thousandsSep);
}

/** «a, b og c» med språkets skilletegn og ord for «og». */
export function list(m: MenuStrings, xs: string[]): string {
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(m.hsListSep)}${m.hsAnd}${xs[xs.length - 1]}`;
}
