import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Minus, Square, SquareStack, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';
import { AppButton } from './AppButton';
import {
  FLOATING_PANEL_SHELL_BASE_CLASS,
  FLOATING_PANEL_SHELL_CHROME_BORDER_CLASS,
  resolveSurfaceChrome,
  type SurfaceChromeColorSource,
} from './surfaceChromeClasses';
import {
  DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS,
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_CANCEL_CLASS,
  PAGE_HEADER_ICON_TITLE_CLUSTER_CLASS,
  type AppSurfaceBoxTone,
} from './surfaceClasses';
import { subscribeFloatingPanelStack } from './floatingPanelStack';
import { WindowChromeFeedbackButton } from './shell/registeredWindowChromeFeedback';
import { WindowChromeStudioToolsMenu } from './shell/registeredStudioToolsMenu';
import { INLINE_TRANSLATION_SCAN_ROOT_ATTR } from './shell/inlineTranslationScanRoot';
import {
  useFloatingPanel,
  type FloatingPanelBounds,
  type FloatingPanelInitialPosition,
  type FloatingPanelMinimizedAnchor,
  type FloatingPanelRestoredAnchor,
  type FloatingPanelInitialOffset,
} from './useFloatingPanel';

const DEFAULT_DRAG_EXCLUDE_SELECTOR = [
  'input',
  'select',
  'button',
  'textarea',
  'option',
  'svg',
  'label',
  'p',
  'h3',
  '[data-panel-resize]',
  '[data-panel-maximize]',
  '[data-floating-panel-drag-exclude]',
].join(', ');

const RESIZE_HANDLE = (
  <svg viewBox="0 0 16 16" className="h-full w-full" fill="currentColor" aria-hidden>
    <path d="M14 14h-2v-2h2v2zm-4 0h-2v-2h2v2zm-4 0H4v-2h2v2zm8-4h-2V8h2v2zm-4 0h-2V8h2v2zm-4 0H4V8h2v2z" />
  </svg>
);

const WINDOW_CHROME_ICON_CLASS = 'h-[18px] w-[18px]';
const WINDOW_CLOSE_ICON_CLASS = 'h-5 w-5';

export type FloatingPanelShellProps = {
  open: boolean;
  onClose: () => void;
  onPointerDown?: () => void;
  title: string;
  titleIcon?: React.ReactNode;
  headerExtra?: React.ReactNode;
  /** Icon-only controls rendered before maximize/close; use AppButton size="icon-sm" only. */
  headerActions?: React.ReactNode;
  /** When true (default), shows Studio tools menu before window controls when registered. */
  showStudioToolsMenu?: boolean;
  /** When true (default), shows feedback entry before window controls when registered. */
  showFeedbackButton?: boolean;
  /** When false, hides the header close control. Default true. */
  showCloseButton?: boolean;
  headerBand?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  bounds: FloatingPanelBounds;
  defaultWidth: number;
  defaultHeight: number;
  initialPosition?: FloatingPanelInitialPosition;
  initialOffset?: FloatingPanelInitialOffset;
  enableDrag?: boolean;
  /** When true, only the title header row starts a drag (body/footer stay interactive). Default false. */
  dragFromHeaderOnly?: boolean;
  enableResize?: boolean;
  enableMaximize?: boolean;
  /** When true, the header shows minimize / restore instead of relying on a host toggle. Default false. */
  enableMinimize?: boolean;
  /** Opens already maximized — still toggleable via the header button. Default false. */
  initialMaximized?: boolean;
  /** When false, enter/exit animation uses opacity only (required for React Flow canvases inside the panel). Default true. */
  enterScale?: boolean;
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
  zIndex?: number;
  /** Higher layers always paint above lower ones. Same-layer windows raise on pointer/focus. Default 0. */
  stackLayer?: number;
  /** Accent theme, preset tone, or custom hex — tints border + header only. Default `accent`. */
  colorSource?: SurfaceChromeColorSource;
  /** Preset tone when `colorSource` is `tone`. Default `slate`. */
  tone?: AppSurfaceBoxTone;
  /** Custom hex when `colorSource` is `custom`. */
  customColorHex?: string;
  /** Overrides shell border from chrome resolver. */
  borderClassName?: string;
  /** Extra classes on the scrollable body (replaces the default `select-text` when provided). */
  bodyClassName?: string;
  /** Extra classes on the outer panel shell (`motion.aside`). */
  shellClassName?: string;
  /** Marker attribute on the outer shell (e.g. screenshot filtering). */
  shellMarker?: string;
  headerClassName?: string;
  titleClassName?: string;
  dragExcludeSelector?: string;
  portal?: boolean;
  /** Position inside a relative ancestor instead of the viewport — Base Components catalog. */
  contained?: boolean;
  onKeyDownCapture?: React.KeyboardEventHandler<HTMLElement>;
};

export type FloatingPanelShellHandle = {
  minimize: () => void;
  restore: () => void;
};

export const FloatingPanelShell = React.forwardRef<FloatingPanelShellHandle, FloatingPanelShellProps>(({
  open,
  onClose,
  onPointerDown,
  title,
  titleIcon,
  headerExtra,
  headerActions,
  showStudioToolsMenu = true,
  showFeedbackButton = true,
  showCloseButton = true,
  headerBand,
  footer,
  children,
  bounds,
  defaultWidth,
  defaultHeight,
  initialPosition = 'center',
  initialOffset,
  enableDrag = true,
  dragFromHeaderOnly = false,
  enableResize = true,
  enableMaximize = true,
  enableMinimize = false,
  initialMaximized = false,
  enterScale = true,
  minimizedAnchor = 'preserve',
  minimizedGap,
  minimizedBesideSelector,
  minimizedAboveSelector,
  restoredAnchor,
  restoredGap,
  restoredBeforeSelector,
  restoredBelowSelector,
  restoredAboveSelector,
  zIndexClassName = 'z-[100]',
  zIndex,
  stackLayer = 0,
  colorSource = 'accent',
  tone = 'slate',
  customColorHex,
  borderClassName,
  bodyClassName,
  shellClassName,
  shellMarker,
  headerClassName = 'h-[60px]',
  titleClassName,
  dragExcludeSelector = DEFAULT_DRAG_EXCLUDE_SELECTOR,
  portal = true,
  contained = false,
  onKeyDownCapture,
}, ref) => {
  const panel = useFloatingPanel({
    open,
    bounds,
    defaultWidth,
    defaultHeight,
    initialPosition,
    initialOffset,
    enableDrag,
    enableResize,
    enableMaximize,
    initialMaximized,
    minimizedAnchor,
    minimizedGap,
    minimizedBesideSelector,
    minimizedAboveSelector,
    restoredAnchor,
    restoredGap,
    restoredBeforeSelector,
    restoredBelowSelector,
    restoredAboveSelector,
  });

  useImperativeHandle(ref, () => ({
    minimize: panel.minimizePanel,
    restore: panel.restorePanel,
  }), [panel.minimizePanel, panel.restorePanel]);

  const [stackZ, setStackZ] = useState<number | undefined>();
  const raiseStackRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!open) {
      setStackZ(undefined);
      return undefined;
    }
    const subscription = subscribeFloatingPanelStack(setStackZ, stackLayer);
    raiseStackRef.current = subscription.raise;
    return () => {
      raiseStackRef.current = () => {};
      subscription.unregister();
    };
  }, [open, stackLayer]);

  const raisePanel = useCallback(() => {
    raiseStackRef.current();
  }, []);

  const handlePointerDownCapture = useCallback(() => {
    raisePanel();
    onPointerDown?.();
  }, [onPointerDown, raisePanel]);

  const handleDragPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(dragExcludeSelector)) {
      return;
    }
    panel.startDrag(event);
  }, [dragExcludeSelector, panel]);

  const shellCursor = dragFromHeaderOnly
    ? (panel.isResizing ? 'se-resize' : panel.isDragging ? 'grabbing' : 'default')
    : panel.panelCursor;

  const chrome = useMemo(
    () => resolveSurfaceChrome({ colorSource, tone, customColorHex }),
    [colorSource, customColorHex, tone],
  );

  const enterMotion = enterScale
    ? { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

  const resolvedZIndex = stackZ ?? zIndex;

  const content = (
    <AnimatePresence>
      {open ? (
        <motion.aside
          {...(shellMarker ? { 'data-floating-panel-marker': shellMarker } : {})}
          {...{ [INLINE_TRANSLATION_SCAN_ROOT_ATTR]: true }}
          initial={enterMotion.initial}
          animate={enterMotion.animate}
          exit={enterMotion.exit}
          transition={{ duration: 0.2 }}
          className={cn(
            contained
              ? FLOATING_PANEL_SHELL_BASE_CLASS.replace(/\bfixed\b/, 'relative')
              : FLOATING_PANEL_SHELL_BASE_CLASS,
            contained && 'max-h-full max-w-full',
            resolvedZIndex == null && !contained ? zIndexClassName : undefined,
            borderClassName ?? FLOATING_PANEL_SHELL_CHROME_BORDER_CLASS,
            borderClassName ?? chrome.shell,
            shellClassName,
          )}
          style={{
            ...(contained
              ? {
                  width: `${panel.panelSize.width}px`,
                  height: `${panel.panelSize.height}px`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                }
              : {
                  right: `${panel.panelPos.x}px`,
                  top: `${panel.panelPos.y}px`,
                  width: `${panel.panelSize.width}px`,
                  height: `${panel.panelSize.height}px`,
                }),
            cursor: shellCursor,
            zIndex: contained ? undefined : resolvedZIndex,
            ...(borderClassName ? undefined : chrome.shellStyle),
          }}
          onPointerDownCapture={handlePointerDownCapture}
          onFocusCapture={raisePanel}
          onKeyDownCapture={onKeyDownCapture}
          onPointerDown={dragFromHeaderOnly || !enableDrag ? undefined : handleDragPointerDown}
        >
          <div
            data-panel-drag-handle={dragFromHeaderOnly || undefined}
            onPointerDown={dragFromHeaderOnly && enableDrag ? handleDragPointerDown : undefined}
            className={cn(
              'flex shrink-0 select-none items-center px-4',
              enableDrag && 'touch-none',
              chrome.header,
              enableDrag && (panel.isDragging ? 'cursor-grabbing' : 'cursor-grab'),
              headerClassName,
            )}
            style={chrome.headerStyle}
          >
            {titleIcon || title ? (
              <span
                className={cn('pointer-events-none min-w-0', PAGE_HEADER_ICON_TITLE_CLUSTER_CLASS)}
                {...(typeof title === 'string' && title.trim()
                  ? pageGuideLocalProps(title.trim(), PAGE_GUIDE_EN['pageGuide.page.panel.hint'], 15)
                  : {})}
              >
                {titleIcon ? (
                  <span className="inline-flex shrink-0 items-center overflow-hidden [&_svg]:shrink-0" aria-hidden>
                    {titleIcon}
                  </span>
                ) : null}
                <span className={cn('truncate font-semibold tracking-tight', titleClassName ?? 'text-[15px]', chrome.title)}>
                  {title}
                </span>
              </span>
            ) : null}

            {headerExtra ? (
              <div className="ms-auto min-w-0">{headerExtra}</div>
            ) : null}

            {showStudioToolsMenu
              || showFeedbackButton
              || headerActions
              || (enableMaximize && !panel.isPanelMinimized)
              || enableMinimize
              || showCloseButton ? (
              <div className={cn('flex items-center gap-1', !headerExtra && 'ms-auto')} data-panel-maximize>
                {showStudioToolsMenu ? <WindowChromeStudioToolsMenu /> : null}
                {showStudioToolsMenu && showFeedbackButton ? (
                  <span className={DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS} aria-hidden />
                ) : null}
                {showFeedbackButton ? <WindowChromeFeedbackButton /> : null}
                {headerActions}
                {enableMaximize && !panel.isPanelMinimized ? (
                  <AppButton
                    type="button"
                    size="icon-sm"
                    className={cn(ICON_ACTION_BUTTON_BASE_CLASS, 'h-7 w-7', ICON_ACTION_CANCEL_CLASS)}
                    aria-label={panel.isPanelMaximized ? 'Restore floating window' : 'Maximize floating window'}
                    title={panel.isPanelMaximized ? 'Restore' : 'Maximize'}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={panel.togglePanelMaximize}
                  >
                    {panel.isPanelMaximized ? (
                      <SquareStack className={WINDOW_CHROME_ICON_CLASS} strokeWidth={2} />
                    ) : (
                      <Square className={WINDOW_CHROME_ICON_CLASS} strokeWidth={2} />
                    )}
                  </AppButton>
                ) : null}

                {enableMinimize ? (
                  panel.isPanelMinimized ? (
                    <AppButton
                      type="button"
                      size="icon-sm"
                      className={cn(ICON_ACTION_BUTTON_BASE_CLASS, 'h-7 w-7', ICON_ACTION_CANCEL_CLASS)}
                      aria-label="Restore floating window"
                      title="Restore"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={panel.restorePanel}
                    >
                      <SquareStack className={WINDOW_CHROME_ICON_CLASS} strokeWidth={2} />
                    </AppButton>
                  ) : (
                    <AppButton
                      type="button"
                      size="icon-sm"
                      className={cn(ICON_ACTION_BUTTON_BASE_CLASS, 'h-7 w-7', ICON_ACTION_CANCEL_CLASS)}
                      aria-label="Minimize floating window"
                      title="Minimize"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={panel.minimizePanel}
                    >
                      <Minus className={WINDOW_CHROME_ICON_CLASS} strokeWidth={2} />
                    </AppButton>
                  )
                ) : null}

                {showCloseButton ? (
                  <AppButton
                    closeIcon
                    className="h-7 w-7"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={onClose}
                    aria-label="Close floating window"
                  >
                    <X className={WINDOW_CLOSE_ICON_CLASS} strokeWidth={2.25} />
                  </AppButton>
                ) : null}
              </div>
            ) : null}
          </div>

          {!panel.isPanelMinimized && headerBand ? (
            <div
              className={cn('pointer-events-auto select-none [&_input]:select-text', chrome.headerBand)}
              style={chrome.headerBandStyle}
              data-floating-panel-drag-exclude
            >
              {headerBand}
            </div>
          ) : null}

          {!panel.isPanelMinimized ? (
            <div
              className={cn(
                'pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden',
                bodyClassName ?? 'select-text',
              )}
            >
              {children}
            </div>
          ) : null}

          {!panel.isPanelMinimized && footer ? (
            <div
              className={cn('pointer-events-auto shrink-0', chrome.footer)}
              style={chrome.footerStyle}
              data-floating-panel-drag-exclude
            >
              {footer}
            </div>
          ) : null}

          {enableResize && !panel.isPanelMaximized && !panel.isPanelMinimized ? (
            <div
              data-panel-resize
              className="absolute bottom-0 right-0 z-10 h-4 w-4 touch-none cursor-se-resize"
              onPointerDown={panel.startResize}
              aria-hidden
            >
              <span className={chrome.resizeHandle} style={chrome.resizeHandleStyle}>
                {RESIZE_HANDLE}
              </span>
            </div>
          ) : null}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );

  const gestureOverlay = !contained && (panel.isDragging || panel.isResizing) && typeof document !== 'undefined'
    ? createPortal(
      <div
        data-testid="floating-panel-gesture-overlay"
        aria-hidden
        className="fixed inset-0 cursor-grabbing select-none"
        style={{
          zIndex: 2147483646,
          cursor: panel.isResizing ? 'se-resize' : 'grabbing',
        }}
      />,
      document.body,
    )
    : null;

  if (contained || !portal || typeof document === 'undefined') {
    if (!gestureOverlay) {
      return content;
    }
    return (
      <>
        {content}
        {gestureOverlay}
      </>
    );
  }

  return (
    <>
      {createPortal(content, document.body)}
      {gestureOverlay}
    </>
  );
});

FloatingPanelShell.displayName = 'FloatingPanelShell';
