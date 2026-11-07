/**
 * Turns the templates in MenuStrings into the text functions the menu uses.
 */
import type {MenuStrings} from './types';

type Vars = Record<string, string | number>;

/** Replaces {name} with its value; unknown placeholders are left as they are. */
export function fmt(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => (key in vars ? String(vars[key]) : all));
}

/** Singular when the number is 1, plural otherwise. */
export function plural(m: MenuStrings, key: 'newPages' | 'statsDue' | 'statsSheetUnit' | 'statsTimeUnit', n: number): string {
  return n === 1 ? m[`${key}_one`] : m[key];
}

/** Integer with the language's thousands separator, e.g. "10 000". */
export function thousands(m: MenuStrings, n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, m.thousandsSep);
}

/** "a, b and c" with the language's separator and word for "and". */
export function list(m: MenuStrings, xs: string[]): string {
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(m.hsListSep)}${m.hsAnd}${xs[xs.length - 1]}`;
}
