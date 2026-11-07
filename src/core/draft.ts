/**
 * Something to be drawn on the page. Collected and inserted in a single call
 * (`insertDrafts` in src/sdk/notes.ts). Lives here, without an SDK import, so the
 * pure logic can produce the drawings and be tested.
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
  /** Free polygon, used for hand-drawn marks. */
  | {kind: 'path'; points: DraftPoint[]; color: number; width: number}
  /** Image from a file on the device, drawn exactly in `rect`. */
  | {kind: 'picture'; path: string; rect: Rect};
