import type {
  PackageBuilderCatalogEdgeApiItem,
  PackageBuilderCatalogEdgeModelItem,
  PackageBuilderCatalogShellItem,
  PackageBuilderCatalogUiComponentItem,
} from './packageBuilderCatalog';
import { collectBindingEndpointsFromDraftJson, extractApiPathsFromDesignerCode } from './packageBuilderDependencyCollectors';

export type PackageEdgeDependencySelection = {
  models: PackageBuilderCatalogEdgeModelItem[];
  apis: PackageBuilderCatalogEdgeApiItem[];
};

function collectHaystackFromComponent(component: PackageBuilderCatalogUiComponentItem): string {
  const parts = [component.exportBundle?.code ?? '', component.exportBundle?.draftJson ?? ''];
  if (component.exportBundle?.draftJson) {
    parts.push(...collectBindingEndpointsFromDraftJson(component.exportBundle.draftJson));
  }
  return parts.join('\n');
}

function collectHaystackFromShell(shell: PackageBuilderCatalogShellItem): string {
  return shell.draftJson;
}

function sourceContainsToken(haystack: string, token: string): boolean {
  const needle = token.trim();
  if (needle.length < 2) return false;
  return haystack.includes(needle);
}

export function resolvePackageEdgeDependencies(input: {
  components: readonly PackageBuilderCatalogUiComponentItem[];
  shells?: readonly PackageBuilderCatalogShellItem[];
  edgeModels: readonly PackageBuilderCatalogEdgeModelItem[];
  edgeApis: readonly PackageBuilderCatalogEdgeApiItem[];
}): PackageEdgeDependencySelection {
  const haystack = [
    ...input.components.map(collectHaystackFromComponent),
    ...(input.shells ?? []).map(collectHaystackFromShell),
  ].join('\n');

  const apiPaths = new Set<string>();
  for (const component of input.components) {
    const code = component.exportBundle?.code;
    if (code) {
      for (const path of extractApiPathsFromDesignerCode(code)) apiPaths.add(path);
    }
    if (component.exportBundle?.draftJson) {
      for (const path of extractApiPathsFromDesignerCode(component.exportBundle.draftJson)) {
        apiPaths.add(path);
      }
      for (const endpoint of collectBindingEndpointsFromDraftJson(component.exportBundle.draftJson)) {
        apiPaths.add(endpoint);
      }
    }
  }
  for (const shell of input.shells ?? []) {
    for (const path of extractApiPathsFromDesignerCode(shell.draftJson)) apiPaths.add(path);
  }

  const apis = input.edgeApis.filter((api) => {
    if (api.basePath && [...apiPaths].some((path) => path === api.basePath || path.startsWith(`${api.basePath}/`))) {
      return true;
    }
    return sourceContainsToken(haystack, api.id)
      || sourceContainsToken(haystack, api.key)
      || (api.basePath.length >= 8 && sourceContainsToken(haystack, api.basePath));
  });

  const modelIds = new Set<string>(apis.map((api) => api.edgeModelId));
  for (const model of input.edgeModels) {
    if (sourceContainsToken(haystack, model.id)) {
      modelIds.add(model.id);
      continue;
    }
    const quotedObject = new RegExp(`['"\`]${model.objectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`);
    if (quotedObject.test(haystack)) {
      modelIds.add(model.id);
    }
  }

  const models = input.edgeModels.filter((model) => modelIds.has(model.id));
  const apiIds = new Set(apis.map((api) => api.id));
  for (const api of input.edgeApis) {
    if (modelIds.has(api.edgeModelId) && !apiIds.has(api.id)) {
      apis.push(api);
      apiIds.add(api.id);
    }
  }

  return {
    models: models.sort((left, right) => left.label.localeCompare(right.label)),
    apis: [...apis].sort((left, right) => left.label.localeCompare(right.label)),
  };
}
