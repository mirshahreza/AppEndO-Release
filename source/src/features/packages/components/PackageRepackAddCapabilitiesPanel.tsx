import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { readManifestCapabilityArray } from '../../../core/packages/manifestCapabilityArrays';
import type { PackageBundleManifest } from '../../../shared/api/contracts/package-manifest/types';
import { displayPackageWorkspaceAssetName, isPackageWorkspaceAssetUrl } from '../../../shared/lib/packageWorkspaceAssets';
import { isWebFontPlatformAssetUrl, webFontPlatformAssetUrlToRelativePath } from '../../../shared/lib/platformWebFonts';
import { FormSection, SideBySideTransferList } from '../../../shared/ui';
import { MonacoEditorPanel } from '../../server-functions/components/MonacoEditorPanel';
import {
  packageBuilderWorkflowRowId,
  type PackageBuilderCatalog,
} from '../lib/packageBuilderCatalog';
import { packageWorkflowIdentity, packageWorkflowLifecycleLabel } from '../lib/packageWorkflows';
import { resolvePackageEdgeDependencies } from '../lib/resolvePackageEdgeDependencies';
import { isManagedApiCoveredByPackage, managedApiPathMatchesEdgeBasePath } from '../lib/packageOwnedManagedApis';
import {
  resolvePortalApisForPackage,
  resolvePortalDerivedComponentsForPackage,
  resolvePortalPackageDependencies,
} from '../lib/resolvePortalPackageDependencies';
import { workflowItemsAsScanComponents } from '../lib/collectPackageDependencyWarnings';
import type { InitialRecordsCaptureTarget } from '../lib/packageBuilderInitialRecords';
import type { CaptureSeedBlob, CaptureHidRow, CaptureCmsModuleResult } from '../lib/packageDbCaptureClient';
import { PackageBuilderDerivedDependenciesPanel } from './PackageBuilderDerivedDependenciesPanel';
import { PackageDbCapturePanel } from './PackageDbCapturePanel';
import { PackageInitialRecordsPackingPanel } from './PackageInitialRecordsPackingPanel';

const SQL_EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 12,
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  automaticLayout: true,
};

const DEPENDENCY_KIND_CLASS = {
  Navigation: 'text-emerald-700',
  Layout: 'text-violet-700',
  Shell: 'text-indigo-700',
  Landing: 'text-cyan-700',
  File: 'text-slate-600',
} as const;

function displayDependencyName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '—';
  }

  const segments = trimmed.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return trimmed;
  }

  return segments[segments.length - 1] ?? trimmed;
}

export type PackageRepackAddTab = 'apis' | 'ui_components' | 'portals' | 'edge_data' | 'workflows' | 'install_sql' | 'uninstall_sql';

export type PackageRepackAddCapabilitiesPanelProps = {
  activeTab: PackageRepackAddTab;
  catalog: PackageBuilderCatalog;
  isCatalogLoading: boolean;
  catalogError: string | null;
  existingManifest: PackageBundleManifest | null;
  markedForRemovalApiIds: Record<string, boolean>;
  onMarkedForRemovalApiIdsChange: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  markedForRemovalComponentKeys: Record<string, boolean>;
  onMarkedForRemovalComponentKeysChange: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  markedForRemovalPortalSegments: Record<string, boolean>;
  onMarkedForRemovalPortalSegmentsChange: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  markedForRemovalWorkflowIds: Record<string, boolean>;
  onMarkedForRemovalWorkflowIdsChange: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedApiKeys: Record<string, boolean>;
  onSelectedApiKeysChange: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedComponentKeys: Record<string, boolean>;
  onSelectedComponentKeysChange: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedPortalSegments: Record<string, boolean>;
  onSelectedPortalSegmentsChange: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedWorkflowIds: Record<string, boolean>;
  onSelectedWorkflowIdsChange: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedEdgeModelIds: Record<string, boolean>;
  onSelectedEdgeModelIdsChange: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedEdgeApiIds: Record<string, boolean>;
  onSelectedEdgeApiIdsChange: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  installSql: string;
  onInstallSqlChange: (value: string) => void;
  uninstallSql: string;
  onUninstallSqlChange: (value: string) => void;
  includeInitialRecords: boolean;
  onIncludeInitialRecordsChange: (value: boolean) => void;
  seedCaptureTarget: InitialRecordsCaptureTarget;
  onSeedCaptureTargetChange: (value: InitialRecordsCaptureTarget) => void;
  optionalInstallSql: string;
  onOptionalInstallSqlChange: (value: string) => void;
  optionalUninstallSql: string;
  onOptionalUninstallSqlChange: (value: string) => void;
  onLoadSqlFile: (sql: string) => void;
  onCaptureSeedInstall: (sql: string) => void;
  onCaptureSeedUninstall: (sql: string) => void;
  onCaptureBlobs?: (blobs: CaptureSeedBlob[]) => void;
  onCaptureHidRows?: (rows: CaptureHidRow[]) => void;
  onPackCmsModule?: (result: CaptureCmsModuleResult) => void;
};

export const PackageRepackAddCapabilitiesPanel: React.FC<PackageRepackAddCapabilitiesPanelProps> = ({
  activeTab,
  catalog,
  isCatalogLoading,
  catalogError,
  existingManifest,
  markedForRemovalApiIds,
  onMarkedForRemovalApiIdsChange,
  markedForRemovalComponentKeys,
  onMarkedForRemovalComponentKeysChange,
  markedForRemovalPortalSegments,
  onMarkedForRemovalPortalSegmentsChange,
  markedForRemovalWorkflowIds,
  onMarkedForRemovalWorkflowIdsChange,
  selectedApiKeys,
  onSelectedApiKeysChange,
  selectedComponentKeys,
  onSelectedComponentKeysChange,
  selectedPortalSegments,
  onSelectedPortalSegmentsChange,
  selectedWorkflowIds,
  onSelectedWorkflowIdsChange,
  selectedEdgeModelIds,
  onSelectedEdgeModelIdsChange,
  selectedEdgeApiIds,
  onSelectedEdgeApiIdsChange,
  installSql,
  onInstallSqlChange,
  uninstallSql,
  onUninstallSqlChange,
  includeInitialRecords,
  onIncludeInitialRecordsChange,
  seedCaptureTarget,
  onSeedCaptureTargetChange,
  optionalInstallSql,
  onOptionalInstallSqlChange,
  optionalUninstallSql,
  onOptionalUninstallSqlChange,
  onLoadSqlFile,
  onCaptureSeedInstall,
  onCaptureSeedUninstall,
  onCaptureBlobs,
  onCaptureHidRows,
  onPackCmsModule,
}) => {
  const existingApis = useMemo(
    () => existingManifest?.capabilities.apis ?? [],
    [existingManifest],
  );
  const existingApiIds = useMemo(
    () => new Set(existingApis.map((api) => api.id)),
    [existingApis],
  );
  const existingEdgeApiIds = useMemo(
    () => new Set(
      ((existingManifest as PackageBundleManifest & {
        capabilities: { edge_apis?: Array<{ id: string }> };
      })?.capabilities.edge_apis ?? []).map((api) => api.id),
    ),
    [existingManifest],
  );
  const packedEdgeApiBasePaths = useMemo(
    () => catalog.edgeApis
      .filter((api) => existingEdgeApiIds.has(api.id) && api.basePath.trim())
      .map((api) => api.basePath.trim()),
    [catalog.edgeApis, existingEdgeApiIds],
  );
  const existingComponentKeys = useMemo(
    () => new Set(readManifestCapabilityArray(existingManifest?.capabilities.ui_components).map((item) => item.componentKey)),
    [existingManifest],
  );
  const existingUiComponents = useMemo(
    () => readManifestCapabilityArray(existingManifest?.capabilities.ui_components),
    [existingManifest],
  );
  const existingPortals = useMemo(
    () => (
      (existingManifest as PackageBundleManifest & {
        capabilities: { portals?: Array<{ segment: string; entry: string }> };
      })?.capabilities.portals ?? []
    ),
    [existingManifest],
  );
  const existingPortalSegments = useMemo(
    () => new Set(existingPortals.map((portal) => portal.segment)),
    [existingPortals],
  );
  const existingWorkflows = useMemo(
    () => existingManifest?.capabilities.workflows ?? [],
    [existingManifest],
  );
  const existingWorkflowIds = useMemo(
    () => new Set(existingWorkflows.map((workflow) => packageWorkflowIdentity(workflow.scopeKey, workflow.key))),
    [existingWorkflows],
  );

  const managedApis = useMemo(
    () => catalog.apis.filter((item) => item.source !== 'system'),
    [catalog.apis],
  );

  const packedEdgeManagedApis = useMemo(
    () => managedApis.filter((api) => packedEdgeApiBasePaths.some((basePath) => (
      managedApiPathMatchesEdgeBasePath(api.path, basePath)
    ))),
    [managedApis, packedEdgeApiBasePaths],
  );
  const packedEdgeManagedApiIds = useMemo(
    () => new Set(packedEdgeManagedApis.map((api) => api.id)),
    [packedEdgeManagedApis],
  );

  const catalogApisNotInPackage = useMemo(
    () => managedApis.filter((api) => !isManagedApiCoveredByPackage(api, {
      existingApis,
      packedEdgeApiBasePaths,
    })),
    [existingApis, managedApis, packedEdgeApiBasePaths],
  );

  const catalogComponentsNotInPackage = useMemo(
    () => catalog.uiComponents.filter((item) => !existingComponentKeys.has(item.componentKey)),
    [catalog.uiComponents, existingComponentKeys],
  );

  const catalogPortalsNotInPackage = useMemo(
    () => catalog.portals.filter((portal) => !existingPortalSegments.has(portal.segment)),
    [catalog.portals, existingPortalSegments],
  );

  const catalogWorkflowsNotInPackage = useMemo(
    () => catalog.workflows.filter((item) => (
      !existingWorkflowIds.has(packageWorkflowIdentity(item.scopeKey, item.key))
    )),
    [catalog.workflows, existingWorkflowIds],
  );

  const apiColumns = useMemo(
    () => [
      { key: 'method', label: 'Method' },
      { key: 'path', label: 'Path' },
      { key: 'name', label: 'Name' },
    ],
    [],
  );

  const portalColumns = useMemo(
    () => [
      { key: 'segment', label: 'Segment' },
      { key: 'name', label: 'Name' },
    ],
    [],
  );

  const apisInPackage = useMemo(() => {
    const keptExisting = existingApis.filter((api) => !markedForRemovalApiIds[api.id]);
    const seenPaths = new Set(keptExisting.map((api) => api.path));
    const edgeOwned = packedEdgeManagedApis.filter((api) => !seenPaths.has(api.path));
    const addedCatalog = catalogApisNotInPackage.filter((api) => selectedApiKeys[api.id]);
    return [...keptExisting, ...edgeOwned, ...addedCatalog];
  }, [
    catalogApisNotInPackage,
    existingApis,
    markedForRemovalApiIds,
    packedEdgeManagedApis,
    selectedApiKeys,
  ]);

  const apisAvailable = useMemo(() => {
    const removedExisting = existingApis.filter((api) => markedForRemovalApiIds[api.id]);
    const catalogAvailable = catalogApisNotInPackage.filter((api) => !selectedApiKeys[api.id]);
    return [...catalogAvailable, ...removedExisting];
  }, [catalogApisNotInPackage, existingApis, markedForRemovalApiIds, selectedApiKeys]);

  const componentsInPackage = useMemo(() => {
    const keptExisting = existingUiComponents.filter((item) => !markedForRemovalComponentKeys[item.componentKey]);
    const addedCatalog = catalogComponentsNotInPackage.filter((item) => selectedComponentKeys[item.id]);
    return { keptExisting, addedCatalog };
  }, [
    catalogComponentsNotInPackage,
    existingUiComponents,
    markedForRemovalComponentKeys,
    selectedComponentKeys,
  ]);

  const componentsAvailable = useMemo(() => {
    const removedExisting = existingUiComponents.filter((item) => markedForRemovalComponentKeys[item.componentKey]);
    const catalogAvailable = catalogComponentsNotInPackage.filter((item) => !selectedComponentKeys[item.id]);
    return { removedExisting, catalogAvailable };
  }, [
    catalogComponentsNotInPackage,
    existingUiComponents,
    markedForRemovalComponentKeys,
    selectedComponentKeys,
  ]);

  const portalsInPackage = useMemo(() => {
    const keptExisting = existingPortals.filter((portal) => !markedForRemovalPortalSegments[portal.segment]);
    const addedCatalog = catalogPortalsNotInPackage.filter((portal) => selectedPortalSegments[portal.segment]);
    return [...keptExisting, ...addedCatalog];
  }, [
    catalogPortalsNotInPackage,
    existingPortals,
    markedForRemovalPortalSegments,
    selectedPortalSegments,
  ]);

  const portalsAvailable = useMemo(() => {
    const removedExisting = existingPortals.filter((portal) => markedForRemovalPortalSegments[portal.segment]);
    const catalogAvailable = catalogPortalsNotInPackage.filter((portal) => !selectedPortalSegments[portal.segment]);
    return [...catalogAvailable, ...removedExisting];
  }, [
    catalogPortalsNotInPackage,
    existingPortals,
    markedForRemovalPortalSegments,
    selectedPortalSegments,
  ]);

  const workflowsInPackage = useMemo(() => {
    const keptExisting = existingWorkflows.filter((workflow) => (
      !markedForRemovalWorkflowIds[packageWorkflowIdentity(workflow.scopeKey, workflow.key)]
    ));
    const addedCatalog = catalogWorkflowsNotInPackage.filter((item) => (
      selectedWorkflowIds[packageBuilderWorkflowRowId(item)]
    ));
    return { keptExisting, addedCatalog };
  }, [
    catalogWorkflowsNotInPackage,
    existingWorkflows,
    markedForRemovalWorkflowIds,
    selectedWorkflowIds,
  ]);

  const workflowsAvailable = useMemo(() => {
    const removedExisting = existingWorkflows.filter((workflow) => (
      markedForRemovalWorkflowIds[packageWorkflowIdentity(workflow.scopeKey, workflow.key)]
    ));
    const catalogAvailable = catalogWorkflowsNotInPackage.filter((item) => (
      !selectedWorkflowIds[packageBuilderWorkflowRowId(item)]
    ));
    return { removedExisting, catalogAvailable };
  }, [
    catalogWorkflowsNotInPackage,
    existingWorkflows,
    markedForRemovalWorkflowIds,
    selectedWorkflowIds,
  ]);

  const packagePortals = useMemo(() => {
    const segments = new Set(portalsInPackage.map((portal) => portal.segment));
    return catalog.portals.filter((portal) => segments.has(portal.segment));
  }, [catalog.portals, portalsInPackage]);

  const selectedCatalogComponents = useMemo(
    () => catalog.uiComponents.filter((item) => selectedComponentKeys[item.id]),
    [catalog.uiComponents, selectedComponentKeys],
  );

  const selectedCatalogWorkflows = useMemo(
    () => catalog.workflows.filter((item) => selectedWorkflowIds[packageBuilderWorkflowRowId(item)]),
    [catalog.workflows, selectedWorkflowIds],
  );

  const workflowScanComponents = useMemo(
    () => workflowItemsAsScanComponents(selectedCatalogWorkflows),
    [selectedCatalogWorkflows],
  );

  const existingEdgeModelIds = useMemo(
    () => new Set(
      ((existingManifest as PackageBundleManifest & {
        capabilities: { edge_models?: Array<{ id: string }> };
      })?.capabilities.edge_models ?? []).map((model) => model.id),
    ),
    [existingManifest],
  );

  const portalDependencies = useMemo(
    () => resolvePortalPackageDependencies(
      packagePortals,
      catalog.navigations,
      catalog.uiComponents,
      catalog.shells ?? [],
      { seedComponents: selectedCatalogComponents },
    ),
    [catalog.navigations, catalog.shells, catalog.uiComponents, packagePortals, selectedCatalogComponents],
  );

  const portalDerivedComponents = useMemo(
    () => resolvePortalDerivedComponentsForPackage(
      packagePortals,
      catalog.navigations,
      catalog.uiComponents,
      catalog.shells ?? [],
      { seedComponents: selectedCatalogComponents },
    ),
    [catalog.navigations, catalog.shells, catalog.uiComponents, packagePortals, selectedCatalogComponents],
  );

  const portalDerivedApis = useMemo(
    () => resolvePortalApisForPackage(
      [...portalDerivedComponents, ...selectedCatalogComponents, ...workflowScanComponents],
      managedApis,
      portalDependencies.shells,
    ),
    [
      managedApis,
      portalDerivedComponents,
      portalDependencies.shells,
      selectedCatalogComponents,
      workflowScanComponents,
    ],
  );

  const portalDerivedApiCards = useMemo(
    () => portalDerivedApis.map((api) => ({
      key: api.id,
      kind: 'Server Function',
      name: api.name || `${api.method} ${api.path}`,
    })),
    [portalDerivedApis],
  );

  const portalDerivedComponentCards = useMemo(() => {
    const layoutComponentIds = new Set(
      portalDependencies.layouts
        .filter((layout) => layout.catalogItem)
        .map((layout) => layout.catalogItem!.id),
    );
    const cards: Array<{ key: string; kind: string; name: string }> = [];

    for (const layout of portalDependencies.layouts) {
      if (layout.builtIn) {
        continue;
      }
      cards.push({
        key: `layout:${layout.layoutLabel}`,
        kind: 'Layout',
        name: layout.layoutLabel.split('/').pop() ?? layout.layoutLabel,
      });
    }

    for (const component of portalDerivedComponents) {
      if (layoutComponentIds.has(component.id)) {
        continue;
      }
      cards.push({
        key: `component:${component.componentKey}`,
        kind: 'Component',
        name: component.label,
      });
    }

    return cards;
  }, [portalDependencies.layouts, portalDerivedComponents]);

  const portalDependencyCards = useMemo(() => {
    const cards: Array<{ key: string; kind: keyof typeof DEPENDENCY_KIND_CLASS; name: string }> = [];
    const seenLayouts = new Set<string>();
    const seenFiles = new Set<string>();

    for (const navigation of portalDependencies.navigations) {
      cards.push({
        key: `navigation:${navigation.id}`,
        kind: 'Navigation',
        name: navigation.id,
      });
    }

    for (const layout of portalDependencies.layouts) {
      if (seenLayouts.has(layout.layoutLabel)) {
        continue;
      }
      seenLayouts.add(layout.layoutLabel);
      cards.push({
        key: `layout:${layout.layoutLabel}`,
        kind: layout.shell ? 'Shell' : 'Layout',
        name: layout.shell
          ? layout.shell.title
          : displayDependencyName(layout.layoutLabel),
      });
    }

    for (const shell of portalDependencies.shells) {
      const key = `shell:${shell.shellKey}`;
      if (seenLayouts.has(key)) continue;
      seenLayouts.add(key);
      cards.push({
        key,
        kind: 'Shell',
        name: shell.title,
      });
    }

    for (const landing of portalDependencies.landings) {
      cards.push({
        key: `landing:${landing.componentKey}`,
        kind: 'Landing',
        name: landing.label || landing.componentKey,
      });
    }

    for (const file of portalDependencies.files) {
      if (
        (!isPackageWorkspaceAssetUrl(file.path) && !isWebFontPlatformAssetUrl(file.path))
        || seenFiles.has(file.path)
      ) {
        continue;
      }
      seenFiles.add(file.path);
      const fontRelative = webFontPlatformAssetUrlToRelativePath(file.path);
      cards.push({
        key: `file:${file.path}`,
        kind: 'File',
        name: fontRelative
          ? displayPackageWorkspaceAssetName(fontRelative)
          : displayPackageWorkspaceAssetName(file.path.replace(/^\/assets\/workspace\//, '')),
      });
    }

    return cards;
  }, [
    portalDependencies.files,
    portalDependencies.landings,
    portalDependencies.layouts,
    portalDependencies.navigations,
    portalDependencies.shells,
  ]);

  const derivedEdge = useMemo(
    () => resolvePackageEdgeDependencies({
      components: [...portalDerivedComponents, ...selectedCatalogComponents, ...workflowScanComponents],
      shells: portalDependencies.shells,
      edgeModels: catalog.edgeModels,
      edgeApis: catalog.edgeApis,
    }),
    [
      catalog.edgeApis,
      catalog.edgeModels,
      portalDependencies.shells,
      portalDerivedComponents,
      selectedCatalogComponents,
      workflowScanComponents,
    ],
  );

  const derivedEdgeCards = useMemo(
    () => [
      ...derivedEdge.models.map((model) => ({
        key: `edge-model:${model.id}`,
        kind: 'Edge Model',
        name: model.label,
      })),
      ...derivedEdge.apis.map((api) => ({
        key: `edge-api:${api.id}`,
        kind: 'Edge API',
        name: api.label,
      })),
    ],
    [derivedEdge.apis, derivedEdge.models],
  );

  const derivedEdgeModelIds = useMemo(
    () => new Set(derivedEdge.models.map((model) => model.id)),
    [derivedEdge.models],
  );

  const derivedEdgeApiIds = useMemo(
    () => new Set(derivedEdge.apis.map((api) => api.id)),
    [derivedEdge.apis],
  );

  const existingEdgeModels = useMemo(
    () => catalog.edgeModels.filter((model) => existingEdgeModelIds.has(model.id)),
    [catalog.edgeModels, existingEdgeModelIds],
  );

  const existingEdgeApis = useMemo(
    () => catalog.edgeApis.filter((api) => existingEdgeApiIds.has(api.id)),
    [catalog.edgeApis, existingEdgeApiIds],
  );

  const extraEdgeModels = useMemo(
    () => catalog.edgeModels.filter((model) => (
      selectedEdgeModelIds[model.id]
      && !existingEdgeModelIds.has(model.id)
      && !derivedEdgeModelIds.has(model.id)
    )),
    [catalog.edgeModels, derivedEdgeModelIds, existingEdgeModelIds, selectedEdgeModelIds],
  );

  const extraEdgeApis = useMemo(
    () => catalog.edgeApis.filter((api) => (
      selectedEdgeApiIds[api.id]
      && !existingEdgeApiIds.has(api.id)
      && !derivedEdgeApiIds.has(api.id)
    )),
    [catalog.edgeApis, derivedEdgeApiIds, existingEdgeApiIds, selectedEdgeApiIds],
  );

  const availableEdgeModels = useMemo(
    () => catalog.edgeModels.filter((model) => (
      !existingEdgeModelIds.has(model.id)
      && !derivedEdgeModelIds.has(model.id)
      && !selectedEdgeModelIds[model.id]
    )),
    [catalog.edgeModels, derivedEdgeModelIds, existingEdgeModelIds, selectedEdgeModelIds],
  );

  const availableEdgeApis = useMemo(
    () => catalog.edgeApis.filter((api) => (
      !existingEdgeApiIds.has(api.id)
      && !derivedEdgeApiIds.has(api.id)
      && !selectedEdgeApiIds[api.id]
    )),
    [catalog.edgeApis, derivedEdgeApiIds, existingEdgeApiIds, selectedEdgeApiIds],
  );

  const moveApiToPackage = (id: string) => {
    if (existingApiIds.has(id) || packedEdgeManagedApiIds.has(id)) {
      onMarkedForRemovalApiIdsChange((current) => ({ ...current, [id]: false }));
      return;
    }
    onSelectedApiKeysChange((current) => ({ ...current, [id]: true }));
  };

  const moveApiOutOfPackage = (id: string) => {
    if (packedEdgeManagedApiIds.has(id)) {
      return;
    }
    if (existingApiIds.has(id)) {
      onMarkedForRemovalApiIdsChange((current) => ({ ...current, [id]: true }));
      return;
    }
    onSelectedApiKeysChange((current) => ({ ...current, [id]: false }));
  };

  const moveComponentToPackage = (id: string) => {
    if (existingComponentKeys.has(id)) {
      onMarkedForRemovalComponentKeysChange((current) => ({ ...current, [id]: false }));
      return;
    }
    onSelectedComponentKeysChange((current) => ({ ...current, [id]: true }));
  };

  const moveComponentOutOfPackage = (id: string) => {
    if (existingComponentKeys.has(id)) {
      onMarkedForRemovalComponentKeysChange((current) => ({ ...current, [id]: true }));
      return;
    }
    onSelectedComponentKeysChange((current) => ({ ...current, [id]: false }));
  };

  const movePortalToPackage = (segment: string) => {
    if (existingPortalSegments.has(segment)) {
      onMarkedForRemovalPortalSegmentsChange((current) => ({ ...current, [segment]: false }));
      return;
    }
    onSelectedPortalSegmentsChange((current) => ({ ...current, [segment]: true }));
  };

  const movePortalOutOfPackage = (segment: string) => {
    if (existingPortalSegments.has(segment)) {
      onMarkedForRemovalPortalSegmentsChange((current) => ({ ...current, [segment]: true }));
      return;
    }
    onSelectedPortalSegmentsChange((current) => ({ ...current, [segment]: false }));
  };

  const moveWorkflowToPackage = (id: string) => {
    if (existingWorkflowIds.has(id)) {
      onMarkedForRemovalWorkflowIdsChange((current) => ({ ...current, [id]: false }));
      return;
    }
    onSelectedWorkflowIdsChange((current) => ({ ...current, [id]: true }));
  };

  const moveWorkflowOutOfPackage = (id: string) => {
    if (existingWorkflowIds.has(id)) {
      onMarkedForRemovalWorkflowIdsChange((current) => ({ ...current, [id]: true }));
      return;
    }
    onSelectedWorkflowIdsChange((current) => ({ ...current, [id]: false }));
  };

  const resolveApiRow = (api: { id: string; method: string; path: string; name?: string }) => ({
    id: api.id,
    cells: [
      <span className="font-semibold">{api.method}</span>,
      <span className="text-slate-600">{api.path}</span>,
      'name' in api && api.name ? api.name : <span className="font-mono text-[11px]">{api.id}</span>,
    ],
  });

  if (isCatalogLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading catalog…
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
        {catalogError}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {activeTab === 'apis' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <PackageBuilderDerivedDependenciesPanel
            items={portalDerivedApiCards}
            emptyMessage={packagePortals.length > 0
              ? 'No server functions were detected from the selected portals.'
              : 'Include a portal first to detect related server functions.'}
          />
          <SideBySideTransferList
            listId="repack-apis"
            tone="cyan"
            className="min-h-0 flex-1"
            leftTitle="Available"
            rightTitle="In Package"
            leftHint="Drag or double-click to include a server function."
            rightHint="Packed Edge Data operations stay here. Other functions can be removed."
            columns={apiColumns}
            leftItems={apisAvailable.map((api) => resolveApiRow(
              'name' in api ? api : { ...api, name: undefined },
            ))}
            rightItems={apisInPackage.map((api) => resolveApiRow(
              'name' in api ? api : { ...api, name: undefined },
            ))}
            onMoveToRight={moveApiToPackage}
            onMoveToLeft={moveApiOutOfPackage}
            leftEmptyMessage="No managed server functions available."
            rightEmptyMessage="Drag server functions here to include them in the package."
          />
        </div>
      ) : null}

      {activeTab === 'ui_components' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <PackageBuilderDerivedDependenciesPanel
            items={portalDerivedComponentCards}
            emptyMessage={packagePortals.length > 0
              ? 'No client components were detected from the selected portals.'
              : 'Include a portal first to detect related client components.'}
          />
          <SideBySideTransferList
            listId="repack-ui-components"
            tone="violet"
            className="min-h-0 flex-1"
            leftTitle="Available"
            rightTitle="In Package"
            leftHint="Drag or double-click to include a component."
            rightHint="Drag or double-click to remove from the package."
            columns={[{ key: 'component', label: 'Component' }]}
            leftItems={[
              ...componentsAvailable.catalogAvailable.map((item) => ({
                id: item.id,
                cells: [item.label],
              })),
              ...componentsAvailable.removedExisting.map((item) => ({
                id: item.componentKey,
                cells: [item.componentKey],
              })),
            ]}
            rightItems={[
              ...componentsInPackage.keptExisting.map((item) => ({
                id: item.componentKey,
                cells: [item.componentKey],
              })),
              ...componentsInPackage.addedCatalog.map((item) => ({
                id: item.id,
                cells: [item.label],
              })),
            ]}
            onMoveToRight={moveComponentToPackage}
            onMoveToLeft={moveComponentOutOfPackage}
            leftEmptyMessage="No custom components available."
            rightEmptyMessage="Drag components here to include them in the package."
          />
        </div>
      ) : null}

      {activeTab === 'portals' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <FormSection
            title="Portal"
            ink="accent"
            className="flex h-[30%] min-h-[11rem] max-h-[32%] shrink-0 flex-col gap-3 !space-y-0 overflow-hidden"
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <SideBySideTransferList
                listId="repack-portals"
                tone="emerald"
                compact
                className="min-h-0 flex-1"
                leftTitle="Available"
                rightTitle="In Package"
                leftHint="Drag or double-click to attach a portal."
                rightHint="Drag or double-click to detach."
                columns={portalColumns}
                leftItems={portalsAvailable.map((portal) => ({
                  id: portal.segment,
                  cells: [
                    <span className="font-mono text-slate-600">{portal.segment}</span>,
                    'name' in portal ? portal.name : <span className="font-mono text-[11px] text-slate-500">{portal.entry}</span>,
                  ],
                }))}
                rightItems={portalsInPackage.map((portal) => ({
                  id: portal.segment,
                  cells: [
                    <span className="font-mono text-slate-600">{portal.segment}</span>,
                    'name' in portal ? portal.name : <span className="font-mono text-[11px] text-slate-500">{portal.entry}</span>,
                  ],
                }))}
                onMoveToRight={movePortalToPackage}
                onMoveToLeft={movePortalOutOfPackage}
                leftEmptyMessage="No portals available."
                rightEmptyMessage="Drag portals here to include them in the package."
              />
            </div>
          </FormSection>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <FormSection title="Dependencies" ink="complement" divided className="min-h-0 flex-1 overflow-hidden">
              {portalDependencyCards.length === 0 ? (
                <p className="text-sm text-slate-500 ps-[4px]">
                  {packagePortals.length > 0
                    ? 'No dependencies detected for the portals in this package.'
                    : 'Select a portal to auto-detect navigation, layout, and file dependencies.'}
                </p>
              ) : (
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
                  {portalDependencyCards.map((card) => (
                    <div
                      key={card.key}
                      className="rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2.5"
                      title={card.name}
                    >
                      <p className={`ps-[4px] text-[10px] font-bold uppercase tracking-wider ${DEPENDENCY_KIND_CLASS[card.kind]}`}>
                        {card.kind}
                      </p>
                      <p className="mt-[2px] truncate ps-[4px] text-sm font-medium text-slate-800">
                        {card.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </FormSection>
          </div>
        </div>
      ) : null}

      {activeTab === 'edge_data' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <PackageBuilderDerivedDependenciesPanel
            items={derivedEdgeCards}
            emptyMessage={portalDerivedComponents.length > 0 || selectedCatalogComponents.length > 0
              ? 'No Edge models or APIs were detected from the selected pages.'
              : 'Include a portal or client component first to detect related Edge data.'}
          />
          <SideBySideTransferList
            listId="repack-edge-models"
            tone="slate"
            className="min-h-0 flex-1"
            leftTitle="Available models"
            rightTitle="In Package"
            leftHint="Derived models are packed automatically. Drag extras here to include them."
            rightHint="Existing models stay in the package. Extra picks can be removed."
            columns={[
              { key: 'id', label: 'Id' },
              { key: 'object', label: 'Object' },
            ]}
            leftItems={availableEdgeModels.map((item) => ({
              id: item.id,
              cells: [
                <span className="font-mono text-slate-600">{item.id}</span>,
                item.label,
              ],
            }))}
            rightItems={[...existingEdgeModels, ...extraEdgeModels].map((item) => ({
              id: item.id,
              cells: [
                <span className="font-mono text-slate-600">{item.id}</span>,
                item.label,
              ],
            }))}
            onMoveToRight={(id) => onSelectedEdgeModelIdsChange((current) => ({ ...current, [id]: true }))}
            onMoveToLeft={(id) => {
              if (existingEdgeModelIds.has(id)) return;
              onSelectedEdgeModelIdsChange((current) => ({ ...current, [id]: false }));
            }}
            leftEmptyMessage="No extra Edge models available."
            rightEmptyMessage="Derived Edge models are packed automatically."
          />
          <SideBySideTransferList
            listId="repack-edge-apis"
            tone="slate"
            className="min-h-0 flex-1"
            leftTitle="Available APIs"
            rightTitle="In Package"
            leftHint="Selecting an API also packs its Edge model."
            rightHint="Existing APIs stay in the package. Extra picks can be removed."
            columns={[
              { key: 'key', label: 'Key' },
              { key: 'path', label: 'Base path' },
            ]}
            leftItems={availableEdgeApis.map((item) => ({
              id: item.id,
              cells: [
                item.label,
                <span className="font-mono text-slate-600">{item.basePath || '—'}</span>,
              ],
            }))}
            rightItems={[...existingEdgeApis, ...extraEdgeApis].map((item) => ({
              id: item.id,
              cells: [
                item.label,
                <span className="font-mono text-slate-600">{item.basePath || '—'}</span>,
              ],
            }))}
            onMoveToRight={(id) => onSelectedEdgeApiIdsChange((current) => ({ ...current, [id]: true }))}
            onMoveToLeft={(id) => {
              if (existingEdgeApiIds.has(id)) return;
              onSelectedEdgeApiIdsChange((current) => ({ ...current, [id]: false }));
            }}
            leftEmptyMessage="No extra Edge APIs available."
            rightEmptyMessage="Derived Edge APIs are packed automatically."
          />
        </div>
      ) : null}

      {activeTab === 'workflows' ? (
        <SideBySideTransferList
          listId="repack-workflows"
          tone="indigo"
          className="min-h-0 flex-1"
          leftTitle="Available"
          rightTitle="In Package"
          leftHint="Drag or double-click to include a workflow."
          rightHint="Drag or double-click to remove from the package."
          columns={[
            { key: 'key', label: 'Workflow' },
            { key: 'status', label: 'Status' },
          ]}
          leftItems={[
            ...workflowsAvailable.catalogAvailable.map((item) => ({
              id: packageBuilderWorkflowRowId(item),
              cells: [
                <span className="font-mono text-slate-700">{item.label}</span>,
                <span className="text-slate-500">{packageWorkflowLifecycleLabel(item.lifecycleStatus)}</span>,
              ],
            })),
            ...workflowsAvailable.removedExisting.map((item) => ({
              id: packageWorkflowIdentity(item.scopeKey, item.key),
              cells: [
                <span className="font-mono text-slate-700">{packageWorkflowIdentity(item.scopeKey, item.key)}</span>,
                <span className="text-slate-500">In package</span>,
              ],
            })),
          ]}
          rightItems={[
            ...workflowsInPackage.keptExisting.map((item) => ({
              id: packageWorkflowIdentity(item.scopeKey, item.key),
              cells: [
                <span className="font-mono text-slate-700">{packageWorkflowIdentity(item.scopeKey, item.key)}</span>,
                <span className="text-slate-500">In package</span>,
              ],
            })),
            ...workflowsInPackage.addedCatalog.map((item) => ({
              id: packageBuilderWorkflowRowId(item),
              cells: [
                <span className="font-mono text-slate-700">{item.label}</span>,
                <span className="text-slate-500">{packageWorkflowLifecycleLabel(item.lifecycleStatus)}</span>,
              ],
            })),
          ]}
          onMoveToRight={moveWorkflowToPackage}
          onMoveToLeft={moveWorkflowOutOfPackage}
          leftEmptyMessage="No workflow definitions available."
          rightEmptyMessage="Drag workflows here to include them in the package."
        />
      ) : null}

      {activeTab === 'install_sql' ? (
        <div className="flex flex-1 min-h-0 w-full flex-col overflow-hidden">
          <PackageInitialRecordsPackingPanel
            idPrefix="package-repack"
            includeInitialRecords={includeInitialRecords}
            onIncludeInitialRecordsChange={onIncludeInitialRecordsChange}
            captureTarget={seedCaptureTarget}
            onCaptureTargetChange={onSeedCaptureTargetChange}
          />
          <PackageDbCapturePanel
            onLoadSqlFile={onLoadSqlFile}
            onCaptureSeedInstall={onCaptureSeedInstall}
            onCaptureSeedUninstall={onCaptureSeedUninstall}
            onCaptureBlobs={onCaptureBlobs}
            onCaptureHidRows={onCaptureHidRows}
            includeOptionalRecords={includeInitialRecords}
            onPackCmsModule={onPackCmsModule}
          />
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            <p className="shrink-0 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Required foundation SQL
            </p>
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <MonacoEditorPanel
                language="sql"
                defaultLanguage="sql"
                value={installSql}
                onChange={(value) => onInstallSqlChange(value ?? '')}
                options={SQL_EDITOR_OPTIONS}
                documentKey="package-repack-addon-install-sql"
              />
            </div>
          </div>
          {includeInitialRecords ? (
            <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-slate-200">
              <p className="shrink-0 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Optional initial records
              </p>
              <div className="flex min-h-0 flex-1 overflow-hidden">
                <MonacoEditorPanel
                  language="sql"
                  defaultLanguage="sql"
                  value={optionalInstallSql}
                  onChange={(value) => onOptionalInstallSqlChange(value ?? '')}
                  options={SQL_EDITOR_OPTIONS}
                  documentKey="package-repack-addon-optional-install-sql"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'uninstall_sql' ? (
        <div className="flex flex-1 min-h-0 w-full flex-col overflow-hidden">
          <PackageInitialRecordsPackingPanel
            idPrefix="package-repack"
            includeInitialRecords={includeInitialRecords}
            onIncludeInitialRecordsChange={onIncludeInitialRecordsChange}
            captureTarget={seedCaptureTarget}
            onCaptureTargetChange={onSeedCaptureTargetChange}
          />
          <PackageDbCapturePanel
            onLoadSqlFile={onLoadSqlFile}
            onCaptureSeedInstall={onCaptureSeedInstall}
            onCaptureSeedUninstall={onCaptureSeedUninstall}
            onCaptureBlobs={onCaptureBlobs}
            onCaptureHidRows={onCaptureHidRows}
            includeOptionalRecords={includeInitialRecords}
            onPackCmsModule={onPackCmsModule}
          />
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            <p className="shrink-0 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Required uninstall SQL
            </p>
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <MonacoEditorPanel
                language="sql"
                defaultLanguage="sql"
                value={uninstallSql}
                onChange={(value) => onUninstallSqlChange(value ?? '')}
                options={SQL_EDITOR_OPTIONS}
                documentKey="package-repack-addon-uninstall-sql"
              />
            </div>
          </div>
          {includeInitialRecords ? (
            <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-slate-200">
              <p className="shrink-0 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Optional initial-record uninstall
              </p>
              <div className="flex min-h-0 flex-1 overflow-hidden">
                <MonacoEditorPanel
                  language="sql"
                  defaultLanguage="sql"
                  value={optionalUninstallSql}
                  onChange={(value) => onOptionalUninstallSqlChange(value ?? '')}
                  options={SQL_EDITOR_OPTIONS}
                  documentKey="package-repack-addon-optional-uninstall-sql"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
