import { useMemo } from 'react';
import { buildDesignerComponentPath, resolveDesignerDraftIdFromComponentPath } from '../../../shared/lib/designerComponentPath';
import type { ExperienceManifestPortal } from '../../../shared/api/contracts/platform/experienceManifest';
import { portalUsesRedirectEntry } from '../../../shared/api/contracts/platform/experienceManifest';
import type { PlatformRuntimeConfig, PlatformShell } from '../../../shared/api/contracts/platform/types';
import { useComponentDesignerDraftsQuery } from '../../../shared/api/queries/component-designer';
import type { DesignerVersionSummary } from '../../../shared/api/queries/component-designer';
import { useExperienceManifestQuery, usePlatformCulturesQuery, usePlatformRuntimeConfigQuery } from '../../../shared/api/queries/platform';
import { SHELL_DRAFT_FOLDER } from '../../../shared/lib/designerShellEntry';
import { STUDIO_PORTAL_SEGMENT } from '../../../shared/api/contracts/platform/mountConstants';

/** Sentinel for HeroUI Select — empty string is not a re-selectable key. Maps to null in manifest. */
export const NAVIGATION_DEFAULT_OPTION_VALUE = '__navigation_default__';
export const NAVIGATION_DEFAULT_OPTION_LABEL = 'Default';

export function navigationSelectValueToNullable(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === NAVIGATION_DEFAULT_OPTION_VALUE) {
    return null;
  }

  return trimmed;
}

export type NavigationCultureOption = {
  value: string;
  label: string;
};

export type NavigationPortalKind = 'layout' | 'redirect';

export type NavigationPortalOption = {
  value: string;
  label: string;
  kind: NavigationPortalKind;
};

export function resolveNavigationPortalKind(shell: PlatformShell): NavigationPortalKind {
  return portalUsesRedirectEntry({
    entryMode: shell.entryMode ?? 'shell',
    redirectToSegment: shell.redirectToSegment,
    redirectToCulture: shell.redirectToCulture,
  })
    ? 'redirect'
    : 'layout';
}

export function isNavigationRedirectPortal(
  portalSegment: string | null | undefined,
  portalOptions: readonly NavigationPortalOption[],
): boolean {
  const segment = portalSegment?.trim();
  if (!segment) {
    return false;
  }

  return portalOptions.find((option) => option.value === segment)?.kind === 'redirect';
}

export type NavigationComponentKind = 'custom' | 'built-in' | 'core';

export type NavigationComponentOption = {
  pageKey: string;
  title: string;
  loaderRef: string;
  kind: NavigationComponentKind;
  updatedAt?: string;
};

const NAVIGATION_COMPONENT_KIND_LABEL: Record<NavigationComponentKind, string> = {
  custom: 'Custom',
  'built-in': 'Built-in',
  core: 'Core',
};

export function navigationComponentKindLabel(kind: NavigationComponentKind): string {
  return NAVIGATION_COMPONENT_KIND_LABEL[kind];
}

export function resolveDesignerDraftPageKey(
  draft: Pick<DesignerVersionSummary, 'id' | 'name' | 'folder' | 'isBuiltIn'>,
): string {
  if (draft.isBuiltIn) {
    return draft.id;
  }

  return buildDesignerComponentPath(draft.folder || 'general', draft.name || draft.id);
}

export function findNavigationComponentOption(
  pageKey: string | null | undefined,
  componentOptions: readonly NavigationComponentOption[],
  designerDrafts: readonly DesignerVersionSummary[] = [],
): NavigationComponentOption | undefined {
  const key = pageKey?.trim();
  if (!key) {
    return undefined;
  }

  const direct = componentOptions.find((option) => option.pageKey === key);
  if (direct) {
    return direct;
  }

  const publicKey = designerDrafts.length > 0
    ? resolvePublicNavigationPageKeyFromDrafts(key, designerDrafts)
    : key;
  if (publicKey !== key) {
    return componentOptions.find((option) => option.pageKey === publicKey);
  }

  return componentOptions.find((option) => option.loaderRef === key);
}

function resolvePublicNavigationPageKeyFromDrafts(
  pageKey: string,
  drafts: readonly DesignerVersionSummary[],
): string {
  if (resolveDesignerDraftIdFromComponentPath(drafts, pageKey)) {
    return pageKey;
  }

  const draft = drafts.find((entry) => entry.id === pageKey);
  return draft ? resolveDesignerDraftPageKey(draft) : pageKey;
}

export function buildNavigationComponentOptionsFromDesignerDrafts(
  drafts: readonly DesignerVersionSummary[],
): NavigationComponentOption[] {
  return drafts
    .filter((draft) => draft.folder !== SHELL_DRAFT_FOLDER)
    .map((draft) => ({
      pageKey: resolveDesignerDraftPageKey(draft),
      title: draft.name.trim() || draft.id,
      loaderRef: draft.isBuiltIn
        ? 'built-in'
        : buildDesignerComponentPath(draft.folder || 'general', draft.name),
      kind: draft.isBuiltIn ? 'built-in' : 'custom',
      updatedAt: draft.updatedAt,
    }));
}

function sortNavigationComponentOptions(
  options: NavigationComponentOption[],
): NavigationComponentOption[] {
  const kindPriority: Record<NavigationComponentKind, number> = {
    custom: 0,
    'built-in': 1,
    core: 2,
  };

  return [...options].sort((left, right) => {
    const byKind = kindPriority[left.kind] - kindPriority[right.kind];
    if (byKind !== 0) {
      return byKind;
    }

    if (left.kind === 'custom' && right.kind === 'custom') {
      const byUpdatedAt = (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '');
      if (byUpdatedAt !== 0) {
        return byUpdatedAt;
      }
    }

    return left.title.localeCompare(right.title);
  });
}

export function buildNavigationPortalOptionsFromExperienceManifest(
  portals: readonly ExperienceManifestPortal[],
): NavigationPortalOption[] {
  return portals
    .filter((portal) => !portalUsesRedirectEntry(portal))
    .map((portal) => ({
      value: portal.segment.trim(),
      label: portal.name.trim() || portal.segment.trim(),
      kind: 'layout' as const,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildNavigationComponentOptions(
  config: PlatformRuntimeConfig,
  designerDrafts: readonly DesignerVersionSummary[] = [],
): NavigationComponentOption[] {
  const fromDesigner = buildNavigationComponentOptionsFromDesignerDrafts(designerDrafts);
  const coveredPageKeys = new Set(fromDesigner.map((option) => option.pageKey));
  const designerDraftIds = new Set(designerDrafts.map((draft) => draft.id));

  const fromPageModules = config.pageModules
    .filter((module) => {
      if (!module.enabled || coveredPageKeys.has(module.pageKey)) {
        return false;
      }

      if (module.loaderKind === 'designer' && designerDraftIds.has(module.pageKey)) {
        return false;
      }

      return true;
    })
    .map((module) => ({
      pageKey: module.pageKey,
      title: module.title,
      loaderRef: module.loaderRef,
      kind: 'core' as const,
    }));

  return sortNavigationComponentOptions([...fromDesigner, ...fromPageModules]);
}

export function useNavigationEditorOptions(enabled = true) {
  const runtimeQuery = usePlatformRuntimeConfigQuery(enabled);
  const culturesQuery = usePlatformCulturesQuery(enabled);
  const experienceManifestQuery = useExperienceManifestQuery('admin', enabled);
  const designerDraftsQuery = useComponentDesignerDraftsQuery({ enabled });

  const cultureOptions = useMemo<NavigationCultureOption[]>(() => {
    const packs = culturesQuery.data?.packs ?? [];
    const enabledIds = culturesQuery.data?.enabledCulturePackIds ?? [];

    return enabledIds.map((cultureId) => {
      const pack = packs.find((entry) => entry.id === cultureId);
      return {
        value: cultureId,
        label: pack?.name?.trim() || cultureId,
      };
    });
  }, [culturesQuery.data]);

  const portalOptions = useMemo(
    () => buildNavigationPortalOptionsFromExperienceManifest(
      experienceManifestQuery.data?.portals ?? [],
    ),
    [experienceManifestQuery.data?.portals],
  );

  const componentOptions = useMemo(
    () => (
      runtimeQuery.data
        ? buildNavigationComponentOptions(runtimeQuery.data, designerDraftsQuery.data ?? [])
        : []
    ),
    [runtimeQuery.data, designerDraftsQuery.data],
  );

  return {
    runtimeConfig: runtimeQuery.data ?? null,
    cultureOptions,
    portalOptions,
    componentOptions,
    designerDrafts: designerDraftsQuery.data ?? [],
    isLoading: runtimeQuery.isLoading
      || culturesQuery.isLoading
      || experienceManifestQuery.isLoading
      || designerDraftsQuery.isLoading,
    defaultCultureId: culturesQuery.data?.defaultCultureId ?? 'us',
    defaultPortalSegment: STUDIO_PORTAL_SEGMENT,
  };
}

export function formatNavigationCultureLabel(
  cultureId: string | null | undefined,
  cultureOptions: NavigationCultureOption[],
): string {
  if (!cultureId?.trim()) {
    return NAVIGATION_DEFAULT_OPTION_LABEL;
  }

  return cultureOptions.find((option) => option.value === cultureId)?.label ?? cultureId;
}

export function formatNavigationPortalLabel(
  portalSegment: string | null | undefined,
  portalOptions: NavigationPortalOption[],
): string {
  if (!portalSegment?.trim()) {
    return NAVIGATION_DEFAULT_OPTION_LABEL;
  }

  return portalOptions.find((option) => option.value === portalSegment)?.label ?? portalSegment;
}

export function formatNavigationComponentLabel(
  pageKey: string | null | undefined,
  componentOptions: readonly NavigationComponentOption[],
  designerDrafts: readonly DesignerVersionSummary[] = [],
): string {
  const key = pageKey?.trim();
  if (!key) {
    return 'Not selected';
  }

  const component = findNavigationComponentOption(key, componentOptions, designerDrafts);
  if (component) {
    return `${component.title} (${component.loaderRef})`;
  }

  return key;
}
