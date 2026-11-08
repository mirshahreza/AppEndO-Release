import * as React from 'react';
import type { DesignerDocument } from '../../domain/component-designer/types';
import {
  SHELL_CHROME_HEADER,
  SHELL_CHROME_LOGO,
  SHELL_CHROME_PORTAL_MENU,
  SHELL_CHROME_SIDEBAR_TOGGLE,
} from '../../shared/lib/shellChromeSlots';
import { extractShellHeaderConfigFromDocument } from '../../shared/lib/shellHeaderProps';
import { extractShellLogoConfigFromDocument } from '../../shared/lib/shellLogoProps';
import { extractShellNavSlotConfigFromDocument } from '../../shared/lib/shellNavSlotProps';
import {
  SHELL_NAV_REGION_FOOTER,
  SHELL_NAV_REGION_SIDE,
  SHELL_NAV_REGION_TOP,
} from '../../shared/lib/shellNavRegions';
import { ShellNavRegionSlot } from './ShellNavRegionSlot';
import { cmsSiteChromeSlots } from './cmsSiteChromeSlots';
import {
  ShellHeaderChromeSlot,
  ShellLogoSlot,
  ShellPortalMenuSlot,
  ShellSidebarToggleSlot,
} from './DesignerPublishedShellChrome';

/**
 * Single source of truth for designer/published shell chrome + nav runtime slots.
 *
 * Bug found (parity audit item 85): three independent copies of this wiring existed
 * (`useDesignerShellRuntimeSlots`, `DesignerPreviewPortalShell`, `DesignerPublishedShell`).
 * Round-1 fixes updated only two of them, so the Designer's main Preview tab kept rendering
 * `<ShellHeaderChromeSlot />` without `config` — `showBreadcrumb=false` etc. stayed dead there.
 * All three call sites now share this builder.
 */
export type ShellRuntimeSlots = {
  routeOutlet?: React.ReactNode;
  navRegions?: Partial<Record<string, React.ReactNode>>;
  chromeSlots?: Partial<Record<string, React.ReactNode>>;
};

export function buildShellRuntimeSlotsFromDocument(
  document: DesignerDocument,
  options?: { routeOutlet?: React.ReactNode },
): ShellRuntimeSlots {
  const logoConfig = extractShellLogoConfigFromDocument(document);
  const headerConfig = extractShellHeaderConfigFromDocument(document);
  const navSlotConfig = extractShellNavSlotConfigFromDocument(document);

  return {
    routeOutlet: options?.routeOutlet,
    navRegions: {
      [SHELL_NAV_REGION_TOP]: (
        <ShellNavRegionSlot slotId={SHELL_NAV_REGION_TOP} slotConfig={navSlotConfig} />
      ),
      [SHELL_NAV_REGION_SIDE]: (
        <ShellNavRegionSlot slotId={SHELL_NAV_REGION_SIDE} slotConfig={navSlotConfig} />
      ),
      [SHELL_NAV_REGION_FOOTER]: (
        <ShellNavRegionSlot slotId={SHELL_NAV_REGION_FOOTER} slotConfig={navSlotConfig} />
      ),
    },
    chromeSlots: {
      [SHELL_CHROME_LOGO]: <ShellLogoSlot config={logoConfig} />,
      [SHELL_CHROME_PORTAL_MENU]: <ShellPortalMenuSlot />,
      [SHELL_CHROME_HEADER]: <ShellHeaderChromeSlot config={headerConfig} />,
      [SHELL_CHROME_SIDEBAR_TOGGLE]: <ShellSidebarToggleSlot />,
      ...cmsSiteChromeSlots,
    },
  };
}
