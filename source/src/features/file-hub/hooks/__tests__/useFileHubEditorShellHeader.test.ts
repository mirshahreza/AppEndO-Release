import { describe, expect, it } from 'vitest';
import { buildFileHubEditorShellHeaderOverride } from '../useFileHubEditorShellHeader';

describe('buildFileHubEditorShellHeaderOverride', () => {
  it('appends Session after the Sftp list label', () => {
    expect(buildFileHubEditorShellHeaderOverride('Sftp')).toEqual({
      icon: 'tabler:IconFolders',
      label: 'Sftp',
      description: undefined,
      titleTrail: ['Sftp', 'Session'],
    });
  });
});
