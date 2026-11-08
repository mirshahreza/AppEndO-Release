import { describe, expect, it } from 'vitest';
import { buildWorkflowDesignerShellHeaderOverride } from '../useWorkflowDesignerShellHeader';

describe('buildWorkflowDesignerShellHeaderOverride', () => {
  it('appends Edit after the Workflows list label in the shell title trail', () => {
    expect(buildWorkflowDesignerShellHeaderOverride('Workflows')).toEqual({
      icon: 'Workflow',
      label: 'Workflows',
      description: undefined,
      titleTrail: ['Workflows', 'Edit'],
    });
  });

  it('does not append workflow keys to the shell trail', () => {
    expect(buildWorkflowDesignerShellHeaderOverride(
      'Workflows',
      'Multi-stage approval for purchase orders.',
    )).toEqual({
      icon: 'Workflow',
      label: 'Workflows',
      description: 'Multi-stage approval for purchase orders.',
      titleTrail: ['Workflows', 'Edit'],
    });
  });
});
