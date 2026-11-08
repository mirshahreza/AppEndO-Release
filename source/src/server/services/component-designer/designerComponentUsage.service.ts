import { getDesignerDraft, listDesignerDrafts } from '../../domain/component-designer/draftIo';
import { collectDesignerResiduePageKeys } from './designerDeleteCleanup';
import { listPageModuleFiles, listRouteBindingFiles } from '../../../core/platform-registry/PlatformRegistryFileStore';
import { HttpError } from '../../errors/HttpError';
import type { DesignerComponentUsageReport } from '../../../shared/api/contracts/component-designer/usage';
import type { UnusedDesignerComponentEntry } from '../../../shared/api/contracts/component-designer/unused';
import { lookupComponentUsageLastHits } from '../component-usage/componentUsagePersistence.service';

/**
 * PDK-9 v1 — static registry-only "where is this used" graph, surfaced as a warning before
 * publish/delete (never a block). Reuses `collectDesignerResiduePageKeys` (the same page-key
 * resolution already relied on by delete cleanup) so "what counts as this component" stays in
 * exactly one place.
 */
export function computeDesignerComponentUsage(draftId: string): DesignerComponentUsageReport {
  const draft = getDesignerDraft(draftId);
  if (!draft) {
    throw new HttpError(404, 'Version not found.');
  }

  const pageKeys = new Set(collectDesignerResiduePageKeys({ draftId: draft.id, name: draft.name }));
  const routeBindings = listRouteBindingFiles();

  const pages = listPageModuleFiles()
    .filter((pageModule) => pageKeys.has(pageModule.pageKey))
    .map((pageModule) => ({
      pageKey: pageModule.pageKey,
      title: pageModule.title,
      loaderKind: pageModule.loaderKind,
      ownerPackageId: pageModule.ownerPackageId ?? null,
      mounts: routeBindings
        .filter((binding) => binding.pageKey === pageModule.pageKey)
        .map((binding) => binding.mountId),
      loaderKindInvariantWarning: pageModule.ownerPackageId != null && pageModule.loaderKind === 'core',
    }));

  return { pages, workflows: [] };
}

const hasRegistryPageUsage = (input: { draftId: string; name?: string }): boolean => {
  const pageKeys = new Set(collectDesignerResiduePageKeys(input));
  return listPageModuleFiles().some((pageModule) => pageKeys.has(pageModule.pageKey));
};

/** All catalog drafts with no platform-registry page module referencing them (same rule as delete warning). */
export async function listUnusedDesignerComponents(): Promise<UnusedDesignerComponentEntry[]> {
  const components: UnusedDesignerComponentEntry[] = [];

  for (const draft of listDesignerDrafts()) {
    if (hasRegistryPageUsage({ draftId: draft.id, name: draft.name })) {
      continue;
    }
    components.push({ draftId: draft.id, name: draft.name, lastHitAt: null });
  }

  const sorted = components.sort((left, right) => (
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  ));

  let lastHits = new Map<string, string | null>();
  try {
    lastHits = await lookupComponentUsageLastHits(sorted.map((entry) => entry.name), 'designer');
  } catch {
    lastHits = new Map();
  }

  return sorted.map((entry) => ({
    ...entry,
    lastHitAt: lastHits.get(entry.name) ?? null,
  }));
}
