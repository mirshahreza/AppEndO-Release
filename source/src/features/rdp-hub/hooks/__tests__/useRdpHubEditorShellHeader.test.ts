import { describe, expect, it } from 'vitest';
import { buildRdpHubEditorShellHeaderOverride } from '../useRdpHubEditorShellHeader';

describe('buildRdpHubEditorShellHeaderOverride', () => {
  it('appends Session after the RDP list label', () => {
    expect(buildRdpHubEditorShellHeaderOverride('RDP')).toEqual({
      icon: 'tabler:IconDeviceDesktop',
      label: 'RDP',
      description: undefined,
      titleTrail: ['RDP', 'Session'],
    });
  });
});
