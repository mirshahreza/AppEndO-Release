import { HTML_EDITOR_DEFAULT_HEIGHT } from './types';

const MODE_BAR_PX = 44;
const COMPACT_TOGGLE_ROW_PX = 36;
const RICH_TOOLBAR_PX = 40;

export const parseHtmlEditorRootHeightPx = (
  editorHeight: number | string | undefined,
  fallbackPx: number = HTML_EDITOR_DEFAULT_HEIGHT,
): number | null => {
  if (editorHeight === '100%' || editorHeight === undefined) {
    return null;
  }
  if (typeof editorHeight === 'number' && Number.isFinite(editorHeight)) {
    return editorHeight;
  }
  const parsed = Number.parseInt(String(editorHeight), 10);
  return Number.isFinite(parsed) ? parsed : fallbackPx;
};

export type HtmlEditorChromeInput = {
  showModeBar: boolean;
  compactVisualSource: boolean;
  compactSourceMode: boolean;
  showCompactRichToolbar: boolean;
  showStandaloneToolbar: boolean;
};

export const resolveHtmlEditorChromeHeightPx = (input: HtmlEditorChromeInput): number => {
  let chromePx = 0;
  if (input.showModeBar) {
    chromePx += MODE_BAR_PX;
  }
  if (input.compactVisualSource) {
    if (input.showCompactRichToolbar) {
      chromePx += RICH_TOOLBAR_PX;
    } else {
      chromePx += COMPACT_TOGGLE_ROW_PX;
    }
  } else if (input.showStandaloneToolbar) {
    chromePx += RICH_TOOLBAR_PX;
  }
  return chromePx;
};

export const resolveHtmlEditorBodyHeightPx = (
  rootHeightPx: number | null,
  chromePx: number,
  minBodyPx = 96,
): number | null => {
  if (rootHeightPx === null) {
    return null;
  }
  return Math.max(minBodyPx, rootHeightPx - chromePx);
};
