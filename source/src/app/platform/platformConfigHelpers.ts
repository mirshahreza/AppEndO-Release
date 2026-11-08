import type {
  MountExperienceCalendar,
  MountExperienceDirection,
  PlatformMount,
  PlatformPageModule,
  PlatformRouteBinding,
  PlatformRuntimeConfig,
  PlatformShell,
  PlatformShellRule,
} from '../../shared/api/contracts/platform/types';
import {
  STUDIO_PORTAL_SEGMENT,
  COMPONENT_ALONE_PORTAL_SEGMENT,
  EXPERIENCE_ROUTE_SOURCE,
  HOME_SHELL_KEY,
  ROOT_PORTAL_SEGMENT,
  STUDIO_MOUNT_ID,
  BASE_COMPONENTS_NAV_LANDING_SECTION,
  BASE_COMPONENTS_PAGE_KEY,
  SETTINGS_NAV_LANDING_SECTION,
  SETTINGS_PAGE_KEY,
  portalBindingIdentityKey,
  toPortalRelativePattern,
  toPortalRoutePattern,
} from '../../shared/api/contracts/platform/mountConstants';
import { normalizePortalPagePath } from '../../shared/api/contracts/platform/experienceManifest';
import { parseDesignerComponentPath } from '../../shared/lib/designerComponentPath';
import { getEnabledCulturePackIds } from '../../core/culture/CultureRegistry';
import {
  HAWIETY_PORTAL_SEGMENT,
  isHawietyRoutePattern,
} from '../../core/packages/hawietyPackage';
import { resolveMountCulture } from '../../core/culture/MountCultureResolver';

function bindingMergePriority(binding: PlatformRouteBinding): number {
  if (binding.source === EXPERIENCE_ROUTE_SOURCE) {
    return 3;
  }

  if (binding.id >= 0) {
    return 2;
  }

  return 1;
}

function dedupeExperienceMountBindings(bindings: PlatformRouteBinding[]): PlatformRouteBinding[] {
  const byKey = new Map<string, PlatformRouteBinding>();

  for (const binding of bindings) {
    const key = portalBindingIdentityKey(binding.routePattern, binding.pageKey);
    const existing = byKey.get(key);
    if (!existing || bindingMergePriority(binding) > bindingMergePriority(existing)) {
      byKey.set(key, binding);
    }
  }

  return [...byKey.values()];
}

export function resolveMountDirection(mount: PlatformMount): MountExperienceDirection {
  return resolveMountCulture(mount).direction;
}

export function resolveMountCalendar(mount: PlatformMount): MountExperienceCalendar {
  return resolveMountCulture(mount).calendar;
}

export function getEnabledMounts(config: PlatformRuntimeConfig): PlatformMount[] {
  return config.mounts.filter((mount) => mount.enabled);
}

function getRegistryMountById(
  config: PlatformRuntimeConfig,
  mountId: string,
): PlatformMount | undefined {
  return config.mounts.find((mount) => mount.id === mountId);
}

/** Culture routes use URL prefix — no dedicated mount entity in registry. */
export function isCultureRouteId(cultureId: string): boolean {
  const normalized = cultureId.trim();
  return normalized.length > 0 && getEnabledCulturePackIds().includes(normalized);
}

/** Legacy registry mounts that duplicated culture as mount entities. */
export function isCultureExperienceMount(mount: PlatformMount): boolean {
  const cultureId = mount.cultureId?.trim();
  if (!cultureId) {
    return false;
  }

  return mount.id === cultureId && isCultureRouteId(cultureId);
}

export function buildCultureRouteMount(
  config: PlatformRuntimeConfig,
  cultureId: string,
): PlatformMount | undefined {
  if (!isCultureRouteId(cultureId)) {
    return undefined;
  }

  const studioMount = getRegistryMountById(config, STUDIO_MOUNT_ID);
  if (!studioMount?.enabled) {
    return undefined;
  }

  return {
    ...studioMount,
    id: cultureId,
    pathPrefix: `/${cultureId}`,
    name: cultureId,
    cultureId,
    designerRoutePropagation: 'auto',
    defaultRoute: `/${cultureId}/${STUDIO_PORTAL_SEGMENT}`,
    experienceConfig: undefined,
  };
}

export function getNonCultureEnabledMounts(config: PlatformRuntimeConfig): PlatformMount[] {
  return getEnabledMounts(config).filter(
    (mount) => mount.pathPrefix?.trim() && !isCultureExperienceMount(mount),
  );
}

export function resolveCultureRouteMount(
  config: PlatformRuntimeConfig,
  cultureId: string,
): PlatformMount | undefined {
  const registryMount = getRegistryMountById(config, cultureId);
  if (registryMount?.enabled && isCultureExperienceMount(registryMount)) {
    return registryMount;
  }

  return buildCultureRouteMount(config, cultureId);
}

export function getMountById(
  config: PlatformRuntimeConfig,
  mountId: string,
): PlatformMount | undefined {
  const registryMount = getRegistryMountById(config, mountId);
  if (registryMount) {
    return registryMount;
  }

  return buildCultureRouteMount(config, mountId);
}

export function getPageModuleByKey(
  config: PlatformRuntimeConfig,
  pageKey: string,
): PlatformPageModule | undefined {
  return config.pageModules.find((page) => page.pageKey === pageKey);
}

export function getShellByKey(
  config: PlatformRuntimeConfig,
  shellKey: string,
): PlatformShell | undefined {
  return config.shells.find((shell) => shell.shellKey === shellKey);
}

export type PortalShellLookup = {
  portalSegment: string;
  shellKey: string;
};

/**
 * Platform shell record for nav, brand, and 404 — not the designer layout draft key
 * stored in `PortalContext.shellKey` (e.g. `studio-shell` vs registry `hawiety`).
 */
export function resolveRegistryShellForPortal(
  config: PlatformRuntimeConfig,
  portal: PortalShellLookup | null | undefined,
): PlatformShell | undefined {
  if (!portal) {
    return undefined;
  }

  const candidateKeys: string[] = [];
  if (portal.portalSegment === ROOT_PORTAL_SEGMENT) {
    candidateKeys.push(HOME_SHELL_KEY);
  } else if (portal.portalSegment.trim()) {
    candidateKeys.push(portal.portalSegment.trim());
  }

  const layoutKey = portal.shellKey.trim();
  if (layoutKey && !candidateKeys.includes(layoutKey)) {
    candidateKeys.push(layoutKey);
  }

  for (const key of candidateKeys) {
    const shell = getShellByKey(config, key);
    if (shell) {
      return shell;
    }
  }

  return undefined;
}

/** Layout drafts (e.g. `studio-shell`) often hardcode `navigationRef: studio`; active portal wins. */
export function resolveExperiencePortalNavigationRef(
  portal: PortalShellLookup | null | undefined,
  registryShell: PlatformShell | undefined,
  slotNavigationRef?: string | null,
): string | null {
  const slotRef = slotNavigationRef?.trim() || null;
  const portalRef = registryShell?.navigationRef?.trim() || null;

  if (!slotRef) {
    return portalRef;
  }

  const portalSegment = portal?.portalSegment?.trim();
  if (
    portalSegment
    && portalSegment !== STUDIO_PORTAL_SEGMENT
    && portalRef
    && (slotRef === STUDIO_PORTAL_SEGMENT || slotRef === 'studio')
  ) {
    return portalRef;
  }

  return slotRef;
}

export function getBindingsForMount(
  config: PlatformRuntimeConfig,
  mountId: string,
): PlatformRouteBinding[] {
  const ownBindings = config.bindings.filter((binding) => binding.mountId === mountId && binding.enabled);

  const mount = getMountById(config, mountId);
  if (
    !mount?.enabled
    || mount.designerRoutePropagation !== 'auto'
    || mountId === STUDIO_MOUNT_ID
  ) {
    return ownBindings;
  }

  const studioBindings = config.bindings.filter(
    (binding) => binding.mountId === STUDIO_MOUNT_ID && binding.enabled,
  );
  const ownKeys = new Set(
    ownBindings.map((binding) => portalBindingIdentityKey(binding.routePattern, binding.pageKey)),
  );

  const inheritedBindings = studioBindings
    .filter((binding) => !ownKeys.has(portalBindingIdentityKey(binding.routePattern, binding.pageKey)))
    .map((binding) => ({
      ...binding,
      mountId,
      id: -binding.id,
      routePattern: inheritStudioRoutePattern(binding.routePattern, config),
    }));

  return dedupeExperienceMountBindings([...ownBindings, ...inheritedBindings]);
}

export function getRouteBindingById(
  config: PlatformRuntimeConfig,
  bindingId: number,
): PlatformRouteBinding | undefined {
  return config.bindings.find((binding) => binding.id === bindingId);
}

export function getShellRulesForMount(
  config: PlatformRuntimeConfig,
  mountId: string,
): PlatformShellRule[] {
  const registryRules = config.shellRules.filter((rule) => rule.mountId === mountId && rule.enabled);
  if (registryRules.length > 0) {
    return registryRules;
  }

  if (!isCultureRouteId(mountId)) {
    return [];
  }

  const studioRules = config.shellRules.filter(
    (rule) => rule.mountId === STUDIO_MOUNT_ID && rule.enabled,
  );

  return studioRules.map((rule) => ({
    ...rule,
    mountId,
    pathPrefix: rule.pathPrefix.replace(/^\/studio(?=\/|$)/, `/${mountId}/studio`),
  }));
}

export function toMountRelativePath(pathname: string, mountPathPrefix: string): string {
  const normalizedPrefix = mountPathPrefix.replace(/\/+$/, '') || '/';
  if (pathname === normalizedPrefix) {
    return '';
  }

  const prefixWithSlash = normalizedPrefix.endsWith('/')
    ? normalizedPrefix
    : `${normalizedPrefix}/`;

  if (!pathname.startsWith(prefixWithSlash)) {
    return '';
  }

  return pathname.slice(prefixWithSlash.length).replace(/^\/+/, '');
}

export function buildMountAbsolutePath(mountPathPrefix: string, relativePath: string): string {
  const normalizedPrefix = mountPathPrefix.replace(/\/+$/, '') || '/';
  const trimmedRelative = relativePath.replace(/^\/+/, '').replace(/\/+$/, '');

  if (!trimmedRelative) {
    return normalizedPrefix;
  }

  return `${normalizedPrefix}/${trimmedRelative}`;
}

/** Root URL for an portal segment within a mount (`/studio` vs `/us/studio`). */
export function buildPortalRootPath(
  mountPathPrefix: string,
  portalSegment: string,
): string {
  const normalizedPrefix = mountPathPrefix.replace(/\/+$/, '') || '/';
  const segment = portalSegment.trim() || ROOT_PORTAL_SEGMENT;

  if (segment === ROOT_PORTAL_SEGMENT) {
    return normalizedPrefix;
  }

  if (segment === STUDIO_PORTAL_SEGMENT) {
    const prefixEndsWithStudio = normalizedPrefix === `/${STUDIO_PORTAL_SEGMENT}`
      || normalizedPrefix.endsWith(`/${STUDIO_PORTAL_SEGMENT}`);

    if (prefixEndsWithStudio) {
      return normalizedPrefix;
    }
  }

  return buildMountAbsolutePath(mountPathPrefix, segment);
}

export function shouldRedirectPortalEntry(
  shell: PlatformShell,
  pageRemainderPath: string,
): boolean {
  if (shell.entryMode !== 'redirect'
    || !shell.redirectToSegment?.trim()
    || !shell.redirectToCulture?.trim()) {
    return false;
  }

  const trimmed = pageRemainderPath.trim();
  return !trimmed || trimmed === '/';
}

export function resolveShellEntryRedirectPath(shell: PlatformShell): string {
  const culture = shell.redirectToCulture!.trim();
  const segment = shell.redirectToSegment!.trim();
  return buildPortalRootPath(`/${culture}`, segment);
}

export function resolveHomeShellRedirectPath(
  config: PlatformRuntimeConfig,
): string | null {
  const homeShell = getShellByKey(config, HOME_SHELL_KEY);
  if (!homeShell?.enabled || !shouldRedirectPortalEntry(homeShell, '/')) {
    return null;
  }

  return resolveShellEntryRedirectPath(homeShell);
}

/** Strip React Router splat suffix (`settings/*` → `settings`) for sidebar and quick-action links. */
export function normalizeRoutePatternForNavPath(routePattern: string): string {
  return routePattern.replace(/\/\*$/, '');
}

const NAV_PAGE_LANDINGS: ReadonlyArray<{ pageKey: string; section: string }> = [
  { pageKey: BASE_COMPONENTS_PAGE_KEY, section: BASE_COMPONENTS_NAV_LANDING_SECTION },
  { pageKey: SETTINGS_PAGE_KEY, section: SETTINGS_NAV_LANDING_SECTION },
];

function isNavLandingRoot(normalized: string, pageKey: string): boolean {
  return normalized === pageKey || normalized === `${STUDIO_PORTAL_SEGMENT}/${pageKey}`;
}

/** Point catalog-style splat pages at their default section, not the empty splat root. */
export function withNavLandingPath(navRelativePath: string): string {
  const normalized = navRelativePath.replace(/^\/+/, '').replace(/\/+$/, '');
  if (normalized === 'hawiety/business-rules') {
    return 'hawiety/business-rules/membership-number';
  }
  for (const landing of NAV_PAGE_LANDINGS) {
    if (isNavLandingRoot(normalized, landing.pageKey)) {
      return `${normalized}/${landing.section}`;
    }
  }
  return normalized;
}

export function buildBindingNavAbsolutePath(
  mountPathPrefix: string,
  binding: PlatformRouteBinding,
): string {
  return buildMountAbsolutePath(
    mountPathPrefix,
    withNavLandingPath(normalizeRoutePatternForNavPath(binding.routePattern)),
  );
}

export function pathnameMatchesBindingNavPath(pathname: string, navPath: string): boolean {
  if (pathname === navPath || pathname.startsWith(`${navPath}/`)) {
    return true;
  }

  for (const landing of NAV_PAGE_LANDINGS) {
    const landingSuffix = `/${landing.pageKey}/${landing.section}`;
    if (!navPath.endsWith(landingSuffix)) {
      continue;
    }

    const catalogRoot = navPath.slice(0, -`/${landing.section}`.length);
    if (pathname === catalogRoot || pathname.startsWith(`${catalogRoot}/`)) {
      return true;
    }
  }

  return false;
}

function matchesShellRulePath(pathname: string, rulePathPrefix: string): boolean {
  if (pathname === rulePathPrefix) {
    return true;
  }

  return pathname.startsWith(`${rulePathPrefix}/`);
}

export function resolveShellRuleForPath(
  config: PlatformRuntimeConfig,
  mountId: string,
  pathname: string,
): PlatformShellRule | undefined {
  const matchingRules = getShellRulesForMount(config, mountId).filter((rule) =>
    matchesShellRulePath(pathname, rule.pathPrefix),
  );

  if (matchingRules.length === 0) {
    return undefined;
  }

  return [...matchingRules].sort((left, right) => {
    const prefixLengthDiff = right.pathPrefix.length - left.pathPrefix.length;
    if (prefixLengthDiff !== 0) {
      return prefixLengthDiff;
    }

    return right.priority - left.priority;
  })[0];
}

function normalizeRelativeRoutePath(relativePath: string): string {
  return relativePath.replace(/^\/+/, '').replace(/\/+$/, '');
}

function routeBindingPatternSpecificity(routePattern: string): number {
  const normalized = normalizeRelativeRoutePath(routePattern);
  return normalized.endsWith('/*') ? normalized.length - 2 : normalized.length;
}

/** Match exact route patterns and trailing splat patterns (`settings/*`). */
export function matchesRouteBindingPattern(routePattern: string, relativePath: string): boolean {
  const normalizedPath = normalizeRelativeRoutePath(relativePath);
  const normalizedPattern = normalizeRelativeRoutePath(routePattern);

  if (normalizedPattern.endsWith('/*')) {
    const prefix = normalizedPattern.slice(0, -2);
    if (!prefix) {
      return normalizedPath.length > 0;
    }

    return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
  }

  return normalizedPattern === normalizedPath;
}

export function isHawietyPortalPublishedInConfig(config: PlatformRuntimeConfig): boolean {
  return Boolean(getShellByKey(config, HAWIETY_PORTAL_SEGMENT)?.enabled);
}

export function resolveRouteBindingForRelativePath(
  config: PlatformRuntimeConfig,
  mountId: string,
  relativePath: string,
): PlatformRouteBinding | undefined {
  const normalizedRelativePath = normalizeRelativeRoutePath(relativePath);
  const hawietyPublished = isHawietyPortalPublishedInConfig(config);

  const matchingBindings = getBindingsForMount(config, mountId).filter((binding) => {
    if (!hawietyPublished && isHawietyRoutePattern(binding.routePattern)) {
      return false;
    }
    return matchesRouteBindingPattern(binding.routePattern, normalizedRelativePath);
  });

  if (matchingBindings.length === 0) {
    return undefined;
  }

  return [...matchingBindings].sort(
    (left, right) =>
      routeBindingPatternSpecificity(right.routePattern)
      - routeBindingPatternSpecificity(left.routePattern),
  )[0];
}

export function normalizePortalRemainderPath(pageRemainderPath: string): string {
  return pageRemainderPath.trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

export const COMPONENT_ALONE_PREVIEW_BINDING_ID = -9101;

function inheritStudioRoutePattern(routePattern: string, config: PlatformRuntimeConfig): string {
  const normalized = normalizeRelativeRoutePath(routePattern);
  if (
    normalized === COMPONENT_ALONE_PORTAL_SEGMENT
    || normalized.startsWith(`${COMPONENT_ALONE_PORTAL_SEGMENT}/`)
  ) {
    return normalized;
  }

  // Every custom portal's pages are registered as route bindings on the single physical
  // `studio` mount (there is only ever one registered PlatformMount), with routePattern
  // already prefixed by that portal's own segment (e.g. `cms/contents`) — NOT "studio-relative"
  // like built-in Studio pages (`workflows`, implicitly meaning `studio/workflows`).
  // Only apply the studio-relative→`studio/…` inference when the pattern doesn't already
  // belong to some other enabled, non-studio portal segment.
  const firstSegment = normalized.split('/')[0];
  const belongsToAnotherPortal = Boolean(
    firstSegment
    && firstSegment !== STUDIO_PORTAL_SEGMENT
    && (config.shells ?? []).some((shell) => shell.shellKey === firstSegment && shell.enabled),
  );
  if (belongsToAnotherPortal) {
    return normalized;
  }

  return toPortalRoutePattern(routePattern);
}

export function parseComponentAloneRoutePattern(routePattern: string): string | null {
  const normalized = normalizeRelativeRoutePath(routePattern);
  const prefix = `${COMPONENT_ALONE_PORTAL_SEGMENT}/`;
  if (!normalized.startsWith(prefix)) {
    return null;
  }

  const componentPath = normalized.slice(prefix.length).trim();
  return parseDesignerComponentPath(componentPath) ? componentPath : null;
}

function findDesignerPageModuleForComponentPath(
  config: PlatformRuntimeConfig,
  componentPath: string,
): PlatformPageModule | undefined {
  const trimmed = componentPath.trim().replace(/^\/+/, '');
  if (!trimmed) {
    return undefined;
  }

  const exactMatch = config.pageModules.find(
    (module) => module.enabled
      && module.loaderKind === 'designer'
      && module.loaderRef.trim() === trimmed,
  );
  if (exactMatch) {
    return exactMatch;
  }

  const parsed = parseDesignerComponentPath(trimmed);
  if (!parsed) {
    return undefined;
  }

  return getPageModuleByKey(config, parsed.componentName);
}

function resolveComponentAloneDesignerBinding(
  config: PlatformRuntimeConfig,
  mountId: string,
  componentPath: string,
): PlatformRouteBinding | undefined {
  const trimmed = componentPath.trim().replace(/^\/+/, '');
  const parsed = parseDesignerComponentPath(trimmed);
  if (!parsed) {
    return undefined;
  }

  const pageModule = findDesignerPageModuleForComponentPath(config, trimmed);
  const pageKey = pageModule?.pageKey ?? parsed.componentName;

  return {
    id: COMPONENT_ALONE_PREVIEW_BINDING_ID,
    mountId,
    routePattern: normalizePortalPagePath(COMPONENT_ALONE_PORTAL_SEGMENT, trimmed),
    pageKey,
    enabled: true,
    source: 'auto',
  };
}

/** Resolve a route binding from the portal-stripped remainder path (`/users` → `users`). */
function resolveWorkflowsDesignerBindingFallback(
  config: PlatformRuntimeConfig,
  mountId: string,
  normalized: string,
): PlatformRouteBinding | undefined {
  const isWorkflowsEditPath = normalized === 'workflows/edit'
    || normalized.startsWith('workflows/edit/');
  const isLegacyDesignerPath = normalized === 'workflow-designer'
    || normalized.startsWith('workflow-designer/');

  if (!isWorkflowsEditPath && !isLegacyDesignerPath) {
    return undefined;
  }

  const bindings = getBindingsForMount(config, mountId).filter(
    (binding) => binding.enabled && binding.pageKey === 'workflows',
  );

  return bindings.find((binding) => binding.routePattern === 'workflows/edit/*')
    ?? bindings.find((binding) => binding.routePattern === 'workflow-designer/*')
    ?? bindings.find((binding) => binding.routePattern === 'workflow-designer')
    ?? bindings.find((binding) => binding.routePattern === 'workflows/*')
    ?? bindings[0];
}

function isDataSourcesNestedRemainder(normalized: string): boolean {
  return normalized.startsWith('data-sources/')
    || normalized.startsWith(`${STUDIO_PORTAL_SEGMENT}/data-sources/`);
}

function ideaFoundryBindingsForMount(
  config: PlatformRuntimeConfig,
  mountId: string,
): PlatformRouteBinding[] {
  return getBindingsForMount(config, mountId).filter(
    (binding) => binding.enabled && binding.pageKey === 'idea-foundry',
  );
}

/** Nested Idea Foundry view URLs when the live binding is still exact `idea-foundry`. */
function isIdeaFoundryEditRemainder(normalized: string): boolean {
  return normalized === 'idea-foundry/edit'
    || normalized.startsWith('idea-foundry/edit/')
    || normalized === `${STUDIO_PORTAL_SEGMENT}/idea-foundry/edit`
    || normalized.startsWith(`${STUDIO_PORTAL_SEGMENT}/idea-foundry/edit/`);
}

function isIdeaFoundryListRemainder(normalized: string): boolean {
  return normalized === 'idea-foundry'
    || normalized === `${STUDIO_PORTAL_SEGMENT}/idea-foundry`;
}

function resolveIdeaFoundryEditorBindingFallback(
  config: PlatformRuntimeConfig,
  mountId: string,
  normalized: string,
): PlatformRouteBinding | undefined {
  if (!isIdeaFoundryEditRemainder(normalized)) {
    return undefined;
  }

  const bindings = ideaFoundryBindingsForMount(config, mountId);

  return bindings.find((binding) => binding.routePattern === 'idea-foundry/edit/*')
    ?? bindings.find((binding) => binding.routePattern === 'idea-foundry/*')
    ?? bindings.find((binding) => binding.routePattern === `${STUDIO_PORTAL_SEGMENT}/idea-foundry/edit/*`)
    ?? bindings.find((binding) => binding.routePattern === `${STUDIO_PORTAL_SEGMENT}/idea-foundry/*`)
    ?? bindings[0];
}

/** List URL when boot sync collapsed the exact list binding onto the edit splat. */
function resolveIdeaFoundryListBindingFallback(
  config: PlatformRuntimeConfig,
  mountId: string,
  normalized: string,
): PlatformRouteBinding | undefined {
  if (!isIdeaFoundryListRemainder(normalized)) {
    return undefined;
  }

  const bindings = ideaFoundryBindingsForMount(config, mountId);

  return bindings.find((binding) => binding.routePattern === 'idea-foundry')
    ?? bindings.find((binding) => binding.routePattern === 'idea-foundry/*')
    ?? bindings.find((binding) => binding.routePattern === `${STUDIO_PORTAL_SEGMENT}/idea-foundry`)
    ?? bindings.find((binding) => binding.routePattern === `${STUDIO_PORTAL_SEGMENT}/idea-foundry/*`)
    ?? bindings[0];
}

function myWorkbooksBindingsForMount(
  config: PlatformRuntimeConfig,
  mountId: string,
): PlatformRouteBinding[] {
  return getBindingsForMount(config, mountId).filter(
    (binding) => binding.enabled && binding.pageKey === 'my-workbooks',
  );
}

/** Nested My Workbooks editor URLs when the live binding is still exact `my-workbooks`. */
function isMyWorkbooksEditRemainder(normalized: string): boolean {
  return normalized === 'my-workbooks/edit'
    || normalized.startsWith('my-workbooks/edit/')
    || normalized === `${STUDIO_PORTAL_SEGMENT}/my-workbooks/edit`
    || normalized.startsWith(`${STUDIO_PORTAL_SEGMENT}/my-workbooks/edit/`);
}

function isMyWorkbooksListRemainder(normalized: string): boolean {
  return normalized === 'my-workbooks'
    || normalized === `${STUDIO_PORTAL_SEGMENT}/my-workbooks`;
}

function resolveMyWorkbooksEditorBindingFallback(
  config: PlatformRuntimeConfig,
  mountId: string,
  normalized: string,
): PlatformRouteBinding | undefined {
  if (!isMyWorkbooksEditRemainder(normalized)) {
    return undefined;
  }

  const bindings = myWorkbooksBindingsForMount(config, mountId);

  return bindings.find((binding) => binding.routePattern === 'my-workbooks/edit/*')
    ?? bindings.find((binding) => binding.routePattern === 'my-workbooks/*')
    ?? bindings.find((binding) => binding.routePattern === `${STUDIO_PORTAL_SEGMENT}/my-workbooks/edit/*`)
    ?? bindings.find((binding) => binding.routePattern === `${STUDIO_PORTAL_SEGMENT}/my-workbooks/*`)
    ?? bindings[0];
}

/** List URL when boot sync collapsed the exact list binding onto the edit splat. */
function resolveMyWorkbooksListBindingFallback(
  config: PlatformRuntimeConfig,
  mountId: string,
  normalized: string,
): PlatformRouteBinding | undefined {
  if (!isMyWorkbooksListRemainder(normalized)) {
    return undefined;
  }

  const bindings = myWorkbooksBindingsForMount(config, mountId);

  return bindings.find((binding) => binding.routePattern === 'my-workbooks')
    ?? bindings.find((binding) => binding.routePattern === 'my-workbooks/*')
    ?? bindings.find((binding) => binding.routePattern === `${STUDIO_PORTAL_SEGMENT}/my-workbooks`)
    ?? bindings.find((binding) => binding.routePattern === `${STUDIO_PORTAL_SEGMENT}/my-workbooks/*`)
    ?? bindings[0];
}

/** Nested Workbooks editor URLs when the live binding is still exact `workbooks`. */
function isWorkbooksEditRemainder(normalized: string): boolean {
  return normalized === 'workbooks/edit'
    || normalized.startsWith('workbooks/edit/')
    || normalized === `${STUDIO_PORTAL_SEGMENT}/workbooks/edit`
    || normalized.startsWith(`${STUDIO_PORTAL_SEGMENT}/workbooks/edit/`);
}

function resolveWorkbooksEditorBindingFallback(
  config: PlatformRuntimeConfig,
  mountId: string,
  normalized: string,
): PlatformRouteBinding | undefined {
  if (!isWorkbooksEditRemainder(normalized)) {
    return undefined;
  }

  const bindings = getBindingsForMount(config, mountId).filter(
    (binding) => binding.enabled && binding.pageKey === 'workbooks',
  );

  return bindings.find((binding) => binding.routePattern === 'workbooks/edit/*')
    ?? bindings.find((binding) => binding.routePattern === 'workbooks/*')
    ?? bindings.find((binding) => binding.routePattern === `${STUDIO_PORTAL_SEGMENT}/workbooks/edit/*`)
    ?? bindings.find((binding) => binding.routePattern === `${STUDIO_PORTAL_SEGMENT}/workbooks/*`)
    ?? bindings[0];
}

/** Nested Data Sources URLs (`…/questions/{id}`) when the live binding is still exact `data-sources`. */
function resolveDataSourcesNestedBindingFallback(
  config: PlatformRuntimeConfig,
  mountId: string,
  normalized: string,
): PlatformRouteBinding | undefined {
  if (!isDataSourcesNestedRemainder(normalized)) {
    return undefined;
  }

  const bindings = getBindingsForMount(config, mountId).filter(
    (binding) => binding.enabled && binding.pageKey === 'sources',
  );

  return bindings.find((binding) => (
    binding.routePattern === 'data-sources/*'
    || binding.routePattern === `${STUDIO_PORTAL_SEGMENT}/data-sources/*`
  ))
    ?? bindings.find((binding) => (
      binding.routePattern === 'data-sources'
      || binding.routePattern === `${STUDIO_PORTAL_SEGMENT}/data-sources`
    ))
    ?? bindings[0];
}

/** True when a culture remainder (`/users`) is a Studio page, not a public CMS slug. */
export function remainderMatchesStudioRoute(
  config: PlatformRuntimeConfig,
  remainderPath: string,
  mountId?: string,
): boolean {
  const normalized = normalizePortalRemainderPath(remainderPath);
  if (!normalized) {
    return false;
  }

  if (!isHawietyPortalPublishedInConfig(config) && isHawietyRoutePattern(normalized)) {
    return false;
  }

  const mountIds = new Set<string>([STUDIO_MOUNT_ID]);
  if (mountId?.trim()) {
    mountIds.add(mountId.trim());
  }

  for (const id of mountIds) {
    if (resolveRouteBindingForPortalRemainder(config, id, remainderPath, STUDIO_PORTAL_SEGMENT)) {
      return true;
    }
  }

  return false;
}

export function resolveRouteBindingForPortalRemainder(
  config: PlatformRuntimeConfig,
  mountId: string,
  pageRemainderPath: string,
  portalSegment?: string,
): PlatformRouteBinding | undefined {
  const normalized = normalizePortalRemainderPath(pageRemainderPath);
  const segment = portalSegment?.trim();

  if (segment && segment !== STUDIO_PORTAL_SEGMENT) {
    const scopedPattern = normalized ? `${segment}/${normalized}` : segment;
    const scopedBinding = resolveRouteBindingForRelativePath(config, mountId, scopedPattern);
    if (scopedBinding) {
      return scopedBinding;
    }

    if (segment === COMPONENT_ALONE_PORTAL_SEGMENT && normalized) {
      const previewBinding = resolveComponentAloneDesignerBinding(config, mountId, normalized);
      if (previewBinding) {
        return previewBinding;
      }
    }

    if (segment === ROOT_PORTAL_SEGMENT) {
      return undefined;
    }
  }

  if (!normalized) {
    const dashboard = resolveRouteBindingForRelativePath(config, mountId, '');
    if (dashboard) {
      return dashboard;
    }

    return resolveRouteBindingForRelativePath(config, mountId, STUDIO_PORTAL_SEGMENT);
  }

  const direct = resolveRouteBindingForRelativePath(config, mountId, normalized);
  if (direct) {
    return direct;
  }

  const applicationPattern = toPortalRoutePattern(toPortalRelativePattern(normalized));
  const applicationBinding = resolveRouteBindingForRelativePath(config, mountId, applicationPattern);
  if (applicationBinding) {
    return applicationBinding;
  }

  if (
    normalized === STUDIO_PORTAL_SEGMENT
    || normalized.startsWith(`${STUDIO_PORTAL_SEGMENT}/`)
  ) {
    const studioRelative = toPortalRelativePattern(normalized);
    const studioBinding = resolveRouteBindingForRelativePath(config, mountId, studioRelative);
    if (studioBinding) {
      return studioBinding;
    }
  }

  return resolveDataSourcesNestedBindingFallback(config, mountId, normalized)
    ?? resolveWorkflowsDesignerBindingFallback(config, mountId, normalized)
    ?? resolveWorkbooksEditorBindingFallback(config, mountId, normalized)
    ?? resolveMyWorkbooksEditorBindingFallback(config, mountId, normalized)
    ?? resolveMyWorkbooksListBindingFallback(config, mountId, normalized)
    ?? resolveIdeaFoundryEditorBindingFallback(config, mountId, normalized)
    ?? resolveIdeaFoundryListBindingFallback(config, mountId, normalized);
}
