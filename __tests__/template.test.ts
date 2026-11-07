import {isBlankTemplate} from '../src/core/template';

describe('blank page template', () => {
  test.each(['', 'White', 'white', 'style_white', 'Blank', '/sdcard/MyStyle/white.png'])('"%s" is blank', name => {
    expect(isBlankTemplate(name)).toBe(true);
  });

  test.each(['Lined', 'Grid', 'Dot', 'style_8mm_lines', 'Weekly planner', 'white_lines'])('"%s" is not blank', name => {
    expect(isBlankTemplate(name)).toBe(false);
  });

  test('unknown template is not counted as blank', () => {
    expect(isBlankTemplate(null)).toBe(false);
  });
});
