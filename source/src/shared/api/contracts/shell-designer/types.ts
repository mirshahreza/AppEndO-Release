export const SHELL_DESIGNER_SCHEMA_VERSION = '1.0.0' as const;
export const SHELL_DESIGNER_REGISTRY_VERSION = '1.0.0' as const;

export const SHELL_RECIPE_IDS = [
  'app-classic', 'app-compact-rail', 'app-overlay-focus', 'app-command-center',
  'app-dual-nav', 'app-mega-side', 'app-mega-top', 'app-minimal', 'app-topnav',
  'app-focus', 'app-editorial', 'app-portal-home', 'app-floating-workspace',
  'app-glass-hybrid', 'app-workbench', 'app-canvas', 'app-analytics', 'app-inbox',
  'app-monitor', 'app-knowledge', 'app-mobile-first', 'app-split-command',
  'app-footer-nav', 'app-hero-mega', 'site-marketing', 'site-content', 'site-docs',
  'site-minimal', 'site-landing-clean', 'site-campaign', 'site-community',
  'site-mega-commerce', 'site-docs-rail', 'site-dashboard', 'site-sidebar-commerce',
  'site-focus', 'site-news', 'site-portfolio', 'site-saas', 'site-event',
  'site-catalog', 'site-learning', 'site-support', 'site-member', 'site-app-like',
  'site-floating-nav', 'site-no-nav', 'site-immersive',
] as const;

export const LANDING_WIDGET_IDS = [
  'landing-announcement', 'landing-hero-centered', 'landing-hero-split',
  'landing-hero-product-stage', 'landing-logo-cloud', 'landing-stat-strip',
  'landing-feature-grid', 'landing-bento-features', 'landing-feature-tabs',
  'landing-process-steps', 'landing-comparison', 'landing-pricing',
  'landing-testimonial-grid', 'landing-featured-quote', 'landing-case-study',
  'landing-integration-grid', 'landing-media-gallery', 'landing-marquee',
  'landing-newsletter', 'landing-cta-band', 'landing-faq', 'landing-team',
  'landing-timeline', 'landing-contact',
] as const;

export const APP_LANDING_WIDGET_IDS = [
  'landing-announcement', 'landing-hero-centered', 'landing-stat-strip',
  'landing-feature-grid', 'landing-bento-features', 'landing-process-steps',
  'landing-integration-grid', 'landing-cta-band', 'landing-faq', 'landing-timeline',
] as const;

export const CREATIVE_MOTION_IDS = [
  'reveal-fade', 'reveal-slide', 'reveal-scale', 'reveal-mask', 'reveal-stagger',
  'metric-count-up', 'hover-lift', 'pointer-tilt', 'pointer-attract', 'track-marquee',
  'scroll-progress', 'scroll-parallax-layers', 'sticky-chapter', 'scene-scrub',
  'scene-camera-path', 'scene-orbit', 'scene-object-focus', 'route-crossfade',
] as const;

export const APP_CREATIVE_MOTION_IDS = [
  'reveal-fade', 'reveal-slide', 'reveal-scale', 'reveal-stagger', 'metric-count-up',
  'hover-lift', 'scroll-progress', 'sticky-chapter', 'route-crossfade',
] as const;

export const CREATIVE_SCENE_IDS = [
  'scene-layered-hero', 'scene-product-orbit', 'scene-product-explode',
  'scene-editorial-chapters', 'scene-spatial-gallery', 'scene-data-constellation',
  'scene-globe-network', 'scene-ambient-landscape', 'scene-image-reveal-story',
  'scene-portal-tunnel', 'scene-kinetic-cards', 'scene-ambient-particles',
] as const;

export const APP_CREATIVE_SCENE_IDS = [
  'scene-layered-hero', 'scene-editorial-chapters', 'scene-data-constellation',
  'scene-kinetic-cards', 'scene-ambient-particles',
] as const;

export const CREATIVE_ENGINE_IDS = [
  'canvas-particle-system', 'canvas-vector-field', 'three-product-stage',
  'three-model-orbit', 'three-spatial-gallery', 'three-data-constellation',
  'shader-image-reveal', 'shader-ambient-field',
] as const;

export const APP_CREATIVE_ENGINE_IDS = [
  'canvas-particle-system', 'canvas-vector-field', 'three-data-constellation',
] as const;

export type ShellExperienceMode = 'app' | 'site';
export type ShellRecipeId = (typeof SHELL_RECIPE_IDS)[number];
export type LandingWidgetId = (typeof LANDING_WIDGET_IDS)[number];
export type CreativeMotionId = (typeof CREATIVE_MOTION_IDS)[number];
export type CreativeSceneId = (typeof CREATIVE_SCENE_IDS)[number];
export type CreativeEngineId = (typeof CREATIVE_ENGINE_IDS)[number];
export type RuntimeEngine = 'static' | 'css-svg' | 'orchestrated-dom' | 'canvas-2d' | 'webgl-three';
export type CostTier = 'low' | 'medium' | 'high' | 'extreme';
export type AuthoringTier = 'core' | 'enhanced' | 'advanced';
export type ShellLocalAssetRef = `/assets/workspace/${string}`;

export type ShellIdentity = {
  shellKey: string;
  displayName: string;
  description?: string;
};

export type ShellCapabilityContext = {
  authentication: 'anonymous' | 'authenticated';
  portalIdentity: boolean;
  userPreferences: boolean;
  navigationDepth: 0 | 1 | 2 | 3;
};

export type ShellSemanticColor =
  | 'surface' | 'surface-elevated' | 'inverse-surface' | 'surface-foreground'
  | 'surface-muted' | 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export type ShellColorValue = {
  colorSpace: 'srgb' | 'display-p3' | 'oklch';
  components: [number, number, number];
  alpha: number;
  hex: string;
};

export type ShellColorRef =
  | { source: 'semantic'; token: ShellSemanticColor }
  | { source: 'custom'; value: ShellColorValue };

export type ShellDesignTokens = {
  profile: 'platform-default' | 'neutral-soft' | 'neutral-crisp' | 'custom';
  accent: { source: 'runtime-accent' } | ShellColorRef;
  neutralFamily: 'slate' | 'gray' | 'zinc';
  surfaceBias: 'cool' | 'neutral' | 'warm';
};

export type ShellBackdropTreatment =
  | { mode: 'solid'; baseColor: ShellColorRef }
  | { mode: 'gradient'; baseColor: ShellColorRef; gradient: ShellGradientOptions }
  | { mode: 'pattern'; baseColor: ShellColorRef; pattern: ShellPatternOptions }
  | { mode: 'gradient-pattern'; baseColor: ShellColorRef; gradient: ShellGradientOptions; pattern: ShellPatternOptions };

export type ShellGradientOptions = {
  type: 'linear' | 'radial' | 'conic';
  direction: 'top' | 'top-end' | 'end' | 'bottom-end' | 'bottom' | 'bottom-start' | 'start' | 'top-start';
  stops: Array<{ color: ShellColorRef; position: 0 | 10 | 20 | 25 | 40 | 50 | 60 | 75 | 80 | 90 | 100 }>;
  intensity: 'subtle' | 'soft' | 'medium' | 'strong';
};

export type ShellPatternOptions = {
  kind: 'dots' | 'halftone' | 'grid' | 'lines' | 'diagonal-lines' | 'noise' | 'waves';
  scale: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  density: 'sparse' | 'normal' | 'dense';
  opacity: 'faint' | 'subtle' | 'visible' | 'strong';
  color: ShellColorRef;
  blend: 'normal' | 'multiply' | 'soft-light' | 'overlay';
};

export type RadiusStep = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ShellShapeDepth = {
  radius: {
    global: RadiusStep;
    header?: 'inherit' | RadiusStep;
    sidebar?: 'inherit' | RadiusStep;
    contentHost?: 'inherit' | RadiusStep;
    panels?: 'inherit' | RadiusStep;
    footer?: 'inherit' | RadiusStep;
  };
  shadow: { level: RadiusStep; softness: 'crisp' | 'balanced' | 'diffused'; target: 'content-only' | 'chrome-only' | 'layered' };
  border: { strength: 'none' | 'hairline' | 'soft' | 'defined'; contrast: 'low' | 'medium' | 'high' };
  backdrop: { style: 'solid' | 'translucent' | 'glass'; blur: 'none' | 'sm' | 'md' | 'lg' };
};

export type ShellRegionShapeDepth = {
  radius?: 'inherit' | RadiusStep;
  shadow?: 'inherit' | ShellShapeDepth['shadow'];
  border?: 'inherit' | ShellShapeDepth['border'];
  backdrop?: 'inherit' | ShellShapeDepth['backdrop'];
};

export type ShellRegionBase = {
  presence: 'visible';
  span: 'full' | 'contained' | 'inset';
  placement: 'start' | 'center' | 'end' | 'space-between';
  padding: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  gap: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  separator: 'none' | 'hairline' | 'surface-shift' | 'shadow';
  visibility: { desktop: boolean; tablet: boolean; phone: boolean };
  surfaceTreatment: ShellBackdropTreatment | { mode: 'inherit' };
  shapeDepth: ShellRegionShapeDepth | { mode: 'inherit' };
  readability: 'none' | 'auto-scrim' | 'solid-panel';
};

export type ShellRegions = {
  header: { presence: 'hidden' } | ShellRegionBase & {
    behavior: 'static' | 'sticky' | 'sticky-shrink';
    height: 'compact' | 'default' | 'tall';
    composition: 'logo-nav-actions' | 'centered-nav' | 'stacked-brand-nav' | 'minimal';
    titleStyle: 'breadcrumb' | 'page-title' | 'title-and-context' | 'hidden';
    contextLine: 'none' | 'route-description' | 'portal-name';
    actionsMode: 'none' | 'single-cta' | 'action-group' | 'workspace-actions';
    actionPlacement: 'start' | 'center' | 'end';
    showProfile: boolean;
    showNotifications: boolean;
    brandPlacement: 'start' | 'center' | 'nav-embedded';
    edgeStyle: 'flush' | 'inset' | 'floating-bar';
    showPortalMenu: boolean;
    showLogo: boolean;
  };
  sidebar: { presence: 'hidden' } | ShellRegionBase & {
    layout: 'fixed' | 'icon-rail' | 'overlay' | 'floating';
    position: 'start' | 'end';
    width: 'compact' | 'comfortable' | 'spacious';
    header: 'none' | 'logo' | 'brand-and-title' | 'minimal';
    footer: 'none' | 'utilities' | 'profile';
    edgeStyle: 'flush' | 'rounded-inner' | 'floating-panel';
  };
  hero: { presence: 'hidden' } | ShellRegionBase & { mode: 'compact' | 'full-bleed' };
  content: ShellRegionBase & {
    composition: 'single-column' | 'content-aside' | 'aside-content';
    contentWidth: 'fluid' | 'boxed-sm' | 'boxed-md' | 'boxed-lg';
    hostStyle: 'plain' | 'card' | 'inset-panel';
    separation: 'spacing' | 'hairline' | 'surface-shift' | 'shadow';
    gutter: 'compact' | 'comfortable' | 'spacious';
    dockPadding: boolean;
    scrollOwner: 'page' | 'content-host';
    scrollShadow: boolean;
    backToTop: 'hidden' | 'after-viewport';
    routeOutlet: { count: 1; region: 'content' };
  };
  aside: { presence: 'hidden' } | ShellRegionBase & {
    behavior: 'static' | 'sticky' | 'collapsible';
    position: 'start' | 'end';
    width: 'sm' | 'md' | 'lg';
  };
  footer: { presence: 'hidden' } | ShellRegionBase & {
    mode: 'simple' | 'multi-column' | 'action-bar';
    behavior: 'static' | 'sticky';
  };
};

export type MegaMenuOptions = {
  columns: 2 | 3 | 4;
  panelWidth: 'trigger' | 'contained' | 'wide' | 'full';
  groupStyle: 'plain' | 'sectioned' | 'cards';
  openBehavior: 'click' | 'hover-and-click';
  featuredArea: 'none' | 'start' | 'end';
  showGroupIcons: boolean;
  showDescriptions: boolean;
  surfaceTreatment: ShellBackdropTreatment | { mode: 'inherit' };
  shapeDepth: ShellRegionShapeDepth | { mode: 'inherit' };
  readability: 'none' | 'auto-scrim' | 'solid-panel';
};

export type ShellNavigation = {
  topology: 'sidebar' | 'topbar' | 'hybrid' | 'none';
  primaryNavigationRef?: string;
  escapePath?: 'header-breadcrumb' | 'header-portal-menu';
  presentation: {
    showIcons: boolean;
    labelMode: 'label' | 'icon-and-label' | 'icon-only';
    activeIndicator: 'bar' | 'pill' | 'underline' | 'surface';
    groupDefault: 'collapsed' | 'expanded-active' | 'expanded-all';
    groupExpansion: 'accordion' | 'multiple';
    groupStyle: 'plain' | 'divided' | 'cards';
    showBadges: boolean;
    utilities: Array<'search' | 'profile' | 'notifications'>;
  };
  side?:
    | { mode: 'standard'; componentId: 'core:TreeNavTwoLevel' | 'core:SidebarRailNavigation'; navigationRef?: string; density: 'compact' | 'default' | 'relaxed' }
    | { mode: 'mega'; componentId: 'core:MegaMenu'; navigationRef?: string; density: 'compact' | 'default' | 'relaxed'; mega: MegaMenuOptions };
  top?:
    | { mode: 'standard'; componentId: 'core:TopBarNav' | 'core:TopNavigationOverflow'; navigationRef?: string; density: 'compact' | 'default' | 'relaxed'; alignment: 'start' | 'center' | 'end' | 'space-between' }
    | { mode: 'mega'; componentId: 'core:TopMegaNavigation'; navigationRef?: string; density: 'compact' | 'default' | 'relaxed'; alignment: 'start' | 'center' | 'end' | 'space-between'; mega: MegaMenuOptions };
  footer?: { mode: 'standard'; componentId: 'core:FlatLinks'; navigationRef: string };
};

export const SHELL_TEXT_ROLES = [
  'display', 'page-title', 'section-title', 'subsection-title', 'card-title',
  'body', 'body-strong', 'supporting', 'caption', 'overline', 'navigation',
  'navigation-active', 'breadcrumb', 'label', 'link', 'code',
] as const;
export type ShellTextRole = (typeof SHELL_TEXT_ROLES)[number];
export type ShellTextRoleStyle = {
  color: ShellColorRef;
  fontProfileId: string;
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  weight: 'regular' | 'medium' | 'semibold' | 'bold';
  lineHeight: 'tight' | 'snug' | 'normal' | 'relaxed';
  tracking: 'tight' | 'normal' | 'wide';
  transform: 'none' | 'uppercase';
};
export type ShellTypographyProfile = {
  roles: Record<ShellTextRole, ShellTextRoleStyle>;
  inverseRoles?: Partial<Record<ShellTextRole, ShellTextRoleStyle>>;
  regionOverrides?: Partial<Record<'header' | 'sidebar' | 'hero' | 'content' | 'footer' | 'mega-panel', Partial<Record<ShellTextRole, ShellTextRoleStyle>>>>;
};

export type ShellLogoAsset = { source: 'platform-default' } | { source: 'local-asset'; assetRef: ShellLocalAssetRef };
export type ShellLogoOptions = {
  main: ShellLogoAsset;
  compact?: ShellLogoAsset;
  darkSurface?: ShellLogoAsset;
  favicon?: ShellLogoAsset;
  alt: string;
  decorative: boolean;
  href?: string;
  fit: 'contain' | 'cover';
  renderStyle: 'original' | 'monochrome' | 'accent-tinted';
  placements: Array<{
    region: 'header' | 'sidebar' | 'footer';
    display: 'full' | 'mark-only' | 'text-and-mark';
    size: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    placement: 'start' | 'center' | 'end';
    visibility: { desktop: boolean; tablet: boolean; phone: boolean };
  }>;
};

export type ShellCreativeReferences = {
  widgets: Array<{ instanceId: string; widgetId: LandingWidgetId; host: 'header' | 'hero' | 'content' | 'aside' | 'footer'; assetRefs?: ShellLocalAssetRef[] }>;
  motions: Array<{ instanceId: string; motionId: CreativeMotionId; targetId: string; intensity: 'subtle' | 'standard' | 'expressive'; reducedMotion: 'reduce' | 'replace' | 'disable' }>;
  scenes: Array<{ instanceId: string; sceneId: CreativeSceneId; host: 'hero' | 'content' | 'aside' | 'footer'; plane: 'background' | 'foreground'; preset: 'calm' | 'balanced' | 'expressive'; fallbackAsset?: ShellLocalAssetRef }>;
  engines: Array<{
    instanceId: string;
    engineId: CreativeEngineId;
    runtimeEngine: 'canvas-2d' | 'webgl-three';
    costTier: 'high' | 'extreme';
    authoringTier: 'enhanced' | 'advanced';
    fallback: { kind: 'static' | 'css-svg' | 'canvas-2d' | 'semantic-dom'; catalogId: string; assetRef?: ShellLocalAssetRef };
  }>;
};

export type ShellEffectLayer = {
  id: string;
  effectId: string;
  target: 'page' | 'header' | 'sidebar' | 'hero' | 'content-host' | 'aside' | 'footer' | 'mega-panel';
  plane: 'underlay' | 'background' | 'overlay';
  palette: ShellColorRef[];
  intensity: 'subtle' | 'soft' | 'medium' | 'strong';
  speed: 'still' | 'slow' | 'medium' | 'fast';
  density: 'sparse' | 'normal' | 'dense';
  scale: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  direction: 'forward' | 'reverse' | 'alternate';
  opacity: 'faint' | 'subtle' | 'visible' | 'strong';
  blend: 'normal' | 'multiply' | 'screen' | 'soft-light' | 'overlay';
  interaction: 'none' | 'scroll' | 'pointer';
  seed: number;
  visibility: { desktop: boolean; tablet: boolean; phone: boolean };
  config: Record<string, string | number | boolean | ShellLocalAssetRef>;
};

export type ShellLayoutWidthMode = 'fluid' | 'bounded';
export type ShellBoundedEdgeStyle = 'hairline' | 'shadow' | 'outset';

export type ShellVisualSystem = {
  colorScheme: 'light' | 'dark' | 'mixed';
  layoutWidth: ShellLayoutWidthMode;
  layoutWidthUserControl?: boolean;
  boundedMaxWidth: 'sm' | 'md' | 'lg';
  boundedEdge: ShellBoundedEdgeStyle;
  chromeDensity: 'compact' | 'default' | 'comfortable' | 'spacious';
  contentDensity: 'compact' | 'default' | 'comfortable' | 'spacious';
  motionLevel: 'none' | 'subtle' | 'expressive';
  designTokens: ShellDesignTokens;
  shapeDepth: ShellShapeDepth;
  typography: ShellTypographyProfile;
  backdrop: ShellBackdropTreatment;
  effects: { layers: ShellEffectLayer[]; isolation: boolean; overflow: 'clip' | 'visible'; reducedMotionFallback: 'static-frame' | 'simplified' | 'hidden' };
  logo: ShellLogoOptions;
  accentControl: 'hidden' | 'header';
  creative: ShellCreativeReferences;
};

export type ShellResponsiveRules = {
  strategy: 'mobile-first' | 'desktop-first' | 'adaptive';
  mobileNavigation: 'drawer' | 'popover' | 'stacked';
  overrides?: Partial<Record<'header' | 'sidebar' | 'hero' | 'content' | 'aside' | 'footer', Partial<Record<'desktop' | 'tablet' | 'phone', {
    presence?: 'visible' | 'hidden';
    order?: 0 | 1 | 2 | 3 | 4 | 5;
    span?: 'full' | 'contained' | 'inset';
    collapse?: 'none' | 'rail' | 'drawer' | 'popover' | 'stack';
    sticky?: boolean;
    safeArea?: 'none' | 'inline' | 'block-start' | 'all';
    scrollOwner?: 'page' | 'content-host';
  }>>>>;
};

export type ShellRecipeV1 = {
  schemaVersion: '1.0.0';
  registryVersion: '1.0.0';
  experienceMode: ShellExperienceMode;
  recipeId: ShellRecipeId;
  identity: ShellIdentity;
  capabilities: ShellCapabilityContext;
  regions: ShellRegions;
  navigation: ShellNavigation;
  visual: ShellVisualSystem;
  responsive: ShellResponsiveRules;
};

export type ShellDesignerMetadataV1 = {
  owner: 'shell-designer';
  schemaVersion: '1.0.0';
  registryVersion: '1.0.0';
  generatorVersion: string;
  experienceMode: ShellExperienceMode;
  recipeId: ShellRecipeId;
  recipe: ShellRecipeV1;
  compiledHash: string;
  compiledDocumentHash: string;
  managedStructureHash: string;
  managedNodeIds: string[];
  customizationState: 'recipe-managed' | 'designer-customized';
  starterLanding?: { pageKey: string; routePath: string; relationship: 'starter-landing' };
};

export type CreativeLandingMetadataV1 = {
  owner: 'creative-landing';
  schemaVersion: '1.0.0';
  registryVersion: '1.0.0';
  generatorVersion: string;
  pageKey: string;
  routePath: string;
  compiledHash: string;
  compiledDocumentHash: string;
  shell: { shellKey: string; relationship: 'starter-shell' };
};
