import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { EdgeModelColumn, EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import {
  useEdgeModelQuery,
  useImportEdgeModelMutation,
  usePatchEdgeModelMutation,
  useRefreshEdgeModelMutation,
} from '../../../shared/api/queries/data-api';
import { dataSourcesQueryKeys, useDataSourceObjectFieldsQuery } from '../../../shared/api/queries/data-sources';
import {
  isControlPlaneProtectedColumnName,
  isControlPlaneStructuralColumnPatch,
} from '../../../shared/lib/controlPlaneEdgeModelGuards';
import {
  createEdgeModelColumnFromField,
  createEdgeModelColumnFromNativeType,
  patchEdgeModelColumn,
  validateEdgeColumnName,
} from '../lib/edgeModelColumnUtils';
import {
  createEdgeModelColumnsFromPresetSpecs,
  type EdgeModelColumnPresetSpec,
} from '../lib/edgeModelColumnPresets';
import {
  mapDataSourceTypeToNativeDialect,
  resolveNativeTypeOptions,
} from '../lib/nativeDatabaseTypes';
import { resolveEdgeModelImportType } from '../lib/explorerObjectKinds';
import type { EdgeModelDesignerLaunchContext } from './useEdgeModelDesignerManager';

type DesignerToast = { type: 'success' | 'error'; text: string } | null;

export function useEdgeModelDesignerInstance(context: EdgeModelDesignerLaunchContext) {
  const queryClient = useQueryClient();
  const isControlPlaneObject = context.row.isControlPlaneLocked;
  const [draftColumns, setDraftColumns] = useState<EdgeModelColumn[]>([]);
  const [protectedColumnNames, setProtectedColumnNames] = useState<ReadonlySet<string>>(() => new Set());
  const [resolvedModelId, setResolvedModelId] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [toast, setToast] = useState<DesignerToast>(null);
  const protectedColumnNamesRef = useRef<ReadonlySet<string>>(new Set());

  const importModelMutation = useImportEdgeModelMutation();
  const importModelRef = useRef(importModelMutation.mutateAsync);
  importModelRef.current = importModelMutation.mutateAsync;
  const refreshModelMutation = useRefreshEdgeModelMutation();
  const patchModelMutation = usePatchEdgeModelMutation();

  const objectType = resolveEdgeModelImportType(context.row.objectKind);
  const modelQuery = useEdgeModelQuery(resolvedModelId);
  const liveFieldsQuery = useDataSourceObjectFieldsQuery(
    context.dataSourceId,
    objectType ?? 'TABLE',
    context.row.name,
  );

  const dialect = useMemo(
    () => mapDataSourceTypeToNativeDialect(context.dataSourceType),
    [context.dataSourceType],
  );

  const liveFields = liveFieldsQuery.data?.items ?? [];

  const discoveredNativeTypes = useMemo(
    () => [...new Set(liveFields.map((field) => field.dataType).filter(Boolean))],
    [liveFields],
  );

  const nativeTypeOptions = useMemo(
    () => resolveNativeTypeOptions(dialect, discoveredNativeTypes),
    [dialect, discoveredNativeTypes],
  );

  const availableDbFields = useMemo(() => {
    const existing = new Set(draftColumns.map((column) => column.name));
    return liveFields.filter((field) => !existing.has(field.name));
  }, [draftColumns, liveFields]);

  const isDirty = useMemo(() => {
    if (!modelQuery.data) {
      return draftColumns.length > 0;
    }

    return JSON.stringify(modelQuery.data.columns) !== JSON.stringify(draftColumns);
  }, [draftColumns, modelQuery.data]);

  const syncProtectedFromModel = useCallback((source: EdgeModelDefinition) => {
    const next = new Set(source.columns.map((column) => column.name));
    protectedColumnNamesRef.current = next;
    setProtectedColumnNames(next);
  }, []);

  const isStructuralColumnLocked = useCallback((columnName: string) => (
    Boolean(modelQuery.data?.readOnly)
    || isControlPlaneProtectedColumnName(context.row.name, columnName, protectedColumnNames)
  ), [context.row.name, modelQuery.data?.readOnly, protectedColumnNames]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setIsBootstrapping(true);
      setBootstrapError(null);
      setResolvedModelId(null);
      setDraftColumns([]);
      protectedColumnNamesRef.current = new Set();
      setProtectedColumnNames(new Set());

      try {
        let modelId = context.row.edgeModelId;
        const importType = resolveEdgeModelImportType(context.row.objectKind);

        if (!modelId) {
          if (!importType) {
            throw new Error('This object type cannot be designed.');
          }

          const imported = await importModelRef.current({
            dataSourceId: context.dataSourceId,
            objectName: context.row.name,
            objectType: importType,
          });
          modelId = imported.id;
        }

        if (!cancelled) {
          setResolvedModelId(modelId);
        }
      } catch (error) {
        if (!cancelled) {
          const message = isApiError(error)
            ? formatApiErrorMessage(error)
            : (error instanceof Error ? error.message : 'Could not open table designer.');
          setBootstrapError(message);
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    context.dataSourceId,
    context.row.edgeModelId,
    context.row.id,
    context.row.name,
    context.row.objectKind,
  ]);

  useEffect(() => {
    if (!modelQuery.data) {
      return;
    }

    syncProtectedFromModel(modelQuery.data);
    setDraftColumns(modelQuery.data.columns.map((column) => ({ ...column })));
  }, [modelQuery.data, syncProtectedFromModel]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const updateColumn = useCallback((columnIndex: number, patch: Partial<EdgeModelColumn>) => {
    setDraftColumns((current) => {
      if (modelQuery.data?.readOnly) {
        return current;
      }
      if (columnIndex < 0 || columnIndex >= current.length) {
        return current;
      }

      const columnName = current[columnIndex].name;
      const protectedColumn = isControlPlaneProtectedColumnName(
        context.row.name,
        columnName,
        protectedColumnNamesRef.current,
      );
      if (protectedColumn && isControlPlaneStructuralColumnPatch(patch)) {
        return current;
      }

      const nextColumn = patchEdgeModelColumn(current[columnIndex], patch);
      if (patch.name !== undefined && patch.name !== columnName) {
        if (protectedColumn) {
          return current;
        }
        const trimmedName = patch.name.trim();
        if (
          !trimmedName
          || validateEdgeColumnName(trimmedName, { fieldLabel: 'Column name' })
          || current.some((column, itemIndex) => itemIndex !== columnIndex && column.name === trimmedName)
        ) {
          return current;
        }
        nextColumn.name = trimmedName;
      }

      return current.map((column, itemIndex) => (
        itemIndex === columnIndex ? nextColumn : column
      ));
    });
  }, [context.row.name, modelQuery.data?.readOnly]);

  const removeColumn = useCallback((columnIndex: number) => {
    setDraftColumns((current) => {
      if (modelQuery.data?.readOnly) {
        return current;
      }
      if (columnIndex < 0 || columnIndex >= current.length) {
        return current;
      }

      const columnName = current[columnIndex].name;
      if (isControlPlaneProtectedColumnName(
        context.row.name,
        columnName,
        protectedColumnNamesRef.current,
      )) {
        return current;
      }

      return current.filter((_, itemIndex) => itemIndex !== columnIndex);
    });
  }, [context.row.name, modelQuery.data?.readOnly]);

  const addColumnFromDatabase = useCallback((fieldName: string) => {
    if (modelQuery.data?.readOnly) {
      return;
    }

    const field = liveFields.find((item) => item.name === fieldName);
    if (!field) {
      return;
    }

    setDraftColumns((current) => {
      if (current.some((column) => column.name === field.name)) {
        return current;
      }

      return [...current, createEdgeModelColumnFromField(field)];
    });
  }, [liveFields, modelQuery.data?.readOnly]);

  const addCustomColumn = useCallback((columnName: string, nativeType: string) => {
    if (modelQuery.data?.readOnly) {
      return;
    }

    const trimmedName = columnName.trim();
    if (!trimmedName) {
      return;
    }

    setDraftColumns((current) => {
      if (current.some((column) => column.name === trimmedName)) {
        return current;
      }

      return [...current, createEdgeModelColumnFromNativeType(trimmedName, nativeType)];
    });
  }, [modelQuery.data?.readOnly]);

  const addBlankColumn = useCallback((): number | null => {
    if (modelQuery.data?.readOnly) {
      return null;
    }

    let nextIndex: number | null = null;
    setDraftColumns((current) => {
      nextIndex = current.length;
      const nativeType = nativeTypeOptions[0] ?? 'text';
      return [...current, createEdgeModelColumnFromNativeType('', nativeType)];
    });
    return nextIndex;
  }, [modelQuery.data?.readOnly, nativeTypeOptions]);

  const addPresetColumns = useCallback((specs: ReadonlyArray<EdgeModelColumnPresetSpec>): number | null => {
    if (modelQuery.data?.readOnly || specs.length === 0) {
      return null;
    }

    let firstAddedIndex: number | null = null;

    setDraftColumns((current) => {
      const created = createEdgeModelColumnsFromPresetSpecs(specs, current);
      if (created.length === 0) {
        return current;
      }
      firstAddedIndex = current.length;
      return [...current, ...created];
    });

    return firstAddedIndex;
  }, [modelQuery.data?.readOnly]);

  const refreshFromDatabase = useCallback(async () => {
    if (!resolvedModelId) {
      return;
    }

    try {
      const refreshed = await refreshModelMutation.mutateAsync(resolvedModelId);
      syncProtectedFromModel(refreshed);
      setDraftColumns(refreshed.columns.map((column) => ({ ...column })));
      setToast({
        type: 'success',
        text: 'Model columns refreshed from the database.',
      });
    } catch (error) {
      const message = isApiError(error)
        ? formatApiErrorMessage(error)
        : (error instanceof Error ? error.message : 'Refresh failed.');
      setToast({ type: 'error', text: message });
    }
  }, [refreshModelMutation, resolvedModelId, syncProtectedFromModel]);

  const saveDesigner = useCallback(async () => {
    if (!resolvedModelId || draftColumns.length === 0 || modelQuery.data?.readOnly) {
      return;
    }

    const newColumnNames = draftColumns
      .filter((column) => !liveFields.some((field) => field.name === column.name))
      .map((column) => column.name);
    const removedColumnNames = liveFields
      .filter((field) => !draftColumns.some((column) => column.name === field.name))
      .map((field) => field.name);

    try {
      const saved = await patchModelMutation.mutateAsync({
        modelId: resolvedModelId,
        patch: { columns: draftColumns },
      });
      syncProtectedFromModel(saved);

      await queryClient.invalidateQueries({
        queryKey: dataSourcesQueryKeys.objectFields(
          context.dataSourceId,
          objectType ?? 'TABLE',
          context.row.name,
        ),
      });

      const parts: string[] = ['Table model saved.'];
      if (newColumnNames.length > 0) {
        parts.push(`Added ${newColumnNames.length} column(s) to the database.`);
      }
      if (removedColumnNames.length > 0) {
        parts.push(`Dropped ${removedColumnNames.length} column(s) from the database.`);
      }
      setToast({
        type: 'success',
        text: parts.join(' '),
      });
    } catch (error) {
      const message = isApiError(error)
        ? formatApiErrorMessage(error)
        : (error instanceof Error ? error.message : 'Save failed.');
      setToast({ type: 'error', text: message });
    }
  }, [
    context.dataSourceId,
    context.row.name,
    draftColumns,
    liveFields,
    modelQuery.data?.readOnly,
    objectType,
    patchModelMutation,
    queryClient,
    resolvedModelId,
    syncProtectedFromModel,
  ]);

  return {
    context,
    isControlPlaneObject,
    /** @deprecated Prefer isControlPlaneObject — platform models are extendable. */
    isControlPlaneLocked: isControlPlaneObject,
    model: modelQuery.data ?? null,
    draftColumns,
    nativeTypeOptions,
    availableDbFields,
    bootstrapError,
    isBootstrapping,
    isLoading: isBootstrapping || modelQuery.isLoading || liveFieldsQuery.isLoading,
    isSaving: patchModelMutation.isPending,
    isRefreshing: refreshModelMutation.isPending,
    isDirty,
    toast,
    isStructuralColumnLocked,
    updateColumn,
    removeColumn,
    addColumnFromDatabase,
    addCustomColumn,
    addBlankColumn,
    addPresetColumns,
    dialect,
    refreshFromDatabase,
    saveDesigner,
  };
}

export type EdgeModelDesignerInstanceModel = ReturnType<typeof useEdgeModelDesignerInstance>;
