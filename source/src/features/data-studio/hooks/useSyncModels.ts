import { useCallback, useRef, useState } from 'react';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import {
  useImportEdgeModelMutation,
  useRefreshEdgeModelMutation,
} from '../../../shared/api/queries/data-api';
import {
  createInitialSyncModelsState,
  type SyncModelItem,
  type SyncModelsState,
  type SyncModelTarget,
} from '../types/syncModels';

const sortTargetsForSync = (targets: SyncModelTarget[]): SyncModelTarget[] => (
  [...targets].sort((left, right) => {
    const byName = left.objectName.localeCompare(right.objectName);
    if (byName !== 0) {
      return byName;
    }
    return left.objectType.localeCompare(right.objectType);
  })
);

const toPendingItems = (targets: SyncModelTarget[]): SyncModelItem[] => (
  targets.map((target) => ({
    key: `${target.objectType}:${target.objectName}`,
    objectName: target.objectName,
    objectType: target.objectType,
    action: target.edgeModelId ? 'refresh' : 'create',
    edgeModelId: target.edgeModelId,
    status: 'pending',
  }))
);

export function useSyncModels() {
  const importModelMutation = useImportEdgeModelMutation();
  const refreshModelMutation = useRefreshEdgeModelMutation();
  const [state, setState] = useState<SyncModelsState>(createInitialSyncModelsState);
  const runIdRef = useRef(0);

  const updateItem = useCallback((
    key: string,
    patch: Partial<Pick<SyncModelItem, 'status' | 'message' | 'edgeModelId'>>,
  ) => {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (
        item.key === key ? { ...item, ...patch } : item
      )),
    }));
  }, []);

  const closeSyncModels = useCallback(() => {
    if (state.isRunning) {
      return;
    }

    runIdRef.current += 1;
    setState(createInitialSyncModelsState());
  }, [state.isRunning]);

  const startSyncModels = useCallback(async (
    dataSourceId: string,
    targets: SyncModelTarget[],
  ): Promise<{ started: boolean; empty: boolean; error?: string }> => {
    const syncable = sortTargetsForSync(targets);

    if (syncable.length === 0) {
      return { started: false, empty: true };
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    setState({
      open: true,
      items: toPendingItems(syncable),
      finished: false,
      isRunning: true,
    });

    for (const target of syncable) {
      const key = `${target.objectType}:${target.objectName}`;
      if (runIdRef.current !== runId) {
        return { started: true, empty: false };
      }

      const runningMessage = target.edgeModelId
        ? 'Refreshing from database…'
        : 'Creating model from database…';
      updateItem(key, { status: 'running', message: runningMessage });

      try {
        if (target.edgeModelId) {
          await refreshModelMutation.mutateAsync(target.edgeModelId);
          updateItem(key, { status: 'done', message: 'refreshed' });
        } else {
          const created = await importModelMutation.mutateAsync({
            dataSourceId,
            objectName: target.objectName,
            objectType: target.objectType,
          });
          updateItem(key, {
            status: 'done',
            message: 'created',
            edgeModelId: created.id,
          });
        }
      } catch (error) {
        const message = isApiError(error)
          ? formatApiErrorMessage(error)
          : (error instanceof Error ? error.message : 'Sync failed.');
        updateItem(key, { status: 'error', message });
      }
    }

    if (runIdRef.current !== runId) {
      return { started: true, empty: false };
    }

    setState((current) => ({
      ...current,
      finished: true,
      isRunning: false,
    }));

    return { started: true, empty: false };
  }, [importModelMutation, refreshModelMutation, updateItem]);

  const completedCount = state.items.filter((item) => (
    item.status === 'done' || item.status === 'stale' || item.status === 'error'
  )).length;

  const successCount = state.items.filter((item) => item.status === 'done').length;
  const staleCount = state.items.filter((item) => item.status === 'stale').length;
  const errorCount = state.items.filter((item) => item.status === 'error').length;
  const createdCount = state.items.filter((item) => (
    item.action === 'create' && item.status === 'done'
  )).length;
  const refreshedCount = state.items.filter((item) => (
    item.action === 'refresh' && (item.status === 'done' || item.status === 'stale')
  )).length;

  const progressPercent = state.items.length === 0
    ? 0
    : Math.round((completedCount / state.items.length) * 100);

  return {
    state,
    completedCount,
    successCount,
    staleCount,
    errorCount,
    createdCount,
    refreshedCount,
    progressPercent,
    totalCount: state.items.length,
    startSyncModels,
    closeSyncModels,
  };
}

export type SyncModelsModel = ReturnType<typeof useSyncModels>;
