import { describe, expect, it } from 'vitest';
import { buildLiveDesignerShellHeaderOverride } from '../useLiveDesignerShellHeader';

describe('buildLiveDesignerShellHeaderOverride', () => {
  it('appends Edit after the Client Components list label in the shell title trail', () => {
    expect(buildLiveDesignerShellHeaderOverride('Client Components')).toEqual({
      icon: 'Component',
      label: 'Client Components',
      description: undefined,
      titleTrail: ['Client Components', 'Edit'],
    });
  });
});
