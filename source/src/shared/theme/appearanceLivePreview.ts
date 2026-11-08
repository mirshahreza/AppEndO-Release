import { applyThemeTokenMapToDocument, type ThemeTokenMap } from './themePresetUtils';

let livePreviewTokens: ThemeTokenMap | null = null;
const listeners = new Set<() => void>();

export function setAppearanceLivePreviewTokens(tokens: ThemeTokenMap | null): void {
  livePreviewTokens = tokens;
  listeners.forEach((listener) => listener());
}

/** Push draft tokens to the module store and apply them to :root immediately. */
export function applyAppearanceLivePreview(tokens: ThemeTokenMap): void {
  setAppearanceLivePreviewTokens(tokens);
  applyThemeTokenMapToDocument(tokens);
}

export function getAppearanceLivePreviewTokens(): ThemeTokenMap | null {
  return livePreviewTokens;
}

export function subscribeAppearanceLivePreview(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
