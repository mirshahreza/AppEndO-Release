import { describe, expect, it } from 'vitest';
import {
  APPENDOO_DEFAULT_LOOK,
  APPENDOO_LOOK_IDS,
  APPENDOO_LOOK_META,
  appendooLookShowsAccessories,
  appendooLookShowsGel,
  appendooLookShowsPaint,
  appendooLookShowsColor,
  appendooLookUsesInkFace,
  isAppendooLookId,
} from '../appendooLook';

describe('appendooLook', () => {
  it('names every look and keeps candy as the gel default', () => {
    expect(APPENDOO_DEFAULT_LOOK).toBe('candy');
    expect(APPENDOO_LOOK_IDS.map((id) => APPENDOO_LOOK_META[id].label)).toEqual([
      'Candy gel',
      'Contour',
      'Watercolor',
      'Gouache',
      'Sumi',
      'Charcoal',
      'Graphite',
      'Realistic',
      'Woodcut',
      'Pastel',
    ]);
    expect(isAppendooLookId('wash')).toBe(true);
    expect(isAppendooLookId('graphite')).toBe(true);
    expect(isAppendooLookId('realistic')).toBe(true);
    expect(isAppendooLookId('schematic')).toBe(false);
  });

  it('shows gel chrome only on candy and ink faces on the drawing looks', () => {
    expect(appendooLookShowsGel('candy')).toBe(true);
    expect(appendooLookShowsAccessories('candy')).toBe(true);
    expect(appendooLookShowsPaint('candy')).toBe(true);
    expect(appendooLookUsesInkFace('candy')).toBe(false);
    expect(appendooLookShowsGel('contour')).toBe(false);
    expect(appendooLookShowsPaint('contour')).toBe(false);
    expect(appendooLookUsesInkFace('contour')).toBe(true);
    expect(appendooLookShowsGel('wash')).toBe(false);
    expect(appendooLookShowsPaint('wash')).toBe(true);
    expect(appendooLookUsesInkFace('woodcut')).toBe(true);
    expect(appendooLookShowsColor('candy')).toBe(true);
    expect(appendooLookShowsColor('graphite')).toBe(false);
    expect(appendooLookShowsPaint('graphite')).toBe(true);
    expect(appendooLookUsesInkFace('graphite')).toBe(true);
    expect(appendooLookShowsColor('realistic')).toBe(true);
    expect(appendooLookShowsPaint('realistic')).toBe(true);
    expect(appendooLookShowsGel('realistic')).toBe(false);
    expect(appendooLookUsesInkFace('realistic')).toBe(false);
  });
});
