const IGNORE_PARENT_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'TEXTAREA', 'INPUT', 'SELECT']);

export type InlineTranslationDomTarget = {
  key: string;
  displayedText: string;
  element: HTMLElement;
};

const isElementVisible = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    const style = window.getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
  }

  const clientRects = element.getClientRects();
  return clientRects.length > 0;
};

const shouldSkipElement = (element: HTMLElement): boolean => {
  if (IGNORE_PARENT_TAGS.has(element.tagName)) {
    return true;
  }
  if (element.closest('[data-inline-translation-layer]')) {
    return true;
  }
  if (element.closest('[data-inline-translation-ignore]')) {
    return true;
  }
  if (element.closest('[contenteditable="true"]')) {
    return true;
  }
  return false;
};

const buildTextToKeyLookup = (keys: ReadonlyMap<string, string>): Map<string, string> => {
  const textToKey = new Map<string, string>();
  for (const [key, displayedText] of keys) {
    const normalizedText = displayedText.trim();
    if (!normalizedText || normalizedText.length > 240) {
      continue;
    }
    if (!textToKey.has(normalizedText)) {
      textToKey.set(normalizedText, key);
    }
  }
  return textToKey;
};

/**
 * Map culture keys to visible DOM nodes that display their resolved text (single tree walk).
 */
export function collectInlineTranslationDomTargets(
  root: HTMLElement,
  keys: ReadonlyMap<string, string>,
): InlineTranslationDomTarget[] {
  const textToKey = buildTextToKeyLookup(keys);
  if (textToKey.size === 0) {
    return [];
  }

  const results: InlineTranslationDomTarget[] = [];
  const elementToKey = new Map<HTMLElement, string>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const parent = node.parentElement;
    if (!parent || !root.contains(parent) || shouldSkipElement(parent)) {
      node = walker.nextNode();
      continue;
    }

    const chunk = node.textContent?.trim() ?? '';
    const key = textToKey.get(chunk);
    if (!key) {
      node = walker.nextNode();
      continue;
    }

    if (!isElementVisible(parent)) {
      node = walker.nextNode();
      continue;
    }

    const previousKey = elementToKey.get(parent);
    if (previousKey && previousKey !== key) {
      node = walker.nextNode();
      continue;
    }

    elementToKey.set(parent, key);
    results.push({
      key,
      displayedText: chunk,
      element: parent,
    });

    node = walker.nextNode();
  }

  return results;
}
