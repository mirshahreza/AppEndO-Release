/** Document attribute that turns off text selection for the Studio mount. */
export const STUDIO_NO_SELECT_DOCUMENT_ATTR = 'data-studio-no-select';

/** Fired after Studio blocks browser Ctrl+A so Live Designer can select canvas objects. */
export const STUDIO_SELECT_ALL_BLOCKED_EVENT = 'appendo:studio-select-all-blocked';

let studioNoSelectHoldCount = 0;
let studioSelectAllListener: ((event: KeyboardEvent) => void) | null = null;
let studioSelectAllDocument: Document | null = null;

export function isStudioSelectAllHotkey(event: KeyboardEvent): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) {
    return false;
  }
  const key = event.key.toLowerCase();
  return key === 'a' || event.code === 'KeyA' || event.keyCode === 65;
}

export function isStudioNativeSelectAllTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest('.monaco-editor, [data-testid="live-designer-code-panel"]')) {
    return true;
  }
  const editable = target.closest('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]');
  if (!editable) {
    return false;
  }
  if (editable.closest('[data-studio-chrome-search]')) {
    return false;
  }
  return true;
}

function onStudioSelectAllKeyDown(event: KeyboardEvent): void {
  if (!isStudioSelectAllHotkey(event) || isStudioNativeSelectAllTarget(event.target)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (event.target instanceof HTMLElement && event.target.closest('[data-studio-chrome-search]')) {
    event.target.blur();
  }
  const doc = event.target instanceof Node ? event.target.ownerDocument : studioSelectAllDocument;
  doc?.getSelection()?.removeAllRanges();
  doc?.dispatchEvent(new CustomEvent(STUDIO_SELECT_ALL_BLOCKED_EVENT));
}

function ensureStudioSelectAllGuard(root: HTMLElement): void {
  const doc = root.ownerDocument;
  if (studioSelectAllListener && studioSelectAllDocument === doc) {
    return;
  }
  releaseStudioSelectAllGuard();
  studioSelectAllListener = onStudioSelectAllKeyDown;
  studioSelectAllDocument = doc;
  doc.addEventListener('keydown', studioSelectAllListener, true);
}

function releaseStudioSelectAllGuard(): void {
  if (!studioSelectAllListener || !studioSelectAllDocument) {
    return;
  }
  studioSelectAllDocument.removeEventListener('keydown', studioSelectAllListener, true);
  studioSelectAllListener = null;
  studioSelectAllDocument = null;
}

/**
 * Marks `html` so studio CSS can disable text selection, including portaled overlays.
 * Nested studio mounts share one hold count so inner unmount does not unlock the outer shell.
 */
export function acquireStudioNoSelectDocument(
  root: HTMLElement = document.documentElement,
): () => void {
  studioNoSelectHoldCount += 1;
  root.setAttribute(STUDIO_NO_SELECT_DOCUMENT_ATTR, '');
  ensureStudioSelectAllGuard(root);
  return () => {
    studioNoSelectHoldCount = Math.max(0, studioNoSelectHoldCount - 1);
    if (studioNoSelectHoldCount === 0) {
      root.removeAttribute(STUDIO_NO_SELECT_DOCUMENT_ATTR);
      releaseStudioSelectAllGuard();
    }
  };
}

/** Clears leaked holds between tests. */
export function resetStudioNoSelectDocumentForTests(
  root: HTMLElement = document.documentElement,
): void {
  studioNoSelectHoldCount = 0;
  root.removeAttribute(STUDIO_NO_SELECT_DOCUMENT_ATTR);
  releaseStudioSelectAllGuard();
}
