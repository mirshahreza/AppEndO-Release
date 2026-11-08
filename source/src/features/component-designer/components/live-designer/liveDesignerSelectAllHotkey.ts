/**
 * Native Ctrl+A stays in the Code editor and Properties fields.
 * Toolbox / Outline / other chrome searches must not steal select-all.
 */
export function isLiveDesignerNativeSelectAllTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest('[data-testid="live-designer-code-panel"], .monaco-editor')) {
    return true;
  }
  const editable = target.closest('input, textarea, select, [contenteditable="true"]');
  if (!editable) {
    return false;
  }
  return Boolean(editable.closest('[data-testid="live-designer-properties-panel"]'));
}

export function isDesignerSelectAllHotkey(event: KeyboardEvent): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) {
    return false;
  }
  const key = event.key.toLowerCase();
  return key === 'a' || event.code === 'KeyA' || event.keyCode === 65;
}
