/**
 * Noe som skal tegnes på siden. Samles opp og settes inn i ett kall
 * (`insertDrafts` i src/sdk/notes.ts). Ligger her, uten SDK-import, så den
 * rene logikken kan lage tegningene og testes.
 */
import type {Rect} from './layout';

export interface DraftPoint {
  x: number;
  y: number;
}

export type Draft =
  | {
      kind: 'text';
      text: string;
      rect: Rect;
      fontSize: number;
      align?: 0 | 1 | 2;
      bold?: boolean;
      locked?: boolean;
    }
  | {kind: 'line'; a: DraftPoint; b: DraftPoint; color: number; width: number}
  /** Fri polygon, brukes til håndtegnede merker. */
  | {kind: 'path'; points: DraftPoint[]; color: number; width: number}
  /** Bilde fra en fil på enheten, tegnet nøyaktig i `rect`. */
  | {kind: 'picture'; path: string; rect: Rect};
