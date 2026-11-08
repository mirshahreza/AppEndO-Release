import type { DesignerDocument } from '../../domain/component-designer/types';
import { parseShellDesignerComponentPath } from './designerShellEntry';
import { isShellChromeSlotId } from './shellChromeSlots';
import { isShellNavRegionSlotId } from './shellNavRegions';

/** True when the document includes shell chrome / nav region slots that need runtime wiring. */
/** Shell layout chrome is editable in Live Designer for portal layouts and chrome-bearing drafts. */
export function isShellLayoutEditorContext(
  document: DesignerDocument | null | undefined,
  componentPath?: string | null,
): boolean {
  if (document && documentNeedsShellRuntimeSlots(document)) {
    return true;
  }
  if (componentPath && parseShellDesignerComponentPath(componentPath)) {
    return true;
  }
  return false;
}

export function documentNeedsShellRuntimeSlots(
  document: DesignerDocument | null | undefined,
): boolean {
  if (!document?.nodes) {
    return false;
  }
  return Object.values(document.nodes).some((node) => {
    if (node.type !== 'system-slot') {
      return false;
    }
    const slotId = typeof node.props.slotId === 'string' ? node.props.slotId.trim() : '';
    return Boolean(slotId) && (isShellChromeSlotId(slotId) || isShellNavRegionSlotId(slotId));
  });
}
