import { describe, expect, it } from 'vitest';
import { buildDataStudioModelerShellHeaderOverride } from '../useDataStudioModelerShellHeader';

describe('buildDataStudioModelerShellHeaderOverride', () => {
  it('appends Edit after the Data Studio list label in the shell title trail', () => {
    expect(buildDataStudioModelerShellHeaderOverride('Data Studio')).toEqual({
      icon: 'Database',
      label: 'Data Studio',
      description: undefined,
      titleTrail: ['Data Studio', 'Edit'],
    });
  });
});
