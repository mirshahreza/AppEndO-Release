import { describe, expect, it } from 'vitest';
import { buildSshHubEditorShellHeaderOverride } from '../useSshHubEditorShellHeader';

describe('buildSshHubEditorShellHeaderOverride', () => {
  it('appends Session after the SSH list label', () => {
    expect(buildSshHubEditorShellHeaderOverride('SSH')).toEqual({
      icon: 'tabler:IconTerminal2',
      label: 'SSH',
      description: undefined,
      titleTrail: ['SSH', 'Session'],
    });
  });
});
