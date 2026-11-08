import { z } from 'zod';
import {
  APP_CREATIVE_ENGINE_IDS,
  APP_CREATIVE_MOTION_IDS,
  APP_CREATIVE_SCENE_IDS,
  APP_LANDING_WIDGET_IDS,
  CREATIVE_ENGINE_IDS,
  CREATIVE_MOTION_IDS,
  CREATIVE_SCENE_IDS,
  LANDING_WIDGET_IDS,
  SHELL_RECIPE_IDS,
  SHELL_TEXT_ROLES,
} from './types';

const strict = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();
const visibilitySchema = strict({ desktop: z.boolean(), tablet: z.boolean(), phone: z.boolean() });
const safeIdSchema = z.string().min(1).max(96).regex(/^[a-z][a-z0-9-]*$/);
const instanceIdSchema = z.string().min(1).max(64).regex(/^[a-z][a-z0-9-]*$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const localAssetRefSchema = z.string().regex(
  /^\/assets\/workspace\/[a-f0-9]{64}\.(?:png|jpg|jpeg|webp|avif|svg|ico)$/,
  'Only sanitized local workspace assets are allowed.',
);
const safeRoutePathSchema = z.string().min(1).max(2048).regex(
  /^\/(?!\/)(?!.*(?:\\|[\u0000-\u001f\u007f]))[^\s?#]*$/,
  'Route must be a normalized relative platform path.',
);
const safeHrefSchema = z.string().max(2048).refine((value) => {
  if (safeRoutePathSchema.safeParse(value).success) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}, 'Link must be a safe relative platform path or credential-free HTTPS URL.');

const semanticColorSchema = z.enum([
  'surface', 'surface-elevated', 'inverse-surface', 'surface-foreground',
  'surface-muted', 'neutral', 'accent', 'success', 'warning', 'danger', 'info',
]);
const colorValueSchema = strict({
  colorSpace: z.enum(['srgb', 'display-p3', 'oklch']),
  components: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
  alpha: z.number().finite().min(0).max(1),
  hex: z.string().regex(/^#[0-9A-F]{6}$/),
}).superRefine((value, context) => {
  const components = value.components as [number, number, number];
  const [a, b, c] = components;
  const valid = value.colorSpace === 'oklch'
    ? a >= 0 && a <= 1 && b >= 0 && b <= 0.4 && c >= 0 && c < 360
    : components.every((component) => component >= 0 && component <= 1);
  if (!valid) context.addIssue({ code: 'custom', path: ['components'], message: 'Color components are outside the selected color-space bounds.' });
});
const colorRefSchema = z.discriminatedUnion('source', [
  strict({ source: z.literal('semantic'), token: semanticColorSchema }),
  strict({ source: z.literal('custom'), value: colorValueSchema }),
]);

const gradientSchema = strict({
  type: z.enum(['linear', 'radial', 'conic']),
  direction: z.enum(['top', 'top-end', 'end', 'bottom-end', 'bottom', 'bottom-start', 'start', 'top-start']),
  stops: z.array(strict({
    color: colorRefSchema,
    position: z.union([z.literal(0), z.literal(10), z.literal(20), z.literal(25), z.literal(40), z.literal(50), z.literal(60), z.literal(75), z.literal(80), z.literal(90), z.literal(100)]),
  })).min(2).max(4),
  intensity: z.enum(['subtle', 'soft', 'medium', 'strong']),
}).superRefine((value, context) => {
  if (value.stops.some((stop, index) => index > 0 && stop.position <= value.stops[index - 1].position)) {
    context.addIssue({ code: 'custom', path: ['stops'], message: 'Gradient stop positions must be strictly ascending.' });
  }
});
const patternSchema = strict({
  kind: z.enum(['dots', 'halftone', 'grid', 'lines', 'diagonal-lines', 'noise', 'waves']),
  scale: z.enum(['xs', 'sm', 'md', 'lg', 'xl']),
  density: z.enum(['sparse', 'normal', 'dense']),
  opacity: z.enum(['faint', 'subtle', 'visible', 'strong']),
  color: colorRefSchema,
  blend: z.enum(['normal', 'multiply', 'soft-light', 'overlay']),
});
const backdropSchema = z.discriminatedUnion('mode', [
  strict({ mode: z.literal('solid'), baseColor: colorRefSchema }),
  strict({ mode: z.literal('gradient'), baseColor: colorRefSchema, gradient: gradientSchema }),
  strict({ mode: z.literal('pattern'), baseColor: colorRefSchema, pattern: patternSchema }),
  strict({ mode: z.literal('gradient-pattern'), baseColor: colorRefSchema, gradient: gradientSchema, pattern: patternSchema }),
]);
const inheritedBackdropSchema = z.union([backdropSchema, strict({ mode: z.literal('inherit') })]);

const radiusSchema = z.enum(['none', 'xs', 'sm', 'md', 'lg', 'xl']);
const shadowSchema = strict({
  level: radiusSchema,
  softness: z.enum(['crisp', 'balanced', 'diffused']),
  target: z.enum(['content-only', 'chrome-only', 'layered']),
});
const borderSchema = strict({
  strength: z.enum(['none', 'hairline', 'soft', 'defined']),
  contrast: z.enum(['low', 'medium', 'high']),
});
const depthBackdropSchema = strict({
  style: z.enum(['solid', 'translucent', 'glass']),
  blur: z.enum(['none', 'sm', 'md', 'lg']),
});
const regionShapeDepthSchema = z.union([
  strict({ mode: z.literal('inherit') }),
  strict({
    radius: z.union([z.literal('inherit'), radiusSchema]).optional(),
    shadow: z.union([z.literal('inherit'), shadowSchema]).optional(),
    border: z.union([z.literal('inherit'), borderSchema]).optional(),
    backdrop: z.union([z.literal('inherit'), depthBackdropSchema]).optional(),
  }),
]);

const regionBaseShape = {
  presence: z.literal('visible'),
  span: z.enum(['full', 'contained', 'inset']),
  placement: z.enum(['start', 'center', 'end', 'space-between']),
  padding: z.enum(['none', 'xs', 'sm', 'md', 'lg']),
  gap: z.enum(['none', 'xs', 'sm', 'md', 'lg']),
  separator: z.enum(['none', 'hairline', 'surface-shift', 'shadow']),
  visibility: visibilitySchema,
  surfaceTreatment: inheritedBackdropSchema,
  shapeDepth: regionShapeDepthSchema,
  readability: z.enum(['none', 'auto-scrim', 'solid-panel']),
} satisfies z.ZodRawShape;
const hiddenRegionSchema = strict({ presence: z.literal('hidden') });
const headerRegionSchema = z.discriminatedUnion('presence', [
  hiddenRegionSchema,
  strict({
    ...regionBaseShape,
    behavior: z.enum(['static', 'sticky', 'sticky-shrink']),
    height: z.enum(['compact', 'default', 'tall']),
    composition: z.enum(['logo-nav-actions', 'centered-nav', 'stacked-brand-nav', 'minimal']),
    titleStyle: z.enum(['breadcrumb', 'page-title', 'title-and-context', 'hidden']),
    contextLine: z.enum(['none', 'route-description', 'portal-name']),
    actionsMode: z.enum(['none', 'single-cta', 'action-group', 'workspace-actions']),
    actionPlacement: z.enum(['start', 'center', 'end']),
    showProfile: z.boolean(),
    showNotifications: z.boolean(),
    brandPlacement: z.enum(['start', 'center', 'nav-embedded']),
    edgeStyle: z.enum(['flush', 'inset', 'floating-bar']),
    showPortalMenu: z.boolean(),
    showLogo: z.boolean(),
  }),
]);
const sidebarRegionSchema = z.discriminatedUnion('presence', [
  hiddenRegionSchema,
  strict({
    ...regionBaseShape,
    layout: z.enum(['fixed', 'icon-rail', 'overlay', 'floating']),
    position: z.enum(['start', 'end']),
    width: z.enum(['compact', 'comfortable', 'spacious']),
    header: z.enum(['none', 'logo', 'brand-and-title', 'minimal']),
    footer: z.enum(['none', 'utilities', 'profile']),
    edgeStyle: z.enum(['flush', 'rounded-inner', 'floating-panel']),
  }),
]);
const heroRegionSchema = z.discriminatedUnion('presence', [
  hiddenRegionSchema,
  strict({ ...regionBaseShape, mode: z.enum(['compact', 'full-bleed']) }),
]);
const asideRegionSchema = z.discriminatedUnion('presence', [
  hiddenRegionSchema,
  strict({
    ...regionBaseShape,
    behavior: z.enum(['static', 'sticky', 'collapsible']),
    position: z.enum(['start', 'end']),
    width: z.enum(['sm', 'md', 'lg']),
  }),
]);
const footerRegionSchema = z.discriminatedUnion('presence', [
  hiddenRegionSchema,
  strict({ ...regionBaseShape, mode: z.enum(['simple', 'multi-column', 'action-bar']), behavior: z.enum(['static', 'sticky']) }),
]);
const contentRegionSchema = strict({
  ...regionBaseShape,
  composition: z.enum(['single-column', 'content-aside', 'aside-content']),
  contentWidth: z.enum(['fluid', 'boxed-sm', 'boxed-md', 'boxed-lg']),
  hostStyle: z.enum(['plain', 'card', 'inset-panel']),
  separation: z.enum(['spacing', 'hairline', 'surface-shift', 'shadow']),
  gutter: z.enum(['compact', 'comfortable', 'spacious']),
  dockPadding: z.boolean(),
  scrollOwner: z.enum(['page', 'content-host']),
  scrollShadow: z.boolean(),
  backToTop: z.enum(['hidden', 'after-viewport']),
  routeOutlet: strict({ count: z.literal(1), region: z.literal('content') }),
});
const regionsSchema = strict({
  header: headerRegionSchema,
  sidebar: sidebarRegionSchema,
  hero: heroRegionSchema,
  content: contentRegionSchema,
  aside: asideRegionSchema,
  footer: footerRegionSchema,
});

const megaSchema = strict({
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  panelWidth: z.enum(['trigger', 'contained', 'wide', 'full']),
  groupStyle: z.enum(['plain', 'sectioned', 'cards']),
  openBehavior: z.enum(['click', 'hover-and-click']),
  featuredArea: z.enum(['none', 'start', 'end']),
  showGroupIcons: z.boolean(),
  showDescriptions: z.boolean(),
  surfaceTreatment: inheritedBackdropSchema,
  shapeDepth: regionShapeDepthSchema,
  readability: z.enum(['none', 'auto-scrim', 'solid-panel']),
});
const sideNavigationSchema = z.discriminatedUnion('mode', [
  strict({ mode: z.literal('standard'), componentId: z.enum(['core:TreeNavTwoLevel', 'core:SidebarRailNavigation']), navigationRef: safeIdSchema.optional(), density: z.enum(['compact', 'default', 'relaxed']) }),
  strict({ mode: z.literal('mega'), componentId: z.literal('core:MegaMenu'), navigationRef: safeIdSchema.optional(), density: z.enum(['compact', 'default', 'relaxed']), mega: megaSchema }),
]);
const topNavigationSchema = z.discriminatedUnion('mode', [
  strict({ mode: z.literal('standard'), componentId: z.enum(['core:TopBarNav', 'core:TopNavigationOverflow']), navigationRef: safeIdSchema.optional(), density: z.enum(['compact', 'default', 'relaxed']), alignment: z.enum(['start', 'center', 'end', 'space-between']) }),
  strict({ mode: z.literal('mega'), componentId: z.literal('core:TopMegaNavigation'), navigationRef: safeIdSchema.optional(), density: z.enum(['compact', 'default', 'relaxed']), alignment: z.enum(['start', 'center', 'end', 'space-between']), mega: megaSchema }),
]);
const navigationSchema = strict({
  topology: z.enum(['sidebar', 'topbar', 'hybrid', 'none']),
  primaryNavigationRef: safeIdSchema.optional(),
  escapePath: z.enum(['header-breadcrumb', 'header-portal-menu']).optional(),
  presentation: strict({
    showIcons: z.boolean(),
    labelMode: z.enum(['label', 'icon-and-label', 'icon-only']),
    activeIndicator: z.enum(['bar', 'pill', 'underline', 'surface']),
    groupDefault: z.enum(['collapsed', 'expanded-active', 'expanded-all']),
    groupExpansion: z.enum(['accordion', 'multiple']),
    groupStyle: z.enum(['plain', 'divided', 'cards']),
    showBadges: z.boolean(),
    utilities: z.array(z.enum(['search', 'profile', 'notifications'])).max(3),
  }),
  side: sideNavigationSchema.optional(),
  top: topNavigationSchema.optional(),
  footer: strict({ mode: z.literal('standard'), componentId: z.literal('core:FlatLinks'), navigationRef: safeIdSchema }).optional(),
});

const textStyleSchema = strict({
  color: colorRefSchema,
  fontProfileId: z.union([z.literal('inherit'), z.string().regex(/^[a-z][a-z0-9-]{1,63}$/)]),
  size: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']),
  weight: z.enum(['regular', 'medium', 'semibold', 'bold']),
  lineHeight: z.enum(['tight', 'snug', 'normal', 'relaxed']),
  tracking: z.enum(['tight', 'normal', 'wide']),
  transform: z.enum(['none', 'uppercase']),
});
const textRoleShape = Object.fromEntries(SHELL_TEXT_ROLES.map((role) => [role, textStyleSchema])) as Record<(typeof SHELL_TEXT_ROLES)[number], typeof textStyleSchema>;
const partialTextRoleShape = Object.fromEntries(SHELL_TEXT_ROLES.map((role) => [role, textStyleSchema.optional()])) as Record<(typeof SHELL_TEXT_ROLES)[number], z.ZodOptional<typeof textStyleSchema>>;
const typographySchema = strict({
  roles: strict(textRoleShape),
  inverseRoles: strict(partialTextRoleShape).optional(),
  regionOverrides: strict({
    header: strict(partialTextRoleShape).optional(),
    sidebar: strict(partialTextRoleShape).optional(),
    hero: strict(partialTextRoleShape).optional(),
    content: strict(partialTextRoleShape).optional(),
    footer: strict(partialTextRoleShape).optional(),
    'mega-panel': strict(partialTextRoleShape).optional(),
  }).optional(),
});

const logoAssetSchema = z.discriminatedUnion('source', [
  strict({ source: z.literal('platform-default') }),
  strict({ source: z.literal('local-asset'), assetRef: localAssetRefSchema }),
]);
const logoSchema = strict({
  main: logoAssetSchema,
  compact: logoAssetSchema.optional(),
  darkSurface: logoAssetSchema.optional(),
  favicon: logoAssetSchema.optional(),
  alt: z.string().max(160),
  decorative: z.boolean(),
  href: safeHrefSchema.optional(),
  fit: z.enum(['contain', 'cover']),
  renderStyle: z.enum(['original', 'monochrome', 'accent-tinted']),
  placements: z.array(strict({
    region: z.enum(['header', 'sidebar', 'footer']),
    display: z.enum(['full', 'mark-only', 'text-and-mark']),
    size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']),
    placement: z.enum(['start', 'center', 'end']),
    visibility: visibilitySchema,
  })).min(1).max(3),
}).superRefine((value, context) => {
  if (value.decorative !== (value.alt.length === 0)) context.addIssue({ code: 'custom', path: ['alt'], message: 'Logo alt must be empty exactly when the logo is decorative.' });
  if (new Set(value.placements.map((item) => item.region)).size !== value.placements.length) context.addIssue({ code: 'custom', path: ['placements'], message: 'Logo placement regions must be unique.' });
});

const creativeSchema = strict({
  widgets: z.array(strict({
    instanceId: instanceIdSchema,
    widgetId: z.enum(LANDING_WIDGET_IDS),
    host: z.enum(['header', 'hero', 'content', 'aside', 'footer']),
    assetRefs: z.array(localAssetRefSchema).max(24).optional(),
  })).max(24),
  motions: z.array(strict({
    instanceId: instanceIdSchema,
    motionId: z.enum(CREATIVE_MOTION_IDS),
    targetId: instanceIdSchema,
    intensity: z.enum(['subtle', 'standard', 'expressive']),
    reducedMotion: z.enum(['reduce', 'replace', 'disable']),
  })).max(8),
  scenes: z.array(strict({
    instanceId: instanceIdSchema,
    sceneId: z.enum(CREATIVE_SCENE_IDS),
    host: z.enum(['hero', 'content', 'aside', 'footer']),
    plane: z.enum(['background', 'foreground']),
    preset: z.enum(['calm', 'balanced', 'expressive']),
    fallbackAsset: localAssetRefSchema.optional(),
  })).max(3),
  engines: z.array(strict({
    instanceId: instanceIdSchema,
    engineId: z.enum(CREATIVE_ENGINE_IDS),
    runtimeEngine: z.enum(['canvas-2d', 'webgl-three']),
    costTier: z.enum(['high', 'extreme']),
    authoringTier: z.enum(['enhanced', 'advanced']),
    fallback: strict({
      kind: z.enum(['static', 'css-svg', 'canvas-2d', 'semantic-dom']),
      catalogId: safeIdSchema,
      assetRef: localAssetRefSchema.optional(),
    }),
  })).max(1),
}).superRefine((value, context) => {
  for (const [name, entries] of Object.entries(value)) {
    const ids = entries.map((entry) => entry.instanceId);
    if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', path: [name], message: `${name} instance IDs must be unique.` });
  }
  const pairs = value.motions.map((item) => `${item.motionId}:${item.targetId}`);
  if (new Set(pairs).size !== pairs.length) context.addIssue({ code: 'custom', path: ['motions'], message: 'Motion behavior and target pairs must be unique.' });
  const foregroundHosts = value.scenes.filter((item) => item.plane === 'foreground').map((item) => item.host);
  if (new Set(foregroundHosts).size !== foregroundHosts.length) context.addIssue({ code: 'custom', path: ['scenes'], message: 'Only one foreground scene may target a host.' });
  value.engines.forEach((engine, index) => {
    const expected = engine.engineId.startsWith('canvas-') ? ['canvas-2d', 'high', 'enhanced'] : [
      'webgl-three',
      engine.engineId.startsWith('three-product') || engine.engineId === 'three-model-orbit' || engine.engineId === 'three-spatial-gallery' ? 'extreme' : 'high',
      'advanced',
    ];
    if (engine.runtimeEngine !== expected[0] || engine.costTier !== expected[1] || engine.authoringTier !== expected[2]) {
      context.addIssue({ code: 'custom', path: ['engines', index], message: 'Engine runtime, cost and authoring tiers do not match the frozen catalog.' });
    }
    if (engine.runtimeEngine === 'webgl-three' && engine.fallback.kind === 'canvas-2d' && !engine.fallback.catalogId.startsWith('canvas-')) {
      context.addIssue({ code: 'custom', path: ['engines', index, 'fallback'], message: 'Canvas fallback must reference a registered Canvas catalog ID.' });
    }
  });
});

const stepped = (minimum: number, maximum: number, step: number, origin = 0) =>
  z.number().int().min(minimum).max(maximum).refine((value) => (value - origin) % step === 0);
const effectLayerBaseShape = {
  id: z.string().regex(/^layer-[a-z0-9-]{1,48}$/),
  target: z.enum(['page', 'header', 'sidebar', 'hero', 'content-host', 'aside', 'footer', 'mega-panel']),
  plane: z.enum(['underlay', 'background', 'overlay']),
  palette: z.array(colorRefSchema).min(1).max(4),
  intensity: z.enum(['subtle', 'soft', 'medium', 'strong']),
  speed: z.enum(['still', 'slow', 'medium', 'fast']),
  density: z.enum(['sparse', 'normal', 'dense']),
  scale: z.enum(['xs', 'sm', 'md', 'lg', 'xl']),
  direction: z.enum(['forward', 'reverse', 'alternate']),
  opacity: z.enum(['faint', 'subtle', 'visible', 'strong']),
  blend: z.enum(['normal', 'multiply', 'screen', 'soft-light', 'overlay']),
  interaction: z.enum(['none', 'scroll', 'pointer']),
  seed: z.number().int().min(0).max(2_147_483_647),
  visibility: visibilitySchema,
} satisfies z.ZodRawShape;
const effect = <Id extends string, Config extends z.ZodType>(
  effectId: Id,
  config: Config,
) => strict({ ...effectLayerBaseShape, effectId: z.literal(effectId), config });
const effectLayerSchema = z.discriminatedUnion('effectId', [
  effect('animated-gradient', strict({ angle: stepped(0, 345, 15), duration: z.number().int().min(8).max(60), stops: z.union([z.literal(2), z.literal(3), z.literal(4)]) })),
  effect('mesh-gradient', strict({ points: z.number().int().min(3).max(8), morph: stepped(0, 100, 10), blur: stepped(16, 96, 8, 16) })),
  effect('aurora', strict({ bands: z.number().int().min(1).max(5), spread: stepped(20, 100, 10), wave: stepped(0, 100, 10) })),
  effect('gradient-orbs', strict({ orbs: z.number().int().min(1).max(6), blur: stepped(16, 96, 8, 16), drift: stepped(0, 100, 10) })),
  effect('floating-blobs', strict({ blobs: z.number().int().min(1).max(6), complexity: z.number().int().min(3).max(8), morph: stepped(0, 100, 10) })),
  effect('flowing-waves', strict({ waves: z.number().int().min(1).max(8), amplitude: stepped(4, 80, 4), frequency: z.number().int().min(1).max(8) })),
  effect('light-rays', strict({ rays: z.number().int().min(2).max(12), spread: stepped(10, 120, 10), rotation: stepped(0, 345, 15) })),
  effect('conic-rays', strict({ rays: stepped(4, 24, 2), rotation: stepped(0, 345, 15), softness: stepped(0, 100, 10) })),
  effect('shimmer-bands', strict({ bands: z.number().int().min(1).max(5), width: stepped(4, 40, 4), angle: stepped(0, 345, 15) })),
  effect('film-grain', strict({ grain: stepped(5, 100, 5), monochrome: z.boolean(), frameRate: z.union([z.literal(6), z.literal(12), z.literal(24)]) })),
  effect('particle-field', strict({ count: z.number().int().min(10).max(120), size: z.number().int().min(1).max(8), drift: stepped(0, 100, 10), connections: z.boolean() })),
  effect('starfield', strict({ count: z.number().int().min(10).max(120), twinkle: stepped(0, 100, 10), depth: z.number().int().min(1).max(5) })),
  effect('animated-dot-field', strict({ count: z.number().int().min(10).max(120), size: z.number().int().min(1).max(8), pulse: stepped(0, 100, 10) })),
  effect('perspective-grid', strict({ spacing: stepped(8, 64, 8), perspective: stepped(100, 1200, 100), horizon: stepped(10, 90, 10) })),
  effect('floating-geometry', strict({ shapes: z.number().int().min(1).max(12), rotation: stepped(0, 100, 10), drift: stepped(0, 100, 10) })),
  effect('image-depth-pan', strict({ assetRef: localAssetRefSchema, zoom: stepped(100, 130, 5), pan: stepped(0, 100, 10), focalX: z.number().int().min(0).max(100), focalY: z.number().int().min(0).max(100) })),
  effect('scroll-parallax', strict({ layers: z.number().int().min(2).max(6), depth: z.number().int().min(1).max(5), axis: z.enum(['x', 'y', 'both']), range: stepped(10, 100, 10) })),
  effect('pointer-parallax', strict({ layers: z.number().int().min(2).max(6), depth: z.number().int().min(1).max(5), lag: stepped(0, 100, 10), range: stepped(4, 48, 4) })),
  effect('cursor-spotlight', strict({ radius: stepped(40, 400, 20), softness: stepped(0, 100, 10), lag: stepped(0, 100, 10) })),
  effect('section-reveal', strict({ style: z.enum(['fade', 'slide', 'scale', 'mask']), distance: stepped(0, 64, 8), stagger: stepped(0, 300, 50), threshold: z.union([z.literal(0.1), z.literal(0.25), z.literal(0.5), z.literal(0.75)]), once: z.boolean() })),
]);

const responsiveOverrideSchema = strict({
  presence: z.enum(['visible', 'hidden']).optional(),
  order: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  span: z.enum(['full', 'contained', 'inset']).optional(),
  collapse: z.enum(['none', 'rail', 'drawer', 'popover', 'stack']).optional(),
  sticky: z.boolean().optional(),
  safeArea: z.enum(['none', 'inline', 'block-start', 'all']).optional(),
  scrollOwner: z.enum(['page', 'content-host']).optional(),
});
const viewportOverridesSchema = strict({
  desktop: responsiveOverrideSchema.optional(),
  tablet: responsiveOverrideSchema.optional(),
  phone: responsiveOverrideSchema.optional(),
});

export const shellRecipeV1Schema = strict({
  schemaVersion: z.literal('1.0.0'),
  registryVersion: z.literal('1.0.0'),
  experienceMode: z.enum(['app', 'site']),
  recipeId: z.enum(SHELL_RECIPE_IDS),
  identity: strict({
    shellKey: z.string().regex(/^[a-z][a-z0-9-]{2,63}$/),
    displayName: z.string().min(1).max(80),
    description: z.string().max(240).optional(),
  }),
  capabilities: strict({
    authentication: z.enum(['anonymous', 'authenticated']),
    portalIdentity: z.boolean(),
    userPreferences: z.boolean(),
    navigationDepth: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  }),
  regions: regionsSchema,
  navigation: navigationSchema,
  visual: strict({
    colorScheme: z.enum(['light', 'dark', 'mixed']),
    layoutWidth: z.enum(['fluid', 'bounded']),
    layoutWidthUserControl: z.boolean().optional(),
    boundedMaxWidth: z.enum(['sm', 'md', 'lg']),
    boundedEdge: z.enum(['hairline', 'shadow', 'outset']),
    chromeDensity: z.enum(['compact', 'default', 'comfortable', 'spacious']),
    contentDensity: z.enum(['compact', 'default', 'comfortable', 'spacious']),
    motionLevel: z.enum(['none', 'subtle', 'expressive']),
    designTokens: strict({
      profile: z.enum(['platform-default', 'neutral-soft', 'neutral-crisp', 'custom']),
      accent: z.union([strict({ source: z.literal('runtime-accent') }), colorRefSchema]),
      neutralFamily: z.enum(['slate', 'gray', 'zinc']),
      surfaceBias: z.enum(['cool', 'neutral', 'warm']),
    }),
    shapeDepth: strict({
      radius: strict({
        global: radiusSchema,
        header: z.union([z.literal('inherit'), radiusSchema]).optional(),
        sidebar: z.union([z.literal('inherit'), radiusSchema]).optional(),
        contentHost: z.union([z.literal('inherit'), radiusSchema]).optional(),
        panels: z.union([z.literal('inherit'), radiusSchema]).optional(),
        footer: z.union([z.literal('inherit'), radiusSchema]).optional(),
      }),
      shadow: shadowSchema,
      border: borderSchema,
      backdrop: depthBackdropSchema,
    }),
    typography: typographySchema,
    backdrop: backdropSchema,
    effects: strict({
      layers: z.array(effectLayerSchema).max(4),
      isolation: z.boolean(),
      overflow: z.enum(['clip', 'visible']),
      reducedMotionFallback: z.enum(['static-frame', 'simplified', 'hidden']),
    }),
    logo: logoSchema,
    accentControl: z.enum(['hidden', 'header']),
    creative: creativeSchema,
  }),
  responsive: strict({
    strategy: z.enum(['mobile-first', 'desktop-first', 'adaptive']),
    mobileNavigation: z.enum(['drawer', 'popover', 'stacked']),
    overrides: strict({
      header: viewportOverridesSchema.optional(),
      sidebar: viewportOverridesSchema.optional(),
      hero: viewportOverridesSchema.optional(),
      content: viewportOverridesSchema.optional(),
      aside: viewportOverridesSchema.optional(),
      footer: viewportOverridesSchema.optional(),
    }).optional(),
  }),
}).superRefine((recipe, context) => {
  const add = (path: PropertyKey[], message: string) => context.addIssue({ code: 'custom', path, message });
  if (!recipe.recipeId.startsWith(`${recipe.experienceMode}-`)) add(['recipeId'], 'Recipe ID is incompatible with experience mode.');
  if (recipe.experienceMode === 'app' && (recipe.capabilities.authentication !== 'authenticated' || !recipe.capabilities.userPreferences)) add(['capabilities'], 'App mode requires authenticated user preferences.');
  if (recipe.capabilities.userPreferences && recipe.capabilities.authentication !== 'authenticated') add(['capabilities', 'userPreferences'], 'User preferences require authentication.');
  if (recipe.regions.content.routeOutlet.count !== 1) add(['regions', 'content', 'routeOutlet'], 'Exactly one route outlet is required.');

  const { topology, side, top, escapePath, primaryNavigationRef } = recipe.navigation;
  const topologyMatches =
    (topology === 'sidebar' && Boolean(side) && !top) ||
    (topology === 'topbar' && Boolean(top) && !side) ||
    (topology === 'hybrid' && Boolean(side) && Boolean(top)) ||
    (topology === 'none' && !side && !top);
  if (!topologyMatches) add(['navigation'], 'Topology requires exactly its active side/top branches; inactive branches must be omitted.');
  if (topology !== 'none' && escapePath) add(['navigation', 'escapePath'], 'Escape path is allowed only when navigation topology is none.');
  if (topology === 'none' && recipe.capabilities.navigationDepth > 0 && !escapePath) add(['navigation', 'escapePath'], 'Navigation-free recipes with depth require an escape path.');
  if (side && recipe.regions.sidebar.presence !== 'visible') add(['navigation', 'side'], 'Side navigation requires a visible sidebar.');
  if (top && recipe.regions.header.presence !== 'visible') add(['navigation', 'top'], 'Top navigation requires a visible header.');
  if (recipe.navigation.footer && recipe.regions.footer.presence !== 'visible') add(['navigation', 'footer'], 'Footer navigation requires a visible footer.');
  if ((side && !(side.navigationRef ?? primaryNavigationRef)) || (top && !(top.navigationRef ?? primaryNavigationRef))) add(['navigation', 'primaryNavigationRef'], 'Every active navigation branch must resolve a navigation reference.');
  if (new Set(recipe.navigation.presentation.utilities).size !== recipe.navigation.presentation.utilities.length) add(['navigation', 'presentation', 'utilities'], 'Navigation utilities must be unique.');
  if (recipe.navigation.presentation.labelMode === 'icon-only' && !recipe.navigation.presentation.showIcons) add(['navigation', 'presentation'], 'Icon-only labels require icons.');
  if (!recipe.navigation.presentation.showIcons && recipe.navigation.presentation.labelMode !== 'label') add(['navigation', 'presentation'], 'Navigation without icons must use labels.');

  const header = recipe.regions.header;
  if (header.presence === 'visible') {
    if (header.titleStyle === 'hidden' && header.contextLine !== 'none') add(['regions', 'header', 'contextLine'], 'Hidden title requires no context line.');
    if (header.contextLine === 'portal-name' && !recipe.capabilities.portalIdentity) add(['regions', 'header', 'contextLine'], 'Portal-name context requires portal identity.');
    if ((header.showProfile || header.showNotifications) && recipe.capabilities.authentication !== 'authenticated') add(['regions', 'header'], 'Profile and notification controls require authentication.');
  }
  if (recipe.visual.accentControl === 'header') {
    if (header.presence !== 'visible' || recipe.capabilities.authentication !== 'authenticated' || !recipe.capabilities.userPreferences || recipe.visual.designTokens.accent.source !== 'runtime-accent') {
      add(['visual', 'accentControl'], 'Header accent control requires a visible header and authenticated runtime-accent preferences.');
    }
  }
  if (recipe.experienceMode === 'app' && recipe.visual.accentControl !== 'header') add(['visual', 'accentControl'], 'App mode requires the header accent control.');

  const visible = (region: keyof typeof recipe.regions) => recipe.regions[region].presence === 'visible';
  for (const [regionName, region] of Object.entries(recipe.regions)) {
    if (region.presence !== 'visible') continue;
    const treatment = region.surfaceTreatment.mode === 'inherit'
      ? recipe.visual.backdrop.mode
      : region.surfaceTreatment.mode;
    if (treatment !== 'solid' && region.readability === 'none') {
      add(
        ['regions', regionName, 'readability'],
        'Text-bearing regions over dynamic backgrounds require auto-scrim or solid-panel readability treatment.',
      );
    }
  }
  recipe.visual.logo.placements.forEach((placement, index) => {
    if (!visible(placement.region)) add(['visual', 'logo', 'placements', index], 'Logo placement requires a visible region.');
  });
  recipe.visual.effects.layers.forEach((layer, index) => {
    const region = layer.target === 'content-host' ? 'content' : layer.target === 'mega-panel' || layer.target === 'page' ? null : layer.target;
    if (region && !visible(region)) add(['visual', 'effects', 'layers', index], 'Effect cannot target a hidden region.');
  });
  if (new Set(recipe.visual.effects.layers.map((layer) => layer.id)).size !== recipe.visual.effects.layers.length) add(['visual', 'effects', 'layers'], 'Effect layer IDs must be unique.');

  if (recipe.experienceMode === 'app') {
    const allowedWidgets = new Set<string>(APP_LANDING_WIDGET_IDS);
    const allowedMotions = new Set<string>(APP_CREATIVE_MOTION_IDS);
    const allowedScenes = new Set<string>(APP_CREATIVE_SCENE_IDS);
    const allowedEngines = new Set<string>(APP_CREATIVE_ENGINE_IDS);
    recipe.visual.creative.widgets.forEach((item, index) => { if (!allowedWidgets.has(item.widgetId)) add(['visual', 'creative', 'widgets', index, 'widgetId'], 'Widget is site-primary and not app compatible.'); });
    recipe.visual.creative.motions.forEach((item, index) => { if (!allowedMotions.has(item.motionId)) add(['visual', 'creative', 'motions', index, 'motionId'], 'Motion is site-primary and not app compatible.'); });
    recipe.visual.creative.scenes.forEach((item, index) => { if (!allowedScenes.has(item.sceneId)) add(['visual', 'creative', 'scenes', index, 'sceneId'], 'Scene is site-primary and not app compatible.'); });
    recipe.visual.creative.engines.forEach((item, index) => { if (!allowedEngines.has(item.engineId)) add(['visual', 'creative', 'engines', index, 'engineId'], 'Engine is site-primary and not app compatible.'); });
  }

  if (recipe.responsive.overrides) {
    for (const [region, viewports] of Object.entries(recipe.responsive.overrides)) {
      for (const [viewport, override] of Object.entries(viewports ?? {})) {
        if (region !== 'content' && override?.scrollOwner !== undefined) add(['responsive', 'overrides', region, viewport, 'scrollOwner'], 'Only content may override scroll ownership.');
      }
    }
  }
});

export const shellDesignerMetadataV1Schema = strict({
  owner: z.literal('shell-designer'),
  schemaVersion: z.literal('1.0.0'),
  registryVersion: z.literal('1.0.0'),
  generatorVersion: z.string().min(1).max(96),
  experienceMode: z.enum(['app', 'site']),
  recipeId: z.enum(SHELL_RECIPE_IDS),
  recipe: shellRecipeV1Schema,
  compiledHash: sha256Schema,
  compiledDocumentHash: sha256Schema,
  managedStructureHash: sha256Schema,
  managedNodeIds: z.array(z.string().regex(/^ss-[a-f0-9]{16}$/)).max(500),
  customizationState: z.enum(['recipe-managed', 'designer-customized']),
  starterLanding: strict({
    pageKey: z.string().regex(/^[a-z][a-z0-9-]{2,63}$/),
    routePath: safeRoutePathSchema,
    relationship: z.literal('starter-landing'),
  }).optional(),
}).superRefine((metadata, context) => {
  if (metadata.experienceMode !== metadata.recipe.experienceMode) context.addIssue({ code: 'custom', path: ['experienceMode'], message: 'Metadata mode must match recipe mode.' });
  if (metadata.recipeId !== metadata.recipe.recipeId) context.addIssue({ code: 'custom', path: ['recipeId'], message: 'Metadata recipe ID must match recipe.' });
  if (new Set(metadata.managedNodeIds).size !== metadata.managedNodeIds.length) context.addIssue({ code: 'custom', path: ['managedNodeIds'], message: 'Managed node IDs must be unique.' });
});

export const creativeLandingMetadataV1Schema = strict({
  owner: z.literal('creative-landing'),
  schemaVersion: z.literal('1.0.0'),
  registryVersion: z.literal('1.0.0'),
  generatorVersion: z.string().min(1).max(96),
  pageKey: z.string().regex(/^[a-z][a-z0-9-]{2,63}$/),
  routePath: safeRoutePathSchema,
  compiledHash: sha256Schema,
  compiledDocumentHash: sha256Schema,
  shell: strict({
    shellKey: z.string().regex(/^[a-z][a-z0-9-]{2,63}$/),
    relationship: z.literal('starter-shell'),
  }),
});

export { localAssetRefSchema as shellLocalAssetRefSchema, sha256Schema };
