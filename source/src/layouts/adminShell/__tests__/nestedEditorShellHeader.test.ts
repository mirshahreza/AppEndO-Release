import { describe, expect, it } from 'vitest';
import {
  buildNestedEditorShellHeaderOverride,
  NESTED_EDITOR_SHELL_EDIT_LABEL,
  NESTED_EDITOR_SHELL_SESSION_LABEL,
} from '../nestedEditorShellHeader';

describe('nestedEditorShellHeader', () => {
  it('appends Edit to titleTrail and leaves groupLabel unset for nav merge', () => {
    expect(buildNestedEditorShellHeaderOverride({
      listLabel: 'Workflows',
      description: 'Author and publish workflow definitions.',
      icon: 'Workflow',
    })).toEqual({
      icon: 'Workflow',
      label: 'Workflows',
      description: 'Author and publish workflow definitions.',
      titleTrail: ['Workflows', NESTED_EDITOR_SHELL_EDIT_LABEL],
    });
  });

  it('omits the mode segment when modeLabel is null', () => {
    expect(buildNestedEditorShellHeaderOverride({
      listLabel: 'Theme Designer',
      icon: 'tabler:IconPalette',
      modeLabel: null,
    })).toEqual({
      icon: 'tabler:IconPalette',
      label: 'Theme Designer',
      description: undefined,
      titleTrail: ['Theme Designer'],
    });
  });

  it('appends Session when a connection hub passes the session mode label', () => {
    expect(buildNestedEditorShellHeaderOverride({
      listLabel: 'SSH',
      icon: 'tabler:IconTerminal2',
      modeLabel: NESTED_EDITOR_SHELL_SESSION_LABEL,
    })).toEqual({
      icon: 'tabler:IconTerminal2',
      label: 'SSH',
      description: undefined,
      titleTrail: ['SSH', 'Session'],
    });
  });
});
