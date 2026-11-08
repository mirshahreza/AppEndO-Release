import { describe, expect, it } from 'vitest';
import { createInitialDesignerState } from '../../../domain/component-designer/state';
import {
  documentNeedsShellRuntimeSlots,
  isShellLayoutEditorContext,
} from '../shellDocumentRuntime';

describe('shellDocumentRuntime — null document', () => {
  it('does not throw when document is null before Live Designer hydrate', () => {
    expect(documentNeedsShellRuntimeSlots(null)).toBe(false);
    expect(isShellLayoutEditorContext(null, 'general/my-page')).toBe(false);
  });

  it('still detects shell layout from component path without a document', () => {
    expect(isShellLayoutEditorContext(null, 'portal-layouts/admin')).toBe(true);
  });

  it('detects shell runtime slots on a hydrated document', () => {
    const state = createInitialDesignerState('probe');
    expect(documentNeedsShellRuntimeSlots(state.document)).toBe(false);
    expect(isShellLayoutEditorContext(state.document, 'probe')).toBe(false);
  });
});
