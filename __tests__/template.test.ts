import {isBlankTemplate} from '../src/core/template';

describe('blank sidemal', () => {
  test.each(['', 'White', 'white', 'style_white', 'Blank', '/sdcard/MyStyle/white.png'])('«%s» er blank', name => {
    expect(isBlankTemplate(name)).toBe(true);
  });

  test.each(['Lined', 'Grid', 'Dot', 'style_8mm_lines', 'Weekly planner', 'white_lines'])('«%s» er ikke blank', name => {
    expect(isBlankTemplate(name)).toBe(false);
  });

  test('ukjent mal regnes ikke som blank', () => {
    expect(isBlankTemplate(null)).toBe(false);
  });
});
