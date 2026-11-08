import type { DesignerViewport } from '../../../domain/component-designer/types';
import { normalizeDesignerViewport } from '../../../domain/component-designer/state';
import { canonicalizeDesignerItemSlug } from '../../../shared/lib/designerComponentPath';

const STORAGE_KEY_PREFIX = 'appendo:designer:viewport:';
const SKIP_VIEWPORT_PREF_KEYS = new Set(['live-designer']);

export const normalizeDesignerViewportPrefsKey = (componentKey: string): string =>
  canonicalizeDesignerItemSlug(componentKey);

export const getDesignerViewportStorageKey = (componentKey: string): string =>
  `${STORAGE_KEY_PREFIX}${normalizeDesignerViewportPrefsKey(componentKey)}`;

export const canPersistDesignerViewportPrefs = (componentKey: string): boolean => {
  const key = normalizeDesignerViewportPrefsKey(componentKey);
  return key.length > 0 && !SKIP_VIEWPORT_PREF_KEYS.has(key);
};

export { normalizeDesignerViewport };

export const readDesignerViewportPrefs = (componentKey: string): DesignerViewport | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const key = normalizeDesignerViewportPrefsKey(componentKey);
  if (!key) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getDesignerViewportStorageKey(key));
    if (!raw) {
      return null;
    }

    return normalizeDesignerViewport(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const writeDesignerViewportPrefs = (componentKey: string, viewport: DesignerViewport): void => {
  if (typeof window === 'undefined' || !canPersistDesignerViewportPrefs(componentKey)) {
    return;
  }

  try {
    window.localStorage.setItem(
      getDesignerViewportStorageKey(componentKey),
      JSON.stringify(viewport),
    );
  } catch {
    // Ignore quota / private-mode storage failures.
  }
};

/** Operator canvas size: localStorage wins so the last chosen size returns without a save. */
export const resolveDesignerViewportForComponent = (
  componentKey: string,
  persistedViewport?: DesignerViewport | null,
): DesignerViewport | null => readDesignerViewportPrefs(componentKey) ?? persistedViewport ?? null;

/** Wait until the browser has applied a viewport size change before hydrating canvas content. */
export const waitForDesignerViewportPaint = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  });
