import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Check, Monitor, Scaling, Smartphone, Tablet } from 'lucide-react';
import {
  AppSplitButton,
  SplitButtonMenuItem,
  UiInputCore,
} from '../../../shared/ui';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import { ViewportTierContext } from '../../../shared/lib/ViewportTierProvider';
import { resolveViewportTier, type ViewportTier } from '../../../shared/lib/viewportTokens';
import { cn } from '../../../lib/utils';

export type BaseComponentsPreviewSizeMode = 'phone' | 'tablet' | 'desktop' | 'responsive';

/** Resolved tier used by grids and compact chrome. */
export type BaseComponentsPreviewViewport = Extract<ViewportTier, 'phone' | 'tablet' | 'desktop'>;

export type BaseComponentsPreviewCustomSize = {
  width: number;
  height: number;
};

export const BASE_COMPONENTS_PREVIEW_VIEWPORT_OPTIONS = [
  { value: 'phone', label: 'Phone', icon: Smartphone },
  { value: 'tablet', label: 'Tablet', icon: Tablet },
  { value: 'desktop', label: 'Desktop', icon: Monitor },
  { value: 'responsive', label: 'Responsive', icon: Scaling },
] as const;

export const DEFAULT_BASE_COMPONENTS_PREVIEW_SIZE_MODE: BaseComponentsPreviewSizeMode = 'desktop';
export const DEFAULT_BASE_COMPONENTS_PREVIEW_VIEWPORT: BaseComponentsPreviewViewport = 'desktop';

export const BASE_COMPONENTS_PREVIEW_PRESET_SIZE: Record<
  Exclude<BaseComponentsPreviewSizeMode, 'responsive'>,
  BaseComponentsPreviewCustomSize
> = {
  phone: { width: 390, height: 720 },
  tablet: { width: 760, height: 900 },
  desktop: { width: 1280, height: 800 },
};

const MIN_PREVIEW_WIDTH = 320;
const MIN_PREVIEW_HEIGHT = 240;
const MAX_PREVIEW_WIDTH = 1920;
const MAX_PREVIEW_HEIGHT = 1600;

type BaseComponentsPreviewViewportContextValue = {
  sizeMode: BaseComponentsPreviewSizeMode;
  setSizeMode: (next: BaseComponentsPreviewSizeMode) => void;
  customSize: BaseComponentsPreviewCustomSize;
  setCustomSize: (next: BaseComponentsPreviewCustomSize) => void;
  viewportTier: ViewportTier;
};

const BaseComponentsPreviewViewportContext = createContext<BaseComponentsPreviewViewportContextValue | null>(null);

export function isBaseComponentsPreviewSizeMode(value: string): value is BaseComponentsPreviewSizeMode {
  return value === 'phone' || value === 'tablet' || value === 'desktop' || value === 'responsive';
}

export function clampPreviewCustomSize(size: BaseComponentsPreviewCustomSize): BaseComponentsPreviewCustomSize {
  return {
    width: Math.min(MAX_PREVIEW_WIDTH, Math.max(MIN_PREVIEW_WIDTH, Math.round(size.width))),
    height: Math.min(MAX_PREVIEW_HEIGHT, Math.max(MIN_PREVIEW_HEIGHT, Math.round(size.height))),
  };
}

export function resolvePreviewViewportTier(
  mode: BaseComponentsPreviewSizeMode,
  customWidth: number,
): ViewportTier {
  if (mode === 'responsive') {
    return resolveViewportTier(customWidth);
  }
  return mode;
}

/** Explicit device/custom box. Desktop fills the preview pane. */
export function resolvePreviewFrameSize(
  sizeMode: BaseComponentsPreviewSizeMode,
  customSize: BaseComponentsPreviewCustomSize,
): BaseComponentsPreviewCustomSize | null {
  if (sizeMode === 'desktop') {
    return null;
  }
  if (sizeMode === 'responsive') {
    return customSize;
  }
  return BASE_COMPONENTS_PREVIEW_PRESET_SIZE[sizeMode];
}

export function resolveBaseComponentsPreviewFrameClass(viewport: BaseComponentsPreviewViewport): string {
  if (viewport === 'phone') {
    return 'mx-auto w-full max-w-[390px]';
  }
  if (viewport === 'tablet') {
    return 'mx-auto w-full max-w-[760px]';
  }
  return 'w-full min-w-0';
}

const parseDimension = (value: string, fallback: number): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const BaseComponentsPreviewViewportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sizeMode, setSizeModeState] = useState<BaseComponentsPreviewSizeMode>(
    DEFAULT_BASE_COMPONENTS_PREVIEW_SIZE_MODE,
  );
  const [customSize, setCustomSizeState] = useState<BaseComponentsPreviewCustomSize>(
    BASE_COMPONENTS_PREVIEW_PRESET_SIZE.desktop,
  );

  const setSizeMode = useCallback((next: BaseComponentsPreviewSizeMode) => {
    setSizeModeState((current) => {
      if (next === 'responsive' && current !== 'responsive') {
        setCustomSizeState(BASE_COMPONENTS_PREVIEW_PRESET_SIZE[current]);
      }
      return next;
    });
  }, []);

  const setCustomSize = useCallback((next: BaseComponentsPreviewCustomSize) => {
    setCustomSizeState(clampPreviewCustomSize(next));
  }, []);

  const viewportTier = resolvePreviewViewportTier(sizeMode, customSize.width);
  const value = useMemo(
    () => ({ sizeMode, setSizeMode, customSize, setCustomSize, viewportTier }),
    [customSize, setCustomSize, setSizeMode, sizeMode, viewportTier],
  );

  return (
    <BaseComponentsPreviewViewportContext.Provider value={value}>
      {children}
    </BaseComponentsPreviewViewportContext.Provider>
  );
};

export function useBaseComponentsPreviewViewport(): ViewportTier {
  return useContext(BaseComponentsPreviewViewportContext)?.viewportTier
    ?? DEFAULT_BASE_COMPONENTS_PREVIEW_VIEWPORT;
}

function usePreviewViewportController(): BaseComponentsPreviewViewportContextValue | null {
  return useContext(BaseComponentsPreviewViewportContext);
}

const SIZE_MODE_LABEL: Record<BaseComponentsPreviewSizeMode, string> = {
  phone: 'Phone',
  tablet: 'Tablet',
  desktop: 'Desktop',
  responsive: 'Responsive',
};

export const BaseComponentsPreviewViewportSelect: React.FC = () => {
  const context = usePreviewViewportController();
  const [menuOpen, setMenuOpen] = useState(false);
  const sizeMode = context?.sizeMode ?? DEFAULT_BASE_COMPONENTS_PREVIEW_SIZE_MODE;
  const customSize = context?.customSize ?? BASE_COMPONENTS_PREVIEW_PRESET_SIZE.desktop;
  const ActiveIcon = BASE_COMPONENTS_PREVIEW_VIEWPORT_OPTIONS.find((option) => option.value === sizeMode)?.icon
    ?? Monitor;

  return (
    <div
      className="flex shrink-0 items-center gap-2"
      {...pageGuideLocalProps(
        'Preview size',
        'Switch the preview pane between phone, tablet, desktop, or a custom responsive size. Compact widths also set the viewport tier used by grids, dialogs, and other responsive chrome.',
        18,
      )}
    >
      <AppSplitButton
        intent="utility"
        size="sm"
        isOpen={menuOpen}
        onOpenChange={setMenuOpen}
        menuFixed
        menuAlign="end"
        icon={<ActiveIcon className="h-3.5 w-3.5" />}
        label={SIZE_MODE_LABEL[sizeMode]}
        menuAriaLabel="Preview size options"
        triggerAriaLabel="Preview size"
      >
        {BASE_COMPONENTS_PREVIEW_VIEWPORT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = option.value === sizeMode;
          return (
            <SplitButtonMenuItem
              key={option.value}
              icon={<Icon className="h-3.5 w-3.5" />}
              aria-selected={selected}
              onClick={() => {
                context?.setSizeMode(option.value);
                setMenuOpen(false);
              }}
            >
              <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                {option.label}
                {selected ? <Check className="h-3.5 w-3.5 text-cyan-600" /> : null}
              </span>
            </SplitButtonMenuItem>
          );
        })}
      </AppSplitButton>
      {sizeMode === 'responsive' ? (
        <div className="flex items-center gap-1">
          <UiInputCore
            size="sm"
            type="number"
            min={MIN_PREVIEW_WIDTH}
            max={MAX_PREVIEW_WIDTH}
            value={String(customSize.width)}
            ariaLabel="Preview width"
            className="w-[4.5rem]"
            autoDir={false}
            onChange={(event) => {
              context?.setCustomSize({
                width: parseDimension(event.target.value, customSize.width),
                height: customSize.height,
              });
            }}
          />
          <span className="text-xs font-semibold text-cyan-700" aria-hidden>×</span>
          <UiInputCore
            size="sm"
            type="number"
            min={MIN_PREVIEW_HEIGHT}
            max={MAX_PREVIEW_HEIGHT}
            value={String(customSize.height)}
            ariaLabel="Preview height"
            className="w-[4.5rem]"
            autoDir={false}
            onChange={(event) => {
              context?.setCustomSize({
                width: customSize.width,
                height: parseDimension(event.target.value, customSize.height),
              });
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

export const BaseComponentsPreviewViewportHost: React.FC<{
  viewport?: BaseComponentsPreviewViewport;
  children: React.ReactNode;
}> = ({ viewport, children }) => {
  const context = usePreviewViewportController();
  const sizeMode: BaseComponentsPreviewSizeMode = viewport
    ?? context?.sizeMode
    ?? DEFAULT_BASE_COMPONENTS_PREVIEW_SIZE_MODE;
  const customSize = context?.customSize ?? BASE_COMPONENTS_PREVIEW_PRESET_SIZE.desktop;
  const viewportTier = viewport ?? context?.viewportTier ?? DEFAULT_BASE_COMPONENTS_PREVIEW_VIEWPORT;
  const frameSize = resolvePreviewFrameSize(sizeMode, customSize);
  const isFramed = frameSize != null;
  const isResponsive = !viewport && sizeMode === 'responsive';
  const dragRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: customSize.width,
      startHeight: customSize.height,
    };
    setIsResizing(true);
  };

  const handleResizePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) {
      return;
    }
    context?.setCustomSize({
      width: dragRef.current.startWidth + (event.clientX - dragRef.current.startX),
      height: dragRef.current.startHeight + (event.clientY - dragRef.current.startY),
    });
  };

  const endResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) {
      return;
    }
    dragRef.current = null;
    setIsResizing(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <ViewportTierContext.Provider value={viewportTier}>
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          isFramed ? 'overflow-auto bg-slate-50 p-3' : 'h-full min-h-0',
        )}
        data-bc-preview-viewport={isResponsive ? 'responsive' : viewportTier}
        data-bc-preview-width={frameSize?.width}
        data-bc-preview-height={frameSize?.height}
      >
        <div
          className={cn(
            'relative flex min-h-0 min-w-0 flex-col bg-white',
            isFramed
              ? 'mx-auto shrink-0 overflow-hidden shadow-[0_0_0_1px_rgba(15,23,42,0.08)]'
              : 'h-full min-h-0 w-full flex-1',
          )}
          style={frameSize
            ? { width: frameSize.width, height: frameSize.height }
            : undefined}
        >
          {children}
          {isResponsive ? (
            <>
              <span
                className={cn(
                  'pointer-events-none absolute bottom-5 end-1 z-10 rounded-md border border-slate-200 bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm',
                  !isResizing && 'opacity-0',
                )}
              >
                {customSize.width} × {customSize.height}
              </span>
              <button
                type="button"
                className="absolute bottom-0 end-0 z-10 h-4 w-4 cursor-se-resize rounded-none border border-slate-300 bg-white/90 text-slate-500 hover:bg-cyan-50 hover:text-cyan-700"
                aria-label="Resize preview"
                onPointerDown={handleResizePointerDown}
                onPointerMove={handleResizePointerMove}
                onPointerUp={endResize}
                onPointerCancel={endResize}
              >
                <span className="pointer-events-none block text-[9px] leading-none">\\</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
    </ViewportTierContext.Provider>
  );
};
