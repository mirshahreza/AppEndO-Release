import { describe, expect, it } from 'vitest';
import { buildWorkbooksShellHeaderOverride } from '../useWorkbooksShellHeader';

describe('buildWorkbooksShellHeaderOverride', () => {
  it('appends Edit after the Workbooks list label in the shell title trail', () => {
    expect(buildWorkbooksShellHeaderOverride('Workbooks')).toEqual({
      icon: 'tabler:IconTable',
      label: 'Workbooks',
      description: undefined,
      titleTrail: ['Workbooks', 'Edit'],
    });
  });
});
