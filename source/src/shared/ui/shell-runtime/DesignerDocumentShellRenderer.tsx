import * as React from 'react';
import type {
  MegaMenuOptions,
  ShellRegionBase,
  ShellShapeDepth,
  ShellTypographyProfile,
  ShellBackdropTreatment,
  ShellDesignTokens,
} from '../../api/contracts/shell-designer';
import type {
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
} from '../../../domain/component-designer/types';
import {
  DesignerDocumentPreview,
  type DesignerRuntimeSlots,
  type DesignerSystemComponentRenderInput,
} from '../../../domain/component-designer/designerRuntimePreview';
import { useAccentTheme } from '../../../contexts/AccentThemeContext';
import { useShellNavigationHost } from '../../../layouts/adminShell/nav/useShellNavigationHost';
import { cn } from '../../../lib/utils';
import type { ShellNavRegionId } from '../../lib/navTreeFilter';
import {
  LANDING_WIDGET_CATALOG,
  LANDING_WIDGET_FIXTURES,
  LandingWidgetRenderer,
  type LandingWidgetConfig,
  type LandingWidgetId,
} from '../landing-widgets';
import {
  CreativeSceneRenderer,
  createCreativeSceneFixture,
  type CreativeSceneConfig,
  type CreativeSceneId,
} from '../creative-scenes';
import {
  CanvasParticleSystem,
  CanvasVectorField,
  ShaderAmbientField,
  ShaderImageReveal,
  ThreeDataConstellation,
  ThreeModelOrbit,
  ThreeProductStage,
  ThreeSpatialGallery,
  type VisualEngineConfig,
} from '../visual-engines';
import { ShellEffectLayer, type ShellEffectLayerConfig } from '../shell-effects';
import {
  buildCreativeMotionSelectionConfig,
  CreativeMotionProvider,
  CreativeMotionTarget,
  type CreativeMotionId,
} from '../motion-runtime';
import {
  ShellAccentControl,
  ShellAside,
  ShellBackToTop,
  ShellContentHost,
  ShellFooter,
  ShellBoundedLayoutCanvas,
  ShellFrame,
  ShellHeader,
  ShellHero,
  ShellMotionControl,
  ShellRegion,
  ShellSidebar,
  useOptionalShellLayoutWidth,
  useResolvedShellLayoutWidth,
  shellBackdropStyle,
  shellDesignTokenStyle,
  shellShapeDepthClass,
  shellTypographyStyle,
  type ShellDirection,
  type ShellViewportTier,
} from '../shell-foundation';
import {
  documentUsesShellFrame,
  readShellBoundedEdge,
  readShellBoundedMaxWidth,
  resolveShellLayoutBackdropStyle,
} from '../shell-foundation/shellLayoutWidth';
import {
  ShellFooterNavigation,
  ShellMobileDrawerNavigation,
  ShellMobilePopoverNavigation,
  ShellNavigationSearch,
  ShellNavigationUtilities,
  ShellSidebarMegaNavigation,
  ShellSidebarNavigation,
  ShellSidebarRailNavigation,
  ShellTopMegaNavigation,
  ShellTopNavigation,
  ShellTopNavigationOverflow,
  filterShellNavigationGroups,
  type ShellNavigationCommonProps,
  type ShellNavigationGroup,
} from '../shell-navigation';
import { ShellRuntimeHostProvider, useShellRuntimeHost } from './ShellRuntimeHostContext';

type RuntimeProps = Record<string, unknown>;

const FOUNDATION_IDS = new Set([
  'ShellFrame',
  'ShellRegion',
  'ShellHeader',
  'ShellSidebar',
  'ShellContentHost',
  'ShellAside',
  'ShellHero',
  'ShellFooter',
  'ShellAccentControl',
  'ShellMotionControl',
  'ShellBackToTop',
]);

const NAVIGATION_IDS = new Set([
  'ShellSidebarNavigation',
  'ShellSidebarRailNavigation',
  'ShellSidebarMegaNavigation',
  'ShellTopNavigation',
  'ShellTopNavigationOverflow',
  'ShellTopMegaNavigation',
  'ShellFooterNavigation',
  'ShellMobileDrawerNavigation',
  'ShellMobilePopoverNavigation',
]);

const VISUAL_ENGINE_COMPONENTS = {
  CanvasParticleSystem,
  CanvasVectorField,
  ThreeProductStage,
  ThreeModelOrbit,
  ThreeSpatialGallery,
  ThreeDataConstellation,
  ShaderImageReveal,
  ShaderAmbientField,
} as const;

const LANDING_COMPONENT_TO_ID = Object.fromEntries(
  Object.values(LANDING_WIDGET_CATALOG).map((entry) => [entry.componentName, entry.id]),
) as Record<string, LandingWidgetId>;

export const SHELL_RUNTIME_COMPONENT_IDS = Object.freeze([
  ...FOUNDATION_IDS,
  ...NAVIGATION_IDS,
  'ShellEffectLayer',
  'LandingPageComposition',
  'LandingWidgetRenderer',
  'CreativeSceneRenderer',
  'CreativeMotionRenderer',
  ...Object.keys(LANDING_COMPONENT_TO_ID),
  ...Object.keys(VISUAL_ENGINE_COMPONENTS),
]);

export function isRegisteredShellRuntimeComponentId(componentId: string): boolean {
  return SHELL_RUNTIME_COMPONENT_IDS.includes(componentId);
}

const COMMON_REGION_RUNTIME_PROPS = [
  'regionId', 'presence', 'width', 'placement', 'padding', 'gap', 'separator',
  'visibility', 'surface', 'responsive',
] as const;
const RUNTIME_PROP_CONSUMERS: Record<string, ReadonlySet<string>> = {
  ShellFrame: new Set([
    'colorScheme', 'chromeDensity', 'contentDensity', 'designTokens', 'typography',
    'backdrop', 'shapeDepth', 'effectsIsolation', 'effectsOverflow', 'structuralSignature',
    'layoutWidth', 'boundedMaxWidth', 'boundedEdge',
  ]),
  ShellRegion: new Set(['regionId', 'composition', 'responsiveStrategy', 'mobileNavigation']),
  ShellHeader: new Set([
    ...COMMON_REGION_RUNTIME_PROPS, 'behavior', 'height', 'composition', 'titleStyle',
    'contextLine', 'actionsMode', 'actionPlacement', 'brandPlacement', 'edgeStyle',
  ]),
  ShellSidebar: new Set([
    ...COMMON_REGION_RUNTIME_PROPS, 'layout', 'position', 'width', 'header', 'footer', 'edgeStyle',
  ]),
  ShellContentHost: new Set([
    ...COMMON_REGION_RUNTIME_PROPS, 'contentDensity', 'composition', 'contentWidth',
    'hostStyle', 'separation', 'gutter', 'dockPadding', 'scrollOwner', 'scrollShadow',
  ]),
  ShellAside: new Set([...COMMON_REGION_RUNTIME_PROPS, 'behavior', 'position', 'width']),
  ShellHero: new Set([...COMMON_REGION_RUNTIME_PROPS, 'mode']),
  ShellFooter: new Set([...COMMON_REGION_RUNTIME_PROPS, 'mode', 'behavior']),
  ShellAccentControl: new Set(['source', 'compactAt']),
  ShellMotionControl: new Set(['level', 'reducedMotionFallback']),
  ShellBackToTop: new Set(['threshold']),
};
const NAVIGATION_RUNTIME_PROPS = new Set([
  'componentKey', 'navigationRef', 'mode', 'density', 'alignment', 'presentation',
  'mega', 'mobileFallback',
]);
const SLOT_RUNTIME_PROPS: Record<string, ReadonlySet<string>> = {
  'core.shell.logo': new Set([
    'slotId', 'logoSrc', 'logoAlt', 'logoHref', 'decorative', 'fit', 'renderStyle',
    'placements', 'compact', 'darkSurface', 'favicon',
  ]),
  'core.shell.portal-menu': new Set(['slotId']),
  'core.shell.header': new Set([
    'slotId', 'titleStyle', 'contextLine', 'actionsMode', 'actionPlacement',
    'showProfile', 'showNotifications',
  ]),
  'core.shell.sidebar-toggle': new Set(['slotId']),
  'core.shell.route-outlet': new Set(['slotId']),
  'cms.site.brand': new Set(['slotId', 'className']),
  'cms.site.nav': new Set(['slotId', 'className']),
  'cms.site.cta': new Set(['slotId', 'className']),
  'cms.site.footer': new Set(['slotId', 'className']),
};

/** Executable compiler/runtime contract used by the option-liveness gate. */
export function isConsumedShellRuntimeProp(componentId: string, propName: string): boolean {
  if (componentId.startsWith('system-slot:')) {
    return SLOT_RUNTIME_PROPS[componentId.slice('system-slot:'.length)]?.has(propName) ?? false;
  }
  if (NAVIGATION_IDS.has(componentId)) return NAVIGATION_RUNTIME_PROPS.has(propName);
  if (RUNTIME_PROP_CONSUMERS[componentId]?.has(propName)) return true;
  if (
    componentId === 'ShellEffectLayer'
    || componentId === 'LandingWidgetRenderer'
    || componentId === 'CreativeSceneRenderer'
    || componentId === 'CreativeMotionRenderer'
    || componentId in VISUAL_ENGINE_COMPONENTS
  ) return true;
  return false;
}

const stringProp = (props: RuntimeProps, key: string): string | undefined =>
  typeof props[key] === 'string' && props[key].trim() ? props[key].trim() : undefined;

const objectProp = <T extends object>(props: RuntimeProps, key: string): T | undefined =>
  props[key] && typeof props[key] === 'object' && !Array.isArray(props[key])
    ? props[key] as T
    : undefined;

type ResponsiveOverride = {
  presence?: 'visible' | 'hidden';
  order?: 0 | 1 | 2 | 3 | 4 | 5;
  span?: 'full' | 'contained' | 'inset';
  collapse?: 'none' | 'rail' | 'drawer' | 'popover' | 'stack';
  sticky?: boolean;
  safeArea?: 'none' | 'inline' | 'block-start' | 'all';
  scrollOwner?: 'page' | 'content-host';
};

function resolveResponsiveProps(props: RuntimeProps, viewport: 'desktop' | 'tablet' | 'phone') {
  const responsive = objectProp<Partial<Record<'desktop' | 'tablet' | 'phone', ResponsiveOverride>>>(props, 'responsive');
  return responsive?.[viewport] ?? {};
}

function regionAppearance(props: RuntimeProps) {
  const surface = objectProp<{
    treatment?: ShellBackdropTreatment;
    shapeDepth?: ShellShapeDepth;
    readability?: ShellRegionBase['readability'];
  }>(props, 'surface');
  return {
    className: cn(
      shellShapeDepthClass(surface?.shapeDepth),
      surface?.readability === 'auto-scrim' && 'bg-background/85 backdrop-blur-sm motion-reduce:backdrop-blur-none',
      surface?.readability === 'solid-panel' && 'bg-background',
    ),
    style: shellBackdropStyle(surface?.treatment),
  };
}

const mergeStyles = (...styles: Array<React.CSSProperties | undefined>) =>
  Object.assign({}, ...styles.filter(Boolean)) as React.CSSProperties;

const semanticElement = (props: RuntimeProps, fallback: 'main' | 'section' = 'section') => {
  const requested = stringProp(props, 'semanticElement');
  return requested === 'main' || requested === 'header' || requested === 'section' || requested === 'article'
    ? requested
    : fallback;
};

function RuntimeDiagnostic({
  componentId,
  node,
  children,
  reason = 'This trusted shell component is unavailable.',
}: {
  componentId: string;
  node: DesignerNode;
  children?: React.ReactNode;
  reason?: string;
}) {
  return (
    <section
      role="status"
      className="min-w-0 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      data-shell-runtime-fallback={componentId || 'unknown'}
      data-shell-runtime-node={node.id}
    >
      <strong className="block font-semibold">{componentId || 'Unknown shell component'}</strong>
      <span>{reason}</span>
      {children}
    </section>
  );
}

function RuntimeNavigation({
  componentId,
  props,
}: {
  componentId: string;
  props: RuntimeProps;
}) {
  const runtime = useShellRuntimeHost();
  const [navigationQuery, setNavigationQuery] = React.useState('');
  const regionOverride: ShellNavRegionId =
    componentId.startsWith('ShellTop')
      ? 'top'
      : componentId === 'ShellFooterNavigation'
        ? 'footer'
        : 'side';
  const componentKey = stringProp(props, 'componentKey') ?? componentId;
  const host = useShellNavigationHost({
    navigationRef: stringProp(props, 'navigationRef'),
    componentKey,
    regionOverride,
  });
  const groups = host.filteredGroups as unknown as ShellNavigationGroup[];
  const displayedGroups = navigationQuery
    ? filterShellNavigationGroups(groups, navigationQuery)
    : groups;
  const utilities = objectProp<ShellNavigationCommonProps['presentation'] & object>(props, 'presentation')?.utilities ?? [];
  const common: ShellNavigationCommonProps = {
    groups: displayedGroups,
    currentPath: host.pathname,
    onNavigate: (path) => host.onNavigate(path),
    className: cn(
      'min-h-0 [font-family:var(--shell-font-navigation,inherit)] [color:var(--shell-navigation-color,inherit)]',
      stringProp(props, 'density') === 'compact' && 'text-xs',
      stringProp(props, 'density') === 'relaxed' && 'text-base',
    ),
    density: stringProp(props, 'density') as ShellNavigationCommonProps['density'],
    alignment: stringProp(props, 'alignment') as ShellNavigationCommonProps['alignment'],
    presentation: objectProp<ShellNavigationCommonProps['presentation'] & object>(props, 'presentation'),
  };
  const mega = objectProp<MegaMenuOptions>(props, 'mega');
  const withUtilities = (navigation: React.ReactNode) => utilities.length ? (
    <div className="min-w-0 space-y-2" data-shell-navigation="">
      <ShellNavigationUtilities className="justify-end border-b border-divider pb-2">
        {utilities.includes('search') ? (
          <ShellNavigationSearch
            groups={groups}
            value={navigationQuery}
            onValueChange={setNavigationQuery}
            minimumItemCount={0}
            debounceMs={0}
            className="min-w-36 flex-1"
          />
        ) : null}
        {utilities.includes('notifications') ? (
          <span className="rounded-full bg-content2 px-2 py-1 text-xs text-foreground/70">Notifications</span>
        ) : null}
        {utilities.includes('profile') ? (
          <span className="rounded-full bg-content2 px-2 py-1 text-xs font-medium text-foreground">Profile</span>
        ) : null}
      </ShellNavigationUtilities>
      {navigation}
    </div>
  ) : navigation;

  if (!host.mount || groups.length === 0) {
    return (
      <nav
        aria-label="Navigation"
        data-shell-runtime-component={componentId}
        data-navigation-ref={host.navigationRef ?? undefined}
        data-nav-empty="true"
      />
    );
  }

  const mobileFallback = stringProp(props, 'mobileFallback');
  if (runtime.viewport === 'phone' && regionOverride === 'side') {
    if (mobileFallback === 'drawer') {
      return (
        <ShellMobileDrawerNavigation
          {...common}
          open={runtime.mobileNavigationOpen}
          onOpenChange={runtime.setMobileNavigationOpen}
          side={runtime.direction === 'rtl' ? 'end' : 'start'}
        />
      );
    }
    if (mobileFallback === 'popover') {
      return (
        <ShellMobilePopoverNavigation
          {...common}
          open={runtime.mobileNavigationOpen}
          onOpenChange={runtime.setMobileNavigationOpen}
        />
      );
    }
  }

  switch (componentId) {
    case 'ShellSidebarNavigation':
      return withUtilities(
        <ShellSidebarNavigation
          {...common}
          expandedGroups={host.expandedGroups}
          onExpandedGroupsChange={host.setExpandedGroups}
        />,
      );
    case 'ShellSidebarRailNavigation':
      return withUtilities(<ShellSidebarRailNavigation {...common} />);
    case 'ShellSidebarMegaNavigation':
      return withUtilities(<ShellSidebarMegaNavigation {...common} featuredArea={mega?.featuredArea} mega={mega} openBehavior={mega?.openBehavior} />);
    case 'ShellTopNavigation':
      return withUtilities(<ShellTopNavigation {...common} />);
    case 'ShellTopNavigationOverflow':
      return withUtilities(<ShellTopNavigationOverflow {...common} />);
    case 'ShellTopMegaNavigation':
      return withUtilities(<ShellTopMegaNavigation {...common} featuredArea={mega?.featuredArea} mega={mega} openBehavior={mega?.openBehavior} />);
    case 'ShellFooterNavigation':
      return withUtilities(<ShellFooterNavigation {...common} />);
    case 'ShellMobileDrawerNavigation':
      return (
        <ShellMobileDrawerNavigation
          {...common}
          open={runtime.mobileNavigationOpen}
          onOpenChange={runtime.setMobileNavigationOpen}
        />
      );
    case 'ShellMobilePopoverNavigation':
      return (
        <ShellMobilePopoverNavigation
          {...common}
          open={runtime.mobileNavigationOpen}
          onOpenChange={runtime.setMobileNavigationOpen}
        />
      );
    default:
      return null;
  }
}

function RuntimeAccentControl() {
  const accent = useAccentTheme();
  return (
    <ShellAccentControl
      value={accent.accentHex.toLowerCase()}
      onValueChange={(value) => accent.setAccentColor(value, 'default')}
      options={[
        { value: '#4f46e5', label: 'Indigo', swatchClassName: 'bg-indigo-600 text-white' },
        { value: '#0284c7', label: 'Sky', swatchClassName: 'bg-sky-600 text-white' },
        { value: '#059669', label: 'Emerald', swatchClassName: 'bg-emerald-600 text-white' },
        { value: '#e11d48', label: 'Rose', swatchClassName: 'bg-rose-600 text-white' },
      ]}
    />
  );
}

function RuntimeMotionControl() {
  const runtime = useShellRuntimeHost();
  return (
    <ShellMotionControl
      paused={runtime.motionPaused}
      onPausedChange={runtime.setMotionPaused}
    />
  );
}

function RuntimeEffect({ props }: { props: RuntimeProps }) {
  const runtime = useShellRuntimeHost();
  const reduced = stringProp(props, 'reducedMotionFallback');
  return (
    <ShellEffectLayer
      layer={props as unknown as ShellEffectLayerConfig}
      viewport={runtime.viewport}
      paused={runtime.motionPaused}
      reducedMotionFallback={reduced === 'static-frame' ? 'static' : reduced as 'static' | 'simplified' | 'hidden' | undefined}
    />
  );
}

function RuntimeFrame({ input }: { input: DesignerSystemComponentRenderInput }) {
  const runtime = useShellRuntimeHost();
  const props = input.node.props;
  const designTokens = objectProp<ShellDesignTokens>(props, 'designTokens');
  const typography = objectProp<ShellTypographyProfile>(props, 'typography');
  const backdrop = objectProp<ShellBackdropTreatment>(props, 'backdrop');
  const shapeDepth = objectProp<ShellShapeDepth>(props, 'shapeDepth');
  const byId = (id: string) =>
    input.childElements.find((_, index) => input.childNodes[index]?.componentRef?.refId === id);
  const reserved = new Set(['ShellHeader', 'ShellHero', 'ShellFooter']);
  const refIdAt = (index: number) => input.childNodes[index]?.componentRef?.refId ?? '';
  const effectUnderlay = input.childElements.filter((_, index) => refIdAt(index) === 'ShellEffectLayer');
  const mainChildren = input.childElements.filter((_, index) => {
    const refId = refIdAt(index);
    return !reserved.has(refId) && refId !== 'ShellEffectLayer';
  });
  const layoutWidthProp = stringProp(props, 'layoutWidth');
  const boundedEdgeProp = stringProp(props, 'boundedEdge');
  const boundedMaxProp = stringProp(props, 'boundedMaxWidth');
  const layoutOverride = useOptionalShellLayoutWidth();
  const frameLayoutWidth = layoutOverride?.activeWidth
    ?? (layoutWidthProp === 'bounded' ? 'bounded' : 'fluid');
  return (
    <ShellFrame
      layoutWidth={frameLayoutWidth}
      boundedMaxWidth={
        boundedMaxProp === 'sm' || boundedMaxProp === 'md' || boundedMaxProp === 'lg'
          ? boundedMaxProp
          : undefined
      }
      boundedEdge={
        boundedEdgeProp === 'hairline' || boundedEdgeProp === 'shadow' || boundedEdgeProp === 'outset'
          ? boundedEdgeProp
          : undefined
      }
      effectUnderlay={effectUnderlay.length > 0 ? effectUnderlay : undefined}
      className={cn(
        shellShapeDepthClass(shapeDepth),
        props.effectsIsolation === true && 'isolate',
        stringProp(props, 'effectsOverflow') === 'clip' && 'overflow-clip',
        stringProp(props, 'chromeDensity') === 'compact' && '[&_[data-shell-header]]:min-h-12 [&_[data-shell-sidebar]]:text-xs [&_[data-shell-footer]]:py-2',
        stringProp(props, 'chromeDensity') === 'comfortable' && '[&_[data-shell-header]]:min-h-20 [&_[data-shell-sidebar]]:text-base',
        stringProp(props, 'chromeDensity') === 'spacious' && '[&_[data-shell-header]]:min-h-24 [&_[data-shell-sidebar]]:text-base [&_[data-shell-footer]]:py-8',
        input.className,
      )}
      style={mergeStyles(
        input.style,
        shellDesignTokenStyle(designTokens),
        shellTypographyStyle(typography),
        shellBackdropStyle(backdrop),
      )}
      direction={runtime.direction}
      colorScheme={stringProp(props, 'colorScheme') as 'light' | 'dark' | 'mixed' | undefined}
      header={byId('ShellHeader')}
      hero={byId('ShellHero')}
      footer={byId('ShellFooter')}
      data-chrome-density={stringProp(props, 'chromeDensity')}
      data-content-density={stringProp(props, 'contentDensity')}
      data-effects-isolation={props.effectsIsolation === true ? 'true' : 'false'}
      data-effects-overflow={stringProp(props, 'effectsOverflow')}
    >
      {mainChildren}
    </ShellFrame>
  );
}

function RuntimeLandingWidget({
  componentId,
  props,
  node,
}: {
  componentId: string;
  props: RuntimeProps;
  node: DesignerNode;
}) {
  const widgetId = (stringProp(props, 'widgetId')
    ?? LANDING_COMPONENT_TO_ID[componentId]) as LandingWidgetId | undefined;
  if (!widgetId || !LANDING_WIDGET_CATALOG[widgetId]) {
    return <RuntimeDiagnostic componentId={componentId} node={node} reason="Landing widget configuration is unavailable." />;
  }
  const fixture = LANDING_WIDGET_FIXTURES[widgetId];
  const config = props.config && typeof props.config === 'object'
    ? props.config as LandingWidgetConfig
    : {
        id: widgetId,
        props: props.props && typeof props.props === 'object' ? props.props : fixture.props,
      } as LandingWidgetConfig;
  return <LandingWidgetRenderer config={config} target="site" />;
}

function RuntimeCreativeScene({ props, node }: { props: RuntimeProps; node: DesignerNode }) {
  const runtime = useShellRuntimeHost();
  let config = props.config && typeof props.config === 'object'
    ? props.config as CreativeSceneConfig
    : null;
  const sceneId = stringProp(props, 'sceneId') as CreativeSceneId | undefined;
  if (!config && sceneId) {
    const fixture = createCreativeSceneFixture(sceneId);
    config = {
      ...fixture,
      instanceId: stringProp(props, 'instanceId') ?? fixture.instanceId,
      preset: (stringProp(props, 'preset') as CreativeSceneConfig['preset']) ?? fixture.preset,
      plane: (stringProp(props, 'plane') as CreativeSceneConfig['plane']) ?? fixture.plane,
    } as CreativeSceneConfig;
  }
  if (!config) {
    return <RuntimeDiagnostic componentId="CreativeSceneRenderer" node={node} reason="Creative scene configuration is unavailable." />;
  }
  return (
    <CreativeSceneRenderer
      config={config}
      capabilities={{
        viewport: runtime.viewport,
        visible: !runtime.motionPaused,
        reducedMotion: runtime.motionPaused,
      }}
    />
  );
}

function RuntimeCreativeMotion({
  props,
  children,
  node,
}: {
  props: RuntimeProps;
  children: React.ReactNode;
  node: DesignerNode;
}) {
  const runtime = useShellRuntimeHost();
  const motionId = stringProp(props, 'motionId') as CreativeMotionId | undefined;
  const intensity = stringProp(props, 'intensity');
  if (
    !motionId
    || !['subtle', 'standard', 'expressive'].includes(intensity ?? '')
  ) {
    return (
      <RuntimeDiagnostic
        componentId="CreativeMotionRenderer"
        node={node}
        reason="Creative motion configuration is unavailable."
      >
        {children}
      </RuntimeDiagnostic>
    );
  }
  return (
    <CreativeMotionProvider
      experienceMode="site"
      viewport={runtime.viewport}
      paused={runtime.motionPaused}
    >
      <CreativeMotionTarget
        config={buildCreativeMotionSelectionConfig({
          motionId,
          intensity: intensity as 'subtle' | 'standard' | 'expressive',
        })}
      >
        {children}
      </CreativeMotionTarget>
    </CreativeMotionProvider>
  );
}

function RuntimeVisualEngine({
  componentId,
  config,
}: {
  componentId: keyof typeof VISUAL_ENGINE_COMPONENTS;
  config: VisualEngineConfig;
}) {
  const runtime = useShellRuntimeHost();
  const Component = VISUAL_ENGINE_COMPONENTS[componentId] as React.ComponentType<Record<string, unknown>>;
  return (
    <Component
      config={config}
      viewport={runtime.viewport}
      paused={runtime.motionPaused}
    />
  );
}

function RuntimeHeader({ input }: { input: DesignerSystemComponentRenderInput }) {
  const props = input.node.props;
  const composition = stringProp(props, 'composition');
  const edge = stringProp(props, 'edgeStyle');
  const brandPlacement = stringProp(props, 'brandPlacement');
  const titleStyle = stringProp(props, 'titleStyle');
  const contextLine = stringProp(props, 'contextLine');
  const actionsMode = stringProp(props, 'actionsMode');
  const actionPlacement = stringProp(props, 'actionPlacement');
  const renderedChildren = input.childElements.map((child, index) => {
    const node = input.childNodes[index];
    const slotId = stringProp(node?.props ?? {}, 'slotId');
    const refId = node?.componentRef?.refId ?? '';
    if (slotId === 'core.shell.logo') {
      return <div key={node?.id ?? index} className="shrink-0" data-shell-header-brand="">{child}</div>;
    }
    if (refId.startsWith('ShellTop')) {
      return <div key={node?.id ?? index} className="min-w-0 flex-1" data-shell-header-navigation="">{child}</div>;
    }
    if (slotId === 'core.shell.header') {
      return (
        <div
          key={node?.id ?? index}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2',
            actionPlacement === 'center' && 'justify-center',
            actionPlacement === 'end' && 'justify-end',
            actionsMode === 'action-group' && 'flex-wrap',
            actionsMode === 'workspace-actions' && 'rounded-lg bg-content2 p-1',
            actionsMode === 'none' && 'hidden',
            titleStyle === 'page-title' && 'text-lg font-semibold',
            titleStyle === 'breadcrumb' && 'text-sm text-foreground/70',
            titleStyle === 'title-and-context' && 'text-base font-semibold',
            titleStyle === 'hidden' && '[&_[data-shell-header-title]]:hidden',
            contextLine !== 'none' && 'flex-col items-start justify-center',
          )}
          data-shell-header-actions={actionsMode}
          data-title-style={titleStyle}
          data-context-line={contextLine}
        >
          {child}
        </div>
      );
    }
    return <React.Fragment key={node?.id ?? index}>{child}</React.Fragment>;
  });
  return (
    <RuntimeRegionChrome input={input}>
      <ShellHeader
        className={cn(
          'w-full gap-3 px-4',
          composition === 'centered-nav' && 'grid grid-cols-[1fr_auto_1fr] [&>*:last-child]:justify-self-end',
          composition === 'stacked-brand-nav' && 'flex-col items-stretch justify-center py-2',
          composition === 'minimal' && 'justify-between [&_[data-shell-navigation]]:hidden',
          edge === 'inset' && 'm-2 w-[calc(100%-1rem)] rounded-lg border border-divider',
          edge === 'floating-bar' && 'm-3 w-[calc(100%-1.5rem)] rounded-xl border border-divider bg-content1 shadow-lg',
          brandPlacement === 'center' && '[&>*:first-child]:mx-auto',
          brandPlacement === 'nav-embedded' && '[&>*:first-child]:order-2',
        )}
        behavior={stringProp(props, 'behavior') as never}
        height={stringProp(props, 'height') as never}
        data-header-composition={composition}
        data-brand-placement={brandPlacement}
        data-edge-style={edge}
      >
        {renderedChildren}
      </ShellHeader>
    </RuntimeRegionChrome>
  );
}

function RuntimeSidebar({ input }: { input: DesignerSystemComponentRenderInput }) {
  const runtime = useShellRuntimeHost();
  const props = input.node.props;
  const responsive = resolveResponsiveProps(props, runtime.viewport);
  const layout = responsive.collapse === 'rail'
    ? 'rail'
    : responsive.collapse === 'drawer' || responsive.collapse === 'popover'
      ? 'overlay'
      : stringProp(props, 'layout') === 'icon-rail' ? 'rail' : stringProp(props, 'layout');
  const header = stringProp(props, 'header');
  const footer = stringProp(props, 'footer');
  const edge = stringProp(props, 'edgeStyle');
  return (
    <RuntimeRegionChrome input={input}>
      <ShellSidebar
        className={cn(
          'flex h-full flex-col gap-2 p-2',
          edge === 'rounded-inner' && (stringProp(props, 'position') === 'end' ? 'rounded-s-xl' : 'rounded-e-xl'),
          edge === 'floating-panel' && 'm-3 rounded-xl border border-divider shadow-lg',
        )}
        side={stringProp(props, 'position') as never}
        layout={layout as never}
        width={stringProp(props, 'width') as never}
        data-sidebar-header={header}
        data-sidebar-footer={footer}
        data-edge-style={edge}
      >
        {header !== 'none' && header !== 'minimal' ? (
          <div className="shrink-0 border-b border-divider pb-2 font-semibold">
            {header === 'brand-and-title' ? <span className="mb-1 block text-xs uppercase tracking-wide text-foreground/60">Workspace</span> : null}
            {input.childElements.filter((_, index) => input.childNodes[index]?.props.slotId === 'core.shell.logo')}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {input.childElements.filter((_, index) => input.childNodes[index]?.props.slotId !== 'core.shell.logo')}
        </div>
        {footer !== 'none' ? (
          <div className="mt-auto shrink-0 border-t border-divider pt-2 text-xs text-foreground/70">
            {footer === 'profile' ? 'Profile' : 'Utilities'}
          </div>
        ) : null}
      </ShellSidebar>
    </RuntimeRegionChrome>
  );
}

function RuntimeContent({ input }: { input: DesignerSystemComponentRenderInput }) {
  const runtime = useShellRuntimeHost();
  const props = input.node.props;
  const responsive = resolveResponsiveProps(props, runtime.viewport);
  const width = stringProp(props, 'contentWidth');
  const variant = stringProp(props, 'hostStyle');
  const density = stringProp(props, 'contentDensity') ?? stringProp(props, 'padding');
  const gutter = stringProp(props, 'gutter');
  const separation = stringProp(props, 'separation');
  const composition = stringProp(props, 'composition');
  return (
    <RuntimeRegionChrome input={input}>
      <ShellContentHost
        className={cn(
          'flex flex-col',
          composition === 'content-aside' && 'lg:grid lg:grid-cols-[minmax(0,1fr)_18rem]',
          composition === 'aside-content' && 'lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]',
          gutter === 'compact' && 'gap-2',
          gutter === 'comfortable' && 'gap-4',
          gutter === 'spacious' && 'gap-8',
          separation === 'hairline' && 'border border-divider',
          separation === 'surface-shift' && 'bg-content2',
          separation === 'shadow' && 'shadow-md',
          props.dockPadding === true && 'ps-[var(--appendoo-dock-padding-inline-start,0px)] pe-[var(--appendoo-dock-padding-inline-end,0px)]',
        )}
        width={width as never}
        variant={variant === 'inset-panel' ? 'inset' : variant as never}
        density={density as never}
        scrollOwner={(responsive.scrollOwner ?? stringProp(props, 'scrollOwner')) as never}
        scrollShadow={props.scrollShadow === true}
        data-content-composition={composition}
        data-separation={separation}
        data-gutter={gutter}
        data-dock-padding={props.dockPadding === true ? 'true' : 'false'}
      >
        {input.children}
      </ShellContentHost>
    </RuntimeRegionChrome>
  );
}

function RuntimeBackToTop({ props }: { props: RuntimeProps }) {
  const [owner, setOwner] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    setOwner(document.querySelector<HTMLElement>('[data-scroll-owner="content-host"]'));
  }, []);
  return (
    <ShellBackToTop
      scrollOwner={owner}
      threshold={stringProp(props, 'threshold') === 'after-viewport' ? 'viewport' : undefined}
    />
  );
}

function RuntimeRegionChrome({
  input,
  children,
}: {
  input: DesignerSystemComponentRenderInput;
  children: React.ReactNode;
}) {
  const runtime = useShellRuntimeHost();
  const props = input.node.props;
  const responsive = resolveResponsiveProps(props, runtime.viewport);
  const appearance = regionAppearance(props);
  return (
    <ShellRegion
      regionId={stringProp(props, 'regionId') ?? input.node.id}
      as="div"
      presence={(responsive.presence ?? stringProp(props, 'presence')) as 'visible' | 'hidden' | undefined}
      width={(responsive.span ?? stringProp(props, 'width')) as 'full' | 'contained' | 'inset' | undefined}
      placement={stringProp(props, 'placement') as 'start' | 'center' | 'end' | 'space-between' | undefined}
      padding={stringProp(props, 'padding') as 'none' | 'xs' | 'sm' | 'md' | 'lg' | undefined}
      gap={stringProp(props, 'gap') as 'none' | 'xs' | 'sm' | 'md' | 'lg' | undefined}
      separator={stringProp(props, 'separator') as 'none' | 'hairline' | 'surface-shift' | 'shadow' | undefined}
      visibility={props.visibility as never}
      safeArea={responsive.safeArea}
      className={cn(
        'relative',
        responsive.sticky === true && 'sticky top-0 z-20',
        appearance.className,
        input.className,
      )}
      style={mergeStyles(input.style, appearance.style, responsive.order == null ? undefined : { order: responsive.order })}
      data-responsive-collapse={responsive.collapse}
      data-readability={objectProp<{ readability?: string }>(props, 'surface')?.readability}
    >
      {children}
    </ShellRegion>
  );
}

function renderFoundation(
  componentId: string,
  input: DesignerSystemComponentRenderInput,
): React.ReactNode | undefined {
  const props = input.node.props;
  const common = { className: input.className, style: input.style };
  switch (componentId) {
    case 'ShellFrame':
      return <RuntimeFrame input={input} />;
    case 'ShellRegion':
      return (
        <ShellRegion
          {...common}
          regionId={stringProp(props, 'regionId') ?? input.node.id}
          width={stringProp(props, 'width') as 'full' | 'contained' | 'inset' | undefined}
          placement={stringProp(props, 'placement') as 'start' | 'center' | 'end' | 'space-between' | undefined}
          padding={stringProp(props, 'padding') as 'none' | 'xs' | 'sm' | 'md' | 'lg' | undefined}
          gap={stringProp(props, 'gap') as 'none' | 'xs' | 'sm' | 'md' | 'lg' | undefined}
          separator={stringProp(props, 'separator') as 'none' | 'hairline' | 'surface-shift' | 'shadow' | undefined}
          visibility={props.visibility as never}
          className={cn(
            'flex-1 flex-col lg:flex-row',
            stringProp(props, 'responsiveStrategy') === 'desktop-first' && 'min-w-[48rem]',
            common.className,
          )}
          data-responsive-strategy={stringProp(props, 'responsiveStrategy')}
          data-mobile-navigation={stringProp(props, 'mobileNavigation')}
        >
          {input.children}
        </ShellRegion>
      );
    case 'ShellHeader':
      return <RuntimeHeader input={input} />;
    case 'ShellSidebar':
      return <RuntimeSidebar input={input} />;
    case 'ShellContentHost':
      return <RuntimeContent input={input} />;
    case 'ShellAside':
      return (
        <RuntimeRegionChrome input={input}>
          <ShellAside {...common} side={stringProp(props, 'position') as never} behavior={stringProp(props, 'behavior') as never} width={stringProp(props, 'width') as never}>{input.children}</ShellAside>
        </RuntimeRegionChrome>
      );
    case 'ShellHero':
      return (
        <RuntimeRegionChrome input={input}>
          <ShellHero {...common} mode={stringProp(props, 'mode') as never} contentWidth={stringProp(props, 'width') === 'full' ? 'full' : 'contained'}>{input.children}</ShellHero>
        </RuntimeRegionChrome>
      );
    case 'ShellFooter':
      return (
        <RuntimeRegionChrome input={input}>
          <ShellFooter {...common} mode={stringProp(props, 'mode') as never} behavior={stringProp(props, 'behavior') as never}>{input.children}</ShellFooter>
        </RuntimeRegionChrome>
      );
    case 'ShellAccentControl':
      return <RuntimeAccentControl />;
    case 'ShellMotionControl':
      return <RuntimeMotionControl />;
    case 'ShellBackToTop':
      return <RuntimeBackToTop props={props} />;
    default:
      return undefined;
  }
}

function ShellSystemComponentResolver(input: DesignerSystemComponentRenderInput): React.ReactNode {
  const componentId = input.node.componentRef?.refId?.trim() ?? '';
  const props = input.node.props;
  const foundation = renderFoundation(componentId, input);
  if (foundation !== undefined) return foundation;
  if (NAVIGATION_IDS.has(componentId)) return <RuntimeNavigation componentId={componentId} props={props} />;
  if (componentId === 'ShellEffectLayer') return <RuntimeEffect props={props} />;
  if (componentId === 'LandingPageComposition') {
    const Element = semanticElement(props, 'main');
    return <Element className={input.className} style={input.style} data-landing-page-composition="">{input.children}</Element>;
  }
  if (componentId === 'LandingWidgetRenderer' || LANDING_COMPONENT_TO_ID[componentId]) {
    return <RuntimeLandingWidget componentId={componentId} props={props} node={input.node} />;
  }
  if (componentId === 'CreativeSceneRenderer') {
    return <RuntimeCreativeScene props={props} node={input.node} />;
  }
  if (componentId === 'CreativeMotionRenderer') {
    return <RuntimeCreativeMotion props={props} node={input.node}>{input.children}</RuntimeCreativeMotion>;
  }
  const VisualComponent = VISUAL_ENGINE_COMPONENTS[componentId as keyof typeof VISUAL_ENGINE_COMPONENTS];
  if (VisualComponent) {
    const config = (props.config && typeof props.config === 'object' ? props.config : props) as VisualEngineConfig;
    return (
      <RuntimeVisualEngine
        componentId={componentId as keyof typeof VISUAL_ENGINE_COMPONENTS}
        config={config}
      />
    );
  }
  return (
    <RuntimeDiagnostic componentId={componentId} node={input.node}>
      {input.children}
    </RuntimeDiagnostic>
  );
}

export type DesignerDocumentShellRendererProps = {
  document: DesignerDocument;
  bindingDefinitions?: DesignerBindingDefinitions | Record<string, unknown>;
  runtimeSlots?: DesignerRuntimeSlots;
  direction?: ShellDirection;
  viewport?: ShellViewportTier;
  motionPaused?: boolean;
  onMotionPausedChange?: (paused: boolean) => void;
  mobileNavigationOpen?: boolean;
  onMobileNavigationOpenChange?: (open: boolean) => void;
};

export function DesignerDocumentShellRenderer({
  document,
  bindingDefinitions = {},
  runtimeSlots,
  direction,
  viewport,
  motionPaused,
  onMotionPausedChange,
  mobileNavigationOpen = false,
  onMobileNavigationOpenChange,
}: DesignerDocumentShellRendererProps) {
  const layoutWidth = useResolvedShellLayoutWidth(document);
  const boundedEdge = readShellBoundedEdge(document);
  const boundedMaxWidth = readShellBoundedMaxWidth(document);
  const usesShellFrame = documentUsesShellFrame(document);
  const boundedCanvasStyle = React.useMemo(
    () => resolveShellLayoutBackdropStyle(document),
    [document],
  );
  const slots = React.useMemo<DesignerRuntimeSlots>(
    () => ({ ...runtimeSlots, renderSystemComponent: ShellSystemComponentResolver }),
    [runtimeSlots],
  );
  const preview = (
    <DesignerDocumentPreview
      document={document}
      bindingDefinitions={bindingDefinitions}
      runtimeSlots={slots}
      layoutMode="shell"
      interactive={false}
    />
  );
  return (
    <ShellRuntimeHostProvider
      direction={direction}
      viewport={viewport}
      motionPaused={motionPaused}
      onMotionPausedChange={onMotionPausedChange}
      mobileNavigationOpen={mobileNavigationOpen}
      onMobileNavigationOpenChange={onMobileNavigationOpenChange}
    >
      {layoutWidth === 'bounded' && !usesShellFrame ? (
        <ShellBoundedLayoutCanvas
          layoutWidth={layoutWidth}
          boundedMaxWidth={boundedMaxWidth}
          boundedEdge={boundedEdge}
          backdropStyle={boundedCanvasStyle}
          className="min-h-dvh"
        >
          {preview}
        </ShellBoundedLayoutCanvas>
      ) : (
        preview
      )}
    </ShellRuntimeHostProvider>
  );
}
