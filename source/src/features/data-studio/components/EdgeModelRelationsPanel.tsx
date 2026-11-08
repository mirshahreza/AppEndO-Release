import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Network, Plus, TableProperties, Trash2, Waypoints, X } from 'lucide-react';
import type { EdgeModelAssociation } from '../../../shared/api/contracts/data-api';
import type {
  SchemaRelationEdge,
  SchemaRelationsSnapshot,
} from '../../../shared/api/contracts/data-sources/schemaRelations';
import {
  useEdgeModelQuery,
  useEdgeModelsQuery,
  usePatchEdgeModelMutation,
} from '../../../shared/api/queries/data-api';
import {
  useDataSourceObjectRelationsQuery,
  useDataSourcesQuery,
  useDropForeignKeyConstraintMutation,
} from '../../../shared/api/queries/data-sources';
import { isControlPlaneProtectedAssociationId } from '../../../shared/lib/controlPlaneEdgeModelGuards';
import type { LogicalRelationPeerTable } from '../../../shared/lib/buildEdgeSchemaFlowGraph';
import { canMutatePhysicalForeignKeys } from '../../../shared/lib/schemaObjectForeignKey';
import {
  AppButton,
  AppToast,
  ConfirmDialogShell,
  FloatingPanelShell,
  QueryErrorPanel,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import {
  resolveForeignKeyColumnOptions,
  suggestAssociationAlias,
  suggestForeignKeyColumn,
  type AssociationDraftInput,
} from '../lib/edgeModelAssociations';
import {
  toLogicalRelationGraphInputs,
  toLogicalRelationPeerTables,
} from '../lib/logicalRelationsForDiagram';
import { resolveEdgeModelImportType } from '../lib/explorerObjectKinds';
import { isControlPlaneSchemaObjectName } from '../lib/controlPlaneSchemaObjects';
import type { EdgeModelRelationsPanelEntry } from '../hooks/useEdgeModelRelationsManager';
import { useSchemaRelationsDiagramLayoutPersistence } from '../hooks/useSchemaRelationsDiagramLayoutPersistence';
import {
  EdgeSchemaRelationsDiagram,
  type RelationsConnectRequest,
  type RelationsEdgeClickPayload,
} from './EdgeSchemaRelationsDiagram';
import { EdgeModelAssociationDialog } from './EdgeModelAssociationDialog';
import { EdgeModelRelationsDatasheet } from './EdgeModelRelationsDatasheet';
import { RelationsAddTablePanel } from './RelationsAddTablePanel';
import {
  RelationsConvertNatureDialog,
  type RelationsConvertNatureRequest,
} from './RelationsConvertNatureDialog';
import { RelationsPhysicalRelationDialog } from './RelationsPhysicalRelationDialog';
import { RelationsPhysicalRulesDialog } from './RelationsPhysicalRulesDialog';
import { supportsPhysicalNatureConversion } from '../lib/edgeModelAssociations';
import {
  findPhysicalRelationForAssociation,
  physicalMatchesAssociation,
} from '../lib/relationNatureConversion';

const PANEL_BOUNDS = {
  minWidth: 560,
  maxWidth: 1100,
  minHeight: 360,
  maximizeInset: 16,
};

type RelationsViewMode = 'diagram' | 'datasheet';

type EdgeModelRelationsPanelProps = {
  panel: EdgeModelRelationsPanelEntry;
  onClose: () => void;
  onFocus: () => void;
};

type AssociationDialogState =
  | {
    mode: 'create';
    initialDraft: Partial<AssociationDraftInput> | null;
    /** When true, target came from a diagram connect — keep it fixed in the dialog. */
    lockTarget?: boolean;
    targetDisplayName?: string;
  }
  | { mode: 'edit'; association: EdgeModelAssociation };

const formatPeerModelLabel = (model: { objectName: string; labels?: { title?: string } }): string => {
  const objectName = model.objectName.trim();
  const title = model.labels?.title?.trim() || '';
  if (title && title !== objectName) {
    return `${title} (${objectName})`;
  }
  return objectName || title || 'Unknown model';
};

const resolveAssociationTargetDisplayName = (
  targetModelId: string,
  peers: ReadonlyArray<{ id: string; objectName: string; labels?: { title?: string } }>,
): string | null => {
  const target = peers.find((model) => model.id === targetModelId);
  return target ? formatPeerModelLabel(target) : null;
};

type PendingRelationDelete =
  | {
    kind: 'logical';
    association: EdgeModelAssociation;
    resolve?: (ok: boolean) => void;
  }
  | {
    kind: 'physical';
    relation: SchemaRelationEdge;
    resolve?: (ok: boolean) => void;
  }
  | {
    kind: 'both';
    association: EdgeModelAssociation;
    relation: SchemaRelationEdge;
    resolve?: (ok: boolean) => void;
  };

const findPhysicalRelation = (
  relations: ReadonlyArray<SchemaRelationEdge>,
  payload: RelationsEdgeClickPayload,
): SchemaRelationEdge | null => {
  const constraintName = payload.data.physicalConstraintName?.trim();
  if (constraintName) {
    const byName = relations.find((item) => item.constraintName === constraintName);
    if (byName) {
      return byName;
    }
  }
  const fromColumn = payload.data.fromColumn?.trim();
  const toColumn = payload.data.toColumn?.trim();
  if (!fromColumn) {
    return null;
  }
  return relations.find((item) => (
    item.fromTable === payload.sourceTable
    && item.toTable === payload.targetTable
    && item.fromColumn === fromColumn
    && (!toColumn || item.toColumn === toColumn)
  )) ?? null;
};

export const EdgeModelRelationsPanel: React.FC<EdgeModelRelationsPanelProps> = ({
  panel,
  onClose,
  onFocus,
}) => {
  const [viewMode, setViewMode] = useState<RelationsViewMode>('diagram');
  const [addTableOpen, setAddTableOpen] = useState(false);
  const [userAddedTables, setUserAddedTables] = useState<LogicalRelationPeerTable[]>([]);
  const [hiddenTableNames, setHiddenTableNames] = useState<Set<string>>(() => new Set());
  const [liveSnapshot, setLiveSnapshot] = useState<SchemaRelationsSnapshot | null>(null);
  const [associationDialog, setAssociationDialog] = useState<AssociationDialogState | null>(null);
  const [convertRequest, setConvertRequest] = useState<RelationsConvertNatureRequest | null>(null);
  const [physicalDialogRelation, setPhysicalDialogRelation] = useState<SchemaRelationEdge | null>(null);
  const [rulesDialogRelation, setRulesDialogRelation] = useState<SchemaRelationEdge | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingRelationDelete | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const objectType = resolveEdgeModelImportType(panel.context.row.objectKind);
  const edgeModelId = panel.context.row.edgeModelId;
  const focusObjectName = panel.context.row.name;

  const dataSourcesQuery = useDataSourcesQuery();
  const modelsQuery = useEdgeModelsQuery();
  const edgeModelQuery = useEdgeModelQuery(edgeModelId);
  const patchModelMutation = usePatchEdgeModelMutation();
  const dropFkMutation = useDropForeignKeyConstraintMutation();

  const dataSourceType = useMemo(
    () => (dataSourcesQuery.data?.items ?? []).find((item) => item.id === panel.context.dataSourceId)?.type
      ?? null,
    [dataSourcesQuery.data?.items, panel.context.dataSourceId],
  );
  const relationsQuery = useDataSourceObjectRelationsQuery(
    panel.context.dataSourceId,
    objectType,
    focusObjectName,
    Boolean(objectType),
  );
  const layoutPersistence = useSchemaRelationsDiagramLayoutPersistence({
    dataSourceId: panel.context.dataSourceId,
    objectName: focusObjectName,
    edgeModelId,
  });

  const baseSnapshot = relationsQuery.data ?? null;

  useEffect(() => {
    setLiveSnapshot(baseSnapshot);
  }, [baseSnapshot]);

  useEffect(() => {
    setUserAddedTables([]);
    setHiddenTableNames(new Set());
  }, [panel.context.dataSourceId, focusObjectName]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const focusModel = edgeModelQuery.data ?? null;
  const protectedAssociationIdsRef = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!focusModel || !isControlPlaneSchemaObjectName(focusModel.objectName)) {
      protectedAssociationIdsRef.current = new Set();
      return;
    }
    if (protectedAssociationIdsRef.current.size === 0) {
      protectedAssociationIdsRef.current = new Set(
        focusModel.associations.map((association) => association.id),
      );
    }
  }, [focusModel]);

  const sameSourceModels = useMemo(
    () => (modelsQuery.data ?? []).filter(
      (model) => model.dataSourceId === panel.context.dataSourceId,
    ),
    [modelsQuery.data, panel.context.dataSourceId],
  );

  const associations = focusModel?.associations ?? [];
  const isAssociationLocked = useCallback((associationId: string) => (
    isControlPlaneProtectedAssociationId(
      focusObjectName,
      associationId,
      protectedAssociationIdsRef.current,
    )
  ), [focusObjectName]);

  const logicalRelations = useMemo(() => {
    if (!focusModel) {
      return [];
    }
    return toLogicalRelationGraphInputs(focusModel, sameSourceModels);
  }, [focusModel, sameSourceModels]);

  /** Only association targets missing from the physical snapshot — not every peer model. */
  const associationExtraTables = useMemo(() => {
    const existing = new Set((liveSnapshot ?? baseSnapshot)?.tables.map((table) => table.name) ?? []);
    if (!focusModel) {
      return [];
    }
    return toLogicalRelationPeerTables(associations, sameSourceModels, existing);
  }, [associations, baseSnapshot, focusModel, liveSnapshot, sameSourceModels]);

  const extraTables = useMemo(() => {
    const byName = new Map<string, LogicalRelationPeerTable>();
    for (const table of associationExtraTables) {
      byName.set(table.name, table);
    }
    for (const table of userAddedTables) {
      if (!byName.has(table.name)) {
        byName.set(table.name, table);
      }
    }
    return [...byName.values()];
  }, [associationExtraTables, userAddedTables]);

  const presentObjectNames = useMemo(() => {
    const names = new Set<string>([(liveSnapshot ?? baseSnapshot)?.focusObject ?? focusObjectName]);
    for (const table of (liveSnapshot ?? baseSnapshot)?.tables ?? []) {
      if (!hiddenTableNames.has(table.name)) {
        names.add(table.name);
      }
    }
    for (const table of extraTables) {
      if (!hiddenTableNames.has(table.name)) {
        names.add(table.name);
      }
    }
    return names;
  }, [baseSnapshot, extraTables, focusObjectName, hiddenTableNames, liveSnapshot]);

  const peerModelsForAdd = useMemo(
    () => sameSourceModels.filter((model) => model.objectName !== focusObjectName),
    [focusObjectName, sameSourceModels],
  );

  const relationsSnapshot = baseSnapshot;
  const relations = liveSnapshot?.relations ?? baseSnapshot?.relations ?? [];
  const allowLogicalEdit = Boolean(edgeModelId && focusModel);

  const modelByObjectName = useMemo(() => {
    const map = new Map<string, (typeof sameSourceModels)[number]>();
    for (const model of sameSourceModels) {
      const key = model.objectName.trim().toLowerCase();
      if (!key) {
        continue;
      }
      map.set(key, model);
    }
    return map;
  }, [sameSourceModels]);

  const persistAssociations = useCallback(async (
    next: EdgeModelAssociation[],
    successText = 'Logical relation saved.',
  ) => {
    if (!edgeModelId) {
      throw new Error('Open or create an Edge model for this table first.');
    }
    try {
      await patchModelMutation.mutateAsync({
        modelId: edgeModelId,
        patch: { associations: next },
      });
      setNotice({ type: 'success', text: successText });
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save logical relation.',
      });
      throw error;
    }
  }, [edgeModelId, patchModelMutation]);

  const handleConnectTables = useCallback((request: RelationsConnectRequest) => {
    if (!focusModel) {
      setNotice({
        type: 'error',
        text: 'Open or create an Edge model for this table to add logical relations.',
      });
      return;
    }

    const focus = focusObjectName;
    const peerTable = request.sourceTable === focus
      ? request.targetTable
      : request.sourceTable;
    const peer = modelByObjectName.get(peerTable.trim().toLowerCase());
    if (!peer) {
      setNotice({
        type: 'error',
        text: `No Edge model found for "${peerTable}". Import or sync that table first.`,
      });
      return;
    }
    if (!peer.id?.trim()) {
      setNotice({
        type: 'error',
        text: `Edge model for "${peerTable}" has no id. Re-import or refresh that model.`,
      });
      return;
    }

    const kind = request.sourceTable === focus ? 'belongsTo' : 'hasMany';
    const usedAliases = new Set(associations.map((item) => item.as));
    const foreignKeyOptions = resolveForeignKeyColumnOptions({
      kind,
      sourceColumns: focusModel.columns,
      targetColumns: peer.columns,
    });
    const referencedName = kind === 'belongsTo' ? peer.objectName : focusModel.objectName;
    const foreignKey = suggestForeignKeyColumn(foreignKeyOptions, referencedName);
    setAssociationDialog({
      mode: 'create',
      lockTarget: true,
      targetDisplayName: formatPeerModelLabel(peer),
      initialDraft: {
        kind,
        targetModelId: peer.id,
        foreignKey,
        as: suggestAssociationAlias(kind, peer.objectName, usedAliases, foreignKey),
      },
    });
  }, [associations, focusModel, focusObjectName, modelByObjectName]);

  const handleEdgeSelect = useCallback((payload: RelationsEdgeClickPayload) => {
    if (payload.data.relationNature === 'physical') {
      const relation = findPhysicalRelation(relations, payload);
      if (relation) {
        setPhysicalDialogRelation(relation);
      }
      return;
    }
    const associationId = payload.data.associationId;
    if (!associationId || !focusModel) {
      return;
    }
    const association = associations.find((item) => item.id === associationId);
    if (!association) {
      return;
    }
    setAssociationDialog({ mode: 'edit', association });
  }, [associations, focusModel, relations]);

  const handleSaveAssociation = useCallback((association: EdgeModelAssociation) => {
    if (!focusModel) {
      return;
    }
    const exists = associations.some((item) => item.id === association.id);
    const next = exists
      ? associations.map((item) => (item.id === association.id ? association : item))
      : [...associations, association];
    void persistAssociations(next).catch(() => undefined);
    setAssociationDialog(null);
  }, [associations, focusModel, persistAssociations]);

  const canConvertAssociationToPhysical = useCallback((association: EdgeModelAssociation) => {
    if (!supportsPhysicalNatureConversion(association.kind)) {
      return false;
    }
    if (!canMutatePhysicalForeignKeys(dataSourceType, objectType ?? 'TABLE', focusObjectName)) {
      return false;
    }
    if (isAssociationLocked(association.id)) {
      return false;
    }
    const target = sameSourceModels.find((model) => model.id === association.targetModelId);
    if (!target) {
      return false;
    }
    return !relations.some((relation) => physicalMatchesAssociation({
      association,
      focusObjectName,
      targetObjectName: target.objectName,
      relation,
    }));
  }, [
    dataSourceType,
    focusObjectName,
    isAssociationLocked,
    objectType,
    relations,
    sameSourceModels,
  ]);

  const canDropPhysicalRelation = useCallback((relation: SchemaRelationEdge) => (
    Boolean(
      relation.constraintName?.trim()
      && canMutatePhysicalForeignKeys(dataSourceType, 'TABLE', relation.fromTable),
    )
  ), [dataSourceType]);

  const canConvertPhysicalToLogical = useCallback((relation: SchemaRelationEdge) => {
    if (!focusModel || !canDropPhysicalRelation(relation)) {
      return false;
    }
    const hasAssociation = associations.some((association) => {
      const target = sameSourceModels.find((model) => model.id === association.targetModelId);
      if (!target) {
        return false;
      }
      return physicalMatchesAssociation({
        association,
        focusObjectName,
        targetObjectName: target.objectName,
        relation,
      });
    });
    if (hasAssociation) {
      return true;
    }
    const peerTable = relation.fromTable === focusObjectName
      ? relation.toTable
      : relation.fromTable;
    return sameSourceModels.some((model) => model.objectName === peerTable);
  }, [
    associations,
    canDropPhysicalRelation,
    focusModel,
    focusObjectName,
    sameSourceModels,
  ]);

  const canConvertAssociationToLogical = useCallback((association: EdgeModelAssociation) => {
    if (!supportsPhysicalNatureConversion(association.kind)) {
      return false;
    }
    if (isAssociationLocked(association.id)) {
      return false;
    }
    const target = sameSourceModels.find((model) => model.id === association.targetModelId);
    if (!target) {
      return false;
    }
    const relation = findPhysicalRelationForAssociation({
      association,
      focusObjectName,
      targetObjectName: target.objectName,
      relations,
    });
    return Boolean(relation && canDropPhysicalRelation(relation));
  }, [
    canDropPhysicalRelation,
    focusObjectName,
    isAssociationLocked,
    relations,
    sameSourceModels,
  ]);

  const dismissPendingDelete = useCallback((ok: boolean) => {
    pendingDelete?.resolve?.(ok);
    setPendingDelete(null);
  }, [pendingDelete]);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) {
      return;
    }

    try {
      if (pendingDelete.kind === 'logical' || pendingDelete.kind === 'both') {
        if (!focusModel) {
          dismissPendingDelete(false);
          return;
        }
        if (isAssociationLocked(pendingDelete.association.id)) {
          setNotice({ type: 'error', text: 'Platform relations cannot be removed.' });
          dismissPendingDelete(false);
          return;
        }
        const next = associations.filter((item) => item.id !== pendingDelete.association.id);
        await persistAssociations(
          next,
          `Removed logical relation ${pendingDelete.association.as}.`,
        );
      }

      if (pendingDelete.kind === 'physical' || pendingDelete.kind === 'both') {
        const constraintName = pendingDelete.relation.constraintName;
        if (!constraintName) {
          dismissPendingDelete(false);
          return;
        }
        await dropFkMutation.mutateAsync({
          dataSourceId: panel.context.dataSourceId,
          tableName: pendingDelete.relation.fromTable,
          constraintName,
        });
        setNotice({
          type: 'success',
          text: pendingDelete.kind === 'both'
            ? `Removed logical relation ${pendingDelete.association.as} and physical constraint ${constraintName}.`
            : `Removed physical relation ${constraintName}.`,
        });
        void relationsQuery.refetch();
      }

      pendingDelete.resolve?.(true);
      setPendingDelete(null);
      setAssociationDialog(null);
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to remove relation.',
      });
      dismissPendingDelete(false);
    }
  }, [
    associations,
    dismissPendingDelete,
    dropFkMutation,
    focusModel,
    isAssociationLocked,
    panel.context.dataSourceId,
    pendingDelete,
    persistAssociations,
    relationsQuery,
  ]);

  const handleAddTables = useCallback((objectNames: string[]) => {
    const snapshotTableNames = new Set(
      (liveSnapshot ?? baseSnapshot)?.tables.map((table) => table.name) ?? [],
    );
    setHiddenTableNames((current) => {
      if (current.size === 0) {
        return current;
      }
      const next = new Set(current);
      let changed = false;
      for (const objectName of objectNames) {
        if (next.delete(objectName)) {
          changed = true;
        }
      }
      return changed ? next : current;
    });
    setUserAddedTables((current) => {
      const byName = new Map(current.map((table) => [table.name, table] as const));
      for (const objectName of objectNames) {
        if (
          byName.has(objectName)
          || presentObjectNames.has(objectName)
          || snapshotTableNames.has(objectName)
        ) {
          continue;
        }
        const model = modelByObjectName.get(objectName.trim().toLowerCase());
        if (!model) {
          continue;
        }
        byName.set(objectName, {
          name: objectName,
          columns: model.columns.map((column) => ({
            name: column.name,
            dataType: column.dataType || 'unknown',
            isPrimaryKey: Boolean(column.isPrimaryKey),
          })),
        });
      }
      return [...byName.values()];
    });
  }, [baseSnapshot, liveSnapshot, modelByObjectName, presentObjectNames]);

  const handleRemoveTable = useCallback((tableName: string) => {
    if (!tableName || tableName === focusObjectName) {
      return;
    }
    setUserAddedTables((current) => current.filter((table) => table.name !== tableName));
    setHiddenTableNames((current) => {
      if (current.has(tableName)) {
        return current;
      }
      const next = new Set(current);
      next.add(tableName);
      return next;
    });
  }, [focusObjectName]);

  return (
    <>
      {notice ? (
        <AppToast type={notice.type} text={notice.text} className="!z-[240]" />
      ) : null}

      <FloatingPanelShell
        open
        onClose={onClose}
        onPointerDown={onFocus}
        title={`Relations · ${panel.context.dataSourceName} / ${focusObjectName}`}
        titleIcon={<Waypoints className="h-3.5 w-3.5 text-violet-600" />}
        bounds={PANEL_BOUNDS}
        defaultWidth={760}
        defaultHeight={520}
        initialPosition="bottom-right"
        initialOffset={{
          x: panel.cascadeIndex * 28,
          y: panel.cascadeIndex * 28,
        }}
        dragFromHeaderOnly
        enableDrag
        enableResize
        enableMaximize
        initialMaximized
        enterScale={false}
        zIndex={panel.zOrder}
        borderClassName="border-2 border-violet-200/70"
        headerClassName="h-9 border-b border-slate-200 bg-white px-3"
        titleClassName="text-xs font-semibold tracking-tight text-slate-800"
      >
        <div className="relative h-full min-h-0 overflow-hidden bg-white">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2">
            <div
              className={cn(
                'pointer-events-auto inline-flex h-8 overflow-hidden rounded-md border border-slate-300/90',
                'bg-white/90 shadow-md shadow-slate-900/10 backdrop-blur-sm',
              )}
              role="group"
              aria-label="Relations view"
            >
              <AppButton
                type="button"
                size="sm"
                intent={viewMode === 'diagram' ? 'secondary' : 'cancel'}
                aria-pressed={viewMode === 'diagram'}
                className={cn(
                  'min-w-0 !h-full !rounded-none !border-y-0 !border-s-0 !border-e border-e-slate-200',
                  viewMode !== 'diagram' && '!bg-transparent !text-slate-400 hover:!bg-slate-50 hover:!text-slate-600',
                )}
                onClick={() => setViewMode('diagram')}
              >
                <Network className="h-3.5 w-3.5" />
                Diagram
              </AppButton>
              <AppButton
                type="button"
                size="sm"
                intent={viewMode === 'datasheet' ? 'secondary' : 'cancel'}
                aria-pressed={viewMode === 'datasheet'}
                className={cn(
                  'min-w-0 !h-full !rounded-none !border-0',
                  viewMode !== 'datasheet' && '!bg-transparent !text-slate-400 hover:!bg-slate-50 hover:!text-slate-600',
                )}
                onClick={() => setViewMode('datasheet')}
              >
                <TableProperties className="h-3.5 w-3.5" />
                Datasheet
              </AppButton>
            </div>

            <AppButton
              intent="secondary"
              size="sm"
              className="pointer-events-auto !bg-white/90 shadow-md shadow-slate-900/10 backdrop-blur-sm"
              disabled={viewMode === 'datasheet' && !allowLogicalEdit}
              onClick={() => {
                if (viewMode === 'diagram') {
                  setAddTableOpen(true);
                  return;
                }
                if (!allowLogicalEdit) {
                  setNotice({
                    type: 'error',
                    text: 'Open or create an Edge model for this table to add logical relations.',
                  });
                  return;
                }
                setAssociationDialog({ mode: 'create', initialDraft: null, lockTarget: false });
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              {viewMode === 'diagram' ? 'Add table' : 'Add relation'}
            </AppButton>
          </div>

          {!allowLogicalEdit && viewMode === 'diagram' ? (
            <p className="pointer-events-none absolute inset-x-2 top-12 z-20 rounded-md border border-amber-200/80 bg-amber-50/90 px-2.5 py-1.5 text-[11px] text-amber-800 shadow-sm backdrop-blur-sm">
              Physical relations from the database are shown. Create an Edge model to add logical
              relations by connecting tables.
            </p>
          ) : null}

          {relationsQuery.isLoading || layoutPersistence.isLayoutHydrating || (
            Boolean(edgeModelId) && edgeModelQuery.isLoading
          ) ? (
            <p className="p-3 pt-14 text-xs text-violet-600/80">Loading relations…</p>
          ) : relationsQuery.isError ? (
            <div className="h-full pt-12">
              <QueryErrorPanel
                className="!h-auto min-h-[12rem]"
                message="Could not load relations."
                detail={relationsQuery.error instanceof Error ? relationsQuery.error.message : 'Request failed.'}
                onRetry={() => { void relationsQuery.refetch(); }}
                isRetrying={relationsQuery.isFetching}
              />
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'absolute inset-0 transition-[opacity,transform] duration-300 ease-out',
                  viewMode === 'diagram'
                    ? 'z-[1] translate-y-0 opacity-100'
                    : 'pointer-events-none z-0 translate-y-1.5 opacity-0',
                )}
                aria-hidden={viewMode !== 'diagram'}
              >
                {!relationsSnapshot ? (
                  <p className="p-3 pt-14 text-xs text-slate-500">No diagram data available.</p>
                ) : (
                  <EdgeSchemaRelationsDiagram
                    key={`${panel.context.dataSourceId}:${relationsSnapshot.focusObject}`}
                    snapshot={relationsSnapshot}
                    dataSourceId={panel.context.dataSourceId}
                    savedLayout={layoutPersistence.savedLayout}
                    onLayoutCommit={layoutPersistence.persistLayout}
                    onSnapshotChange={setLiveSnapshot}
                    logicalRelations={logicalRelations}
                    extraTables={extraTables}
                    hiddenTableNames={hiddenTableNames}
                    allowLogicalEdit={allowLogicalEdit}
                    onConnectTables={handleConnectTables}
                    onEdgeSelect={handleEdgeSelect}
                    onRemoveTable={handleRemoveTable}
                    onLogicalEditBlocked={(reason) => setNotice({ type: 'error', text: reason })}
                  />
                )}
              </div>

              <div
                className={cn(
                  'absolute inset-0 transition-[opacity,transform] duration-300 ease-out',
                  viewMode === 'datasheet'
                    ? 'z-[1] translate-y-0 opacity-100'
                    : 'pointer-events-none z-0 -translate-y-1.5 opacity-0',
                )}
                aria-hidden={viewMode !== 'datasheet'}
              >
                <div className="h-full pt-11">
                  <EdgeModelRelationsDatasheet
                    dataSourceId={panel.context.dataSourceId}
                    dataSourceName={panel.context.dataSourceName}
                    dataSourceType={dataSourceType}
                    objectName={focusObjectName}
                    objectType={objectType ?? 'TABLE'}
                    physicalRelations={relations}
                    associations={associations}
                    peerModels={sameSourceModels}
                    isLoading={relationsQuery.isLoading}
                    canEditLogical={allowLogicalEdit}
                    isAssociationLocked={isAssociationLocked}
                    onEditLogical={(association) => setAssociationDialog({ mode: 'edit', association })}
                    onDeleteLogical={(association) => setPendingDelete({ kind: 'logical', association })}
                    onDeleteBoth={(association, relation) => setPendingDelete({
                      kind: 'both',
                      association,
                      relation,
                    })}
                    onEditPhysical={(relation) => setPhysicalDialogRelation(relation)}
                    onPhysicalChanged={() => { void relationsQuery.refetch(); }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </FloatingPanelShell>

      <RelationsAddTablePanel
        open={addTableOpen}
        onClose={() => setAddTableOpen(false)}
        peerModels={peerModelsForAdd}
        presentObjectNames={presentObjectNames}
        zIndex={panel.zOrder + 20}
        onAdd={handleAddTables}
      />

      {focusModel && convertRequest ? (
        <RelationsConvertNatureDialog
          open
          request={convertRequest}
          onClose={() => setConvertRequest(null)}
          dataSourceId={panel.context.dataSourceId}
          focusModel={focusModel}
          peerModels={sameSourceModels}
          associations={associations}
          elevated
          onLogicalAdded={async (association) => {
            await persistAssociations(
              [...associations, association],
              `Converted to logical relation ${association.as}.`,
            );
          }}
          onPhysicalChanged={() => {
            void relationsQuery.refetch();
            setNotice({
              type: 'success',
              text: convertRequest.direction === 'logical-to-physical'
                ? 'Converted to physical foreign-key constraint.'
                : 'Converted to logical relation (database constraint removed).',
            });
          }}
        />
      ) : null}

      {focusModel && associationDialog ? (
        <EdgeModelAssociationDialog
          open
          onClose={() => setAssociationDialog(null)}
          mode={associationDialog.mode}
          dataSourceId={panel.context.dataSourceId}
          dataSourceType={dataSourceType}
          sourceModelId={focusModel.id}
          sourceObjectName={focusModel.objectName}
          sourcePrimaryKey={focusModel.primaryKey}
          sourceColumns={focusModel.columns}
          peerModels={sameSourceModels}
          existing={associations}
          initial={associationDialog.mode === 'edit' ? associationDialog.association : null}
          initialDraft={associationDialog.mode === 'create' ? associationDialog.initialDraft : null}
          lockTarget={associationDialog.mode === 'create' ? Boolean(associationDialog.lockTarget) : false}
          targetDisplayName={
            associationDialog.mode === 'create'
              ? (associationDialog.targetDisplayName ?? null)
              : resolveAssociationTargetDisplayName(
                associationDialog.association.targetModelId,
                sameSourceModels,
              )
          }
          locked={
            associationDialog.mode === 'edit'
            && isAssociationLocked(associationDialog.association.id)
          }
          elevated
          onSave={handleSaveAssociation}
          onDelete={
            associationDialog.mode === 'edit'
              ? () => {
                const target = sameSourceModels.find(
                  (model) => model.id === associationDialog.association.targetModelId,
                );
                const twin = target
                  ? findPhysicalRelationForAssociation({
                    association: associationDialog.association,
                    focusObjectName,
                    targetObjectName: target.objectName,
                    relations,
                  })
                  : null;
                if (twin) {
                  setPendingDelete({
                    kind: 'both',
                    association: associationDialog.association,
                    relation: twin,
                  });
                } else {
                  setPendingDelete({ kind: 'logical', association: associationDialog.association });
                }
                setAssociationDialog(null);
              }
              : undefined
          }
          onConvertToPhysical={
            associationDialog.mode === 'edit'
            && canConvertAssociationToPhysical(associationDialog.association)
              ? () => {
                setConvertRequest({
                  direction: 'logical-to-physical',
                  association: associationDialog.association,
                });
                setAssociationDialog(null);
              }
              : undefined
          }
          onConvertToLogical={
            associationDialog.mode === 'edit'
            && canConvertAssociationToLogical(associationDialog.association)
              ? () => {
                const target = sameSourceModels.find(
                  (model) => model.id === associationDialog.association.targetModelId,
                );
                if (!target) {
                  setNotice({ type: 'error', text: 'Target Edge model was not found for this relation.' });
                  return;
                }
                const relation = findPhysicalRelationForAssociation({
                  association: associationDialog.association,
                  focusObjectName,
                  targetObjectName: target.objectName,
                  relations,
                });
                if (!relation) {
                  setNotice({ type: 'error', text: 'No matching physical foreign-key was found.' });
                  return;
                }
                setConvertRequest({
                  direction: 'physical-to-logical',
                  relation,
                });
                setAssociationDialog(null);
              }
              : undefined
          }
          onThroughTableCreated={(result) => {
            void modelsQuery.refetch();
            void relationsQuery.refetch();
            setUserAddedTables((current) => {
              if (current.some((table) => table.name === result.throughObjectName)) {
                return current;
              }
              return [
                ...current,
                {
                  name: result.throughObjectName,
                  columns: [
                    { name: 'id', dataType: 'bigint', isPrimaryKey: true },
                    { name: result.foreignKey, dataType: 'bigint', isPrimaryKey: false },
                    { name: result.otherKey, dataType: 'bigint', isPrimaryKey: false },
                  ],
                },
              ];
            });
            setNotice({
              type: 'success',
              text: `Through table ${result.throughObjectName} created. Confirm the logical relation to finish.`,
            });
          }}
        />
      ) : null}

      {physicalDialogRelation ? (
        <RelationsPhysicalRelationDialog
          open
          relation={physicalDialogRelation}
          onClose={() => setPhysicalDialogRelation(null)}
          elevated
          canDrop={canDropPhysicalRelation(physicalDialogRelation)
            && physicalDialogRelation.fromTable === focusObjectName}
          canEditRules={canDropPhysicalRelation(physicalDialogRelation)}
          canConvertToLogical={canConvertPhysicalToLogical(physicalDialogRelation)}
          onDrop={() => {
            setPendingDelete({ kind: 'physical', relation: physicalDialogRelation });
            setPhysicalDialogRelation(null);
          }}
          onEditRules={() => {
            setRulesDialogRelation(physicalDialogRelation);
          }}
          onConvertToLogical={() => {
            if (!focusModel) {
              setNotice({
                type: 'error',
                text: 'Open or create an Edge model for this table to convert to a logical relation.',
              });
              return;
            }
            setConvertRequest({
              direction: 'physical-to-logical',
              relation: physicalDialogRelation,
            });
            setPhysicalDialogRelation(null);
          }}
        />
      ) : null}

      {rulesDialogRelation ? (
        <RelationsPhysicalRulesDialog
          open
          relation={rulesDialogRelation}
          dataSourceId={panel.context.dataSourceId}
          elevated
          onClose={() => setRulesDialogRelation(null)}
          onSaved={(next) => {
            void relationsQuery.refetch();
            setNotice({ type: 'success', text: 'Foreign-key rules updated.' });
            setPhysicalDialogRelation((current) => (
              current
              && current.fromTable === rulesDialogRelation.fromTable
              && current.fromColumn === rulesDialogRelation.fromColumn
              && current.toTable === rulesDialogRelation.toTable
              && current.toColumn === rulesDialogRelation.toColumn
                ? {
                  ...current,
                  onDelete: next.onDelete,
                  onUpdate: next.onUpdate,
                }
                : current
            ));
          }}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialogShell
          size="sm"
          title={
            pendingDelete.kind === 'physical'
              ? 'Remove physical relation'
              : pendingDelete.kind === 'both'
                ? 'Delete relation'
                : 'Delete logical relation'
          }
          icon={<Trash2 className="h-4 w-4" />}
          confirmIntent="destructive"
          closeOnEscape={!dropFkMutation.isPending && !patchModelMutation.isPending}
          onClose={
            dropFkMutation.isPending || patchModelMutation.isPending
              ? () => undefined
              : () => dismissPendingDelete(false)
          }
          onBackdropClick={
            dropFkMutation.isPending || patchModelMutation.isPending
              ? () => undefined
              : () => dismissPendingDelete(false)
          }
          backdropClassName="!z-[520]"
          footer={(
            <>
              <AppButton
                intent="cancel"
                size="sm"
                disabled={dropFkMutation.isPending || patchModelMutation.isPending}
                onClick={() => dismissPendingDelete(false)}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </AppButton>
              <AppButton
                intent="destructive"
                size="sm"
                disabled={dropFkMutation.isPending || patchModelMutation.isPending}
                onClick={() => { void handleConfirmDelete(); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {pendingDelete.kind === 'physical' ? 'Remove relation' : 'Delete relation'}
              </AppButton>
            </>
          )}
        >
          <p className="text-sm text-slate-700">
            {pendingDelete.kind === 'logical'
              ? `Remove logical relation ${pendingDelete.association.as}? This only updates Edge model metadata and does not change the database.`
              : pendingDelete.kind === 'physical'
                ? `Remove database constraint ${pendingDelete.relation.constraintName ?? ''} from ${pendingDelete.relation.fromTable}? This changes the physical database schema.`
                : `Remove logical relation ${pendingDelete.association.as} and database constraint ${pendingDelete.relation.constraintName ?? ''}? Metadata and the physical schema will both change.`}
          </p>
        </ConfirmDialogShell>
      ) : null}
    </>
  );
};
