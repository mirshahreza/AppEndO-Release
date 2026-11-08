import { apiGet } from '../../../shared/api/client';
import {
  isBuiltInPortal,
  type ExperienceManifestPortal,
} from '../../../shared/api/contracts/platform/experienceManifest';
import type { NavigationManifestSummary } from '../../../shared/api/contracts/platform/navigation';
import { buildDesignerComponentPath } from '../../../shared/lib/designerComponentPath';
import { listComponentDesignerVersions } from '../../../shared/api/queries/component-designer';
import { fetchExperienceManifest, fetchNavigationManifests } from '../../../shared/api/queries/platform';
import { packageWorkflowIdentity } from './packageWorkflows';

export type PackageBuilderCatalogApiItem = {
  id: string;
  name: string;
  folder: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  source: 'managed' | 'system';
  exportBundle?: {
    entry: string;
    metaEntry: string;
    code: string;
    metaJson: string;
    auth: 'public' | 'authenticated' | 'admin';
    timeoutMs: number;
  };
};

export type PackageBuilderCatalogUiComponentItem = {
  id: string;
  componentKey: string;
  label: string;
  exportBundle?: {
    entry: string;
    code: string;
    draftJson?: string;
    draftEntry?: string;
  };
};

export type PackageBuilderCatalogShellItem = {
  shellKey: string;
  title: string;
  entry: string;
  draftJson: string;
};

export type PackageBuilderCatalogWorkflowItem = {
  id: number;
  scopeKey: string;
  key: string;
  label: string;
  lifecycleStatus: string;
  draftJson?: string;
};

export type PackageBuilderCatalogEdgeModelItem = {
  id: string;
  objectName: string;
  label: string;
};

export type PackageBuilderCatalogEdgeApiItem = {
  id: string;
  edgeModelId: string;
  key: string;
  label: string;
  basePath: string;
};

export type PackageBuilderCatalog = {
  apis: PackageBuilderCatalogApiItem[];
  uiComponents: PackageBuilderCatalogUiComponentItem[];
  shells: PackageBuilderCatalogShellItem[];
  portals: ExperienceManifestPortal[];
  navigations: NavigationManifestSummary[];
  workflows: PackageBuilderCatalogWorkflowItem[];
  edgeModels: PackageBuilderCatalogEdgeModelItem[];
  edgeApis: PackageBuilderCatalogEdgeApiItem[];
};

export const EMPTY_PACKAGE_BUILDER_CATALOG: PackageBuilderCatalog = {
  apis: [],
  uiComponents: [],
  shells: [],
  portals: [],
  navigations: [],
  workflows: [],
  edgeModels: [],
  edgeApis: [],
};

export function packageBuilderWorkflowRowId(item: Pick<PackageBuilderCatalogWorkflowItem, 'id'>): string {
  return String(item.id);
}

function parseCatalogWorkflows(raw: unknown): PackageBuilderCatalogWorkflowItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const id = Number(row.id);
    const key = typeof row.key === 'string' ? row.key.trim() : '';
    if (!Number.isFinite(id) || id <= 0 || !key) return [];
    const scopeKey = typeof row.scopeKey === 'string' && row.scopeKey.trim() ? row.scopeKey.trim() : 'global';
    const lifecycleStatus = typeof row.lifecycleStatus === 'string' ? row.lifecycleStatus : 'DRAFT';
    const draftJson = typeof row.draftJson === 'string' && row.draftJson.trim() ? row.draftJson : undefined;
    return [{
      id,
      scopeKey,
      key,
      label: typeof row.label === 'string' && row.label.trim()
        ? row.label.trim()
        : packageWorkflowIdentity(scopeKey, key),
      lifecycleStatus,
      ...(draftJson ? { draftJson } : {}),
    }];
  });
}

function parseCatalogEdgeModels(raw: unknown): PackageBuilderCatalogEdgeModelItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    if (!id) return [];
    const objectName = typeof row.objectName === 'string' ? row.objectName.trim() : id;
    const label = typeof row.label === 'string' && row.label.trim() ? row.label.trim() : objectName;
    return [{ id, objectName, label }];
  });
}

function parseCatalogEdgeApis(raw: unknown): PackageBuilderCatalogEdgeApiItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const edgeModelId = typeof row.edgeModelId === 'string' ? row.edgeModelId.trim() : '';
    if (!id || !edgeModelId) return [];
    const key = typeof row.key === 'string' ? row.key.trim() : id;
    const label = typeof row.label === 'string' && row.label.trim() ? row.label.trim() : key;
    const basePath = typeof row.basePath === 'string' ? row.basePath.trim() : '';
    return [{ id, edgeModelId, key, label, basePath }];
  });
}

export async function loadPackageBuilderCatalog(): Promise<PackageBuilderCatalog> {
  const [
    builderResult,
    designerDrafts,
    experienceManifest,
    navigationManifests,
  ] = await Promise.all([
    apiGet<{
      success?: boolean;
      error?: string;
      catalog?: {
        apis?: PackageBuilderCatalogApiItem[];
        uiComponents?: PackageBuilderCatalogUiComponentItem[];
        shells?: PackageBuilderCatalogShellItem[];
        workflows?: unknown[];
        edgeModels?: PackageBuilderCatalogEdgeModelItem[];
        edgeApis?: PackageBuilderCatalogEdgeApiItem[];
      };
    }>('/api/packages/builder/catalog'),
    listComponentDesignerVersions(),
    fetchExperienceManifest('admin'),
    fetchNavigationManifests(),
  ]);

  const { data: json, response: res } = builderResult;
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || 'Failed to load package builder catalog.');
  }

  const apis: PackageBuilderCatalogApiItem[] = Array.isArray(json.catalog?.apis) ? json.catalog.apis : [];
  const serverUiComponents = Array.isArray(json.catalog?.uiComponents) ? json.catalog.uiComponents : [];
  const shells: PackageBuilderCatalogShellItem[] = Array.isArray(json.catalog?.shells) ? json.catalog.shells : [];
  const uiComponents: PackageBuilderCatalogUiComponentItem[] = serverUiComponents.length > 0
    ? serverUiComponents
    : designerDrafts
      .filter((draft) => !draft.isBuiltIn)
      .map((draft) => ({
        id: draft.id,
        componentKey: buildDesignerComponentPath(draft.folder, draft.name),
        label: buildDesignerComponentPath(draft.folder, draft.name),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));

  const portals = (experienceManifest.portals ?? [])
    .filter((portal) => portal.enabled && !isBuiltInPortal(portal))
    .sort((left, right) => left.name.localeCompare(right.name));

  const navigations = navigationManifests
    .filter((item) => !item.builtIn)
    .sort((left, right) => left.id.localeCompare(right.id));

  const workflows = parseCatalogWorkflows(json.catalog?.workflows)
    .sort((left, right) => left.label.localeCompare(right.label));

  const edgeModels = parseCatalogEdgeModels(json.catalog?.edgeModels)
    .sort((left, right) => left.label.localeCompare(right.label));
  const edgeApis = parseCatalogEdgeApis(json.catalog?.edgeApis)
    .sort((left, right) => left.label.localeCompare(right.label));

  return { apis, uiComponents, shells, portals, navigations, workflows, edgeModels, edgeApis };
}
