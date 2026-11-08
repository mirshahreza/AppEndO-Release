import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  APP_SURFACE_BOX_BODY_CLASS,
  APP_SURFACE_BOX_SHELL_CLASS,
  APP_SURFACE_BOX_TONE_CLASS,
  type AppSurfaceBoxTone,
} from './surfaceClasses';
import { SurfaceChromeProvider, useSurfaceChrome } from './SurfaceChromeContext';
import type { SurfaceChromeProps } from './SurfaceChromeContext';
import { WorkspaceVerticalSplitHandle } from './WorkspaceVerticalSplitHandle';
import { useWorkspaceVerticalSplitPanel } from './useWorkspaceVerticalSplitPanel';
import { WORKSPACE_SPLIT_PANEL_KEYS } from './workspaceSplitStorage';
import {
  type ComponentLayoutPreset,
  resolveComponentLayoutPreset,
} from './componentLayoutPresets';

export type ComponentLayoutDensity = 'compact' | 'default';

export type ComponentLayoutRegionChrome = SurfaceChromeProps & {
  tone?: AppSurfaceBoxTone;
};

export type ComponentLayoutRegionConfig = {
  title?: React.ReactNode;
  titleIcon?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  showHeader?: boolean;
  showTitle?: boolean;
  showIcon?: boolean;
  showSubtitle?: boolean;
  collapsible?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  chrome?: ComponentLayoutRegionChrome;
  bodyClassName?: string;
  className?: string;
};

export type ComponentLayoutSplitOptions = {
  enabled?: boolean;
  collapsible?: boolean;
  persist?: boolean;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
};

export type ComponentLayoutRootHeightMode = 'content' | 'fill';

export type UiComponentLayoutProps = {
  preset?: ComponentLayoutPreset;
  direction?: 'ltr' | 'rtl';
  /** @deprecated Use heightMode on the root container instead. */
  fill?: boolean;
  heightMode?: ComponentLayoutRootHeightMode;
  density?: ComponentLayoutDensity;
  showHeader?: boolean;
  showFooter?: boolean;
  showStartAside?: boolean;
  showEndAside?: boolean;
  startAsideSplit?: boolean | ComponentLayoutSplitOptions;
  endAsideSplit?: boolean | ComponentLayoutSplitOptions;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  startAside?: React.ReactNode;
  endAside?: React.ReactNode;
  headerConfig?: ComponentLayoutRegionConfig;
  footerConfig?: ComponentLayoutRegionConfig;
  startAsideConfig?: ComponentLayoutRegionConfig;
  endAsideConfig?: ComponentLayoutRegionConfig;
  mainConfig?: ComponentLayoutRegionConfig;
  className?: string;
  bodyClassName?: string;
  /** Remove flex gaps so the layout flush-aligns with its host edges (top, left, right). */
  flushEdges?: boolean;
  children: React.ReactNode;
};

const DENSITY_HEADER_CLASS: Record<ComponentLayoutDensity, string> = {
  compact: 'px-2.5 py-1.5',
  default: 'px-3 py-2',
};

const DENSITY_BODY_CLASS: Record<ComponentLayoutDensity, string> = {
  compact: 'p-2',
  default: 'p-3',
};

const DENSITY_FOOTER_CLASS: Record<ComponentLayoutDensity, string> = {
  compact: 'px-2.5 py-1.5',
  default: 'px-3 py-2',
};

const DEFAULT_SPLIT_OPTIONS: ComponentLayoutSplitOptions = {
  enabled: true,
  collapsible: true,
  persist: true,
  defaultSize: 220,
  minSize: 140,
  maxSize: 480,
};

function normalizeSplitOptions(
  value: boolean | ComponentLayoutSplitOptions | undefined,
): ComponentLayoutSplitOptions {
  if (value === false || value === undefined) {
    return { ...DEFAULT_SPLIT_OPTIONS, enabled: false };
  }
  if (value === true) {
    return { ...DEFAULT_SPLIT_OPTIONS, enabled: true };
  }
  return { ...DEFAULT_SPLIT_OPTIONS, ...value, enabled: value.enabled ?? true };
}

type ComponentLayoutRegionPanelProps = {
  regionKey: string;
  density: ComponentLayoutDensity;
  fill?: boolean;
  config?: ComponentLayoutRegionConfig;
  children: React.ReactNode;
};

const ComponentLayoutRegionPanel: React.FC<ComponentLayoutRegionPanelProps> = ({
  regionKey,
  density,
  fill = false,
  config,
  children,
}) => {
  const chromeOptions = config?.chrome ?? {};
  const tone = chromeOptions.tone ?? 'slate';
  const tokens = APP_SURFACE_BOX_TONE_CLASS[tone];
  const collapsible = Boolean(config?.collapsible);
  const isControlled = config?.open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(config?.defaultOpen ?? true);
  const isOpen = collapsible ? (isControlled ? Boolean(config?.open) : uncontrolledOpen) : true;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      config?.onOpenChange?.(next);
    },
    [config, isControlled],
  );

  const toggleOpen = React.useCallback(() => {
    if (!collapsible) return;
    setOpen(!isOpen);
  }, [collapsible, isOpen, setOpen]);

  const showTitle = config?.showTitle ?? Boolean(config?.title);
  const showIcon = config?.showIcon ?? Boolean(config?.titleIcon);
  const showSubtitle = config?.showSubtitle ?? Boolean(config?.subtitle);
  const showHeaderBand = (config?.showHeader ?? true)
    && (showTitle || showIcon || showSubtitle || config?.headerExtra || collapsible);

  const headerContent = showTitle ? config?.title : null;
  const regionFooter = config?.footer;

  return (
    <SurfaceChromeProvider
      colorSource={chromeOptions.colorSource}
      tone={chromeOptions.tone}
      customColorHex={chromeOptions.customColorHex}
    >
      <ComponentLayoutRegionChromeShell
        regionKey={regionKey}
        density={density}
        fill={fill}
        tone={tone}
        tokens={tokens}
        showHeaderBand={showHeaderBand}
        showTitle={showTitle}
        showIcon={showIcon}
        showSubtitle={showSubtitle}
        headerContent={headerContent}
        titleIcon={config?.titleIcon}
        subtitle={config?.subtitle}
        headerExtra={config?.headerExtra}
        collapsible={collapsible}
        isOpen={isOpen}
        toggleOpen={toggleOpen}
        regionFooter={regionFooter}
        bodyClassName={config?.bodyClassName}
        className={config?.className}
      >
        {children}
      </ComponentLayoutRegionChromeShell>
    </SurfaceChromeProvider>
  );
};

type ComponentLayoutRegionChromeShellProps = {
  regionKey: string;
  density: ComponentLayoutDensity;
  fill?: boolean;
  tone: AppSurfaceBoxTone;
  tokens: ReturnType<typeof APP_SURFACE_BOX_TONE_CLASS>[AppSurfaceBoxTone];
  showHeaderBand: boolean;
  showTitle: boolean;
  showIcon: boolean;
  showSubtitle: boolean;
  headerContent: React.ReactNode;
  titleIcon?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerExtra?: React.ReactNode;
  collapsible: boolean;
  isOpen: boolean;
  toggleOpen: () => void;
  regionFooter?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
  children: React.ReactNode;
};

const ComponentLayoutRegionChromeShell: React.FC<ComponentLayoutRegionChromeShellProps> = ({
  regionKey,
  density,
  fill,
  tone,
  tokens,
  showHeaderBand,
  showTitle,
  showIcon,
  showSubtitle,
  headerContent,
  titleIcon,
  subtitle,
  headerExtra,
  collapsible,
  isOpen,
  toggleOpen,
  regionFooter,
  bodyClassName,
  className,
  children,
}) => {
  const chrome = useSurfaceChrome();

  return (
    <div
      className={cn(
        APP_SURFACE_BOX_SHELL_CLASS,
        chrome.shell,
        tokens.shell,
        fill ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'shrink-0',
        className,
      )}
      data-component-layout-region={regionKey}
      data-tone={tone}
      data-collapsed={collapsible ? (isOpen ? 'false' : 'true') : undefined}
    >
      {showHeaderBand ? (
        <div
          className={cn(
            'flex items-center gap-2 border-b',
            chrome.header,
            chrome.headerBand,
            DENSITY_HEADER_CLASS[density],
            collapsible ? 'cursor-pointer select-none' : null,
          )}
          role={collapsible ? 'button' : undefined}
          tabIndex={collapsible ? 0 : undefined}
          aria-expanded={collapsible ? isOpen : undefined}
          onClick={collapsible ? toggleOpen : undefined}
          onKeyDown={
            collapsible
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleOpen();
                  }
                }
              : undefined
          }
        >
          {collapsible ? (
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform',
                isOpen ? 'rotate-0' : '-rotate-90',
              )}
              aria-hidden
            />
          ) : null}
          {showIcon && titleIcon ? (
            <span className="inline-flex shrink-0 items-center overflow-hidden text-slate-600 [&_svg]:shrink-0" aria-hidden>
              {titleIcon}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            {showTitle && headerContent ? (
              <p className={cn('truncate text-sm font-semibold', chrome.title)}>{headerContent}</p>
            ) : null}
            {showSubtitle && subtitle ? (
              <p className="truncate text-xs text-slate-600">{subtitle}</p>
            ) : null}
          </div>
          {headerExtra ? <div className="shrink-0">{headerExtra}</div> : null}
        </div>
      ) : null}
      {isOpen ? (
        <div
          className={cn(
            fill ? 'flex min-h-0 flex-1 flex-col overflow-auto' : null,
            DENSITY_BODY_CLASS[density],
            APP_SURFACE_BOX_BODY_CLASS,
            bodyClassName,
          )}
        >
          {children}
        </div>
      ) : null}
      {isOpen && regionFooter ? (
        <div className={cn('border-t text-xs text-slate-600', chrome.footer, DENSITY_FOOTER_CLASS[density])}>
          {regionFooter}
        </div>
      ) : null}
    </div>
  );
};

type SplitAsideHostProps = {
  side: 'start' | 'end';
  split: ComponentLayoutSplitOptions;
  panelKey: typeof WORKSPACE_SPLIT_PANEL_KEYS[keyof typeof WORKSPACE_SPLIT_PANEL_KEYS];
  containerRef: React.RefObject<HTMLElement | null>;
  density: ComponentLayoutDensity;
  config?: ComponentLayoutRegionConfig;
  children: React.ReactNode;
};

const SplitAsideHost: React.FC<SplitAsideHostProps> = ({
  side,
  split,
  panelKey,
  containerRef,
  density,
  config,
  children,
}) => {
  const splitPanel = useWorkspaceVerticalSplitPanel({
    panelKey,
    defaultSize: split.defaultSize ?? DEFAULT_SPLIT_OPTIONS.defaultSize!,
    minSize: split.minSize ?? DEFAULT_SPLIT_OPTIONS.minSize!,
    maxSize: split.maxSize ?? DEFAULT_SPLIT_OPTIONS.maxSize!,
    measure: side === 'start' ? 'leading' : 'trailing',
    containerRef,
    side,
    collapsible: split.collapsible,
    persist: split.persist,
  });

  if (!split.enabled) {
    return (
      <div className="flex min-h-0 min-w-0 shrink-0 flex-col" style={{ width: split.defaultSize }}>
        <ComponentLayoutRegionPanel regionKey={side} density={density} fill config={config}>
          {children}
        </ComponentLayoutRegionPanel>
      </div>
    );
  }

  return (
    <>
      {side === 'end' ? null : (
        <div
          className="flex min-h-0 shrink-0 flex-col overflow-hidden"
          style={{ width: splitPanel.size > 0 ? splitPanel.size : undefined }}
        >
          {splitPanel.size > 0 ? (
            <ComponentLayoutRegionPanel regionKey={side} density={density} fill config={config}>
              {children}
            </ComponentLayoutRegionPanel>
          ) : null}
        </div>
      )}
      <WorkspaceVerticalSplitHandle {...splitPanel.splitHandleProps} />
      {side === 'start' ? null : (
        <div
          className="flex min-h-0 shrink-0 flex-col overflow-hidden"
          style={{ width: splitPanel.size > 0 ? splitPanel.size : undefined }}
        >
          {splitPanel.size > 0 ? (
            <ComponentLayoutRegionPanel regionKey={side} density={density} fill config={config}>
              {children}
            </ComponentLayoutRegionPanel>
          ) : null}
        </div>
      )}
    </>
  );
};

export const UiComponentLayout: React.FC<UiComponentLayoutProps> = ({
  preset = 'form',
  direction = 'ltr',
  fill,
  heightMode,
  density = 'default',
  showHeader: showHeaderProp,
  showFooter: showFooterProp,
  showStartAside: showStartAsideProp,
  showEndAside: showEndAsideProp,
  startAsideSplit: startAsideSplitProp,
  endAsideSplit: endAsideSplitProp,
  header,
  footer,
  startAside,
  endAside,
  headerConfig,
  footerConfig,
  startAsideConfig,
  endAsideConfig,
  mainConfig,
  className,
  bodyClassName,
  flushEdges = false,
  children,
}) => {
  const resolvedHeightMode: ComponentLayoutRootHeightMode = heightMode ?? (fill === false ? 'content' : 'fill');
  const isFillHeight = resolvedHeightMode === 'fill';
  const gapClass = flushEdges ? 'gap-0' : 'gap-2';

  const presetDefaults = resolveComponentLayoutPreset(preset);
  const showHeader = showHeaderProp ?? presetDefaults.showHeader;
  const showFooter = showFooterProp ?? presetDefaults.showFooter;
  const showStartAside = showStartAsideProp ?? presetDefaults.showStartAside;
  const showEndAside = showEndAsideProp ?? presetDefaults.showEndAside;
  const startAsideSplit = normalizeSplitOptions(
    startAsideSplitProp ?? presetDefaults.startAsideSplit,
  );
  const endAsideSplit = normalizeSplitOptions(
    endAsideSplitProp ?? presetDefaults.endAsideSplit,
  );

  const bodyRef = React.useRef<HTMLDivElement>(null);

  const headerRegion = showHeader
    ? (header ?? (
      <ComponentLayoutRegionPanel regionKey="header" density={density} config={headerConfig}>
        <p className="text-xs text-slate-600">Header band — titles, actions, and context.</p>
      </ComponentLayoutRegionPanel>
    ))
    : null;

  const footerRegion = showFooter
    ? (footer ?? (
      <ComponentLayoutRegionPanel regionKey="footer" density={density} config={footerConfig}>
        <p className="text-xs text-slate-600">Footer band — primary actions or status.</p>
      </ComponentLayoutRegionPanel>
    ))
    : null;

  const mainRegion = (
    <ComponentLayoutRegionPanel regionKey="main" density={density} fill={isFillHeight} config={mainConfig}>
      {children}
    </ComponentLayoutRegionPanel>
  );

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col',
        isFillHeight ? 'h-full min-h-0 flex-1 overflow-hidden' : 'h-auto',
        className,
      )}
      dir={direction}
      data-component-layout-root
      data-component-layout-height-mode={resolvedHeightMode}
      data-component-layout-preset={preset}
      data-component-layout-density={density}
    >
      <div
        className={cn(
          'flex min-w-0 flex-col',
          gapClass,
          isFillHeight ? 'min-h-0 flex-1 overflow-hidden' : null,
        )}
      >
        {headerRegion}
        <div
          ref={bodyRef}
          className={cn(
            'flex min-w-0 flex-1 flex-row',
            gapClass,
            isFillHeight ? 'min-h-0 overflow-hidden' : null,
            bodyClassName,
          )}
        >
        {showStartAside ? (
          <SplitAsideHost
            side="start"
            split={startAsideSplit}
            panelKey={WORKSPACE_SPLIT_PANEL_KEYS.componentLayoutStartAside}
            containerRef={bodyRef}
            density={density}
            config={startAsideConfig}
          >
            {startAside ?? (
              <p className="text-xs text-slate-600">Start aside — navigation or tool palette.</p>
            )}
          </SplitAsideHost>
        ) : null}

        <div className={cn('flex min-h-0 min-w-0 flex-1 flex-row', gapClass)}>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{mainRegion}</div>
          {showEndAside ? (
            <SplitAsideHost
              side="end"
              split={endAsideSplit}
              panelKey={WORKSPACE_SPLIT_PANEL_KEYS.componentLayoutEndAside}
              containerRef={bodyRef}
              density={density}
              config={endAsideConfig}
            >
              {endAside ?? (
                <p className="text-xs text-slate-600">End aside — inspector or preview rail.</p>
              )}
            </SplitAsideHost>
          ) : null}
        </div>
        </div>
        {footerRegion}
      </div>
    </div>
  );
};

export {
  COMPONENT_LAYOUT_PRESET_MAP,
  type ComponentLayoutPreset,
  resolveComponentLayoutPreset,
} from './componentLayoutPresets';
