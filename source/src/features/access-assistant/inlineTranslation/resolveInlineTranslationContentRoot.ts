import {
  INLINE_TRANSLATION_SCAN_ROOT_SELECTOR,
} from '../../../shared/ui/shell/inlineTranslationScanRoot';

const MARKED_PAGE_ROOT_SELECTOR = '[data-shell-content-root]';

const isVisibleSurface = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
};

/**
 * Prefer the front-most modal / floating window; otherwise the main workspace content host.
 */
export function resolveInlineTranslationContentRoot(): HTMLElement | null {
  const surfaces = document.querySelectorAll(INLINE_TRANSLATION_SCAN_ROOT_SELECTOR);
  let fallbackSurface: HTMLElement | null = null;
  for (let index = surfaces.length - 1; index >= 0; index -= 1) {
    const candidate = surfaces.item(index);
    if (!(candidate instanceof HTMLElement)) {
      continue;
    }
    fallbackSurface = candidate;
    if (isVisibleSurface(candidate)) {
      return candidate;
    }
  }
  if (fallbackSurface) {
    return fallbackSurface;
  }

  const marked = document.querySelector(MARKED_PAGE_ROOT_SELECTOR);
  if (marked instanceof HTMLElement) {
    return marked;
  }

  const main = document.querySelector('main');
  return main instanceof HTMLElement ? main : null;
}
