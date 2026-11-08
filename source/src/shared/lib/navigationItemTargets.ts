import type { PlatformRuntimeConfig, PlatformRouteBinding } from '../api/contracts/platform/types';
import type { DesignerVersionSummary } from '../api/queries/component-designer';
import { STUDIO_MOUNT_ID, STUDIO_PORTAL_SEGMENT } from '../api/contracts/platform/mountConstants';
import { getBindingsForMount } from '../../app/platform/platformConfigHelpers';
import {
  parseDesignerComponentPath,
  resolveDesignerDraftIdFromComponentPath,
} from './designerComponentPath';
import { toNavigationManifestRoutePattern } from './navigationItemPath';

function resolveNavigationBindingPageKeys(
  pageKey: string,
  designerDrafts: readonly DesignerVersionSummary[],
): string[] {
  const normalized = pageKey.trim();
  const keys = new Set<string>([normalized]);

  const parsed = parseDesignerComponentPath(normalized);
  if (parsed) {
    keys.add(parsed.componentName);
  }

  const draftIdFromPath = resolveDesignerDraftIdFromComponentPath(designerDrafts, normalized);
  if (draftIdFromPath) {
    keys.add(draftIdFromPath);
  }

  if (designerDrafts.some((draft) => draft.id === normalized)) {
    keys.add(normalized);
  }

  return [...keys];
}

export function resolveNavigationRoutePatternForPageKey(
  config: PlatformRuntimeConfig,
  pageKey: string,
  portalSegment?: string | null,
  designerDrafts: readonly DesignerVersionSummary[] = [],
): string {
  const normalizedPageKey = pageKey.trim();
  if (!normalizedPageKey) {
    return '';
  }

  const portal = portalSegment?.trim() || STUDIO_PORTAL_SEGMENT;
  const bindings = getBindingsForMount(config, STUDIO_MOUNT_ID);
  const bindingPageKeys = resolveNavigationBindingPageKeys(normalizedPageKey, designerDrafts);
  const candidates = bindings.filter((binding) => bindingPageKeys.includes(binding.pageKey));

  if (candidates.length === 0) {
    return normalizedPageKey;
  }

  const match = pickBindingForPortal(candidates, portal) ?? candidates[0]!;
  return toNavigationManifestRoutePattern(match.routePattern);
}

function pickBindingForPortal(
  bindings: PlatformRouteBinding[],
  portalSegment: string,
): PlatformRouteBinding | undefined {
  if (portalSegment === STUDIO_PORTAL_SEGMENT) {
    return bindings.find((binding) => (
      binding.routePattern === ''
      || binding.routePattern === STUDIO_PORTAL_SEGMENT
      || binding.routePattern.startsWith(`${STUDIO_PORTAL_SEGMENT}/`)
      || !binding.routePattern.includes('/')
    ));
  }

  return bindings.find((binding) => (
    binding.routePattern === portalSegment
    || binding.routePattern.startsWith(`${portalSegment}/`)
  ));
}

export function getNavigationPageModuleLabel(
  config: PlatformRuntimeConfig,
  pageKey?: string,
): string {
  const normalized = pageKey?.trim();
  if (!normalized) {
    return '—';
  }

  const module = config.pageModules.find((entry) => entry.pageKey === normalized);
  if (!module) {
    return normalized;
  }

  return module.loaderRef?.trim()
    ? `${module.title} (${module.loaderRef})`
    : module.title;
}
