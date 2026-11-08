import { useRef } from 'react';
import {
  INSPECTOR_RAIL_DEFAULT_WIDTH_PX,
  INSPECTOR_RAIL_MAX_WIDTH_PX,
  INSPECTOR_RAIL_MIN_WIDTH_PX,
} from './surfaceClasses';
import { useWorkspaceVerticalSplitPanel } from './useWorkspaceVerticalSplitPanel';
import type { WorkspaceSplitPanelKey } from './workspaceSplitStorage';

function inspectorRailIsRtl(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.documentElement.getAttribute('dir') === 'rtl';
}

/** Default nested-editor inspector resize: 370px, 280–560 persist, not collapsible. */
export function useInspectorRailSplit(panelKey: WorkspaceSplitPanelKey) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rtl = inspectorRailIsRtl();
  const split = useWorkspaceVerticalSplitPanel({
    panelKey,
    defaultSize: INSPECTOR_RAIL_DEFAULT_WIDTH_PX,
    minSize: INSPECTOR_RAIL_MIN_WIDTH_PX,
    maxSize: INSPECTOR_RAIL_MAX_WIDTH_PX,
    measure: rtl ? 'leading' : 'trailing',
    containerRef,
    side: rtl ? 'start' : 'end',
    collapsible: false,
    persist: true,
    displayClassName: 'block',
  });

  return { containerRef, split };
}
