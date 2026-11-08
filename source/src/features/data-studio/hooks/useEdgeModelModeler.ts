import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  ColumnFormWidget,
  ColumnFormWidgetProps,
  ColumnFilterRole,
  ColumnSearchRole,
  EdgeModelAssociation,
  EdgeModelColumn,
  EdgeModelDefinition,
  EdgeModelStudioMeta,
  RelationFormWidget,
  RelationTargetFilterCondition,
  CubeDerivedMeasureDef,
} from '../../../shared/api/contracts/data-api';
import type { EdgeModelHistory } from '../../../shared/api/contracts/record-events';
import { normalizeRelationTargetFilter } from '../../../shared/api/contracts/data-api';
import {
  CUBE_DERIVED_MEASURES_EXTENSION_KEY,
  createEmptyEdgeModelStudioMeta,
  DEFAULT_COLUMN_FILTER_ROLE,
  DEFAULT_COLUMN_SEARCH_ROLE,
  parseCubeDerivedMeasures,
  pruneColumnFormWidgetProps,
} from '../../../shared/api/contracts/data-api';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import {
  useEdgeModelQuery,
  useEdgeModelStudioMetaQuery,
  useEdgeModelsQuery,
  usePatchEdgeModelMutation,
  useRefreshEdgeModelMutation,
} from '../../../shared/api/queries/data-api';
import {
  dataSourcesQueryKeys,
  useDataSourceObjectFieldsQuery,
  useDataSourcesQuery,
} from '../../../shared/api/queries/data-sources';
import { associationShapeKey } from '../lib/edgeModelAssociations';
import {
  buildNextBlankColumnName,
  createEdgeModelColumnFromNativeType,
  patchEdgeModelColumn,
} from '../lib/edgeModelColumnUtils';
import {
  COLUMN_GROUP_ORDER_EXTENSION_KEY,
  COLUMN_GROUP_PRESENTATION_EXTENSION_KEY,
  columnMetaToStudioLayout,
  mergeColumnGroupOrder,
  readColumnGroupOrderFromExtensions,
  readColumnGroupPresentationFromExtensions,
  renameColumnLayoutKeys,
  removeColumnLayoutKeys,
  sanitizeColumnGroupOrder,
  studioLayoutToColumnGroupPresentation,
  studioLayoutToColumnMeta,
  type EdgeModelColumnStudioLayout,
} from '../lib/edgeModelColumnLayout';
import {
  associationMetaToStudioLayout,
  studioLayoutToAssociationMeta,
  type EdgeModelRelationStudioLayout,
} from '../lib/edgeModelAssociationStudioMeta';
import {
  MODEL_STORY_EXTENSION_KEY,
  normalizeModelStoryForStorage,
  readModelStoryFromExtensions,
} from '../../../shared/lib/edgeModelStory';
import {
  mapDataSourceTypeToNativeDialect,
  resolveNativeTypeOptions,
} from '../lib/nativeDatabaseTypes';
import {
  isControlPlaneProtectedAssociationId,
  isControlPlaneProtectedColumnName,
  isControlPlaneStructuralColumnPatch,
} from '../../../shared/lib/controlPlaneEdgeModelGuards';
import { isControlPlaneSchemaObjectName } from '../lib/controlPlaneSchemaObjects';

const AUTOSAVE_DEBOUNCE_MS = 450;

type ModelerToast = { type: 'success' | 'error'; text: string } | null;

type ModelerStudioDraft = {
  tagsText: string;
  /** Rich HTML story body (TipTap), persisted in studio-meta.extensions.story. */
  story: string;
  cubeDerivedMeasures: CubeDerivedMeasureDef[];
  history?: EdgeModelHistory;
} & EdgeModelColumnStudioLayout & EdgeModelRelationStudioLayout;

type ModelerDraft = {
  title: string;
  /** Navigation icon ref (`pack:icon-name`); empty when unset. */
  icon: string;
  /** Tailwind text color class for the model icon; empty uses the studio default. */
  color: string;
  readOnly: boolean;
  columns: EdgeModelColumn[];
  associations: EdgeModelAssociation[];
  studio: ModelerStudioDraft;
};

const tagsToText = (tags: string[]): string => tags.join(', ');

const textToTags = (tagsText: string): string[] => (
  tagsText
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
);

const toStudioDraft = (
  meta: EdgeModelStudioMeta,
  columns: ReadonlyArray<Pick<EdgeModelColumn, 'name' | 'isPrimaryKey'>>,
): ModelerStudioDraft => {
  const layout = columnMetaToStudioLayout(meta.columnMeta ?? [], columns);
  const relationLayout = associationMetaToStudioLayout(meta.associationMeta ?? []);
  const groupPresentation = readColumnGroupPresentationFromExtensions(meta.extensions);
  return {
    tagsText: tagsToText(meta.tags ?? []),
    story: readModelStoryFromExtensions(meta.extensions),
    cubeDerivedMeasures: parseCubeDerivedMeasures(meta.extensions),
    history: meta.history,
    ...layout,
    ...relationLayout,
    columnGroupOrder: mergeColumnGroupOrder(
      readColumnGroupOrderFromExtensions(meta.extensions),
      layout.columnGroupOrder,
    ),
    columnGroupIcons: groupPresentation.columnGroupIcons,
    columnGroupColors: groupPresentation.columnGroupColors,
  };
};

const toDraft = (model: EdgeModelDefinition, meta: EdgeModelStudioMeta): ModelerDraft => ({
  title: model.labels.title?.trim() || model.objectName,
  icon: model.labels.icon?.trim() ?? '',
  color: model.labels.color?.trim() ?? '',
  readOnly: model.readOnly,
  columns: model.columns.map((column) => ({ ...column })),
  associations: model.associations.map((association) => ({ ...association })),
  studio: toStudioDraft(meta, model.columns),
});

export function useEdgeModelModeler(modelId: string) {
  const queryClient = useQueryClient();
  const modelQuery = useEdgeModelQuery(modelId);
  const studioMetaQuery = useEdgeModelStudioMetaQuery(modelId);
  const modelsQuery = useEdgeModelsQuery();
  const dataSourcesQuery = useDataSourcesQuery();
  const refreshModelMutation = useRefreshEdgeModelMutation();
  const patchModelMutation = usePatchEdgeModelMutation();

  const [draft, setDraft] = useState<ModelerDraft | null>(null);
  const [toast, setToast] = useState<ModelerToast>(null);
  const [focusColumnName, setFocusColumnName] = useState<string | null>(null);
  const [baselineJson, setBaselineJson] = useState<string | null>(null);
  const [protectedColumnNames, setProtectedColumnNames] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [protectedAssociationIds, setProtectedAssociationIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const draftRef = useRef<ModelerDraft | null>(null);
  const baselineJsonRef = useRef<string | null>(null);
  const hydratedModelIdRef = useRef<string | null>(null);
  const studioMetaAppliedRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const autosaveInFlightRef = useRef(false);
  const autosaveAgainRef = useRef(false);
  const protectedColumnNamesRef = useRef<ReadonlySet<string>>(new Set());
  const protectedAssociationIdsRef = useRef<ReadonlySet<string>>(new Set());

  const model = modelQuery.data ?? null;
  const studioMeta = studioMetaQuery.data
    ?? (model ? createEmptyEdgeModelStudioMeta(model.id) : null);
  const isControlPlaneObject = Boolean(model && isControlPlaneSchemaObjectName(model.objectName));
  /** @deprecated Prefer isControlPlaneObject — platform models are extendable, not fully locked. */
  const isControlPlaneLocked = isControlPlaneObject;
  const dataSource = useMemo(
    () => (dataSourcesQuery.data?.items ?? []).find((item) => item.id === model?.dataSourceId) ?? null,
    [dataSourcesQuery.data?.items, model?.dataSourceId],
  );

  const liveFieldsQuery = useDataSourceObjectFieldsQuery(
    model?.dataSourceId ?? '',
    model?.objectType ?? 'TABLE',
    model?.objectName ?? '',
  );

  const dialect = useMemo(
    () => mapDataSourceTypeToNativeDialect(dataSource?.type),
    [dataSource?.type],
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

  const modelNameById = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const item of modelsQuery.data ?? []) {
      lookup.set(item.id, item.labels.title || item.objectName);
    }
    return lookup;
  }, [modelsQuery.data]);

  const syncProtectedFromModel = useCallback((source: EdgeModelDefinition) => {
    const nextColumns = new Set(source.columns.map((column) => column.name));
    const nextAssociations = new Set(source.associations.map((association) => association.id));
    protectedColumnNamesRef.current = nextColumns;
    protectedAssociationIdsRef.current = nextAssociations;
    setProtectedColumnNames(nextColumns);
    setProtectedAssociationIds(nextAssociations);
  }, []);

  const applyDraftBaseline = useCallback((next: ModelerDraft) => {
    const json = JSON.stringify(next);
    draftRef.current = next;
    baselineJsonRef.current = json;
    setDraft(next);
    setBaselineJson(json);
  }, []);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!model) {
      hydratedModelIdRef.current = null;
      studioMetaAppliedRef.current = false;
      draftRef.current = null;
      baselineJsonRef.current = null;
      protectedColumnNamesRef.current = new Set();
      protectedAssociationIdsRef.current = new Set();
      setDraft(null);
      setBaselineJson(null);
      setProtectedColumnNames(new Set());
      setProtectedAssociationIds(new Set());
      return;
    }

    // Seed draft when opening a model. Prefer server studio-meta when available; otherwise
    // seed an empty local draft so the modeler can open if meta is slow.
    if (hydratedModelIdRef.current !== model.id) {
      hydratedModelIdRef.current = model.id;
      studioMetaAppliedRef.current = Boolean(studioMetaQuery.data);
      syncProtectedFromModel(model);
      applyDraftBaseline(toDraft(
        model,
        studioMetaQuery.data ?? createEmptyEdgeModelStudioMeta(model.id),
      ));
      return;
    }

    // Soft-apply studio meta once when it first arrives, only if the user has not edited yet.
    if (!studioMetaAppliedRef.current && studioMetaQuery.data) {
      studioMetaAppliedRef.current = true;
      const currentJson = draftRef.current ? JSON.stringify(draftRef.current) : null;
      if (currentJson != null && currentJson === baselineJsonRef.current) {
        applyDraftBaseline(toDraft(model, studioMetaQuery.data));
      }
      return;
    }

    // When the server model changes (e.g. table designer save) and the draft is clean, resync.
    const currentJson = draftRef.current ? JSON.stringify(draftRef.current) : null;
    if (currentJson != null && currentJson === baselineJsonRef.current) {
      const next = toDraft(
        model,
        studioMetaQuery.data ?? createEmptyEdgeModelStudioMeta(model.id),
      );
      if (JSON.stringify(next) !== currentJson) {
        syncProtectedFromModel(model);
        applyDraftBaseline(next);
      }
    }
  }, [applyDraftBaseline, model, studioMetaQuery.data, syncProtectedFromModel]);

  // Keep draft associations aligned with server after Relations-diagram edits.
  useEffect(() => {
    if (!model || hydratedModelIdRef.current !== model.id) {
      return;
    }
    const nextAssociations = model.associations.map((association) => ({ ...association }));
    setDraft((current) => {
      if (!current) {
        return current;
      }
      if (JSON.stringify(current.associations) === JSON.stringify(nextAssociations)) {
        return current;
      }
      return { ...current, associations: nextAssociations };
    });
    if (baselineJsonRef.current) {
      try {
        const baseline = JSON.parse(baselineJsonRef.current) as ModelerDraft;
        if (JSON.stringify(baseline.associations) !== JSON.stringify(nextAssociations)) {
          const nextBaseline = JSON.stringify({ ...baseline, associations: nextAssociations });
          baselineJsonRef.current = nextBaseline;
          setBaselineJson(nextBaseline);
        }
      } catch {
        // Ignore malformed baseline JSON.
      }
    }
  }, [model]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const isDirty = useMemo(() => {
    if (!draft || baselineJson == null) {
      return false;
    }
    return JSON.stringify(draft) !== baselineJson;
  }, [baselineJson, draft]);

  const columnsReadOnly = Boolean(draft?.readOnly);
  const canEditMetadata = true;
  const objectName = model?.objectName ?? '';

  const isStructuralColumnLocked = useCallback((columnName: string) => (
    Boolean(draft?.readOnly)
    || isControlPlaneProtectedColumnName(objectName, columnName, protectedColumnNames)
  ), [draft?.readOnly, objectName, protectedColumnNames]);

  const isAssociationLocked = useCallback((associationId: string) => (
    isControlPlaneProtectedAssociationId(objectName, associationId, protectedAssociationIds)
  ), [objectName, protectedAssociationIds]);

  const updateLabels = useCallback((
    patch: Partial<Pick<ModelerDraft, 'title' | 'icon' | 'color'>>,
  ) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const updateStudioTagsText = useCallback((tagsText: string) => {
    setDraft((current) => (
      current
        ? { ...current, studio: { ...current.studio, tagsText } }
        : current
    ));
  }, []);

  const updateStudioStory = useCallback((story: string) => {
    setDraft((current) => (
      current
        ? {
          ...current,
          studio: {
            ...current.studio,
            story: normalizeModelStoryForStorage(story),
          },
        }
        : current
    ));
  }, []);

  const updateColumnDisplayLabel = useCallback((columnName: string, displayLabel: string) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const nextLabels = { ...current.studio.columnDisplayLabels };
      // Empty / translate(field_name) means untouched — resolve at display time.
      if (displayLabel.trim()) {
        nextLabels[columnName] = displayLabel;
      } else {
        delete nextLabels[columnName];
      }
      return {
        ...current,
        studio: {
          ...current.studio,
          columnDisplayLabels: nextLabels,
        },
      };
    });
  }, []);

  const updateColumnIcon = useCallback((columnName: string, icon: string) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const nextIcons = { ...current.studio.columnIcons };
      const trimmed = icon.trim();
      if (trimmed) {
        nextIcons[columnName] = trimmed;
      } else {
        delete nextIcons[columnName];
      }
      return {
        ...current,
        studio: {
          ...current.studio,
          columnIcons: nextIcons,
        },
      };
    });
  }, []);

  const updateColumnFormWidget = useCallback((
    columnName: string,
    formWidget: ColumnFormWidget | '',
    formWidgetProps?: ColumnFormWidgetProps | null,
  ) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const nextWidgets = { ...current.studio.columnFormWidgets };
      const nextProps = { ...current.studio.columnFormWidgetProps };
      if (formWidget) {
        nextWidgets[columnName] = formWidget;
      } else {
        delete nextWidgets[columnName];
      }
      const pruned = pruneColumnFormWidgetProps(formWidget, formWidgetProps);
      if (pruned) {
        nextProps[columnName] = pruned;
      } else {
        delete nextProps[columnName];
      }
      return {
        ...current,
        studio: {
          ...current.studio,
          columnFormWidgets: nextWidgets,
          columnFormWidgetProps: nextProps,
        },
      };
    });
  }, []);

  const updateColumnRequired = useCallback((columnName: string, required: boolean) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const nextRequired = { ...current.studio.columnRequired };
      if (required) {
        nextRequired[columnName] = true;
      } else {
        delete nextRequired[columnName];
      }
      return {
        ...current,
        studio: {
          ...current.studio,
          columnRequired: nextRequired,
        },
      };
    });
  }, []);

  const updateColumnSearchRole = useCallback((columnName: string, searchRole: ColumnSearchRole) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const nextRoles = { ...current.studio.columnSearchRoles };
      if (searchRole !== DEFAULT_COLUMN_SEARCH_ROLE) {
        nextRoles[columnName] = searchRole;
      } else {
        delete nextRoles[columnName];
      }
      return {
        ...current,
        studio: {
          ...current.studio,
          columnSearchRoles: nextRoles,
        },
      };
    });
  }, []);

  const updateColumnFilterRole = useCallback((columnName: string, filterRole: ColumnFilterRole) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const nextRoles = { ...current.studio.columnFilterRoles };
      if (filterRole !== DEFAULT_COLUMN_FILTER_ROLE) {
        nextRoles[columnName] = filterRole;
      } else {
        delete nextRoles[columnName];
      }
      return {
        ...current,
        studio: {
          ...current.studio,
          columnFilterRoles: nextRoles,
        },
      };
    });
  }, []);

  const updateColumnDeveloperNotes = useCallback((columnName: string, developerNotes: string) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const nextNotes = { ...current.studio.columnDeveloperNotes };
      if (developerNotes.trim()) {
        nextNotes[columnName] = developerNotes;
      } else {
        delete nextNotes[columnName];
      }
      return {
        ...current,
        studio: {
          ...current.studio,
          columnDeveloperNotes: nextNotes,
        },
      };
    });
  }, []);

  const updateColumnInterfaceNotes = useCallback((columnName: string, interfaceNotes: string) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const nextNotes = { ...current.studio.columnInterfaceNotes };
      if (interfaceNotes.trim()) {
        nextNotes[columnName] = interfaceNotes;
      } else {
        delete nextNotes[columnName];
      }
      return {
        ...current,
        studio: {
          ...current.studio,
          columnInterfaceNotes: nextNotes,
        },
      };
    });
  }, []);

  const updateColumnCubeMeasure = useCallback((
    columnName: string,
    cubeMeasure: NonNullable<EdgeModelColumnStudioLayout['columnCubeMeasures']>[string] | null,
  ) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const next = { ...(current.studio.columnCubeMeasures ?? {}) };
      if (cubeMeasure) {
        next[columnName] = cubeMeasure;
      } else {
        delete next[columnName];
      }
      return {
        ...current,
        studio: {
          ...current.studio,
          columnCubeMeasures: next,
        },
      };
    });
  }, []);

  const updateColumnHistory = useCallback((
    columnName: string,
    history: NonNullable<EdgeModelColumnStudioLayout['columnHistories']>[string] | null,
  ) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const next = { ...(current.studio.columnHistories ?? {}) };
      if (history) {
        next[columnName] = history;
      } else {
        delete next[columnName];
      }
      return {
        ...current,
        studio: {
          ...current.studio,
          columnHistories: next,
        },
      };
    });
  }, []);

  const updateModelHistory = useCallback((history: EdgeModelHistory | undefined) => {
    setDraft((current) => (
      current
        ? {
          ...current,
          studio: {
            ...current.studio,
            history,
          },
        }
        : current
    ));
  }, []);

  const applyColumnStudioLayout = useCallback((
    next: Pick<
      EdgeModelColumnStudioLayout,
      | 'columnGroups'
      | 'columnSortOrders'
      | 'columnGroupOrder'
      | 'columnGroupIcons'
      | 'columnGroupColors'
    >,
  ) => {
    setDraft((current) => (
      current
        ? {
          ...current,
          studio: {
            ...current.studio,
            columnGroups: next.columnGroups,
            columnSortOrders: next.columnSortOrders,
            columnGroupOrder: next.columnGroupOrder,
            columnGroupIcons: next.columnGroupIcons ?? current.studio.columnGroupIcons,
            columnGroupColors: next.columnGroupColors ?? current.studio.columnGroupColors,
          },
        }
        : current
    ));
  }, []);

  const applyRelationStudioMeta = useCallback((
    relationKey: string,
    values: {
      displayLabel: string;
      icon: string;
      formWidget: RelationFormWidget | '';
      targetFilter?: ReadonlyArray<RelationTargetFilterCondition>;
      developerNotes: string;
      interfaceNotes: string;
      cubeDimension?: NonNullable<EdgeModelRelationStudioLayout['relationCubeDimensions']>[string] | null;
      history?: NonNullable<EdgeModelRelationStudioLayout['relationHistories']>[string] | null;
    },
  ) => {
    const key = relationKey.trim();
    if (!key) {
      return;
    }
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const nextLabels = { ...current.studio.relationDisplayLabels };
      const nextIcons = { ...current.studio.relationIcons };
      const nextFormWidgets = { ...current.studio.relationFormWidgets };
      const nextTargetFilters = { ...current.studio.relationTargetFilters };
      const nextDeveloperNotes = { ...current.studio.relationDeveloperNotes };
      const nextInterfaceNotes = { ...current.studio.relationInterfaceNotes };
      const nextCubeDimensions = { ...(current.studio.relationCubeDimensions ?? {}) };
      const nextHistories = { ...(current.studio.relationHistories ?? {}) };

      if (values.displayLabel.trim()) {
        nextLabels[key] = values.displayLabel;
      } else {
        delete nextLabels[key];
      }
      if (values.icon.trim()) {
        nextIcons[key] = values.icon.trim();
      } else {
        delete nextIcons[key];
      }
      if (values.formWidget) {
        nextFormWidgets[key] = values.formWidget;
      } else {
        delete nextFormWidgets[key];
      }
      if (values.targetFilter !== undefined) {
        const normalized = normalizeRelationTargetFilter(values.targetFilter);
        if (normalized.length > 0) {
          nextTargetFilters[key] = normalized;
        } else {
          delete nextTargetFilters[key];
        }
      }
      if (values.developerNotes.trim()) {
        nextDeveloperNotes[key] = values.developerNotes;
      } else {
        delete nextDeveloperNotes[key];
      }
      if (values.interfaceNotes.trim()) {
        nextInterfaceNotes[key] = values.interfaceNotes;
      } else {
        delete nextInterfaceNotes[key];
      }
      if (values.cubeDimension) {
        nextCubeDimensions[key] = values.cubeDimension;
      } else {
        delete nextCubeDimensions[key];
      }
      if (values.history) {
        nextHistories[key] = values.history;
      } else {
        delete nextHistories[key];
      }

      return {
        ...current,
        studio: {
          ...current.studio,
          relationDisplayLabels: nextLabels,
          relationIcons: nextIcons,
          relationFormWidgets: nextFormWidgets,
          relationTargetFilters: nextTargetFilters,
          relationDeveloperNotes: nextDeveloperNotes,
          relationInterfaceNotes: nextInterfaceNotes,
          relationCubeDimensions: nextCubeDimensions,
          relationHistories: nextHistories,
        },
      };
    });
  }, []);

  const updateCubeDerivedMeasures = useCallback((next: CubeDerivedMeasureDef[]) => {
    setDraft((current) => (
      current
        ? {
          ...current,
          studio: {
            ...current.studio,
            cubeDerivedMeasures: next,
          },
        }
        : current
    ));
  }, []);

  const updateRelationFormWidget = useCallback((
    relationKey: string,
    formWidget: RelationFormWidget | '',
  ) => {
    const key = relationKey.trim();
    if (!key) {
      return;
    }
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const nextFormWidgets = { ...current.studio.relationFormWidgets };
      if (formWidget) {
        nextFormWidgets[key] = formWidget;
      } else {
        delete nextFormWidgets[key];
      }
      return {
        ...current,
        studio: {
          ...current.studio,
          relationFormWidgets: nextFormWidgets,
        },
      };
    });
  }, []);

  const applyRelationAttachedFields = useCallback((
    relationKey: string,
    attachedFields: ReadonlyArray<{ sourceColumn: string; as: string }>,
  ) => {
    const key = relationKey.trim();
    if (!key) {
      return;
    }
    const nextFields = attachedFields
      .map((field) => ({
        sourceColumn: field.sourceColumn.trim(),
        as: field.as.trim(),
      }))
      .filter((field) => field.sourceColumn && field.as);
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const nextAttached = { ...current.studio.relationAttachedFields };
      if (nextFields.length > 0) {
        nextAttached[key] = nextFields;
      } else {
        delete nextAttached[key];
      }
      return {
        ...current,
        studio: {
          ...current.studio,
          relationAttachedFields: nextAttached,
        },
      };
    });
  }, []);

  const setReadOnly = useCallback((next: boolean) => {
    if (model?.objectType === 'VIEW') {
      return;
    }
    setDraft((current) => (current ? { ...current, readOnly: next } : current));
  }, [model?.objectType]);

  const updateColumn = useCallback((columnName: string, patch: Partial<EdgeModelColumn>) => {
    const protectedColumn = isControlPlaneProtectedColumnName(
      objectName,
      columnName,
      protectedColumnNamesRef.current,
    );
    if (protectedColumn && isControlPlaneStructuralColumnPatch(patch)) {
      return;
    }

    setDraft((current) => {
      if (!current || current.readOnly) {
        return current;
      }

      const index = current.columns.findIndex((column) => column.name === columnName);
      if (index === -1) {
        return current;
      }

      const nextColumn = patchEdgeModelColumn(current.columns[index], patch);
      let nextStudio = current.studio;
      if (patch.name && patch.name !== columnName) {
        if (protectedColumn) {
          return current;
        }
        const trimmedName = patch.name.trim();
        if (!trimmedName || current.columns.some((column, itemIndex) => (
          itemIndex !== index && column.name === trimmedName
        ))) {
          return current;
        }
        nextColumn.name = trimmedName;
        nextStudio = {
          ...current.studio,
          ...renameColumnLayoutKeys(current.studio, columnName, trimmedName),
        };
      }

      return {
        ...current,
        columns: current.columns.map((column, itemIndex) => (
          itemIndex === index ? nextColumn : column
        )),
        studio: nextStudio,
      };
    });
  }, [objectName]);

  const removeColumn = useCallback((columnName: string) => {
    if (isControlPlaneProtectedColumnName(objectName, columnName, protectedColumnNamesRef.current)) {
      return;
    }
    setDraft((current) => {
      if (!current || current.readOnly) {
        return current;
      }
      return {
        ...current,
        columns: current.columns.filter((column) => column.name !== columnName),
        studio: {
          ...current.studio,
          ...removeColumnLayoutKeys(current.studio, columnName),
        },
      };
    });
  }, [objectName]);

  const addBlankColumn = useCallback(() => {
    setDraft((current) => {
      if (!current || current.readOnly) {
        return current;
      }
      const name = buildNextBlankColumnName(current.columns);
      const nativeType = nativeTypeOptions[0] ?? 'text';
      const maxOrder = Math.max(-1, ...Object.values(current.studio.columnSortOrders));
      setFocusColumnName(name);
      return {
        ...current,
        columns: [...current.columns, createEdgeModelColumnFromNativeType(name, nativeType)],
        studio: {
          ...current.studio,
          columnSortOrders: {
            ...current.studio.columnSortOrders,
            [name]: maxOrder + 1,
          },
        },
      };
    });
  }, [nativeTypeOptions]);

  const addAssociation = useCallback((association: EdgeModelAssociation) => {
    const current = draftRef.current;
    if (!current) {
      return;
    }
    if (current.associations.some((item) => item.id === association.id || item.as === association.as)) {
      return;
    }
    const next = {
      ...current,
      associations: [...current.associations, association],
    };
    draftRef.current = next;
    setDraft(next);
  }, []);

  const addAssociations = useCallback((associations: EdgeModelAssociation[]) => {
    const current = draftRef.current;
    if (!current || associations.length === 0) {
      return 0;
    }

    const nextAssociations = [...current.associations];
    const usedIds = new Set(nextAssociations.map((item) => item.id));
    const usedAliases = new Set(nextAssociations.map((item) => item.as));
    const usedShape = new Set(
      nextAssociations.map((item) => associationShapeKey(item)),
    );
    let added = 0;

    for (const association of associations) {
      const shapeKey = associationShapeKey(association);
      if (
        usedIds.has(association.id)
        || usedAliases.has(association.as)
        || usedShape.has(shapeKey)
      ) {
        continue;
      }
      nextAssociations.push(association);
      usedIds.add(association.id);
      usedAliases.add(association.as);
      usedShape.add(shapeKey);
      added += 1;
    }

    if (added === 0) {
      return 0;
    }

    const next = {
      ...current,
      associations: nextAssociations,
    };
    draftRef.current = next;
    setDraft(next);
    return added;
  }, []);

  const updateAssociation = useCallback((
    associationId: string,
    patch: Partial<Pick<EdgeModelAssociation, 'kind' | 'targetModelId' | 'as' | 'foreignKey' | 'source'>>,
  ) => {
    if (isControlPlaneProtectedAssociationId(
      objectName,
      associationId,
      protectedAssociationIdsRef.current,
    )) {
      return;
    }

    setDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        associations: current.associations.map((association) => (
          association.id === associationId
            ? { ...association, ...patch }
            : association
        )),
      };
    });
  }, [objectName]);

  const removeAssociation = useCallback((associationId: string) => {
    if (isControlPlaneProtectedAssociationId(
      objectName,
      associationId,
      protectedAssociationIdsRef.current,
    )) {
      return;
    }

    setDraft((current) => (
      current
        ? {
          ...current,
          associations: current.associations.filter((association) => association.id !== associationId),
        }
        : current
    ));
  }, [objectName]);

  const refreshFromDatabase = useCallback(async () => {
    try {
      const refreshed = await refreshModelMutation.mutateAsync(modelId);
      if (studioMeta) {
        syncProtectedFromModel(refreshed);
        applyDraftBaseline(toDraft(refreshed, studioMeta));
      }
      setToast({
        type: 'success',
        text: 'Model synced from the database.',
      });
    } catch (error) {
      const message = isApiError(error)
        ? formatApiErrorMessage(error)
        : (error instanceof Error ? error.message : 'Sync failed.');
      setToast({ type: 'error', text: message });
    }
  }, [applyDraftBaseline, modelId, refreshModelMutation, studioMeta, syncProtectedFromModel]);

  const persistDraft = useCallback(async (toSave: ModelerDraft) => {
    if (!studioMeta || toSave.columns.length === 0) {
      return;
    }

    const requestJson = JSON.stringify(toSave);
    const baseline = baselineJsonRef.current
      ? (JSON.parse(baselineJsonRef.current) as ModelerDraft)
      : null;

    const labelsDirty = !baseline || (
      baseline.title !== toSave.title
      || baseline.icon !== toSave.icon
      || baseline.color !== toSave.color
      || baseline.readOnly !== toSave.readOnly
    );
    const columnsDirty = !baseline
      || JSON.stringify(baseline.columns) !== JSON.stringify(toSave.columns);
    // Associations are edited on the Relations diagram (immediate PATCH), not via modeler autosave.
    const associationsDirty = false;
    const modelDirty = labelsDirty || columnsDirty || associationsDirty;
    const studioDirty = !baseline || (
      baseline.studio.tagsText !== toSave.studio.tagsText
      || baseline.studio.story !== toSave.studio.story
      || JSON.stringify(baseline.studio.columnDisplayLabels)
        !== JSON.stringify(toSave.studio.columnDisplayLabels)
      || JSON.stringify(baseline.studio.columnIcons)
        !== JSON.stringify(toSave.studio.columnIcons)
      || JSON.stringify(baseline.studio.columnFormWidgets)
        !== JSON.stringify(toSave.studio.columnFormWidgets)
      || JSON.stringify(baseline.studio.columnFormWidgetProps)
        !== JSON.stringify(toSave.studio.columnFormWidgetProps)
      || JSON.stringify(baseline.studio.columnRequired)
        !== JSON.stringify(toSave.studio.columnRequired)
      || JSON.stringify(baseline.studio.columnSearchRoles)
        !== JSON.stringify(toSave.studio.columnSearchRoles)
      || JSON.stringify(baseline.studio.columnFilterRoles)
        !== JSON.stringify(toSave.studio.columnFilterRoles)
      || JSON.stringify(baseline.studio.columnDeveloperNotes)
        !== JSON.stringify(toSave.studio.columnDeveloperNotes)
      || JSON.stringify(baseline.studio.columnInterfaceNotes)
        !== JSON.stringify(toSave.studio.columnInterfaceNotes)
      || JSON.stringify(baseline.studio.columnCubeMeasures ?? {})
        !== JSON.stringify(toSave.studio.columnCubeMeasures ?? {})
      || JSON.stringify(baseline.studio.columnGroups) !== JSON.stringify(toSave.studio.columnGroups)
      || JSON.stringify(baseline.studio.columnSortOrders)
        !== JSON.stringify(toSave.studio.columnSortOrders)
      || JSON.stringify(baseline.studio.columnGroupOrder)
        !== JSON.stringify(toSave.studio.columnGroupOrder)
      || JSON.stringify(baseline.studio.columnGroupIcons)
        !== JSON.stringify(toSave.studio.columnGroupIcons)
      || JSON.stringify(baseline.studio.columnGroupColors)
        !== JSON.stringify(toSave.studio.columnGroupColors)
      || JSON.stringify(baseline.studio.relationDisplayLabels)
        !== JSON.stringify(toSave.studio.relationDisplayLabels)
      || JSON.stringify(baseline.studio.relationIcons)
        !== JSON.stringify(toSave.studio.relationIcons)
      || JSON.stringify(baseline.studio.relationFormWidgets)
        !== JSON.stringify(toSave.studio.relationFormWidgets)
      || JSON.stringify(baseline.studio.relationAttachedFields)
        !== JSON.stringify(toSave.studio.relationAttachedFields)
      || JSON.stringify(baseline.studio.relationTargetFilters)
        !== JSON.stringify(toSave.studio.relationTargetFilters)
      || JSON.stringify(baseline.studio.relationDeveloperNotes)
        !== JSON.stringify(toSave.studio.relationDeveloperNotes)
      || JSON.stringify(baseline.studio.relationInterfaceNotes)
        !== JSON.stringify(toSave.studio.relationInterfaceNotes)
      || JSON.stringify(baseline.studio.relationCubeDimensions ?? {})
        !== JSON.stringify(toSave.studio.relationCubeDimensions ?? {})
      || JSON.stringify(baseline.studio.cubeDerivedMeasures ?? [])
        !== JSON.stringify(toSave.studio.cubeDerivedMeasures ?? [])
      || JSON.stringify(baseline.studio.columnHistories ?? {})
        !== JSON.stringify(toSave.studio.columnHistories ?? {})
      || JSON.stringify(baseline.studio.relationHistories ?? {})
        !== JSON.stringify(toSave.studio.relationHistories ?? {})
      || JSON.stringify(baseline.studio.history ?? null)
        !== JSON.stringify(toSave.studio.history ?? null)
    );

    if (!modelDirty && !studioDirty) {
      return;
    }

    try {
      // Persist model + studio-meta through PATCH /models/:id (single known-good route).
      // Avoids a separate /studio-meta call that older/stale servers may not expose.
      // Only send columns/associations when those slices changed — label/icon saves must not
      // trigger applyNewTableColumns on the server.
      const columnMeta = studioDirty
        ? studioLayoutToColumnMeta(
          toSave.columns.map((column) => column.name),
          toSave.studio,
        )
        : undefined;
      const associationMeta = studioDirty
        ? studioLayoutToAssociationMeta(toSave.studio)
        : undefined;
      const columnGroupOrder = studioDirty
        ? sanitizeColumnGroupOrder(toSave.studio.columnGroupOrder)
        : undefined;
      const story = studioDirty
        ? normalizeModelStoryForStorage(toSave.studio.story)
        : undefined;
      const columnGroupPresentation = studioDirty
        ? studioLayoutToColumnGroupPresentation(toSave.studio)
        : undefined;

      const saved = await patchModelMutation.mutateAsync({
        modelId,
        patch: {
          ...(labelsDirty ? {
            labels: {
              title: toSave.title.trim() || model?.objectName || 'Model',
              icon: toSave.icon.trim(),
              color: toSave.color.trim(),
            },
            readOnly: toSave.readOnly,
          } : {}),
          ...(columnsDirty ? { columns: toSave.columns } : {}),
          ...(associationsDirty ? { associations: toSave.associations } : {}),
          ...(studioDirty ? {
            studioMeta: {
              tags: textToTags(toSave.studio.tagsText),
              columnMeta,
              associationMeta,
              history: toSave.studio.history,
              // Merge-only bag: preserve silent UI keys (e.g. relations diagram layout).
              extensions: {
                ...studioMeta.extensions,
                [COLUMN_GROUP_ORDER_EXTENSION_KEY]: columnGroupOrder ?? [],
                [MODEL_STORY_EXTENSION_KEY]: story ?? '',
                [COLUMN_GROUP_PRESENTATION_EXTENSION_KEY]: columnGroupPresentation ?? {},
                [CUBE_DERIVED_MEASURES_EXTENSION_KEY]: toSave.studio.cubeDerivedMeasures ?? [],
              },
            },
          } : {}),
        },
      });

      const savedStudioMeta = studioDirty
        ? {
          ...studioMeta,
          tags: textToTags(toSave.studio.tagsText),
          columnMeta: columnMeta ?? studioMeta.columnMeta ?? [],
          associationMeta: associationMeta ?? studioMeta.associationMeta ?? [],
          history: toSave.studio.history,
          extensions: {
            ...studioMeta.extensions,
            [COLUMN_GROUP_ORDER_EXTENSION_KEY]: columnGroupOrder ?? [],
            [MODEL_STORY_EXTENSION_KEY]: story ?? '',
            [COLUMN_GROUP_PRESENTATION_EXTENSION_KEY]: columnGroupPresentation ?? {},
            [CUBE_DERIVED_MEASURES_EXTENSION_KEY]: toSave.studio.cubeDerivedMeasures ?? [],
          },
          updated_at: new Date().toISOString(),
        }
        : studioMeta;

      if (columnsDirty && model) {
        await queryClient.invalidateQueries({
          queryKey: dataSourcesQueryKeys.objectFields(
            model.dataSourceId,
            model.objectType,
            model.objectName,
          ),
        });
      }
      if (modelDirty) {
        syncProtectedFromModel(saved);
      }

      const normalized = toDraft(saved, savedStudioMeta);
      const currentJson = draftRef.current ? JSON.stringify(draftRef.current) : null;

      if (currentJson === requestJson) {
        // Idle after this save — sync to server-normalized shape.
        applyDraftBaseline(normalized);
      } else {
        // User kept typing; mark the persisted request as baseline so dirty tracks new edits.
        baselineJsonRef.current = requestJson;
        setBaselineJson(requestJson);
      }
    } catch (error) {
      const message = isApiError(error)
        ? formatApiErrorMessage(error)
        : (error instanceof Error ? error.message : 'Save failed.');
      setToast({ type: 'error', text: message });
    }
  }, [
    applyDraftBaseline,
    model,
    modelId,
    patchModelMutation,
    queryClient,
    studioMeta,
    syncProtectedFromModel,
  ]);

  const flushAutosave = useCallback(async () => {
    const toSave = draftRef.current;
    if (
      !toSave
      || toSave.columns.length === 0
      || baselineJsonRef.current == null
      || JSON.stringify(toSave) === baselineJsonRef.current
    ) {
      return;
    }

    if (autosaveInFlightRef.current) {
      autosaveAgainRef.current = true;
      return;
    }

    autosaveInFlightRef.current = true;
    try {
      do {
        autosaveAgainRef.current = false;
        const pending = draftRef.current;
        if (
          !pending
          || pending.columns.length === 0
          || baselineJsonRef.current == null
          || JSON.stringify(pending) === baselineJsonRef.current
        ) {
          break;
        }
        await persistDraft(pending);
      } while (autosaveAgainRef.current);
    } finally {
      autosaveInFlightRef.current = false;
    }
  }, [persistDraft]);

  const flushAutosaveRef = useRef(flushAutosave);
  flushAutosaveRef.current = flushAutosave;

  useEffect(() => {
    if (!isDirty || !draft || draft.columns.length === 0) {
      return;
    }

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void flushAutosaveRef.current();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [draft, isDirty]);

  useEffect(() => () => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    void flushAutosaveRef.current();
  }, []);

  const clearFocusColumnName = useCallback(() => {
    setFocusColumnName(null);
  }, []);

  return {
    model,
    draft,
    dataSource,
    modelNameById,
    nativeTypeOptions,
    isControlPlaneObject,
    isControlPlaneLocked,
    canEditMetadata,
    columnsReadOnly,
    metadataReadOnly: false,
    isStructuralColumnLocked,
    isAssociationLocked,
    focusColumnName,
    clearFocusColumnName,
    isLoading: modelQuery.isLoading || dataSourcesQuery.isLoading,
    isError: modelQuery.isError,
    error: modelQuery.error instanceof Error
      ? modelQuery.error.message
      : (modelQuery.isError ? 'Failed to load model.' : null),
    isDirty,
    isSaving: patchModelMutation.isPending,
    isRefreshing: refreshModelMutation.isPending,
    toast,
    updateLabels,
    updateStudioTagsText,
    updateStudioStory,
    updateColumnDisplayLabel,
    updateColumnIcon,
    updateColumnFormWidget,
    updateColumnRequired,
    updateColumnSearchRole,
    updateColumnFilterRole,
    updateColumnDeveloperNotes,
    updateColumnInterfaceNotes,
    updateColumnCubeMeasure,
    updateColumnHistory,
    updateModelHistory,
    updateCubeDerivedMeasures,
    applyColumnStudioLayout,
    applyRelationStudioMeta,
    updateRelationFormWidget,
    applyRelationAttachedFields,
    setReadOnly,
    updateColumn,
    removeColumn,
    addBlankColumn,
    addAssociation,
    addAssociations,
    updateAssociation,
    removeAssociation,
    refreshFromDatabase,
    models: modelsQuery.data ?? [],
  };
}

export type EdgeModelModelerModel = ReturnType<typeof useEdgeModelModeler>;
