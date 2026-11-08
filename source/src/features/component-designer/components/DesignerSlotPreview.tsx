import * as React from 'react';
import {
  DesignerPublishedShellChromeProvider,
  ShellHeaderChromeSlot,
  ShellLogoSlot,
  ShellPortalMenuSlot,
  ShellSidebarToggleSlot,
} from '../../../app/platform/DesignerPublishedShellChrome';
import { ShellNavRegionSlot } from '../../../app/platform/ShellNavRegionSlot';
import { ShellRouteOutlet } from '../../../app/platform/ShellRouteOutlet';
import {
  DesignerRuntimeRegisteredSlotFill,
  DASHBOARD_WIDGETS_SLOT_ID,
} from '../../../domain/component-designer/DesignerRuntimeRegisteredSlotFill';
import {
  SHELL_CHROME_HEADER,
  SHELL_CHROME_LOGO,
  SHELL_CHROME_PORTAL_MENU,
  SHELL_CHROME_SIDEBAR_TOGGLE,
  isShellChromeSlotId,
} from '../../../shared/lib/shellChromeSlots';
import { resolveShellLogoConfigFromProps } from '../../../shared/lib/shellLogoProps';
import { resolveShellHeaderConfigFromProps } from '../../../shared/lib/shellHeaderProps';
import { isShellNavRegionSlotId } from '../../../shared/lib/shellNavRegions';
import { SHELL_ROUTE_OUTLET_SLOT_ID } from '../../../shared/lib/shellRouteOutlet';
import { SHELL_NAV_SLOT_NAVIGATION_REF_PROP } from '../../../shared/lib/shellNavSlotProps';

export { DASHBOARD_WIDGETS_SLOT_ID };

type DesignerSlotPreviewProps = {
  slotId: string;
  label: string;
  surface: string;
  slotProps?: Record<string, unknown>;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Bug found (parity audit item P2.13): the route-outlet slot previously always rendered a
   * static "Page content loads here" placeholder, in BOTH the Designer's own editing canvas
   * AND the exported/published `.tsx` package artifact — since it's the same shared component
   * in both cases (`canvasNodes.tsx` and the codegen'd import both render `DesignerSlotPreview`
   * directly). Inside the designer's own canvas there is no real route to mount, so a
   * placeholder is correct there; but once exported and mounted as a real nested-route layout
   * in the app's actual router tree, it should render the real `<Outlet />` (via the same
   * `ShellRouteOutlet` component the real production shell already uses). Only the canvas
   * caller passes `isDesignCanvas` — every other caller (including generated/exported code,
   * which never sets this prop) gets the real component.
   */
  isDesignCanvas?: boolean;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>;

const SlotEmptyPlaceholder: React.FC<{
  slotId: string;
  label: string;
  surface: string;
}> = ({ slotId, label, surface }) => (
  <div className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-violet-300 bg-violet-50/80 px-4 py-3 text-center">
    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-600">Platform Slot</span>
    <span className="text-sm font-semibold text-violet-900">{label}</span>
    {slotId ? <span className="font-mono text-[10px] text-violet-700/80">{slotId}</span> : null}
    <span className="text-[10px] text-violet-600/70">{surface}</span>
  </div>
);

/**
 * PortalMenu (the real component behind ShellPortalMenuSlot) intentionally renders nothing
 * whenever fewer than 2 accessible portals are configured — the common single-portal setup. That
 * makes it visually indistinguishable from a broken/unimplemented element in the canvas. Since
 * whether it renders is driven by async manifest/auth data we don't have direct access to here
 * (and shouldn't duplicate — PortalMenu is also used in the real published shell), detect via the
 * DOM whether it actually rendered anything and show a design-time placeholder in its place when
 * it didn't, without ever touching the shared component's own logic.
 */
const ChromeSlotWithEmptyFallback: React.FC<{
  slotId: string;
  label: string;
  surface: string;
  children: React.ReactNode;
}> = ({ slotId, label, surface, children }) => {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = React.useState(true);

  React.useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) {
      return undefined;
    }

    const checkEmpty = () => setIsEmpty(node.childElementCount === 0);
    checkEmpty();

    const observer = new MutationObserver(checkEmpty);
    observer.observe(node, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={contentRef} className={isEmpty ? 'hidden' : 'contents'}>
        {children}
      </div>
      {isEmpty ? <SlotEmptyPlaceholder slotId={slotId} label={label} surface={surface} /> : null}
    </>
  );
};

const RouteOutletDesignerPlaceholder: React.FC = () => (
  <div className="flex min-h-[160px] flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-sky-400/80 bg-sky-50/90 px-4 py-6 text-center">
    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700">Route Outlet</span>
    <span className="text-sm font-semibold text-sky-950">Page content loads here</span>
    <span className="max-w-sm text-[11px] leading-relaxed text-sky-800/80">
      Routed page components render in this region based on the active portal URL.
    </span>
  </div>
);

export const DesignerSlotPreview: React.FC<DesignerSlotPreviewProps> = ({
  slotId,
  label,
  surface,
  slotProps,
  className,
  style,
  isDesignCanvas,
  ...domProps
}) => {
  if (isShellChromeSlotId(slotId)) {
    const chrome = (() => {
      switch (slotId) {
        case SHELL_CHROME_LOGO:
          return <ShellLogoSlot config={resolveShellLogoConfigFromProps(slotProps)} />;
        case SHELL_CHROME_PORTAL_MENU:
          return <ShellPortalMenuSlot />;
        case SHELL_CHROME_HEADER:
          // Bug found (parity audit item 4): unlike the logo branch right above (which
          // correctly calls resolveShellLogoConfigFromProps(slotProps)), this never passed a
          // config at all — showLogo/showBreadcrumb/showActions always fell back to their
          // ShellHeaderChromeSlot default (all true), regardless of the Inspector's real
          // settings, in both the design canvas and the exported/published `.tsx` (both render
          // through this exact component). Only the separate live/published-shell path
          // (extractShellHeaderConfigFromDocument) ever honored these fields.
          return <ShellHeaderChromeSlot config={resolveShellHeaderConfigFromProps(slotProps)} />;
        case SHELL_CHROME_SIDEBAR_TOGGLE:
          return <ShellSidebarToggleSlot />;
        default:
          return null;
      }
    })();

    if (chrome) {
      return (
        <DesignerPublishedShellChromeProvider>
          <div {...domProps} className={className} style={style}>
            {slotId === SHELL_CHROME_PORTAL_MENU ? (
              <ChromeSlotWithEmptyFallback slotId={slotId} label={label} surface={surface}>
                {chrome}
              </ChromeSlotWithEmptyFallback>
            ) : chrome}
          </div>
        </DesignerPublishedShellChromeProvider>
      );
    }
  }

  if (isShellNavRegionSlotId(slotId)) {
    const navigationRef = typeof slotProps?.[SHELL_NAV_SLOT_NAVIGATION_REF_PROP] === 'string'
      ? slotProps[SHELL_NAV_SLOT_NAVIGATION_REF_PROP]
      : undefined;
    const slotConfig = navigationRef?.trim()
      ? { [slotId]: { navigationRef: navigationRef.trim() } }
      : {};

    return (
      <div {...domProps} className={className} style={style}>
        <ShellNavRegionSlot slotId={slotId} slotConfig={slotConfig} />
      </div>
    );
  }

  if (slotId === SHELL_ROUTE_OUTLET_SLOT_ID) {
    return (
      <div {...domProps} className={className} style={style}>
        {isDesignCanvas ? <RouteOutletDesignerPlaceholder /> : <ShellRouteOutlet />}
      </div>
    );
  }

  return (
    <DesignerRuntimeRegisteredSlotFill
      slotId={slotId}
      label={label}
      surface={surface}
      className={className}
      style={style}
    />
  );
};
