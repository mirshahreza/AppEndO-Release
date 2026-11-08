import { lockUiScrollAreaTextSelection } from '../../../../shared/ui/UiScrollArea';

export const LIVE_DESIGNER_PALETTE_DRAG_MIME = 'application/x-appendo-designer-palette';
export const LIVE_DESIGNER_NODE_DRAG_MIME = 'application/x-appendo-designer-node';

export type LiveDesignerExternalDrag =
  | { kind: 'palette'; itemId: string; label: string }
  | { kind: 'node'; nodeId: string; label: string };

let current: LiveDesignerExternalDrag | null = null;
let selectionLockCount = 0;
let unlockSelection: (() => void) | null = null;

/** Blocks native text selection for the duration of a Live Designer drag (HTML5 or canvas). */
export function acquireLiveDesignerDragSelectionLock(): void {
  if (typeof document === 'undefined') {
    return;
  }
  selectionLockCount += 1;
  if (selectionLockCount === 1) {
    unlockSelection = lockUiScrollAreaTextSelection();
  }
}

export function releaseLiveDesignerDragSelectionLock(): void {
  if (selectionLockCount <= 0) {
    return;
  }
  selectionLockCount -= 1;
  if (selectionLockCount === 0 && unlockSelection) {
    unlockSelection();
    unlockSelection = null;
  }
}

export function beginLiveDesignerExternalDrag(drag: LiveDesignerExternalDrag): void {
  if (!current) {
    acquireLiveDesignerDragSelectionLock();
  }
  current = drag;
}

export function getLiveDesignerExternalDrag(): LiveDesignerExternalDrag | null {
  return current;
}

export function endLiveDesignerExternalDrag(): void {
  if (!current) {
    return;
  }
  current = null;
  releaseLiveDesignerDragSelectionLock();
}

export function hasLiveDesignerExternalDragType(types: DataTransfer['types'] | null | undefined): boolean {
  if (current) {
    return true;
  }
  if (!types) {
    return false;
  }
  const list = Array.from(types);
  return list.includes(LIVE_DESIGNER_PALETTE_DRAG_MIME)
    || list.includes(LIVE_DESIGNER_NODE_DRAG_MIME);
}

export function setLiveDesignerDragImage(dataTransfer: DataTransfer, label: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  const chip = document.createElement('div');
  chip.textContent = label;
  chip.setAttribute('data-live-designer-drag-image', '');
  chip.style.cssText = [
    'position:absolute',
    'top:-1200px',
    'left:0',
    'padding:4px 8px',
    'border:2px solid #06b6d4',
    'background:#fff',
    'border-radius:6px',
    'font:600 11px/1.2 ui-sans-serif,system-ui,sans-serif',
    'color:#0f172a',
    'box-shadow:0 8px 16px rgba(15,23,42,0.18)',
    'white-space:nowrap',
    'pointer-events:none',
    'z-index:0',
  ].join(';');
  document.body.appendChild(chip);
  dataTransfer.setDragImage(chip, 16, 12);
  window.requestAnimationFrame(() => {
    chip.remove();
  });
}
