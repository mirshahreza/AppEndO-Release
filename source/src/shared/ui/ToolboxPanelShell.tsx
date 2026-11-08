import React from 'react';
import { ChevronsDown, ChevronsUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AppSearchBox } from './AppSearchBox';
import { FloatingPanelShell, type FloatingPanelShellHandle } from './FloatingPanelShell';
import { SideHintTooltip } from './SideHintTooltip';
import {
  TOOLBOX_PANEL_DEFAULT_BOUNDS,
  TOOLBOX_PANEL_EMPTY_STATE_CLASS,
  TOOLBOX_PANEL_HEADER_CLASS,
  TOOLBOX_PANEL_ITEM_CLASS,
  TOOLBOX_PANEL_SEARCH_HOST_CLASS,
  TOOLBOX_PANEL_SECTION_BODY_CLASS,
  TOOLBOX_PANEL_SECTION_CLASS,
  TOOLBOX_PANEL_SECTION_CHEVRON_CLASS,
  TOOLBOX_PANEL_SECTION_COLLAPSED_CLASS,
  TOOLBOX_PANEL_SECTION_EXPANDED_CLASS,
  TOOLBOX_PANEL_SECTION_HEADER_CLASS,
  TOOLBOX_PANEL_TITLE_CLASS,
  UI_CHROME_NO_SELECT_CLASS,
} from './surfaceClasses';
import type { FloatingPanelBounds, FloatingPanelInitialPosition, FloatingPanelMinimizedAnchor, FloatingPanelRestoredAnchor } from './useFloatingPanel';
import type { SurfaceChromeProps } from './SurfaceChromeContext';

export { TOOLBOX_PANEL_DEFAULT_BOUNDS };

export type ToolboxPanelShellProps = SurfaceChromeProps & {
  open: boolean;
  onClose: () => void;
  title: string;
  titleIcon?: React.ReactNode;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  children: React.ReactNode;
  bounds?: FloatingPanelBounds;
  defaultWidth?: number;
  defaultHeight?: number;
  initialPosition?: FloatingPanelInitialPosition;
  /** Where the panel docks when minimized. Default `preserve`. */
  minimizedAnchor?: FloatingPanelMinimizedAnchor;
  /** Gap from the minimized anchor edges. Default `24`. */
  minimizedGap?: number;
  /** Element whose right edge the minimized panel sits next to (`bottom-left` only). */
  minimizedBesideSelector?: string;
  /** Element whose top edge the minimized panel sits above (`bottom-left` only). */
  minimizedAboveSelector?: string;
  /** Where the panel docks when restored from minimize. Default `preserve`. */
  restoredAnchor?: FloatingPanelRestoredAnchor;
  /** Gap from the restored anchor edges. Default `10`. */
  restoredGap?: number;
  /** Element whose left edge the restored panel sits before (`top-right` only). */
  restoredBeforeSelector?: string;
  /** Element whose bottom edge the restored panel sits below (`top-right` only). */
  restoredBelowSelector?: string;
  /** Element whose top edge the restored panel sits above (`top-right` only). */
  restoredAboveSelector?: string;
  zIndexClassName?: string;
  enableMaximize?: boolean;
  enableMinimize?: boolean;
  showCloseButton?: boolean;
  enableDrag?: boolean;
  enableResize?: boolean;
  dragFromHeaderOnly?: boolean;
  borderClassName?: string;
  className?: string;
};

/**
 * Compact floating toolbox panel — search band, accordion body, and list rows.
 * Built on FloatingPanelShell with workflow palette defaults.
 */
export const ToolboxPanelShell = React.forwardRef<FloatingPanelShellHandle, ToolboxPanelShellProps>(({
  open,
  onClose,
  title,
  titleIcon,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'toolbox…',
  searchAriaLabel = 'Search toolbox',
  children,
  bounds = TOOLBOX_PANEL_DEFAULT_BOUNDS,
  defaultWidth = 300,
  defaultHeight = 560,
  initialPosition = 'bottom-right',
  minimizedAnchor = 'preserve',
  minimizedGap,
  minimizedBesideSelector,
  minimizedAboveSelector,
  restoredAnchor,
  restoredGap,
  restoredBeforeSelector,
  restoredBelowSelector,
  restoredAboveSelector,
  zIndexClassName = 'z-[90]',
  enableMaximize = false,
  enableMinimize = false,
  showCloseButton = true,
  enableDrag = true,
  enableResize = true,
  dragFromHeaderOnly = false,
  borderClassName,
  className,
  colorSource = 'accent',
  tone = 'slate',
  customColorHex,
}, ref) => (
  <FloatingPanelShell
    ref={ref}
    open={open}
    onClose={onClose}
    title={title}
    titleIcon={titleIcon}
    colorSource={colorSource}
    tone={tone}
    customColorHex={customColorHex}
    bounds={bounds}
    defaultWidth={defaultWidth}
    defaultHeight={defaultHeight}
    initialPosition={initialPosition}
    minimizedAnchor={minimizedAnchor}
    minimizedGap={minimizedGap}
    minimizedBesideSelector={minimizedBesideSelector}
    minimizedAboveSelector={minimizedAboveSelector}
    restoredAnchor={restoredAnchor}
    restoredGap={restoredGap}
    restoredBeforeSelector={restoredBeforeSelector}
    restoredBelowSelector={restoredBelowSelector}
    restoredAboveSelector={restoredAboveSelector}
    zIndexClassName={zIndexClassName}
    enableMaximize={enableMaximize}
    enableMinimize={enableMinimize}
    showCloseButton={showCloseButton}
    enableDrag={enableDrag}
    enableResize={enableResize}
    dragFromHeaderOnly={dragFromHeaderOnly}
    borderClassName={borderClassName}
    bodyClassName={cn(UI_CHROME_NO_SELECT_CLASS, '[&_input]:!select-none [&_textarea]:!select-none')}
    headerClassName={TOOLBOX_PANEL_HEADER_CLASS}
    titleClassName={TOOLBOX_PANEL_TITLE_CLASS}
    headerBand={(
      <div className={TOOLBOX_PANEL_SEARCH_HOST_CLASS}>
        <AppSearchBox
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          ariaLabel={searchAriaLabel}
          className="!min-h-0 gap-1.5 px-2 py-1 [&>svg:first-child]:h-3 [&>svg:first-child]:w-3"
        />
      </div>
    )}
  >
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
      {children}
    </div>
  </FloatingPanelShell>
));

ToolboxPanelShell.displayName = 'ToolboxPanelShell';

export type ToolboxPanelSectionProps = {
  id: string;
  label: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Optional control after the truncated label (hint icon, trailing actions). */
  labelExtra?: React.ReactNode;
};

export const ToolboxPanelSection: React.FC<ToolboxPanelSectionProps> = ({
  id,
  label,
  expanded,
  onToggle,
  children,
  className,
  bodyClassName,
  labelExtra,
}) => (
  <div
    className={cn(
      TOOLBOX_PANEL_SECTION_CLASS,
      expanded ? TOOLBOX_PANEL_SECTION_EXPANDED_CLASS : TOOLBOX_PANEL_SECTION_COLLAPSED_CLASS,
      className,
    )}
  >
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={TOOLBOX_PANEL_SECTION_HEADER_CLASS}
      aria-expanded={expanded}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <span className="truncate">{label}</span>
        {labelExtra}
      </span>
      {expanded
        ? <ChevronsUp className={TOOLBOX_PANEL_SECTION_CHEVRON_CLASS} />
        : <ChevronsDown className={TOOLBOX_PANEL_SECTION_CHEVRON_CLASS} />}
    </button>
    {expanded ? (
      <div className={cn(TOOLBOX_PANEL_SECTION_BODY_CLASS, bodyClassName)}>
        {children}
      </div>
    ) : null}
  </div>
);

export type ToolboxPanelItemProps = {
  label: string;
  description?: string;
  /** When false, description stays in the HeroUI hint only (inline band hidden). Default true. */
  showDescriptionInline?: boolean;
  accentColor?: string;
  icon: React.ReactNode;
  onActivate?: () => void;
  /** When `dblclick`, `onActivate` fires on double-click only. Default `click`. */
  activateOn?: 'click' | 'dblclick';
  draggable?: boolean;
  onDragStart?: React.DragEventHandler<HTMLButtonElement>;
  onDragEnd?: React.DragEventHandler<HTMLButtonElement>;
  className?: string;
};

function useTruncationObserver(enabled: boolean) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  const measure = React.useCallback(() => {
    const el = ref.current;
    if (!el) {
      setIsTruncated(false);
      return;
    }
    setIsTruncated(el.scrollWidth > el.clientWidth + 0.5);
  }, []);

  React.useLayoutEffect(() => {
    if (!enabled) {
      setIsTruncated(false);
      return;
    }
    measure();
  }, [enabled, measure]);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, measure]);

  return { ref, isTruncated };
}

export const ToolboxPanelItem: React.FC<ToolboxPanelItemProps> = ({
  label,
  description,
  showDescriptionInline = true,
  accentColor,
  icon,
  onActivate,
  activateOn = 'click',
  draggable = false,
  onDragStart,
  onDragEnd,
  className,
}) => {
  const trimmedDescription = description?.trim() ?? '';
  const showInlineDescription = showDescriptionInline && trimmedDescription;
  const { ref: descriptionRef, isTruncated: descriptionTruncated } = useTruncationObserver(showInlineDescription);

  const hintText = trimmedDescription || label;
  const shouldShowHint = trimmedDescription
    ? (showInlineDescription ? descriptionTruncated : true)
    : false;

  const button = (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseDown={draggable ? (event) => {
        if (event.button === 0) {
          window.getSelection()?.removeAllRanges();
        }
      } : undefined}
      onClick={activateOn === 'click' ? onActivate : undefined}
      onDoubleClick={activateOn === 'dblclick' ? onActivate : undefined}
      aria-label={trimmedDescription ? `${label} — ${trimmedDescription}` : label}
      className={cn(TOOLBOX_PANEL_ITEM_CLASS, className)}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center"
        style={accentColor ? { color: accentColor } : undefined}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium leading-tight text-slate-700">{label}</span>
        {showInlineDescription ? (
          <span
            ref={descriptionRef}
            className="mt-0.5 block truncate text-[10px] leading-tight text-slate-400"
          >
            {trimmedDescription}
          </span>
        ) : null}
      </span>
    </button>
  );

  if (!shouldShowHint) {
    return button;
  }

  return (
    <SideHintTooltip
      content={hintText}
      className="block w-full min-w-0"
    >
      {button}
    </SideHintTooltip>
  );
};

export type ToolboxPanelEmptyStateProps = {
  children: React.ReactNode;
  className?: string;
};

export const ToolboxPanelEmptyState: React.FC<ToolboxPanelEmptyStateProps> = ({
  children,
  className,
}) => (
  <div className={cn(TOOLBOX_PANEL_EMPTY_STATE_CLASS, className)}>
    {children}
  </div>
);

export type ToolboxPanelScrollBodyProps = {
  children: React.ReactNode;
  className?: string;
};

export const ToolboxPanelScrollBody: React.FC<ToolboxPanelScrollBodyProps> = ({
  children,
  className,
}) => (
  <div className={cn('min-h-0 flex-1 overflow-y-auto', className)}>
    {children}
  </div>
);
