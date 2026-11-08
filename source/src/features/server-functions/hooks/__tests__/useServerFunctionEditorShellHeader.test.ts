import { describe, expect, it } from 'vitest';
import { buildServerFunctionEditorShellHeaderOverride } from '../useServerFunctionEditorShellHeader';

describe('buildServerFunctionEditorShellHeaderOverride', () => {
  it('appends Edit after the Server Functions list label in the shell title trail', () => {
    expect(buildServerFunctionEditorShellHeaderOverride(
      'Server Functions',
      'Sample edge route.',
    )).toEqual({
      icon: 'tabler:IconFunction',
      label: 'Server Functions',
      description: 'Sample edge route.',
      titleTrail: ['Server Functions', 'Edit'],
    });
  });
});
