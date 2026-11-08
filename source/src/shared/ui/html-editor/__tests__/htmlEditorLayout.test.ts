import { describe, expect, it } from 'vitest';
import {
  resolveHtmlEditorBodyHeightPx,
  resolveHtmlEditorChromeHeightPx,
} from '../htmlEditorLayout';

describe('htmlEditorLayout', () => {
  it('reserves compact toolbar and body height for visual switch layout', () => {
    const chromePx = resolveHtmlEditorChromeHeightPx({
      showModeBar: false,
      compactVisualSource: true,
      compactSourceMode: false,
      showCompactRichToolbar: true,
      showStandaloneToolbar: false,
    });
    expect(chromePx).toBe(40);
    expect(resolveHtmlEditorBodyHeightPx(320, chromePx)).toBe(280);
  });

  it('reserves toggle row in compact source mode', () => {
    const chromePx = resolveHtmlEditorChromeHeightPx({
      showModeBar: false,
      compactVisualSource: true,
      compactSourceMode: true,
      showCompactRichToolbar: false,
      showStandaloneToolbar: false,
    });
    expect(chromePx).toBe(36);
    expect(resolveHtmlEditorBodyHeightPx(320, chromePx)).toBe(284);
  });
});
