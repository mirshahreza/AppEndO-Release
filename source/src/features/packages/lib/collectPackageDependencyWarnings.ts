import type {
  PackageBuilderCatalogApiItem,
  PackageBuilderCatalogEdgeApiItem,
  PackageBuilderCatalogEdgeModelItem,
  PackageBuilderCatalogShellItem,
  PackageBuilderCatalogUiComponentItem,
  PackageBuilderCatalogWorkflowItem,
} from './packageBuilderCatalog';
import {
  findUiComponentForPageKey,
  type PortalPackageNavigationItem,
} from './resolvePortalPackageDependencies';
import {
  collectFontProfileIdsFromDraftJson,
  extractApiPathsFromDesignerCode,
  extractDesignerAssetPaths,
} from './packageBuilderDependencyCollectors';
import { resolvePackageEdgeDependencies } from './resolvePackageEdgeDependencies';

export type PackageDependencyWarning = {
  code: 'unresolved-page' | 'unresolved-api' | 'unresolved-font-profile';
  message: string;
};

const BUILT_IN_FONT_PROFILE_IDS = new Set([
  'inherit',
  'inter',
  'system',
  'system-sans',
  'editorial',
  'mono',
]);

const CORE_PAGE_KEY_RE = /^(core:|[a-z]+:)/i;

function isResolvedApiPath(
  apiPath: string,
  managedApis: readonly PackageBuilderCatalogApiItem[],
  edgeApis: readonly PackageBuilderCatalogEdgeApiItem[],
): boolean {
  if (managedApis.some((api) => api.path === apiPath)) {
    return true;
  }
  return edgeApis.some((api) => (
    api.basePath.length > 0
    && (apiPath === api.basePath || apiPath.startsWith(`${api.basePath}/`))
  ));
}

export function collectPackageDependencyWarnings(input: {
  navigationItems?: readonly PortalPackageNavigationItem[];
  uiComponents: readonly PackageBuilderCatalogUiComponentItem[];
  packedComponents: readonly PackageBuilderCatalogUiComponentItem[];
  shells?: readonly PackageBuilderCatalogShellItem[];
  workflows?: readonly PackageBuilderCatalogWorkflowItem[];
  managedApis: readonly PackageBuilderCatalogApiItem[];
  edgeApis: readonly PackageBuilderCatalogEdgeApiItem[];
  edgeModels: readonly PackageBuilderCatalogEdgeModelItem[];
}): PackageDependencyWarning[] {
  const warnings: PackageDependencyWarning[] = [];
  const seen = new Set<string>();
  const push = (warning: PackageDependencyWarning) => {
    const key = `${warning.code}:${warning.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push(warning);
  };

  for (const item of input.navigationItems ?? []) {
    const pageKey = item.pageKey?.trim();
    if (!pageKey || CORE_PAGE_KEY_RE.test(pageKey)) continue;
    if (!findUiComponentForPageKey(pageKey, input.uiComponents)) {
      push({
        code: 'unresolved-page',
        message: `Navigation page "${pageKey}" has no matching designer draft.`,
      });
    }
  }

  const haystacks: string[] = [];
  for (const component of input.packedComponents) {
    if (component.exportBundle?.code) haystacks.push(component.exportBundle.code);
    if (component.exportBundle?.draftJson) haystacks.push(component.exportBundle.draftJson);
  }
  for (const shell of input.shells ?? []) {
    haystacks.push(shell.draftJson);
  }
  for (const workflow of input.workflows ?? []) {
    if (workflow.draftJson) haystacks.push(workflow.draftJson);
  }

  const apiPaths = new Set<string>();
  for (const haystack of haystacks) {
    for (const apiPath of extractApiPathsFromDesignerCode(haystack)) {
      apiPaths.add(apiPath);
    }
  }

  for (const apiPath of [...apiPaths].sort((left, right) => left.localeCompare(right))) {
    if (!isResolvedApiPath(apiPath, input.managedApis, input.edgeApis)) {
      push({
        code: 'unresolved-api',
        message: `Path ${apiPath} is not a managed server function or Edge API.`,
      });
    }
  }

  const derivedEdge = resolvePackageEdgeDependencies({
    components: [...input.packedComponents, ...workflowItemsAsScanComponents(input.workflows ?? [])],
    shells: input.shells,
    edgeModels: input.edgeModels,
    edgeApis: input.edgeApis,
  });
  const resolvedModelIds = new Set(derivedEdge.models.map((model) => model.id));
  for (const api of derivedEdge.apis) {
    if (!resolvedModelIds.has(api.edgeModelId)
      && !input.edgeModels.some((model) => model.id === api.edgeModelId)
    ) {
      push({
        code: 'unresolved-api',
        message: `Edge API "${api.label}" references a missing model.`,
      });
    }
  }

  const packedFontHaystack = haystacks
    .flatMap((haystack) => extractDesignerAssetPaths(haystack))
    .join('\n')
    .toLowerCase();
  for (const component of input.packedComponents) {
    const draftJson = component.exportBundle?.draftJson;
    if (!draftJson) continue;
    for (const profileId of collectFontProfileIdsFromDraftJson(draftJson)) {
      if (BUILT_IN_FONT_PROFILE_IDS.has(profileId)) continue;
      if (packedFontHaystack.includes(profileId.toLowerCase())) continue;
      push({
        code: 'unresolved-font-profile',
        message: `Font profile "${profileId}" is not a built-in profile and was not packed as a platform font.`,
      });
    }
  }

  return warnings;
}

export function workflowItemsAsScanComponents(
  workflows: readonly PackageBuilderCatalogWorkflowItem[],
): PackageBuilderCatalogUiComponentItem[] {
  return workflows.flatMap((workflow) => {
    if (!workflow.draftJson) return [];
    return [{
      id: `workflow:${workflow.id}`,
      componentKey: `workflows/${workflow.scopeKey}/${workflow.key}`,
      label: workflow.label,
      exportBundle: {
        entry: `workflows/${workflow.scopeKey}/${workflow.key}.json`,
        code: workflow.draftJson,
        draftJson: workflow.draftJson,
      },
    }];
  });
}
