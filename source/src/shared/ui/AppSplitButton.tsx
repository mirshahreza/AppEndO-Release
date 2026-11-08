import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BUTTON_INTENT_CLASS, type ButtonIntent } from './buttonSemantics';
import { NativeButton } from './NativeButton';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';
import {
  overlayMotionDocumentDir,
  overlayMotionPanelProps,
  type OverlayMotionOrigin,
} from './overlay-motion/overlayMotion';

export const SPLIT_BUTTON_MENU_PANEL_CLASS =
  'overlay-motion-panel overlay-motion-enter absolute end-0 top-[calc(100%+4px)] z-20 min-w-[7.5rem] rounded-md border border-slate-200 bg-white py-1 shadow-lg';

/** Body-portaled menu — above floating designer panels (z 120+) and overflow-hidden shells. */
export const SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS =
  'overlay-motion-panel overlay-motion-enter fixed z-[1000] min-w-[7.5rem] rounded-md border border-slate-200 bg-white py-1 shadow-lg';

/** Fixed overlay panel for menus inside overflow-hidden shells (e.g. AppEndooPanel). */
export const SPLIT_BUTTON_DROP_UP_MENU_FIXED_CLASS =
  'overlay-motion-panel overlay-motion-enter overlay-motion-drop-up fixed z-[110] rounded-md border border-slate-200 bg-white shadow-lg';

export type FixedOverlayMenuAlign = 'start' | 'end';

export type FixedOverlayMenuOptions = {
  align?: FixedOverlayMenuAlign;
  minWidth?: number;
  maxHeight?: number;
  /** Pin menu width to the trigger width (select menus in dialogs). */
  matchAnchorWidth?: boolean;
  /**
   * Flip horizontal align and vertical side when the panel would overflow the viewport
   * (last grid columns, menus near the bottom edge).
   */
  flip?: boolean;
  /** Measured panel used when `flip` is on so the real width/height can win over `minWidth`. */
  panelRef?: React.RefObject<HTMLElement | null>;
};

const FIXED_OVERLAY_GAP_PX = 6;
const FIXED_OVERLAY_VIEWPORT_MARGIN_PX = 8;
const FIXED_OVERLAY_MIN_HEIGHT_PX = 96;

export type ResolveFixedOverlayMenuStyleInput = {
  anchor: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left' | 'width' | 'height'>;
  viewport: { width: number; height: number };
  align?: FixedOverlayMenuAlign;
  minWidth?: number;
  maxHeightCap?: number;
  panelWidth?: number;
  panelHeight?: number;
  matchAnchorWidth?: boolean;
  flip?: boolean;
  gap?: number;
};

const applyAnchorWidth = (
  style: React.CSSProperties,
  anchorWidth: number,
  minWidth?: number,
  matchAnchorWidth?: boolean,
): void => {
  if (!matchAnchorWidth || anchorWidth <= 0) {
    return;
  }
  style.width = anchorWidth;
  style.minWidth = Math.max(minWidth ?? 0, anchorWidth);
  style.boxSizing = 'border-box';
};

export function resolveFixedOverlayMenuStyle(
  input: ResolveFixedOverlayMenuStyleInput,
): React.CSSProperties {
  const align = input.align ?? 'start';
  const gap = input.gap ?? FIXED_OVERLAY_GAP_PX;
  const maxHeightCap = input.maxHeightCap ?? 320;
  const availableBelow = input.viewport.height - input.anchor.bottom - gap - FIXED_OVERLAY_VIEWPORT_MARGIN_PX;

  if (!input.flip) {
    const next: React.CSSProperties = {
      top: input.anchor.bottom + gap,
      maxHeight: Math.max(FIXED_OVERLAY_MIN_HEIGHT_PX, Math.min(maxHeightCap, availableBelow)),
      overflowY: 'auto',
    };
    if (align === 'end') {
      next.right = input.viewport.width - input.anchor.right;
    } else {
      next.left = input.anchor.left;
    }
    if (input.minWidth) {
      next.minWidth = input.minWidth;
    }
    applyAnchorWidth(next, input.anchor.width, input.minWidth, input.matchAnchorWidth);
    return next;
  }

  const estimatedWidth = Math.max(
    input.matchAnchorWidth ? input.anchor.width : 0,
    input.panelWidth ?? 0,
    input.minWidth ?? 0,
    1,
  );
  const estimatedHeight = Math.max(input.panelHeight ?? 0, FIXED_OVERLAY_MIN_HEIGHT_PX);
  const availableAbove = input.anchor.top - gap - FIXED_OVERLAY_VIEWPORT_MARGIN_PX;
  const openAbove = availableBelow < estimatedHeight && availableAbove > availableBelow;
  const spaceOnSide = openAbove ? availableAbove : availableBelow;

  const spaceStart = input.viewport.width - input.anchor.left - FIXED_OVERLAY_VIEWPORT_MARGIN_PX;
  const spaceEnd = input.anchor.right - FIXED_OVERLAY_VIEWPORT_MARGIN_PX;
  let resolvedAlign = align;
  if (align === 'start' && estimatedWidth > spaceStart && spaceEnd > spaceStart) {
    resolvedAlign = 'end';
  } else if (align === 'end' && estimatedWidth > spaceEnd && spaceStart > spaceEnd) {
    resolvedAlign = 'start';
  }

  const next: React.CSSProperties = {
    maxHeight: Math.max(FIXED_OVERLAY_MIN_HEIGHT_PX, Math.min(maxHeightCap, spaceOnSide)),
    maxWidth: Math.max(0, input.viewport.width - FIXED_OVERLAY_VIEWPORT_MARGIN_PX * 2),
    overflowY: 'auto',
  };

  if (openAbove) {
    next.bottom = input.viewport.height - input.anchor.top + gap;
  } else {
    next.top = input.anchor.bottom + gap;
  }

  if (resolvedAlign === 'end') {
    next.right = Math.max(
      FIXED_OVERLAY_VIEWPORT_MARGIN_PX,
      Math.min(
        input.viewport.width - input.anchor.right,
        Math.max(FIXED_OVERLAY_VIEWPORT_MARGIN_PX, input.viewport.width - estimatedWidth - FIXED_OVERLAY_VIEWPORT_MARGIN_PX),
      ),
    );
  } else {
    next.left = Math.max(
      FIXED_OVERLAY_VIEWPORT_MARGIN_PX,
      Math.min(
        input.anchor.left,
        Math.max(FIXED_OVERLAY_VIEWPORT_MARGIN_PX, input.viewport.width - estimatedWidth - FIXED_OVERLAY_VIEWPORT_MARGIN_PX),
      ),
    );
  }

  if (input.minWidth) {
    next.minWidth = input.minWidth;
  }
  applyAnchorWidth(next, input.anchor.width, input.minWidth, input.matchAnchorWidth);
  return next;
}

export function overlayOriginFromFixedMenuStyle(
  style: React.CSSProperties | undefined,
): OverlayMotionOrigin {
  const vertical = style && style.bottom != null ? 'bottom' : 'top';
  const horizontal = style && style.right != null ? 'end' : 'start';
  return `${vertical}-${horizontal}` as OverlayMotionOrigin;
}

/** @deprecated Use FixedOverlayMenuOptions */
export type FixedDropUpMenuOptions = FixedOverlayMenuOptions;

export function useFixedDropUpMenuStyle(
  isOpen: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  options: FixedOverlayMenuOptions = {},
): React.CSSProperties | undefined {
  const {
    align = 'start',
    minWidth,
    maxHeight: maxHeightCap = 320,
  } = options;
  const [style, setStyle] = React.useState<React.CSSProperties | undefined>();

  React.useLayoutEffect(() => {
    if (!isOpen) {
      setStyle(undefined);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) {
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const gap = 4;
      const availableAbove = rect.top - gap - 8;
      const maxHeight = Math.max(96, Math.min(maxHeightCap, availableAbove));
      const next: React.CSSProperties = {
        bottom: window.innerHeight - rect.top + gap,
        maxHeight,
        overflowY: 'auto',
      };

      if (align === 'end') {
        next.right = window.innerWidth - rect.right;
      } else {
        next.left = rect.left;
      }

      if (minWidth) {
        next.minWidth = minWidth;
      }

      setStyle(next);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, anchorRef, isOpen, maxHeightCap, minWidth]);

  return style;
}

export function useFixedDropDownMenuStyle(
  isOpen: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  options: FixedOverlayMenuOptions = {},
): React.CSSProperties | undefined {
  const {
    align = 'start',
    minWidth,
    maxHeight: maxHeightCap = 320,
    matchAnchorWidth,
    flip = false,
    panelRef,
  } = options;
  const [style, setStyle] = React.useState<React.CSSProperties | undefined>();

  React.useLayoutEffect(() => {
    if (!isOpen) {
      setStyle(undefined);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) {
        return;
      }

      const panel = panelRef?.current;
      const panelRect = panel?.getBoundingClientRect();
      setStyle(resolveFixedOverlayMenuStyle({
        anchor: anchor.getBoundingClientRect(),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        align,
        minWidth,
        maxHeightCap,
        panelWidth: panel?.scrollWidth ?? panelRect?.width,
        panelHeight: panel?.scrollHeight ?? panelRect?.height,
        matchAnchorWidth,
        flip,
      }));
    };

    updatePosition();
    const frame = flip ? window.requestAnimationFrame(updatePosition) : 0;
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, anchorRef, flip, isOpen, matchAnchorWidth, maxHeightCap, minWidth, panelRef]);

  return style;
}

export const SPLIT_BUTTON_MENU_ITEM_CLASS =
  'flex w-full items-center gap-2 px-2.5 py-1.5 text-start text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-indigo-700';

export const SPLIT_BUTTON_COMPOUND_CONTAINER_CLASS =
  'inline-flex items-stretch overflow-hidden rounded-md border border-slate-200 bg-white';

export type SplitButtonSize = 'compact' | 'sm';

const SPLIT_BUTTON_SIZE_CLASS: Record<SplitButtonSize, { dropdown: string; primary: string; menuTrigger: string }> = {
  compact: {
    dropdown: 'inline-flex h-7 items-center gap-1 rounded-md border px-1.5 text-xs font-semibold transition-colors',
    primary: 'inline-flex h-7 items-center gap-1.5 px-3 text-xs font-semibold transition-colors',
    menuTrigger: 'inline-flex h-7 w-8 items-center justify-center transition-colors',
  },
  sm: {
    dropdown: 'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors',
    primary: 'inline-flex h-8 items-center gap-1.5 px-3 text-xs font-semibold transition-colors',
    menuTrigger: 'inline-flex h-8 w-8 items-center justify-center transition-colors',
  },
};

/** Segments sit inside a rounded shell; global `button { border-radius }` must be suppressed. */
const SPLIT_BUTTON_SEGMENT_BASE_CLASS =
  '!rounded-none border-0 shadow-none text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';

const SPLIT_BUTTON_DIVIDER_CLASS: Partial<Record<ButtonIntent, string>> = {
  create: 'border-primary-500/30',
  primary: 'border-primary-500/30',
  utility: 'border-cyan-300/60',
  'toggle-on': 'border-cyan-300/60',
  secondary: 'border-indigo-300/60',
  'toggle-off': 'border-indigo-300/60',
  confirm: 'border-emerald-300/60',
  'destructive-soft': 'border-rose-300/60',
};

export function useSplitButtonMenu(
  isOpen: boolean,
  onOpenChange: (open: boolean) => void,
  extraContainRefs: ReadonlyArray<React.RefObject<HTMLElement | null>> = [],
): React.RefObject<HTMLDivElement | null> {
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) {
        return;
      }
      if (extraContainRefs.some((ref) => ref.current?.contains(target))) {
        return;
      }
      onOpenChange(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [extraContainRefs, isOpen, onOpenChange]);

  return menuRef;
}

export type SplitButtonMenuItemProps = {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  role?: string;
  'aria-selected'?: boolean;
  'data-testid'?: string;
};

export const SplitButtonMenuItem: React.FC<SplitButtonMenuItemProps> = ({
  icon,
  children,
  onClick,
  disabled = false,
  className,
  role = 'menuitem',
  'aria-selected': ariaSelected,
  'data-testid': dataTestId,
}) => (
  <NativeButton
    className={cn(
      SPLIT_BUTTON_MENU_ITEM_CLASS,
      disabled && 'cursor-not-allowed text-slate-400 hover:bg-transparent hover:text-slate-400',
      className,
    )}
    role={role}
    aria-selected={ariaSelected}
    disabled={disabled}
    onClick={onClick}
    data-testid={dataTestId}
  >
    {icon}
    {children}
  </NativeButton>
);

export type AppSplitButtonProps = {
  intent?: ButtonIntent;
  size?: SplitButtonSize;
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
  /**
   * Render the menu in a body portal with fixed positioning.
   * Use inside overflow-hidden / transformed shells (floating panels, trees).
   */
  menuFixed?: boolean;
  /** Horizontal alignment of a fixed menu relative to the trigger. Default `end`. */
  menuAlign?: 'start' | 'end';
  /** Icon-only trigger without chevron (e.g. row “more” menus). */
  hideChevron?: boolean;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  onPrimaryClick?: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  menuAriaLabel: string;
  triggerAriaLabel: string;
  title?: string;
  children: React.ReactNode;
};

export const AppSplitButton: React.FC<AppSplitButtonProps> = ({
  intent = 'utility',
  size = 'sm',
  disabled = false,
  className,
  menuClassName,
  menuFixed = false,
  menuAlign = 'end',
  hideChevron = false,
  label,
  icon,
  onPrimaryClick,
  isOpen,
  onOpenChange,
  menuAriaLabel,
  triggerAriaLabel,
  title,
  children,
}) => {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const portalContainRefs = React.useMemo(
    () => (menuFixed ? [panelRef] : []),
    [menuFixed],
  );
  const menuRef = useSplitButtonMenu(isOpen, onOpenChange, portalContainRefs);
  const fixedMenuStyle = useFixedDropDownMenuStyle(menuFixed && isOpen, menuRef, {
    align: menuAlign,
  });
  const sizeClass = SPLIT_BUTTON_SIZE_CLASS[size];
  const intentClass = BUTTON_INTENT_CLASS[intent];
  const dividerClass = SPLIT_BUTTON_DIVIDER_CLASS[intent] ?? 'border-slate-200';
  const isPrimaryMenuMode = onPrimaryClick !== undefined;
  const createGuide = intent === 'create'
    ? pageGuideLocalProps(
      (typeof triggerAriaLabel === 'string' && triggerAriaLabel.trim())
        || (typeof label === 'string' && label.trim())
        || PAGE_GUIDE_EN['pageGuide.page.create.title']
        || 'Create',
      PAGE_GUIDE_EN['pageGuide.page.createMenu.hint'],
      16,
    )
    : {};

  const menuMotion = overlayMotionPanelProps({
    kind: 'popover',
    origin: menuAlign === 'start' ? 'top-start' : 'top-end',
    dir: overlayMotionDocumentDir(),
  });
  const menuPanel = isOpen ? (
    <div
      ref={menuFixed ? panelRef : undefined}
      className={cn(
        menuFixed ? SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS : SPLIT_BUTTON_MENU_PANEL_CLASS,
        menuMotion.className,
        menuClassName,
      )}
      data-overlay-kind={menuMotion['data-overlay-kind']}
      data-overlay-origin={menuMotion['data-overlay-origin']}
      data-overlay-dir={menuMotion['data-overlay-dir']}
      style={menuFixed ? fixedMenuStyle : undefined}
      role="menu"
      aria-label={menuAriaLabel}
    >
      {children}
    </div>
  ) : null;

  const renderedMenu = menuFixed && menuPanel && typeof document !== 'undefined'
    ? createPortal(menuPanel, document.body)
    : menuPanel;

  const chevron = (
    <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', isOpen && 'rotate-180')} />
  );

  if (!isPrimaryMenuMode) {
    const isIconOnlyTrigger = Boolean(icon) && !label;

    return (
      <div ref={menuRef} className={cn('relative inline-flex items-center', className)} {...createGuide}>
        <NativeButton
          className={cn(
            hideChevron && isIconOnlyTrigger
              ? 'inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-slate-400 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600'
              : cn(
                sizeClass.dropdown,
                intentClass,
                isIconOnlyTrigger && 'gap-1 px-1.5',
              ),
            disabled && 'cursor-not-allowed opacity-50',
          )}
          aria-label={triggerAriaLabel}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          title={title ?? triggerAriaLabel}
          disabled={disabled}
          onClick={() => onOpenChange(!isOpen)}
        >
          {icon}
          {label ? <span>{label}</span> : null}
          {hideChevron && isIconOnlyTrigger ? null : chevron}
        </NativeButton>
        {renderedMenu}
      </div>
    );
  }

  const segmentBaseClass = cn(SPLIT_BUTTON_SEGMENT_BASE_CLASS, BUTTON_INTENT_CLASS[intent]);

  return (
    <div ref={menuRef} className={cn('relative inline-flex items-center', className)} {...createGuide}>
      <div className="inline-flex items-stretch overflow-hidden rounded-md shadow-sm">
        <NativeButton
          className={cn(sizeClass.primary, segmentBaseClass, disabled && 'opacity-50')}
          aria-label={triggerAriaLabel}
          title={title ?? triggerAriaLabel}
          disabled={disabled}
          onClick={onPrimaryClick}
        >
          {icon}
          {label ? <span>{label}</span> : null}
        </NativeButton>
        <NativeButton
          className={cn(
            sizeClass.menuTrigger,
            segmentBaseClass,
            'border-s',
            dividerClass,
            disabled && 'opacity-50',
          )}
          aria-label={menuAriaLabel}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          title={menuAriaLabel}
          disabled={disabled}
          onClick={() => onOpenChange(!isOpen)}
        >
          {chevron}
        </NativeButton>
      </div>
      {renderedMenu}
    </div>
  );
};
