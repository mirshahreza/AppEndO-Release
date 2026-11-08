import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import {
  useEdgeModelsQuery,
  useDeleteEdgeApiDefinitionMutation,
  useEdgeApiDefinitionsQuery,
  useImportEdgeModelMutation,
} from '../../../shared/api/queries/data-api';
import { useServerFunctionsCatalogQuery } from '../../../shared/api/queries/server-functions';
import {
  dataSourcesQueryKeys,
  fetchDataSourceObjectFields,
  fetchSchemaObjectDefinition,
  useDataSourceSchemaCatalogQuery,
  useDataSourceSchemaObjectsQuery,
  useDataSourcesQuery,
  useCreateSchemaObjectMutation,
  useDeleteSchemaObjectMutation,
  useTruncateSchemaObjectMutation,
  useExecuteDataSourceQueryMutation,
  useUpdateSchemaObjectDefinitionMutation,
} from '../../../shared/api/queries/data-sources';
import type { CreateSchemaObjectInput } from '../../../shared/api/contracts/data-sources/createSchemaObject';
import type { EdgeApiDefinition, EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import type { SchemaObjectDependencyItem } from '../../../shared/api/contracts/data-sources/schemaObjectDependencies';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../shared/lib/usePersistedListPreferences';
import {
  DEFAULT_DATA_STUDIO_LIST_FILTERS,
  sanitizeDataStudioListFilters,
} from '../lib/dataStudioListFilters';
import {
  buildEdgeModelLookupKey,
  DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS,
  DEFAULT_DATA_STUDIO_EXPLORER_OBJECT_KIND,
  getDataStudioExplorerObjectKindLabel,
  resolveCreateSchemaObjectInput,
  resolveCreateSchemaObjectSqlInput,
  resolveDeleteSchemaObjectInput,
  resolveEdgeModelImportType,
  resolveExplorerSchemaQuery,
  resolveDataStudioExplorerObjectKindFromDependencyKind,
  resolveSchemaObjectDefinitionQuery,
  resolveUpdateSchemaObjectSqlInput,
} from '../lib/explorerObjectKinds';
import { buildSchemaObjectSqlTemplate, canCreateSchemaObjectKind, usesSqlEditorForCreate } from '../lib/schemaObjectSqlTemplates';
import { buildSchemaObjectRunSqlTemplate, canRunSchemaObjectKind } from '../lib/schemaObjectRunSqlTemplates';
import {
  deriveStructureFromFields,
  needsExplorerStructureHydration,
  resolveExplorerObjectStructure,
} from '../lib/explorerObjectStructure';
import { isControlPlaneSchemaObjectName } from '../lib/controlPlaneSchemaObjects';
import { useEdgeModelDesignerManager } from './useEdgeModelDesignerManager';
import { useEdgeModelDatasheetManager } from './useEdgeModelDatasheetManager';
import { useEdgeModelRelationsManager } from './useEdgeModelRelationsManager';
import { useSyncModels } from './useSyncModels';
import { useSchemaObjectSqlPanelManager, buildSchemaObjectSqlPanelId } from './useSchemaObjectSqlPanelManager';
import { useSchemaObjectRunPanelManager, buildSchemaObjectRunPanelId } from './useSchemaObjectRunPanelManager';
import type { DataStudioExplorerObjectKind, DataStudioExplorerObjectRow } from '../types';
import type { SyncModelTarget } from '../types/syncModels';
import type { ServerFunctionItem } from '../../../shared/api/contracts/server-functions/types';
import type { ConfigureDataApiTarget } from '../components/ConfigureDataApiDialog';
import type {
  ConfigureFunctionApiMode,
  ConfigureFunctionApiTarget,
} from '../components/ConfigureFunctionApiDialog';
import { isPackageServerFunction } from '../../../shared/api/contracts/server-functions/packageFunctions';
import {
  buildDataStudioListRelativePath,
  buildDataStudioModelerEditRelativePath,
  findEdgeModelByEditSlug,
  parseDataStudioModelerEditSlug,
  parseDataStudioModelerEditSlugFromPathname,
} from '../dataStudioRoute';
import { useDataStudioWorkspaceOverlayDeepLink } from './useDataStudioWorkspaceOverlayDeepLink';

type ToastState = {
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
  persistent?: boolean;
} | null;

export type CreateObjectDialogState = {
  open: boolean;
  objectKind: DataStudioExplorerObjectKind;
};

const edgeModelPresentationScore = (model: EdgeModelDefinition): number => {
  const hasIcon = Boolean(model.labels.icon?.trim());
  const hasColor = Boolean(model.labels.color?.trim());
  const updatedAt = Date.parse(model.updated_at) || 0;
  // Prefer models with operator-facing icon/color when duplicates share a lookup key.
  return (hasIcon ? 2_000_000_000_000 : 0)
    + (hasColor ? 1_000_000_000_000 : 0)
    + updatedAt;
};

const pickPreferredEdgeModel = (
  existing: EdgeModelDefinition | undefined,
  candidate: EdgeModelDefinition,
): EdgeModelDefinition => {
  if (!existing) {
    return candidate;
  }
  return edgeModelPresentationScore(candidate) >= edgeModelPresentationScore(existing)
    ? candidate
    : existing;
};

const buildEdgeModelLookup = (models: EdgeModelDefinition[] | undefined) => {
  const lookup = new Map<string, EdgeModelDefinition>();
  for (const model of models ?? []) {
    if (model.objectType !== 'TABLE' && model.objectType !== 'VIEW') {
      continue;
    }
    const key = buildEdgeModelLookupKey(model.dataSourceId, model.objectType, model.objectName);
    lookup.set(key, pickPreferredEdgeModel(lookup.get(key), model));
  }
  return lookup;
};

const ROUTE_FUNCTION_KIND_CANDIDATES: DataStudioExplorerObjectKind[] = [
  'SCALAR_FUNCTION',
  'TABLE_VALUED_FUNCTION',
];

const findRouteObjectKindFromCatalog = (
  objectName: string,
  catalog: Record<'TABLE' | 'VIEW' | 'PROCEDURE' | 'FUNCTION', string[]>,
): DataStudioExplorerObjectKind | null => {
  const normalized = objectName.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (catalog.TABLE.some((item) => item.toLowerCase() === normalized)) {
    return 'TABLE';
  }
  if (catalog.VIEW.some((item) => item.toLowerCase() === normalized)) {
    return 'VIEW';
  }
  if (catalog.PROCEDURE.some((item) => item.toLowerCase() === normalized)) {
    return 'STORED_PROCEDURE';
  }
  if (catalog.FUNCTION.some((item) => item.toLowerCase() === normalized)) {
    return 'SCALAR_FUNCTION';
  }
  return null;
};

const buildRouteObjectKey = (
  dataSourceId: string,
  objectKind: DataStudioExplorerObjectKind,
  objectName: string,
): string => `${dataSourceId}::${objectKind}::${objectName}`;

export function useDataStudioPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { mountId, toMountPath } = usePlatformMount();
  const application = useOptionalPortal();
  const routeParamSuffix = useParams()['*'];
  const applicationSuffix = application?.pageRemainderPath.replace(/^\/+/, '') || undefined;
  const pathSuffix = applicationSuffix ?? routeParamSuffix;
  const editSlugFromUrl = useMemo(
    () => parseDataStudioModelerEditSlug(pathSuffix)
      ?? parseDataStudioModelerEditSlugFromPathname(location.pathname),
    [location.pathname, pathSuffix],
  );
  const skipUrlToStateSyncRef = useRef(false);

  const dataSourcesQuery = useDataSourcesQuery();
  const edgeModelsQuery = useEdgeModelsQuery();
  const dataSources = dataSourcesQuery.data?.items ?? [];
  const edgeModels = edgeModelsQuery.data ?? [];

  const defaultDataSourceId = useMemo(
    () => dataSources.find((item) => item.isDefault)?.id ?? dataSources[0]?.id ?? '',
    [dataSources],
  );

  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.dataStudio,
    defaultFilters: DEFAULT_DATA_STUDIO_LIST_FILTERS,
    sanitize: sanitizeDataStudioListFilters,
  });
  const { selectedDataSourceId, objectKind, searchInput } = filters;
  const [searchText, setSearchText] = useState(searchInput);

  const setSelectedDataSourceId = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, selectedDataSourceId: next }));
  }, [setFilters]);

  const setObjectKind = useCallback((next: DataStudioExplorerObjectKind) => {
    setFilters((prev) => ({ ...prev, objectKind: next }));
  }, [setFilters]);

  const setSearchInput = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, searchInput: next }));
  }, [setFilters]);
  /** Local open state; URL sync uses skipUrlToStateSyncRef (same pattern as Workflows). */
  const [openModelId, setOpenModelIdState] = useState<string | null>(null);
  const [routeOpenedSqlPanelId, setRouteOpenedSqlPanelId] = useState<string | null>(null);
  const [resolvedRouteObjectKey, setResolvedRouteObjectKey] = useState<string | null>(null);
  const [pendingSqlEditorRowId, setPendingSqlEditorRowId] = useState<string | null>(null);
  const [pendingRunRowId, setPendingRunRowId] = useState<string | null>(null);
  const [pendingModelerRowId, setPendingModelerRowId] = useState<string | null>(null);
  const [pendingDatasheetRowId, setPendingDatasheetRowId] = useState<string | null>(null);
  const [deleteObjectTarget, setDeleteObjectTarget] = useState<DataStudioExplorerObjectRow | null>(null);
  const [truncateTableTarget, setTruncateTableTarget] = useState<DataStudioExplorerObjectRow | null>(null);
  const [truncateTableError, setTruncateTableError] = useState<string | null>(null);
  const [deleteApiTarget, setDeleteApiTarget] = useState<EdgeApiDefinition | null>(null);
  const [configureApiTarget, setConfigureApiTarget] = useState<ConfigureDataApiTarget | null>(null);
  const [configureFunctionApiTarget, setConfigureFunctionApiTarget] = useState<ConfigureFunctionApiTarget | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [createObjectDialog, setCreateObjectDialog] = useState<CreateObjectDialogState>({
    open: false,
    objectKind: DEFAULT_DATA_STUDIO_EXPLORER_OBJECT_KIND,
  });
  const designerManager = useEdgeModelDesignerManager();
  const datasheetManager = useEdgeModelDatasheetManager();
  const relationsManager = useEdgeModelRelationsManager();
  const sqlPanelManager = useSchemaObjectSqlPanelManager();
  const runPanelManager = useSchemaObjectRunPanelManager();
  const syncModels = useSyncModels();
  const createSchemaObjectMutation = useCreateSchemaObjectMutation();
  const updateSchemaObjectMutation = useUpdateSchemaObjectDefinitionMutation();
  const executeDataSourceQueryMutation = useExecuteDataSourceQueryMutation();
  const deleteSchemaObjectMutation = useDeleteSchemaObjectMutation();
  const truncateSchemaObjectMutation = useTruncateSchemaObjectMutation();
  const deleteEdgeApiMutation = useDeleteEdgeApiDefinitionMutation();
  const importEdgeModelMutation = useImportEdgeModelMutation();

  const buildExplorerRowFromEdgeModel = useCallback((model: EdgeModelDefinition): DataStudioExplorerObjectRow => {
    const objectKind = model.objectType;
    return {
      id: `${objectKind}:${model.objectName}`,
      name: model.objectName,
      objectKind,
      objectKindLabel: getDataStudioExplorerObjectKindLabel(objectKind),
      columnCount: model.columns.length,
      primaryKey: model.primaryKey,
      supportsEdgeModel: true,
      isControlPlaneLocked: isControlPlaneSchemaObjectName(model.objectName),
      edgeModelId: model.id,
      modelStatus: model.status,
      modelIcon: model.labels.icon?.trim() || null,
      modelColor: model.labels.color?.trim() || null,
    };
  }, []);

  useEffect(() => {
    if (dataSourcesQuery.isLoading || dataSources.length === 0) {
      return;
    }
    const exists = Boolean(selectedDataSourceId)
      && dataSources.some((item) => item.id === selectedDataSourceId);
    if (!exists && defaultDataSourceId) {
      setSelectedDataSourceId(defaultDataSourceId);
    }
  }, [
    dataSources,
    dataSourcesQuery.isLoading,
    defaultDataSourceId,
    selectedDataSourceId,
    setSelectedDataSourceId,
  ]);

  const listRelativePath = useMemo(
    () => buildDataStudioListRelativePath(mountId),
    [mountId],
  );
  const listPath = useMemo(
    () => toMountPath(listRelativePath),
    [listRelativePath, toMountPath],
  );

  const schemaQuery = resolveExplorerSchemaQuery(objectKind);
  const schemaCatalogQuery = useDataSourceSchemaCatalogQuery(selectedDataSourceId, Boolean(selectedDataSourceId));
  const objectsQuery = useDataSourceSchemaObjectsQuery(
    selectedDataSourceId,
    schemaQuery.objectType,
    schemaQuery.functionKind,
  );

  const openModelObjectName = useMemo(() => {
    if (!openModelId) {
      return null;
    }
    return edgeModels.find((model) => model.id === openModelId)?.objectName ?? null;
  }, [edgeModels, openModelId]);

  const resolveOpenModelApiContext = useCallback((): ConfigureDataApiTarget | null => {
    if (!openModelId) {
      return null;
    }

    const model = edgeModels.find((item) => item.id === openModelId);
    if (!model || (model.objectType !== 'TABLE' && model.objectType !== 'VIEW')) {
      return null;
    }

    const source = dataSources.find((item) => item.id === model.dataSourceId);

    return {
      row: buildExplorerRowFromEdgeModel(model),
      edgeModelId: model.id,
      objectType: model.objectType,
      dataSourceName: source?.name ?? null,
    };
  }, [buildExplorerRowFromEdgeModel, dataSources, edgeModels, openModelId]);

  const setOpenModelId = useCallback((modelId: string | null) => {
    skipUrlToStateSyncRef.current = true;
    setOpenModelIdState(modelId);

    if (modelId === null) {
      navigate(listPath);
      return;
    }

    const target = edgeModels.find((model) => model.id === modelId);
    if (!target) {
      return;
    }

    navigate(toMountPath(buildDataStudioModelerEditRelativePath(target, mountId)));
  }, [edgeModels, listPath, mountId, navigate, toMountPath]);

  useEffect(() => {
    if (edgeModelsQuery.isLoading || schemaCatalogQuery.isLoading) {
      return;
    }

    if (skipUrlToStateSyncRef.current) {
      if (openModelId === null) {
        if (!editSlugFromUrl) {
          skipUrlToStateSyncRef.current = false;
        }
        return;
      }

      const pendingMatch = editSlugFromUrl
        ? findEdgeModelByEditSlug(edgeModels, editSlugFromUrl, {
          preferredDataSourceId: selectedDataSourceId,
        })
        : undefined;
      if (pendingMatch?.id !== openModelId) {
        // Editor→editor: keep optimistic model until the new slug lands.
        return;
      }
      skipUrlToStateSyncRef.current = false;
    }

    if (!editSlugFromUrl) {
      if (openModelId !== null) {
        setOpenModelIdState(null);
      }
      if (routeOpenedSqlPanelId) {
        sqlPanelManager.closePanel(routeOpenedSqlPanelId);
        setRouteOpenedSqlPanelId(null);
      }
      if (resolvedRouteObjectKey !== null) {
        setResolvedRouteObjectKey(null);
      }
      return;
    }

    const matched = findEdgeModelByEditSlug(edgeModels, editSlugFromUrl, {
      preferredDataSourceId: selectedDataSourceId,
    });
    if (!matched) {
      // Non-modeler deep links are handled by the route object resolver below.
      return;
    }

    if (openModelId !== matched.id) {
      setOpenModelIdState(matched.id);
    }
    // Keep list DS selection aligned with the open modeler (deep link / multi-source).
    if (matched.dataSourceId && matched.dataSourceId !== selectedDataSourceId) {
      setSelectedDataSourceId(matched.dataSourceId);
    }
    if (resolvedRouteObjectKey !== null) {
      setResolvedRouteObjectKey(null);
    }
    if (routeOpenedSqlPanelId) {
      sqlPanelManager.closePanel(routeOpenedSqlPanelId);
      setRouteOpenedSqlPanelId(null);
    }
  }, [
    edgeModels,
    edgeModelsQuery.isLoading,
    editSlugFromUrl,
    listPath,
    navigate,
    openModelId,
    resolvedRouteObjectKey,
    routeOpenedSqlPanelId,
    schemaCatalogQuery.isLoading,
    selectedDataSourceId,
    setSelectedDataSourceId,
    sqlPanelManager,
  ]);

  useEffect(() => {
    if (skipUrlToStateSyncRef.current) {
      return;
    }
    if (!openModelId || !editSlugFromUrl || edgeModelsQuery.isLoading) {
      return;
    }

    const target = edgeModels.find((model) => model.id === openModelId);
    if (!target) {
      return;
    }

    const canonicalPath = toMountPath(buildDataStudioModelerEditRelativePath(target, mountId));
    if (location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [
    edgeModels,
    edgeModelsQuery.isLoading,
    editSlugFromUrl,
    location.pathname,
    mountId,
    navigate,
    openModelId,
    toMountPath,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchText(searchInput), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!toast || toast.persistent) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const edgeModelLookup = useMemo(
    () => buildEdgeModelLookup(edgeModelsQuery.data ?? []),
    [edgeModelsQuery.data],
  );

  const importObjectType = resolveEdgeModelImportType(objectKind);
  const schemaItems = objectsQuery.data?.items ?? [];
  const shouldHydrateStructure = Boolean(selectedDataSourceId)
    && needsExplorerStructureHydration(schemaItems);

  const structureFieldQueries = useQueries({
    queries: shouldHydrateStructure
      ? schemaItems.map((item) => ({
        queryKey: dataSourcesQueryKeys.objectFields(
          selectedDataSourceId,
          schemaQuery.objectType,
          item.name,
        ),
        queryFn: () => fetchDataSourceObjectFields(
          selectedDataSourceId,
          schemaQuery.objectType,
          item.name,
        ),
        staleTime: 30_000,
      }))
      : [],
  });

  const hydratedStructureByName = useMemo(() => {
    if (!shouldHydrateStructure) {
      return new Map<string, ReturnType<typeof deriveStructureFromFields>>();
    }

    const lookup = new Map<string, ReturnType<typeof deriveStructureFromFields>>();
    schemaItems.forEach((item, index) => {
      const fields = structureFieldQueries[index]?.data?.items ?? [];
      if (fields.length > 0) {
        lookup.set(item.name, deriveStructureFromFields(fields));
      }
    });
    return lookup;
  }, [schemaItems, shouldHydrateStructure, structureFieldQueries]);

  const rows = useMemo<DataStudioExplorerObjectRow[]>(() => {
    const objectKindLabel = getDataStudioExplorerObjectKindLabel(objectKind);
    const supportsEdgeModel = importObjectType !== null;

    return schemaItems.map((item) => {
      const edgeModel = supportsEdgeModel && selectedDataSourceId
        ? edgeModelLookup.get(buildEdgeModelLookupKey(selectedDataSourceId, importObjectType, item.name))
        : undefined;
      const structure = resolveExplorerObjectStructure(
        item,
        edgeModel,
        hydratedStructureByName.get(item.name),
      );

      const isControlPlaneLocked = isControlPlaneSchemaObjectName(item.name);

      return {
        id: `${objectKind}:${item.name}`,
        name: item.name,
        objectKind,
        objectKindLabel,
        columnCount: structure.columnCount,
        primaryKey: structure.primaryKey,
        supportsEdgeModel,
        isControlPlaneLocked,
        edgeModelId: edgeModel?.id ?? null,
        modelStatus: edgeModel?.status ?? null,
        modelIcon: edgeModel?.labels.icon?.trim() || null,
        modelColor: edgeModel?.labels.color?.trim() || null,
      };
    });
  }, [
    edgeModelLookup,
    hydratedStructureByName,
    importObjectType,
    objectKind,
    schemaItems,
    selectedDataSourceId,
  ]);

  const selectedDataSource = useMemo(
    () => dataSources.find((item) => item.id === selectedDataSourceId) ?? null,
    [dataSources, selectedDataSourceId],
  );

  const filteredRows = useMemo(() => {
    const needle = searchText.trim().toLowerCase();

    if (!needle) {
      return rows;
    }

    return rows.filter((row) => row.name.toLowerCase().includes(needle));
  }, [rows, searchText]);

  const handleCloseConfigureApiWizard = useCallback(() => {
    setConfigureApiTarget(null);
  }, []);

  const handleCloseConfigureFunctionApi = useCallback(() => {
    setConfigureFunctionApiTarget(null);
  }, []);

  const handleFunctionApiSaved = useCallback((text: string) => {
    setToast({ type: 'success', text });
  }, []);

  const handleConfigureApiPublished = useCallback((definition: EdgeApiDefinition) => {
    const path = definition.operations[0]?.pathPattern ?? definition.basePath;
    setToast({
      type: 'success',
      text: `Data API published at ${path}.`,
    });
  }, []);

  const handleOpenDesigner = useCallback((row: DataStudioExplorerObjectRow) => {
    if (!selectedDataSourceId || row.objectKind !== 'TABLE') {
      return;
    }

    const source = dataSources.find((item) => item.id === selectedDataSourceId);
    if (!source) {
      return;
    }

    designerManager.openDesigner({
      row,
      dataSourceId: selectedDataSourceId,
      dataSourceName: source.name,
      dataSourceType: source.type,
    });
  }, [dataSources, designerManager.openDesigner, selectedDataSourceId]);

  const handleOpenDatasheet = useCallback(async (row: DataStudioExplorerObjectRow) => {
    if (!selectedDataSourceId || row.objectKind !== 'TABLE') {
      return;
    }
    const source = dataSources.find((item) => item.id === selectedDataSourceId);
    if (!source) {
      return;
    }
    const importType = resolveEdgeModelImportType(row.objectKind);
    let modelId = row.edgeModelId
      ?? (importType
        ? edgeModelLookup.get(buildEdgeModelLookupKey(selectedDataSourceId, importType, row.name))?.id ?? null
        : null);
    if (!modelId && importType) {
      setPendingDatasheetRowId(row.id);
      try {
        const created = await importEdgeModelMutation.mutateAsync({
          dataSourceId: selectedDataSourceId,
          objectName: row.name,
          objectType: importType,
        });
        modelId = created.id;
      } catch (error) {
        const message = isApiError(error)
          ? formatApiErrorMessage(error)
          : (error instanceof Error ? error.message : 'Failed to open datasheet.');
        setToast({ type: 'error', text: message });
        return;
      } finally {
        setPendingDatasheetRowId(null);
      }
    }
    if (!modelId) {
      return;
    }
    datasheetManager.openDatasheet({
      row: { ...row, edgeModelId: modelId },
      modelId,
      dataSourceId: selectedDataSourceId,
      dataSourceName: source.name,
    });
  }, [
    dataSources,
    datasheetManager.openDatasheet,
    edgeModelLookup,
    importEdgeModelMutation,
    selectedDataSourceId,
  ]);

  const openSqlEditorForObject = useCallback(async (
    row: DataStudioExplorerObjectRow,
    options?: { suppressPendingState?: boolean },
  ): Promise<string | null> => {
    if (!selectedDataSourceId || row.objectKind === 'TABLE') {
      return null;
    }

    const source = dataSources.find((item) => item.id === selectedDataSourceId);
    if (!source) {
      return null;
    }

    if (!options?.suppressPendingState) {
      setPendingSqlEditorRowId(row.id);
    }
    try {
      const definitionCandidates = row.objectKind === 'SCALAR_FUNCTION'
        ? ROUTE_FUNCTION_KIND_CANDIDATES
        : row.objectKind === 'TABLE_VALUED_FUNCTION'
          ? ['TABLE_VALUED_FUNCTION', 'SCALAR_FUNCTION'] as const
          : row.objectKind === 'STORED_PROCEDURE'
            ? ['STORED_PROCEDURE'] as const
            : (row.objectKind === 'VIEW'
              ? ['VIEW'] as const
              : ROUTE_FUNCTION_KIND_CANDIDATES);

      let result: Awaited<ReturnType<typeof fetchSchemaObjectDefinition>> | null = null;
      let resolvedKind: DataStudioExplorerObjectKind | null = null;

      for (const candidateKind of definitionCandidates) {
        const candidateResult = await fetchSchemaObjectDefinition(
          resolveSchemaObjectDefinitionQuery(selectedDataSourceId, candidateKind, row.name),
        );
        if (candidateResult.definition) {
          result = candidateResult;
          resolvedKind = candidateKind;
          break;
        }
        if (!result?.error && candidateResult.error) {
          result = candidateResult;
        }
      }

      if (!result?.definition || !resolvedKind) {
        setToast({
          type: 'error',
          text: result?.error ?? 'Schema object definition was not found.',
        });
        return null;
      }

      const panelId = buildSchemaObjectSqlPanelId(resolvedKind, selectedDataSourceId, row.name);
      sqlPanelManager.openPanel({
        mode: 'alter',
        dataSourceId: selectedDataSourceId,
        dataSourceName: source.name,
        dataSourceType: source.type,
        objectKind: resolvedKind,
        objectName: row.name,
        initialSql: result.definition,
        readOnly: row.isControlPlaneLocked,
      });
      return panelId;
    } catch (error) {
      const message = isApiError(error)
        ? formatApiErrorMessage(error)
        : (error instanceof Error ? error.message : 'Failed to load schema object definition.');
      setToast({ type: 'error', text: message });
      return null;
    } finally {
      if (!options?.suppressPendingState) {
        setPendingSqlEditorRowId(null);
      }
    }
  }, [dataSources, selectedDataSourceId, sqlPanelManager.openPanel]);

  const resolveModelerHref = useCallback((row: DataStudioExplorerObjectRow) => (
    toMountPath(buildDataStudioModelerEditRelativePath({ objectName: row.name }, mountId))
  ), [mountId, toMountPath]);

  const resolveDependencyObjectHref = useCallback((item: SchemaObjectDependencyItem) => (
    toMountPath(buildDataStudioModelerEditRelativePath({ objectName: item.objectName }, mountId))
  ), [mountId, toMountPath]);

  const handleOpenModeler = useCallback(async (row: DataStudioExplorerObjectRow) => {
    if (!row.supportsEdgeModel || !selectedDataSourceId) {
      return;
    }

    const importType = resolveEdgeModelImportType(row.objectKind);
    const existingModelId = row.edgeModelId
      ?? (importType
        ? edgeModelLookup.get(buildEdgeModelLookupKey(selectedDataSourceId, importType, row.name))?.id ?? null
        : null);

    if (existingModelId) {
      setOpenModelId(existingModelId);
      return;
    }

    if (!importType) {
      return;
    }

    setPendingModelerRowId(row.id);
    try {
      const created = await importEdgeModelMutation.mutateAsync({
        dataSourceId: selectedDataSourceId,
        objectName: row.name,
        objectType: importType,
      });
      setOpenModelId(created.id);
    } catch (error) {
      const message = isApiError(error)
        ? formatApiErrorMessage(error)
        : (error instanceof Error ? error.message : 'Failed to open modeler.');
      setToast({ type: 'error', text: message });
    } finally {
      setPendingModelerRowId(null);
    }
  }, [edgeModelLookup, importEdgeModelMutation, selectedDataSourceId, setOpenModelId]);

  const handleOpenDependencyObject = useCallback(async (item: SchemaObjectDependencyItem) => {
    const dependencyKind = resolveDataStudioExplorerObjectKindFromDependencyKind(item.objectKind);
    if (!dependencyKind || !selectedDataSourceId) {
      return;
    }

    const importType = resolveEdgeModelImportType(dependencyKind);
    const existingModel = importType
      ? edgeModelLookup.get(buildEdgeModelLookupKey(selectedDataSourceId, importType, item.objectName))
      : undefined;

    const dependencyRow: DataStudioExplorerObjectRow = {
      id: `${dependencyKind}:${item.objectName}`,
      name: item.objectName,
      objectKind: dependencyKind,
      objectKindLabel: getDataStudioExplorerObjectKindLabel(dependencyKind),
      columnCount: 0,
      primaryKey: null,
      supportsEdgeModel: importType !== null,
      isControlPlaneLocked: isControlPlaneSchemaObjectName(item.objectName),
      edgeModelId: existingModel?.id ?? null,
      modelStatus: existingModel?.status ?? null,
      modelIcon: existingModel?.labels.icon?.trim() || null,
      modelColor: existingModel?.labels.color?.trim() || null,
    };

    if (importType) {
      if (routeOpenedSqlPanelId) {
        sqlPanelManager.closePanel(routeOpenedSqlPanelId);
        setRouteOpenedSqlPanelId(null);
      }
      await handleOpenModeler(dependencyRow);
      return;
    }

    setResolvedRouteObjectKey(buildRouteObjectKey(selectedDataSourceId, dependencyKind, item.objectName));
    setObjectKind(dependencyKind);
    setSearchInput(item.objectName);

    if (routeOpenedSqlPanelId) {
      sqlPanelManager.closePanel(routeOpenedSqlPanelId);
    }
    navigate(toMountPath(buildDataStudioModelerEditRelativePath({ objectName: item.objectName }, mountId)));
    const panelId = await openSqlEditorForObject(dependencyRow, { suppressPendingState: true });
    setRouteOpenedSqlPanelId(panelId);
  }, [
    edgeModelLookup,
    handleOpenModeler,
    mountId,
    navigate,
    openSqlEditorForObject,
    routeOpenedSqlPanelId,
    selectedDataSourceId,
    setObjectKind,
    setSearchInput,
    sqlPanelManager,
    toMountPath,
  ]);

  useEffect(() => {
    if (!editSlugFromUrl || edgeModelsQuery.isLoading || schemaCatalogQuery.isLoading || !selectedDataSourceId) {
      return;
    }

    const matched = findEdgeModelByEditSlug(edgeModels, editSlugFromUrl, {
      preferredDataSourceId: selectedDataSourceId,
    });
    if (matched) {
      return;
    }

    const matchedKind = findRouteObjectKindFromCatalog(editSlugFromUrl, schemaCatalogQuery.objectsByType);
    if (!matchedKind) {
      if (!openModelId) {
        navigate(listPath, { replace: true });
      }
      return;
    }

    const routeObjectKey = buildRouteObjectKey(selectedDataSourceId, matchedKind, editSlugFromUrl);
    if (resolvedRouteObjectKey === routeObjectKey) {
      return;
    }

    const routeRow: DataStudioExplorerObjectRow = {
      id: `${matchedKind}:${editSlugFromUrl}`,
      name: editSlugFromUrl,
      objectKind: matchedKind,
      objectKindLabel: getDataStudioExplorerObjectKindLabel(matchedKind),
      columnCount: 0,
      primaryKey: null,
      supportsEdgeModel: resolveEdgeModelImportType(matchedKind) !== null,
      isControlPlaneLocked: isControlPlaneSchemaObjectName(editSlugFromUrl),
      edgeModelId: null,
      modelStatus: null,
      modelIcon: null,
      modelColor: null,
    };

    setResolvedRouteObjectKey(routeObjectKey);
    setObjectKind(matchedKind);
    setSearchInput(editSlugFromUrl);

    if (resolveEdgeModelImportType(matchedKind)) {
      void handleOpenModeler(routeRow);
      return;
    }

    if (routeOpenedSqlPanelId) {
      sqlPanelManager.closePanel(routeOpenedSqlPanelId);
    }
    void openSqlEditorForObject(routeRow, { suppressPendingState: true }).then((panelId) => {
      setRouteOpenedSqlPanelId(panelId);
    });
  }, [
    edgeModels,
    edgeModelsQuery.isLoading,
    editSlugFromUrl,
    handleOpenModeler,
    listPath,
    navigate,
    openModelId,
    openSqlEditorForObject,
    resolvedRouteObjectKey,
    routeOpenedSqlPanelId,
    schemaCatalogQuery.isLoading,
    schemaCatalogQuery.objectsByType,
    selectedDataSourceId,
    setObjectKind,
    setSearchInput,
    sqlPanelManager,
  ]);

  const handleOpenSqlEditor = useCallback(async (row: DataStudioExplorerObjectRow) => {
    await openSqlEditorForObject(row);
  }, [openSqlEditorForObject]);

  const handleOpenRunPanel = useCallback(async (row: DataStudioExplorerObjectRow) => {
    if (!selectedDataSourceId || row.objectKind === 'TABLE') {
      return;
    }

    const source = dataSources.find((item) => item.id === selectedDataSourceId);
    if (!source || !canRunSchemaObjectKind(source.type, row.objectKind)) {
      setToast({
        type: 'error',
        text: `Run is not supported for this object on ${source?.type ?? 'the selected connection'}.`,
        persistent: true,
      });
      return;
    }

    setPendingRunRowId(row.id);
    try {
      const schemaQuery = resolveExplorerSchemaQuery(row.objectKind);
      const fieldsResult = await fetchDataSourceObjectFields(
        selectedDataSourceId,
        schemaQuery.objectType,
        row.name,
      );

      runPanelManager.openPanel({
        dataSourceId: selectedDataSourceId,
        dataSourceName: source.name,
        dataSourceType: source.type,
        objectKind: row.objectKind,
        objectName: row.name,
        initialSql: buildSchemaObjectRunSqlTemplate(
          source.type,
          row.objectKind,
          row.name,
          fieldsResult.items,
        ),
      });
    } catch (error) {
      const message = isApiError(error)
        ? formatApiErrorMessage(error)
        : (error instanceof Error ? error.message : 'Failed to open run panel.');
      setToast({ type: 'error', text: message, persistent: true });
    } finally {
      setPendingRunRowId(null);
    }
  }, [dataSources, runPanelManager.openPanel, selectedDataSourceId]);

  const handleRunSchemaObjectSql = useCallback(async (
    sql: string,
    _panelId: string,
    dataSourceId: string,
  ) => executeDataSourceQueryMutation.mutateAsync({ dataSourceId, sql }), [executeDataSourceQueryMutation]);

  const handleOpenRelations = useCallback((row: DataStudioExplorerObjectRow) => {
    if (!selectedDataSourceId) {
      return;
    }

    const source = dataSources.find((item) => item.id === selectedDataSourceId);
    if (!source) {
      return;
    }

    relationsManager.openRelations({
      row,
      dataSourceId: selectedDataSourceId,
      dataSourceName: source.name,
    });
  }, [dataSources, relationsManager.openRelations, selectedDataSourceId]);

  const handleOpenModelerRelations = useCallback(() => {
    if (!openModelId) {
      return;
    }

    const model = edgeModels.find((item) => item.id === openModelId);
    if (!model || (model.objectType !== 'TABLE' && model.objectType !== 'VIEW')) {
      return;
    }

    const source = dataSources.find((item) => item.id === model.dataSourceId);
    if (!source) {
      return;
    }

    relationsManager.openRelations({
      row: buildExplorerRowFromEdgeModel(model),
      dataSourceId: model.dataSourceId,
      dataSourceName: source.name,
    });
  }, [
    buildExplorerRowFromEdgeModel,
    dataSources,
    edgeModels,
    openModelId,
    relationsManager.openRelations,
  ]);

  const handleOpenModelerDatasheet = useCallback(() => {
    if (!openModelId) {
      return;
    }
    const model = edgeModels.find((item) => item.id === openModelId);
    if (!model || (model.objectType !== 'TABLE' && model.objectType !== 'VIEW')) {
      return;
    }
    const source = dataSources.find((item) => item.id === model.dataSourceId);
    if (!source) {
      return;
    }
    datasheetManager.openDatasheet({
      row: buildExplorerRowFromEdgeModel(model),
      modelId: model.id,
      dataSourceId: model.dataSourceId,
      dataSourceName: source.name,
    });
  }, [
    buildExplorerRowFromEdgeModel,
    dataSources,
    datasheetManager.openDatasheet,
    edgeModels,
    openModelId,
  ]);

  const handleOpenModelerDesigner = useCallback(() => {
    if (!openModelId) {
      return;
    }

    const model = edgeModels.find((item) => item.id === openModelId);
    if (!model || model.objectType !== 'TABLE') {
      return;
    }

    const source = dataSources.find((item) => item.id === model.dataSourceId);
    if (!source) {
      return;
    }

    designerManager.openDesigner({
      row: buildExplorerRowFromEdgeModel(model),
      dataSourceId: model.dataSourceId,
      dataSourceName: source.name,
      dataSourceType: source.type,
    });
  }, [
    buildExplorerRowFromEdgeModel,
    dataSources,
    designerManager.openDesigner,
    edgeModels,
    openModelId,
  ]);

  const handleOpenModelerCreateApi = useCallback(() => {
    const context = resolveOpenModelApiContext();
    if (!context) {
      return;
    }

    setConfigureFunctionApiTarget(null);
    setConfigureApiTarget({
      ...context,
      mode: 'create',
    });
  }, [resolveOpenModelApiContext]);

  const handleOpenModelerEditApi = useCallback((
    definitionId: string,
    options?: { initialTab?: ConfigureDataApiTarget['initialTab']; openAccessModal?: boolean; openHooksModal?: boolean },
  ) => {
    const context = resolveOpenModelApiContext();
    if (!context || !definitionId) {
      return;
    }

    setConfigureFunctionApiTarget(null);
    setConfigureApiTarget({
      ...context,
      mode: 'edit',
      definitionId,
      initialTab: options?.initialTab,
      openAccessModal: options?.openAccessModal,
      openHooksModal: options?.openHooksModal,
    });
  }, [resolveOpenModelApiContext]);

  const handleOpenModelerEditFunctionApi = useCallback((
    fn: ServerFunctionItem,
    mode: ConfigureFunctionApiMode = 'settings',
  ) => {
    if (!fn?.id) {
      return;
    }
    if ((mode === 'access' || mode === 'hooks') && isPackageServerFunction(fn)) {
      setToast({
        type: 'error',
        text: mode === 'access'
          ? 'Package API access is managed by the package.'
          : 'Package API hooks are managed by the package.',
      });
      return;
    }
    setConfigureApiTarget(null);
    setConfigureFunctionApiTarget({ fn, mode });
  }, []);

  const handleOpenDeleteApiDialog = useCallback((definition: EdgeApiDefinition) => {
    setDeleteApiTarget(definition);
  }, []);

  const handleCloseDeleteApiDialog = useCallback(() => {
    if (deleteEdgeApiMutation.isPending) {
      return;
    }
    setDeleteApiTarget(null);
  }, [deleteEdgeApiMutation.isPending]);

  const handleConfirmDeleteApi = useCallback(async () => {
    if (!deleteApiTarget) {
      return;
    }

    try {
      await deleteEdgeApiMutation.mutateAsync(deleteApiTarget.id);
      setDeleteApiTarget(null);
      setToast({
        type: 'success',
        text: `Data API "${deleteApiTarget.label}" deleted.`,
      });
    } catch (error) {
      const message = isApiError(error)
        ? formatApiErrorMessage(error)
        : (error instanceof Error ? error.message : 'Failed to delete Data API.');
      setToast({ type: 'error', text: message });
    }
  }, [deleteApiTarget, deleteEdgeApiMutation]);

  const handleSyncModels = useCallback(async () => {
    if (!selectedDataSourceId) {
      return;
    }

    const targets: SyncModelTarget[] = filteredRows
      .filter((row) => row.supportsEdgeModel)
      .map((row) => {
        const objectType = resolveEdgeModelImportType(row.objectKind);
        if (!objectType) {
          return null;
        }
        return {
          objectName: row.name,
          objectType,
          edgeModelId: row.edgeModelId,
        };
      })
      .filter((target): target is SyncModelTarget => target !== null);

    const result = await syncModels.startSyncModels(selectedDataSourceId, targets);

    if (result.empty) {
      setToast({
        type: 'error',
        text: 'No tables or views are available to sync for the current list.',
      });
    }
  }, [filteredRows, selectedDataSourceId, syncModels.startSyncModels]);

  const handleOpenCreateObjectDialog = useCallback((kind: DataStudioExplorerObjectKind) => {
    if (!selectedDataSourceId || !selectedDataSource) {
      return;
    }

    if (usesSqlEditorForCreate(kind) && !canCreateSchemaObjectKind(selectedDataSource.type, kind)) {
      setToast({
        type: 'error',
        text: `${DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS[kind]} creation is not supported for ${selectedDataSource.type}.`,
      });
      return;
    }

    setCreateObjectDialog({ open: true, objectKind: kind });
  }, [selectedDataSource, selectedDataSourceId]);

  const handleCloseCreateObjectDialog = useCallback(() => {
    setCreateObjectDialog((current) => ({ ...current, open: false }));
  }, []);

  const handleExecuteSchemaObjectSql = useCallback(async (
    sql: string,
    mode: 'create' | 'alter',
    explorerObjectKind: DataStudioExplorerObjectKind,
    objectName: string,
    panelId: string,
  ) => {
    if (!selectedDataSourceId) {
      return;
    }

    const schemaQuery = resolveExplorerSchemaQuery(explorerObjectKind);

    if (mode === 'create') {
      const input: CreateSchemaObjectInput = resolveCreateSchemaObjectSqlInput(
        selectedDataSourceId,
        explorerObjectKind,
        sql,
      );
      await createSchemaObjectMutation.mutateAsync(input);
      setObjectKind(explorerObjectKind);
      sqlPanelManager.updatePanelContext(panelId, {
        mode: 'alter',
        initialSql: sql,
      });
    } else {
      await updateSchemaObjectMutation.mutateAsync(
        resolveUpdateSchemaObjectSqlInput(selectedDataSourceId, explorerObjectKind, sql),
      );
    }

    await queryClient.refetchQueries({
      queryKey: dataSourcesQueryKeys.schemaObjects(selectedDataSourceId, schemaQuery.objectType),
    });

    if (mode === 'alter') {
      await queryClient.refetchQueries({
        queryKey: dataSourcesQueryKeys.objectFields(
          selectedDataSourceId,
          schemaQuery.objectType,
          objectName,
        ),
      });
    }
  }, [
    createSchemaObjectMutation,
    queryClient,
    selectedDataSourceId,
    sqlPanelManager.updatePanelContext,
    updateSchemaObjectMutation,
  ]);

  const handleShowImportantSqlMessage = useCallback((text: string) => {
    setToast({ type: 'error', text, persistent: true });
  }, []);

  const handleDismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const resolveOpenModelExplorerRow = useCallback((): DataStudioExplorerObjectRow | null => {
    if (!openModelId) {
      return null;
    }

    const model = edgeModels.find((item) => item.id === openModelId);
    if (!model || (model.objectType !== 'TABLE' && model.objectType !== 'VIEW')) {
      return null;
    }

    return buildExplorerRowFromEdgeModel(model);
  }, [buildExplorerRowFromEdgeModel, edgeModels, openModelId]);

  /** Prefer the open edge model's data source — list toolbar selection can lag on deep links. */
  const resolveExplorerRowDataSourceId = useCallback((row: DataStudioExplorerObjectRow | null): string => {
    if (!row) {
      return '';
    }
    if (row.edgeModelId) {
      const model = edgeModels.find((item) => item.id === row.edgeModelId);
      if (model?.dataSourceId) {
        return model.dataSourceId;
      }
    }
    return selectedDataSourceId;
  }, [edgeModels, selectedDataSourceId]);

  const handleOpenDeleteObjectDialog = useCallback((row: DataStudioExplorerObjectRow) => {
    if (row.isControlPlaneLocked) {
      return;
    }
    setDeleteObjectTarget(row);
  }, []);

  const handleOpenModelerDeleteObjectDialog = useCallback(() => {
    const row = resolveOpenModelExplorerRow();
    if (!row || row.isControlPlaneLocked) {
      return;
    }
    handleOpenDeleteObjectDialog(row);
  }, [handleOpenDeleteObjectDialog, resolveOpenModelExplorerRow]);

  const handleCloseDeleteObjectDialog = useCallback(() => {
    if (deleteSchemaObjectMutation.isPending) {
      return;
    }
    setDeleteObjectTarget(null);
  }, [deleteSchemaObjectMutation.isPending]);

  const handleOpenModelerTruncateTableDialog = useCallback(() => {
    const row = resolveOpenModelExplorerRow();
    if (!row || row.isControlPlaneLocked || row.objectKind !== 'TABLE') {
      setToast({
        type: 'error',
        text: 'Truncate is only available for non-platform tables.',
      });
      return;
    }
    setTruncateTableError(null);
    setTruncateTableTarget(row);
  }, [resolveOpenModelExplorerRow]);

  const handleCloseTruncateTableDialog = useCallback(() => {
    if (truncateSchemaObjectMutation.isPending) {
      return;
    }
    setTruncateTableTarget(null);
    setTruncateTableError(null);
  }, [truncateSchemaObjectMutation.isPending]);

  const handleConfirmTruncateTable = useCallback(async () => {
    if (!truncateTableTarget || truncateTableTarget.isControlPlaneLocked) {
      return;
    }

    const dataSourceId = resolveExplorerRowDataSourceId(truncateTableTarget);
    if (!dataSourceId) {
      const message = 'No data source is selected for this model.';
      setTruncateTableError(message);
      setToast({ type: 'error', text: message });
      return;
    }

    setTruncateTableError(null);

    try {
      await truncateSchemaObjectMutation.mutateAsync({
        dataSourceId,
        objectName: truncateTableTarget.name,
      });
      setTruncateTableTarget(null);
      setTruncateTableError(null);
      setToast({
        type: 'success',
        text: `Table "${truncateTableTarget.name}" truncated.`,
      });
    } catch (error) {
      const message = isApiError(error)
        ? formatApiErrorMessage(error)
        : (error instanceof Error ? error.message : 'Failed to truncate table.');
      setTruncateTableError(message);
      setToast({ type: 'error', text: message });
    }
  }, [resolveExplorerRowDataSourceId, truncateSchemaObjectMutation, truncateTableTarget]);

  const handleConfirmDeleteObject = useCallback(async () => {
    if (!deleteObjectTarget || deleteObjectTarget.isControlPlaneLocked) {
      return;
    }

    const dataSourceId = resolveExplorerRowDataSourceId(deleteObjectTarget);
    if (!dataSourceId) {
      setToast({ type: 'error', text: 'No data source is selected for this model.' });
      return;
    }

    try {
      await deleteSchemaObjectMutation.mutateAsync(
        resolveDeleteSchemaObjectInput(
          dataSourceId,
          deleteObjectTarget.objectKind,
          deleteObjectTarget.name,
        ),
      );

      designerManager.closeDesigner(deleteObjectTarget.id);
      if (deleteObjectTarget.edgeModelId) {
        datasheetManager.closeDatasheet(deleteObjectTarget.edgeModelId);
      }
      relationsManager.closeRelations(deleteObjectTarget.id);
      sqlPanelManager.closePanel(buildSchemaObjectSqlPanelId(
        deleteObjectTarget.objectKind,
        dataSourceId,
        deleteObjectTarget.name,
      ));
      runPanelManager.closePanel(buildSchemaObjectRunPanelId(
        deleteObjectTarget.objectKind,
        dataSourceId,
        deleteObjectTarget.name,
      ));
      if (openModelId && deleteObjectTarget.edgeModelId === openModelId) {
        setOpenModelId(null);
      }
      setDeleteObjectTarget(null);
      setToast({
        type: 'success',
        text: `${DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS[deleteObjectTarget.objectKind]} "${deleteObjectTarget.name}" deleted.`,
      });
    } catch (error) {
      const message = isApiError(error)
        ? formatApiErrorMessage(error)
        : (error instanceof Error ? error.message : 'Failed to delete schema object.');
      setToast({ type: 'error', text: message });
    }
  }, [
    deleteObjectTarget,
    deleteSchemaObjectMutation,
    designerManager.closeDesigner,
    datasheetManager.closeDatasheet,
    openModelId,
    relationsManager.closeRelations,
    resolveExplorerRowDataSourceId,
    setOpenModelId,
    sqlPanelManager.closePanel,
    runPanelManager.closePanel,
  ]);

  const handleCreateObject = useCallback(async (objectName: string) => {
    if (!selectedDataSourceId || !selectedDataSource) {
      return;
    }

    const { objectKind: createKind } = createObjectDialog;

    if (usesSqlEditorForCreate(createKind)) {
      setCreateObjectDialog((current) => ({ ...current, open: false }));
      sqlPanelManager.openPanel({
        mode: 'create',
        dataSourceId: selectedDataSourceId,
        dataSourceName: selectedDataSource.name,
        dataSourceType: selectedDataSource.type,
        objectKind: createKind,
        objectName,
        initialSql: buildSchemaObjectSqlTemplate(selectedDataSource.type, createKind, objectName),
      });
      return;
    }

    const schemaQuery = resolveExplorerSchemaQuery(createKind);

    try {
      await createSchemaObjectMutation.mutateAsync(
        resolveCreateSchemaObjectInput(selectedDataSourceId, createKind, objectName),
      );

      await queryClient.refetchQueries({
        queryKey: dataSourcesQueryKeys.schemaObjects(selectedDataSourceId, schemaQuery.objectType),
      });
      await queryClient.refetchQueries({
        queryKey: dataSourcesQueryKeys.objectFields(selectedDataSourceId, schemaQuery.objectType, objectName),
      });

      setCreateObjectDialog((current) => ({ ...current, open: false }));
      setObjectKind(createKind);
      setSearchInput(objectName);
      setToast({
        type: 'success',
        text: `${DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS[createKind]} "${objectName}" created.`,
      });

      const importType = resolveEdgeModelImportType(createKind);
      if (!importType) {
        return;
      }

      const row: DataStudioExplorerObjectRow = {
        id: `${createKind}:${objectName}`,
        name: objectName,
        objectKind: createKind,
        objectKindLabel: getDataStudioExplorerObjectKindLabel(createKind),
        columnCount: 0,
        primaryKey: null,
        supportsEdgeModel: true,
        isControlPlaneLocked: false,
        edgeModelId: null,
        modelStatus: null,
        modelIcon: null,
        modelColor: null,
      };

      designerManager.openDesigner({
        row,
        dataSourceId: selectedDataSourceId,
        dataSourceName: selectedDataSource.name,
        dataSourceType: selectedDataSource.type,
      });
    } catch (error) {
      const message = isApiError(error)
        ? formatApiErrorMessage(error)
        : (error instanceof Error ? error.message : 'Failed to create schema object.');
      setToast({ type: 'error', text: message });
    }
  }, [
    createObjectDialog,
    createSchemaObjectMutation,
    designerManager.openDesigner,
    queryClient,
    selectedDataSource,
    selectedDataSourceId,
    sqlPanelManager.openPanel,
  ]);

  const loadError = objectsQuery.data?.error
    ?? (objectsQuery.error instanceof Error ? objectsQuery.error.message : null)
    ?? (edgeModelsQuery.error instanceof Error ? edgeModelsQuery.error.message : null)
    ?? (dataSourcesQuery.data?.error ?? null);

  const edgeApiDefinitionsQuery = useEdgeApiDefinitionsQuery();
  const serverFunctionsCatalogQuery = useServerFunctionsCatalogQuery();
  const edgeApiDefinitions = edgeApiDefinitionsQuery.data ?? [];
  const serverFunctions = serverFunctionsCatalogQuery.data?.functions ?? [];

  useDataStudioWorkspaceOverlayDeepLink({
    createObjectDialog,
    designerManager,
    datasheetManager,
    relationsManager,
    sqlPanelManager,
    runPanelManager,
    openModelId,
    handleOpenModelerDesigner,
    handleOpenModelerDatasheet,
    handleOpenModelerRelations,
    handleOpenCreateObjectDialog,
    handleOpenSqlEditor,
    handleOpenRunPanel,
    rows,
    syncModelsOpen: syncModels.state.open,
    handleSyncModels,
    deleteApiTarget,
    handleOpenDeleteApiDialog,
    edgeApiDefinitions,
    deleteObjectTarget,
    handleOpenDeleteObjectDialog,
    truncateTableTarget,
    handleOpenModelerTruncateTableDialog,
    configureApiTarget,
    handleOpenModelerCreateApi,
    handleOpenModelerEditApi,
    configureFunctionApiTarget,
    handleOpenModelerEditFunctionApi,
    serverFunctions,
  });

    return {
    dataSources,
    selectedDataSourceId,
    setSelectedDataSourceId,
    selectedDataSource,
    objectKind,
    setObjectKind,
    searchInput,
    setSearchInput,
    displayItems: filteredRows,
    editSlugFromUrl,
    openModelId,
    openModelObjectName,
    setOpenModelId,
    edgeModels,
    pendingSqlEditorRowId,
    pendingRunRowId,
    pendingModelerRowId,
    pendingDatasheetRowId,
    configureApiTarget,
    handleCloseConfigureApiWizard,
    handleConfigureApiPublished,
    configureFunctionApiTarget,
    handleCloseConfigureFunctionApi,
    handleFunctionApiSaved,
    handleOpenDesigner,
    handleOpenDatasheet,
    handleOpenModeler,
    resolveModelerHref,
    handleOpenDependencyObject,
    resolveDependencyObjectHref,
    handleOpenSqlEditor,
    handleOpenRunPanel,
    handleOpenRelations,
    handleOpenModelerRelations,
    handleOpenModelerDesigner,
    handleOpenModelerDatasheet,
    handleOpenModelerCreateApi,
    handleOpenModelerEditApi,
    handleOpenModelerEditFunctionApi,
    handleOpenDeleteApiDialog,
    deleteApiTarget,
    handleCloseDeleteApiDialog,
    handleConfirmDeleteApi,
    isDeletingApi: deleteEdgeApiMutation.isPending,
    handleOpenDeleteObjectDialog,
    handleOpenModelerDeleteObjectDialog,
    deleteObjectTarget,
    handleCloseDeleteObjectDialog,
    handleConfirmDeleteObject,
    isDeletingObject: deleteSchemaObjectMutation.isPending,
    handleOpenModelerTruncateTableDialog,
    truncateTableTarget,
    truncateTableError,
    handleCloseTruncateTableDialog,
    handleConfirmTruncateTable,
    isTruncatingTable: truncateSchemaObjectMutation.isPending,
    resolveExplorerRowDataSourceId,
    handleSyncModels,
    createObjectDialog,
    handleOpenCreateObjectDialog,
    handleCloseCreateObjectDialog,
    handleCreateObject,
    handleExecuteSchemaObjectSql,
    handleShowImportantSqlMessage,
    handleDismissToast,
    sqlPanelManager,
    runPanelManager,
    handleRunSchemaObjectSql,
    isExecutingSchemaObjectSql: createSchemaObjectMutation.isPending || updateSchemaObjectMutation.isPending,
    isRunningSchemaObjectSql: executeDataSourceQueryMutation.isPending,
    designerManager,
    datasheetManager,
    relationsManager,
    syncModels,
    toast,
    isLoading: dataSourcesQuery.isLoading
      || objectsQuery.isLoading
      || edgeModelsQuery.isLoading
      || (shouldHydrateStructure && structureFieldQueries.some((query) => query.isLoading)),
    isRefreshing: dataSourcesQuery.isFetching || objectsQuery.isFetching || edgeModelsQuery.isFetching,
    isError: Boolean(loadError),
    error: loadError,
    retryLoad: () => {
      void dataSourcesQuery.refetch();
      void objectsQuery.refetch();
      void edgeModelsQuery.refetch();
    },
    isEmptyConnections: !dataSourcesQuery.isLoading && dataSources.length === 0,
  };
}

export type DataStudioPageModel = ReturnType<typeof useDataStudioPage>;
