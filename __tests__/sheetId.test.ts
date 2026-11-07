import {SHEET_ID_PREFIX, newSheetId, parseSheetId, sheetIdDraft, sheetIdIn} from '../src/core/sheetId';
import {isResultText} from '../src/core/sheet';
import {parseOutlineKey} from '../src/core/outlineSheet';
import {sheetKey} from '../src/core/stats';

test('a new sheet ID is read back, and two IDs differ', () => {
  const a = newSheetId(1_700_000_000_000, () => 0.1);
  const b = newSheetId(1_700_000_000_000, () => 0.9);
  expect(a).not.toBe(b);
  expect(parseSheetId(SHEET_ID_PREFIX + a)).toBe(a);
  expect(sheetIdIn(['Hovedsteder – Europa (20)', null, `  ${SHEET_ID_PREFIX}${b} `])).toBe(b);
  expect(sheetIdIn(['Hovedsteder – Europa (20)'])).toBeNull();
});

test('the ID text is not taken for something else on the sheet', () => {
  const d = sheetIdDraft({width: 1920, height: 2560}, newSheetId());
  expect(d.kind).toBe('text');
  if (d.kind === 'text') {
    expect(isResultText(d.text)).toBe(false);
    expect(parseOutlineKey(d.text)).toBeNull();
    expect(d.rect.bottom).toBeLessThanOrEqual(2560);
  }
});

test('the key follows the sheet ID, not the note, when there is one', () => {
  expect(sheetKey('/a.note', 'capital', ['NO', 'SE'], 'lx2k1a00')).toBe(
    sheetKey('/b.note', 'capital', ['SE', 'NO'], 'lx2k1a00'),
  );
  expect(sheetKey('/a.note', 'capital', ['NO', 'SE'], 'lx2k1a00')).not.toBe(
    sheetKey('/a.note', 'capital', ['NO', 'SE'], 'lx2k1b00'),
  );
  expect(sheetKey('/a.note', 'capital', ['NO', 'SE'])).toBe(sheetKey('/a.note', 'capital', ['NO', 'SE'], null));
});
