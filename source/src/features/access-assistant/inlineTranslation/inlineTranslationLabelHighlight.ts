type StyleSnapshot = {
  outline: string;
  outlineOffset: string;
  backgroundColor: string;
};

const snapshots = new WeakMap<HTMLElement, StyleSnapshot>();

export function setInlineTranslationLabelHighlight(element: HTMLElement, active: boolean): void {
  if (active) {
    if (!snapshots.has(element)) {
      snapshots.set(element, {
        outline: element.style.outline,
        outlineOffset: element.style.outlineOffset,
        backgroundColor: element.style.backgroundColor,
      });
    }
    element.style.outline = '2px solid rgba(6, 182, 212, 0.55)';
    element.style.outlineOffset = '1px';
    element.style.backgroundColor = 'rgba(6, 182, 212, 0.14)';
    return;
  }

  const previous = snapshots.get(element);
  if (!previous) {
    element.style.outline = '';
    element.style.outlineOffset = '';
    element.style.backgroundColor = '';
    return;
  }

  element.style.outline = previous.outline;
  element.style.outlineOffset = previous.outlineOffset;
  element.style.backgroundColor = previous.backgroundColor;
  snapshots.delete(element);
}

export function clearAllInlineTranslationLabelHighlights(anchors: ReadonlyArray<{ element: HTMLElement }>): void {
  for (const anchor of anchors) {
    setInlineTranslationLabelHighlight(anchor.element, false);
  }
}
