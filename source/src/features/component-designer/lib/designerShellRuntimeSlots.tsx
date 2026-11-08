import * as React from 'react';
import type { DesignerDocument } from '../../../domain/component-designer/types';
import {
  buildShellRuntimeSlotsFromDocument,
  type ShellRuntimeSlots,
} from '../../../app/platform/buildShellRuntimeSlots';

export type DesignerShellRuntimeSlots = ShellRuntimeSlots;

/**
 * Runtime slots for the Designer's main Preview tab (`DesignerPreviewViewport`).
 * Delegates to `buildShellRuntimeSlotsFromDocument` so header/logo/nav config stays
 * in lockstep with `DesignerPreviewPortalShell` and `DesignerPublishedShell`.
 */
export function useDesignerShellRuntimeSlots(
  document: DesignerDocument,
  options?: { routeOutlet?: React.ReactNode },
): DesignerShellRuntimeSlots {
  const routeOutlet = options?.routeOutlet;
  return React.useMemo(
    () => buildShellRuntimeSlotsFromDocument(document, { routeOutlet }),
    [document, routeOutlet],
  );
}
