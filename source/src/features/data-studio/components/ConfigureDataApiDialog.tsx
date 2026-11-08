import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Maximize2, Minimize2, Plus, Route, Settings2, X } from 'lucide-react';
import {
  AccessControlModal,
  AppButton,
  ChangeReasonPolicyFields,
  CreateEditModalShell,
  FormField,
  FormSection,
  FunctionCacheConfig,
  ServerFunctionHooksModal,
  UiCheckboxChoice,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import type { EdgeApiDefinition } from '../../../shared/api/contracts/data-api';
import { parseQuerySurfacesDocument } from '../../../shared/api/contracts/data-api';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import {
  changeReasonFolderOwnerKeyForDataApi,
  changeReasonFolderOwnerKeyForDataApiDraft,
} from '../../../shared/api/queries/changeReasonFolder';
import {
  LATIN_SLUG_HELPER_TEXT,
  sanitizeLatinSlugInput,
} from '../../../shared/lib/latinSlug';
import {
  useCreateEdgeApiDefinitionMutation,
  useEdgeApiDefinitionsQuery,
  useEdgeModelQuery,
  useEdgeModelStudioMetaQuery,
  useEdgeModelsQuery,
  usePatchEdgeApiDefinitionMutation,
  usePublishEdgeApiDefinitionMutation,
} from '../../../shared/api/queries/data-api';
import { useServerFunctionsCatalogQuery } from '../../../shared/api/queries/server-functions';
import { useRecordPoliciesQuery } from '../../../shared/api/queries/record-policy';
import {
  CLIENT_CONTEXT_CATALOG,
  defaultWriteClientContext,
  type ClientContextMode,
} from '../../../shared/api/contracts/client-context';
import type { DataStudioExplorerObjectRow } from '../types';
import type { RouteComposerOption } from '../lib/routeComposerTypes';
import {
  buildConfigureDataApiDefinitionPayload,
  buildConfigureDataApiOperation,
  buildConfigureDataApiPath,
  collectReservedApiNameSlugsForObject,
  createDefaultConfigureDataApiFormState,
  deriveDataApiKey,
  deriveObjectFolderSlug,
  excludeDefinitionApiNameSlugsFromReserved,
  getConfigureDataApiModelOptions,
  hydrateConfigureDataApiFormFromOperation,
  mergeOperationIntoDefinition,
  refreshConfigureDataApiFieldsForModel,
  suggestConfigureDataApiName,
  supportsConfigureDataApiInputFields,
  supportsConfigureDataApiOutputFields,
  validateConfigureDataApiName,
  type ConfigureDataApiConfigTabId,
  type ConfigureDataApiDialogMode,
  type ConfigureDataApiFormState,
  type ConfigureDataApiObjectType,
} from '../lib/configureDataApi';
import {
  composerOptionRequiresPrimaryKey,
  getComposerOptionUsageLabel,
  getInputFieldColumnsForOption,
  getOutputFieldColumnsForOption,
  METHOD_BADGE_WIDTH_CLASS,
  resolveComposerHttpMethod,
  slugifyRouteSegment,
} from '../lib/dataApiRouteMethods';
import { METHOD_THEME } from '../../server-functions/constants';
import {
  edgeModelColumnsToSchemaFields,
  resolveEdgeModelPrimaryKey,
} from '../lib/dataApiWizard';
import {
  DataApiInputFieldsToggleEditor,
} from './DataApiRouteFieldsEditor';
import { DataApiOutputFieldsWithEnrichmentEditor } from './DataApiFieldEnrichmentDialog';
import { buildJoinTableOptions } from '../lib/dataApiJoinTableOptions';
import { DataApiIncludesEditor } from './DataApiIncludesEditor';
import { DataApiComputedFieldsEditor } from './DataApiComputedFieldsEditor';
import { DataApiQueryOptionsEditor } from './DataApiQueryOptionsEditor';
import { DataApiOperationTestPanel } from './DataApiOperationTestPanel';

const CONFIGURE_API_DIALOG_SHELL_CLASS = 'flex min-h-0 flex-col overflow-hidden';
const CONFIGURE_API_DIALOG_BODY_CLASS = 'flex min-h-0 flex-1 flex-col overflow-hidden !min-h-0 !p-0';
const CONFIGURE_API_DIALOG_COLUMNS_CLASS = 'flex h-full min-h-0 flex-1';
const CONFIGURE_API_DIALOG_SIDEBAR_CLASS =
  'flex w-64 shrink-0 flex-col gap-3 self-stretch overflow-y-auto border-r border-slate-200 p-3';
const CONFIGURE_API_DIALOG_MAIN_CLASS = 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden';
const CONFIGURE_API_DIALOG_TABS_ROW_CLASS =
  'flex shrink-0 flex-wrap gap-1 border-b border-slate-200 px-1 pb-2';
const CONFIGURE_API_DIALOG_TAB_BUTTON_CLASS =
  'rounded-md border border-transparent px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors';
const CONFIGURE_API_DIALOG_TAB_BUTTON_ACTIVE_CLASS =
  'border-slate-200 bg-white text-slate-900 shadow-sm';
const CONFIGURE_API_DIALOG_TAB_PANEL_CLASS = 'flex min-h-0 flex-1 flex-col overflow-hidden pt-3';
const CONFIGURE_API_DIALOG_DATA_HOST_CLASS =
  'flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white';
const CONFIGURE_API_DIALOG_DATA_SCROLL_CLASS = 'min-h-0 flex-1 overflow-y-auto p-3';

const API_MODEL_SELECTED_BUTTON_CLASS = {
  GET: 'border-sky-300 bg-sky-100 text-sky-950 hover:bg-sky-100',
  POST: 'border-emerald-300 bg-emerald-100 text-emerald-950 hover:bg-emerald-100',
  PUT: 'border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-100',
  DELETE: 'border-rose-300 bg-rose-100 text-rose-950 hover:bg-rose-100',
  PATCH: 'border-violet-300 bg-violet-100 text-violet-950 hover:bg-violet-100',
} as const satisfies Record<keyof typeof METHOD_THEME, string>;

const CONFIG_TABS: Array<{ id: ConfigureDataApiConfigTabId; label: string }> = [
  { id: 'fields', label: 'Fields' },
  { id: 'relations', label: 'Relations' },
  { id: 'computed', label: 'Computed' },
  { id: 'query', label: 'Query Options' },
  { id: 'access', label: 'Access' },
  { id: 'runtime', label: 'Runtime & Cache' },
  { id: 'hooks', label: 'Hooks' },
  { id: 'test', label: 'Test' },
];

const RUNTIME_TIMEOUT_OPTIONS = [1000, 1500, 3000, 5000] as const;

const capitalizeModelUsageLabel = (value: string): string => (
  value.replace(/\b\w/g, (char) => char.toUpperCase())
);

export type ConfigureDataApiOpenOptions = {
  initialTab?: ConfigureDataApiConfigTabId;
  openAccessModal?: boolean;
  openHooksModal?: boolean;
};

export type ConfigureDataApiTarget = {
  row: DataStudioExplorerObjectRow;
  edgeModelId: string;
  objectType: ConfigureDataApiObjectType;
  dataSourceName: string | null;
  mode?: ConfigureDataApiDialogMode;
  definitionId?: string;
  operationId?: string;
  initialTab?: ConfigureDataApiConfigTabId;
  openAccessModal?: boolean;
  openHooksModal?: boolean;
};

export type ConfigureDataApiDialogProps = {
  target: ConfigureDataApiTarget | null;
  onClose: () => void;
  onPublished: (definition: EdgeApiDefinition) => void;
};

export const ConfigureDataApiDialog: React.FC<ConfigureDataApiDialogProps> = ({
  target,
  onClose,
  onPublished,
}) => {
  const definitionsQuery = useEdgeApiDefinitionsQuery();
  const serverFunctionsCatalogQuery = useServerFunctionsCatalogQuery(Boolean(target));
  const edgeModelQuery = useEdgeModelQuery(target?.edgeModelId ?? null);
  const studioMetaQuery = useEdgeModelStudioMetaQuery(target?.edgeModelId ?? null);
  const recordPoliciesQuery = useRecordPoliciesQuery(target?.edgeModelId, Boolean(target));
  const queryPresetOptions = useMemo(
    () => (parseQuerySurfacesDocument(studioMetaQuery.data?.extensions)?.presets ?? []).map((preset) => ({
      id: preset.id,
      label: preset.label,
    })),
    [studioMetaQuery.data?.extensions],
  );
  const edgeModelsQuery = useEdgeModelsQuery();
  const createDefinitionMutation = useCreateEdgeApiDefinitionMutation();
  const patchDefinitionMutation = usePatchEdgeApiDefinitionMutation();
  const publishDefinitionMutation = usePublishEdgeApiDefinitionMutation();

  const [form, setForm] = useState<ConfigureDataApiFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [apiNameTouched, setApiNameTouched] = useState(false);
  const [activeTab, setActiveTab] = useState<ConfigureDataApiConfigTabId>('fields');
  const [isAccessModalOpen, setAccessModalOpen] = useState(false);
  const [isHooksModalOpen, setHooksModalOpen] = useState(false);

  const mode: ConfigureDataApiDialogMode = target?.mode ?? (
    target?.definitionId ? 'edit' : 'create'
  );

  const columnOptions = useMemo(
    () => (edgeModelQuery.data ? edgeModelColumnsToSchemaFields(edgeModelQuery.data) : []),
    [edgeModelQuery.data],
  );

  const resolvedPrimaryKey = useMemo(() => {
    if (edgeModelQuery.data) {
      return resolveEdgeModelPrimaryKey(edgeModelQuery.data);
    }
    return '';
  }, [edgeModelQuery.data]);

  const modelOptions = useMemo(
    () => (target ? getConfigureDataApiModelOptions(target.objectType) : []),
    [target],
  );

  const activeManagedFunctionIds = useMemo(
    () => new Set((serverFunctionsCatalogQuery.data?.functions ?? []).map((item) => item.id)),
    [serverFunctionsCatalogQuery.data],
  );

  const objectDefinitions = useMemo(() => {
    if (!target) {
      return [];
    }
    return (definitionsQuery.data ?? []).filter((item) => item.edgeModelId === target.edgeModelId);
  }, [definitionsQuery.data, target]);

  const existingApiNames = useMemo(() => {
    if (!target) {
      return [];
    }

    const folderSlug = deriveObjectFolderSlug(target.row.name);
    const routePrefix = `/api/${folderSlug}/`;
    const catalogRouteCandidates = (serverFunctionsCatalogQuery.data?.functions ?? [])
      .filter((item) => item.path.startsWith(routePrefix))
      .map((item) => ({
        path: item.path,
        engineType: item.engineType,
        metadataJson: item.metadataJson as Record<string, unknown> | null | undefined,
      }));

    return collectReservedApiNameSlugsForObject(
      target.row.name,
      target.edgeModelId,
      definitionsQuery.data ?? [],
      catalogRouteCandidates,
      { activeManagedFunctionIds },
    );
  }, [
    activeManagedFunctionIds,
    definitionsQuery.data,
    serverFunctionsCatalogQuery.data,
    target,
  ]);

  const reservationSourcesReady = (
    definitionsQuery.isFetched && serverFunctionsCatalogQuery.isFetched
  );

  const editingDefinition = useMemo(() => {
    if (!target?.definitionId) {
      return null;
    }
    return objectDefinitions.find((item) => item.id === target.definitionId) ?? null;
  }, [objectDefinitions, target?.definitionId]);

  useEffect(() => {
    if (!target) {
      setForm(null);
      setError(null);
      setSeeded(false);
      setIsMaximized(false);
      setApiNameTouched(false);
      setActiveTab('fields');
      setAccessModalOpen(false);
      setHooksModalOpen(false);
      return;
    }

    setError(null);
    setSeeded(false);
    setApiNameTouched(mode === 'edit');
    setActiveTab(target.initialTab ?? 'fields');
    setAccessModalOpen(Boolean(target.openAccessModal));
    setHooksModalOpen(Boolean(target.openHooksModal));
    setForm(createDefaultConfigureDataApiFormState(
      target.objectType,
      columnOptions,
      resolvedPrimaryKey,
      edgeModelQuery.data,
    ));
  }, [target?.edgeModelId, target?.row.id, target?.definitionId, target?.operationId, target?.initialTab, target?.openAccessModal, target?.openHooksModal, mode]);

  useEffect(() => {
    if (!target || seeded || !edgeModelQuery.data || !form || !reservationSourcesReady) {
      return;
    }

    if (mode === 'edit' && editingDefinition) {
      const operation = target.operationId
        ? editingDefinition.operations.find((item) => item.id === target.operationId)
        : editingDefinition.operations[0];

      if (operation) {
        setForm(hydrateConfigureDataApiFormFromOperation(
          editingDefinition,
          operation,
          target.row.name,
          target.objectType,
          edgeModelQuery.data,
          columnOptions,
          resolvedPrimaryKey,
        ));
        setSeeded(true);
        return;
      }
    }

    const defaultState = createDefaultConfigureDataApiFormState(
      target.objectType,
      columnOptions,
      resolvedPrimaryKey,
      edgeModelQuery.data,
    );
    setForm({
      ...defaultState,
      apiName: suggestConfigureDataApiName(defaultState.model, existingApiNames),
    });
    setSeeded(true);
  }, [
    columnOptions,
    edgeModelQuery.data,
    editingDefinition,
    existingApiNames,
    form,
    mode,
    reservationSourcesReady,
    resolvedPrimaryKey,
    seeded,
    target,
  ]);

  useEffect(() => {
    if (!target || !form || apiNameTouched || mode === 'edit') {
      return;
    }

    const suggested = suggestConfigureDataApiName(form.model, existingApiNames);
    setForm((current) => {
      if (!current || current.apiName === suggested) {
        return current;
      }
      return { ...current, apiName: suggested };
    });
  }, [apiNameTouched, existingApiNames, form, mode, target]);

  const trimmedApiName = form?.apiName.trim() ?? '';
  const matchingDefinition = useMemo(() => {
    if (!target || !trimmedApiName) {
      return editingDefinition;
    }

    const nextKey = deriveDataApiKey(target.row.name, trimmedApiName);
    return (definitionsQuery.data ?? []).find((item) => (
      item.edgeModelId === target.edgeModelId && item.key === nextKey
    )) ?? editingDefinition;
  }, [definitionsQuery.data, editingDefinition, target, trimmedApiName]);

  const apiNameReservedNames = useMemo(() => {
    if (!target || mode !== 'edit' || !editingDefinition) {
      return existingApiNames;
    }

    return excludeDefinitionApiNameSlugsFromReserved(
      target.row.name,
      editingDefinition,
      existingApiNames,
    );
  }, [editingDefinition, existingApiNames, mode, target]);

  const joinTableOptions = useMemo(
    () => buildJoinTableOptions(edgeModelQuery.data, edgeModelsQuery.data ?? []),
    [edgeModelQuery.data, edgeModelsQuery.data],
  );

  const outputColumnOptions = useMemo(() => {
    if (!target || !form) {
      return [];
    }
    return getOutputFieldColumnsForOption(form.model, target.objectType, columnOptions);
  }, [columnOptions, form, target]);

  const inputColumnOptions = useMemo(() => {
    if (!target || !form) {
      return [];
    }
    return getInputFieldColumnsForOption(
      form.model,
      target.objectType,
      columnOptions,
      resolvedPrimaryKey,
    );
  }, [columnOptions, form, resolvedPrimaryKey, target]);

  if (!target || !form) {
    return null;
  }

  const apiNameError = validateConfigureDataApiName(form.apiName, {
    reservedNames: apiNameReservedNames,
    objectName: target.row.name,
    republishingKey: mode === 'edit' ? editingDefinition?.key ?? null : matchingDefinition?.key ?? null,
  });
  const showApiNameInvalid = Boolean(apiNameError && (apiNameTouched || trimmedApiName));
  const apiRoutePrefix = `/api/${deriveObjectFolderSlug(target.row.name)}/`;
  const apiRouteSuffix = composerOptionRequiresPrimaryKey(form.model, target.objectType)
    ? `/:${slugifyRouteSegment(resolvedPrimaryKey || 'id') || 'id'}`
    : '';
  const pathPreview = buildConfigureDataApiPath(
    target.row.name,
    trimmedApiName || 'api-name',
    form.model,
    resolvedPrimaryKey || 'id',
    target.objectType,
  );

  const showOutputFields = supportsConfigureDataApiOutputFields(form.model, target.objectType);
  const showInputFields = supportsConfigureDataApiInputFields(form.model, target.objectType);
  const objectConfigured = Boolean(edgeModelQuery.data);
  const allOutputSelected = outputColumnOptions.length > 0
    && outputColumnOptions.every((column) => form.outputFields.includes(column.name));
  const allInputSelected = inputColumnOptions.length > 0
    && inputColumnOptions.every((column) => form.inputFields.some((field) => field.name === column.name));
  const isReadOperation = showOutputFields;

  const isSubmitting = createDefinitionMutation.isPending
    || patchDefinitionMutation.isPending
    || publishDefinitionMutation.isPending;

  const canPublish = Boolean(trimmedApiName)
    && !apiNameError
    && objectConfigured
    && !isSubmitting;

  const handleModelChange = (model: RouteComposerOption) => {
    setForm((current) => {
      if (!current) return current;
      const next = refreshConfigureDataApiFieldsForModel(
        { ...current, model },
        target.objectType,
        columnOptions,
        resolvedPrimaryKey,
        edgeModelQuery.data,
      );

      // Keep the same operation identity when redesigning an existing API.
      if (mode === 'edit' && current.operationId) {
        next.operationId = current.operationId;
      }

      if (!apiNameTouched && mode !== 'edit') {
        next.apiName = suggestConfigureDataApiName(model, existingApiNames);
      }

      const isWrite = model === 'POST' || model === 'PUT' || model === 'PATCH' || model === 'DELETE';
      if (isWrite && (next.clientContextFields ?? []).length === 0) {
        next.clientContextFields = defaultWriteClientContext().fields;
      }
      if (!isWrite) {
        next.clientContextFields = [];
      }

      return next;
    });
  };

  const handlePublish = async () => {
    setError(null);

    const validationMessage = validateConfigureDataApiName(form.apiName, {
      required: true,
      reservedNames: apiNameReservedNames,
      objectName: target.row.name,
      republishingKey: mode === 'edit' ? editingDefinition?.key ?? null : matchingDefinition?.key ?? null,
    });
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    if (!edgeModelQuery.data) {
      setError('Edge model is not ready yet.');
      return;
    }

    if (form.recordScopeMode === 'policy' && !form.recordPolicyId.trim()) {
      setError('Select a record policy or switch record scope to model default.');
      return;
    }

    const operation = buildConfigureDataApiOperation(
      target.row.name,
      target.objectType,
      form,
      resolvedPrimaryKey,
      edgeModelQuery.data,
    );

    const definitionMeta = buildConfigureDataApiDefinitionPayload(target.row.name, form);
    const existingDefinition = (mode === 'edit' && editingDefinition)
      ? editingDefinition
      : (matchingDefinition
        ?? (form.definitionId
          ? objectDefinitions.find((item) => item.id === form.definitionId)
          : null));

    try {
      let definitionId = existingDefinition?.id;

      if (definitionId && existingDefinition) {
        const updated = await patchDefinitionMutation.mutateAsync({
          definitionId,
          patch: {
            key: definitionMeta.key,
            label: definitionMeta.label,
            basePath: definitionMeta.basePath,
            operations: mergeOperationIntoDefinition(existingDefinition.operations, operation),
            accessControl: form.accessControl,
            runtime: form.runtime,
            changeReason: definitionMeta.changeReason,
          },
        });
        definitionId = updated.id;
      } else {
        const created = await createDefinitionMutation.mutateAsync({
          edgeModelId: target.edgeModelId,
          key: definitionMeta.key,
          label: definitionMeta.label,
          basePath: definitionMeta.basePath,
          operations: [operation],
        });
        definitionId = created.id;

        // Creation seeds accessControl/runtime with server-side defaults (edgeApiPublisher.ts);
        // patch immediately so whatever the user configured in the Access/Runtime/Hooks tabs
        // before the first save actually takes effect.
        await patchDefinitionMutation.mutateAsync({
          definitionId,
          patch: {
            accessControl: form.accessControl,
            runtime: form.runtime,
            changeReason: definitionMeta.changeReason,
          },
        });
      }

      const published = await publishDefinitionMutation.mutateAsync(definitionId);
      onPublished(published);
      onClose();
    } catch (publishError) {
      const message = isApiError(publishError)
        ? formatApiErrorMessage(publishError)
        : (publishError instanceof Error ? publishError.message : 'Failed to publish Data API.');
      setError(message);
    }
  };

  const contextLabel = target.dataSourceName
    ? `${target.row.objectKindLabel} · ${target.dataSourceName} · ${target.row.name}`
    : `${target.row.objectKindLabel} · ${target.row.name}`;

  const contextHeaderBand = (
    <p className="truncate ps-[4px] text-[10px] font-medium text-slate-500">{contextLabel}</p>
  );

  const apiNameHeaderBand = (
    <div className="flex w-full min-w-0 flex-col">
      <FormField
        label="API name"
        required
        className="min-w-0 overflow-visible [&_label]:text-sm"
        labelExtra={(
          <span className="min-w-0 text-[10px] font-normal normal-case tracking-normal text-slate-500">
            — {LATIN_SLUG_HELPER_TEXT}
          </span>
        )}
      >
        <UiInput
          size="sm"
          aiAssist={false}
          autoDir={false}
          value={form.apiName}
          isInvalid={showApiNameInvalid}
          errorMessage={showApiNameInvalid ? apiNameError ?? undefined : undefined}
          title={pathPreview}
          startContent={(
            <span className="whitespace-nowrap font-mono text-[11px] font-medium text-cyan-700">
              {apiRoutePrefix}
            </span>
          )}
          endContent={apiRouteSuffix ? (
            <span className="whitespace-nowrap font-mono text-[11px] font-medium text-cyan-700">
              {apiRouteSuffix}
            </span>
          ) : undefined}
          startContentClassName="bg-slate-50"
          endContentClassName="bg-slate-50"
          onChange={(event) => {
            setApiNameTouched(true);
            setForm((current) => (
              current
                ? { ...current, apiName: sanitizeLatinSlugInput(event.target.value) }
                : current
            ));
          }}
          placeholder="list-active"
        />
      </FormField>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'fields':
        return (
          <div className="flex min-h-0 flex-1 flex-col gap-1">
            {showOutputFields ? (
              <FormSection
                title="Output"
                ink="accent"
                className="flex min-h-0 flex-1 flex-col"
                hint="Choose which columns are returned in the response. Leave none selected to return all columns."
                headerExtra={(
                  <AppButton
                    type="button"
                    intent="secondary"
                    size="sm"
                    disabled={outputColumnOptions.length === 0}
                    onClick={() => setForm((current) => (
                      current
                        ? {
                          ...current,
                          outputFields: allOutputSelected
                            ? []
                            : outputColumnOptions.map((column) => column.name),
                        }
                        : current
                    ))}
                  >
                    {allOutputSelected ? 'Clear All' : 'Select All'}
                  </AppButton>
                )}
              >
                <div className={CONFIGURE_API_DIALOG_DATA_HOST_CLASS}>
                  <div className={CONFIGURE_API_DIALOG_DATA_SCROLL_CLASS}>
                    <DataApiOutputFieldsWithEnrichmentEditor
                      outputFields={form.outputFields}
                      columnOptions={outputColumnOptions}
                      enrichments={form.enrichments}
                      sourceModel={edgeModelQuery.data}
                      joinTableOptions={joinTableOptions}
                      isColumnOptionsLoading={edgeModelQuery.isLoading}
                      onChange={(outputFields) => setForm((current) => {
                        if (!current) return current;
                        const removedColumns = current.outputFields.filter((name) => !outputFields.includes(name));
                        const nextEnrichments = current.enrichments.filter((enrichment) => (
                          !removedColumns.some((columnName) => (
                            enrichment.sourceField === columnName
                            || edgeModelQuery.data?.columns.some((column) => (
                              column.name === columnName
                              && (enrichment.sourceField === column.field || enrichment.sourceField === column.name)
                            ))
                          ))
                        ));
                        return { ...current, outputFields, enrichments: nextEnrichments };
                      })}
                      onEnrichmentsChange={(enrichments) => setForm((current) => (
                        current ? { ...current, enrichments } : current
                      ))}
                    />
                  </div>
                </div>
              </FormSection>
            ) : null}

            {showInputFields ? (
              <FormSection
                title="Input"
                ink={showOutputFields ? 'complement' : 'accent'}
                divided={showOutputFields}
                className="flex min-h-0 flex-1 flex-col"
                hint="Choose which columns callers may send in the request body."
                headerExtra={(
                  <AppButton
                    type="button"
                    intent="secondary"
                    size="sm"
                    disabled={inputColumnOptions.length === 0}
                    onClick={() => setForm((current) => (
                      current
                        ? {
                          ...current,
                          inputFields: allInputSelected
                            ? []
                            : inputColumnOptions.map((column) => ({
                              id: `field-${Math.random().toString(36).slice(2, 9)}`,
                              name: column.name,
                              type: column.suggestedFieldType,
                              required: !column.nullable,
                            })),
                        }
                        : current
                    ))}
                  >
                    {allInputSelected ? 'Clear All' : 'Select All'}
                  </AppButton>
                )}
              >
                <div className={CONFIGURE_API_DIALOG_DATA_HOST_CLASS}>
                  <div className={CONFIGURE_API_DIALOG_DATA_SCROLL_CLASS}>
                    <DataApiInputFieldsToggleEditor
                      embedded
                      fields={form.inputFields}
                      columnOptions={inputColumnOptions}
                      isColumnOptionsLoading={edgeModelQuery.isLoading}
                      onChange={(inputFields) => setForm((current) => (
                        current ? { ...current, inputFields } : current
                      ))}
                    />
                  </div>
                </div>
              </FormSection>
            ) : null}
          </div>
        );
      case 'relations':
        return (
          <DataApiIncludesEditor
            includeConfigs={form.includeConfigs}
            associations={edgeModelQuery.data?.associations ?? []}
            onChange={(includeConfigs) => setForm((current) => (
              current ? { ...current, includeConfigs } : current
            ))}
          />
        );
      case 'computed':
        return (
          <DataApiComputedFieldsEditor
            computedFields={form.computedFields}
            onChange={(computedFields) => setForm((current) => (
              current ? { ...current, computedFields } : current
            ))}
          />
        );
      case 'query':
        return (
          <DataApiQueryOptionsEditor
            queryOptions={form.queryOptions}
            supportsPaging={form.model === 'GET_LIST'}
            presetOptions={form.model === 'GET_LIST' ? queryPresetOptions : []}
            onChange={(queryOptions) => setForm((current) => (
              current ? { ...current, queryOptions } : current
            ))}
          />
        );
      case 'access': {
        const mode = form.accessControl.accessMode ?? 'authenticated';
        const modeLabel = mode === 'public' ? 'Public' : mode === 'specific' ? 'Specific (allow/deny lists)' : 'Logged in users';
        const entryCount = form.accessControl.allowRoles.length
          + form.accessControl.allowUsers.length
          + form.accessControl.denyRoles.length
          + form.accessControl.denyUsers.length;
        return (
          <FormSection
            title="Access"
            ink="contrast"
            hint="Who can call this API once it's published — same contract as Server Functions."
          >
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">{modeLabel}</p>
                {mode === 'specific' ? (
                  <p className="text-[11px] text-slate-500">{entryCount} allow/deny entr{entryCount === 1 ? 'y' : 'ies'} configured</p>
                ) : null}
              </div>
              <AppButton type="button" intent="secondary" size="sm" onClick={() => setAccessModalOpen(true)}>
                Edit Access
              </AppButton>
            </div>
          </FormSection>
        );
      }
      case 'runtime':
        return (
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            <FormSection title="Runtime" ink="accent" hint="Timeout and logging — inherits global Server Functions settings by default.">
              <div className="flex flex-col gap-4">
                <UiCheckboxChoice
                  id="dataApiUseGlobalConfig"
                  checked={form.runtime.useGlobalConfig}
                  onChange={(checked) => setForm((current) => (
                    current ? { ...current, runtime: { ...current.runtime, useGlobalConfig: checked } } : current
                  ))}
                >
                  Inherit global defaults
                </UiCheckboxChoice>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-[2px]">
                    <label className="text-[10px] text-slate-500 font-mono">Timeout</label>
                    <UiSelect
                      value={form.runtime.timeoutMs ?? RUNTIME_TIMEOUT_OPTIONS[0]}
                      disabled={form.runtime.useGlobalConfig}
                      onChange={(event) => setForm((current) => (
                        current ? { ...current, runtime: { ...current.runtime, timeoutMs: Number(event.target.value) } } : current
                      ))}
                      className="w-full text-[11px] h-8 px-2 border border-slate-200 rounded-lg cursor-pointer bg-white font-semibold text-slate-800 outline-none disabled:opacity-30 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    >
                      {RUNTIME_TIMEOUT_OPTIONS.map((value) => (
                        <option key={value} value={value}>{value} ms</option>
                      ))}
                    </UiSelect>
                  </div>
                </div>

                <UiCheckboxChoice
                  id="dataApiEnableLogs"
                  checked={form.runtime.enableLogs ?? false}
                  onChange={(checked) => setForm((current) => (
                    current ? { ...current, runtime: { ...current.runtime, enableLogs: checked } } : current
                  ))}
                >
                  Log requests to this API
                </UiCheckboxChoice>
              </div>
            </FormSection>

            <FormSection
              title="Client context"
              ink="accent"
              divided
              hint="Per-field metadata stored on record events. Require applies to write operations only. IP is always observed from the server."
            >
              <div className="flex flex-col gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Server-observed — higher confidence
                </p>
                {CLIENT_CONTEXT_CATALOG.filter((entry) => entry.source === 'observed').map((entry) => {
                  const current = (form.clientContextFields ?? []).find((field) => field.id === entry.id)?.mode ?? 'off';
                  const disabled = entry.id === 'geoipCountry';
                  return (
                    <FormField key={`observed-${entry.id}`} label={entry.label}>
                      <UiSelect
                        size="sm"
                        ariaLabel={`${entry.label} client context mode`}
                        value={current}
                        disabled={disabled}
                        onChange={(event) => {
                          const mode = String(event.target.value) as ClientContextMode;
                          setForm((currentForm) => {
                            if (!currentForm) return currentForm;
                            const rest = (currentForm.clientContextFields ?? []).filter((field) => field.id !== entry.id);
                            return {
                              ...currentForm,
                              clientContextFields: mode === 'off' ? rest : [...rest, { id: entry.id, mode }],
                            };
                          });
                        }}
                      >
                        <option value="off">Off</option>
                        <option value="record">Record</option>
                      </UiSelect>
                    </FormField>
                  );
                })}
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Client-claimed — spoofable
                </p>
                {CLIENT_CONTEXT_CATALOG.filter((entry) => entry.source === 'claimed').map((entry) => {
                  const current = (form.clientContextFields ?? []).find((field) => field.id === entry.id)?.mode ?? 'off';
                  return (
                    <FormField key={`claimed-${entry.id}`} label={entry.label}>
                      <UiSelect
                        size="sm"
                        ariaLabel={`${entry.label} client context mode`}
                        value={current}
                        onChange={(event) => {
                          const mode = String(event.target.value) as ClientContextMode;
                          setForm((currentForm) => {
                            if (!currentForm) return currentForm;
                            const rest = (currentForm.clientContextFields ?? []).filter((field) => field.id !== entry.id);
                            return {
                              ...currentForm,
                              clientContextFields: mode === 'off' ? rest : [...rest, { id: entry.id, mode }],
                            };
                          });
                        }}
                      >
                        <option value="off">Off</option>
                        <option value="record">Record</option>
                        <option value="require">Require</option>
                      </UiSelect>
                    </FormField>
                  );
                })}
                {(form.clientContextFields ?? []).some((field) => field.id === 'location' && field.mode === 'require') ? (
                  <p className="text-xs text-amber-700">
                    Requiring location on a generic CRUD API will prompt for GPS on every Save and reject clients that deny permission.
                  </p>
                ) : null}
              </div>
            </FormSection>

            {form.model === 'PUT' || form.model === 'PATCH' || form.model === 'DELETE' ? (
            <FormSection
              title="Change reason"
              ink="contrast"
              divided
              hint="Ask for a reason on update, patch, and delete. Not on list, get, or create. Ask without Track stores nothing."
            >
              <div className="grid w-full min-w-0 grid-cols-2 gap-3">
                <ChangeReasonPolicyFields
                  value={form.changeReason}
                  folderOwnerKey={target.definitionId
                    ? changeReasonFolderOwnerKeyForDataApi(target.definitionId)
                    : changeReasonFolderOwnerKeyForDataApiDraft(target.edgeModelId, form.apiName)}
                  folderTitle={form.apiName.trim() ? `Data API ${form.apiName.trim()}` : 'Data API'}
                  onChange={(patch) => setForm((current) => (
                    current ? { ...current, changeReason: { ...current.changeReason, ...patch } } : current
                  ))}
                />
              </div>
            </FormSection>
            ) : null}

            <FormSection
              title="Scope"
              ink="contrast"
              divided
              hint="Record Policies on the model filter every query. Use the model default, skip scope, or pick a specific policy for this API only."
            >
              <div className="flex flex-col gap-2">
                <UiSelect
                  size="sm"
                  ariaLabel="Record scope mode"
                  value={form.recordScopeMode}
                  onChange={(event) => {
                    const nextMode = String(event.target.value);
                    setForm((current) => {
                      if (!current) {
                        return current;
                      }
                      if (nextMode === 'bypass' || nextMode === 'policy' || nextMode === 'default') {
                        return {
                          ...current,
                          recordScopeMode: nextMode,
                          bypassRecordPolicy: nextMode === 'bypass',
                        };
                      }
                      return current;
                    });
                  }}
                >
                  <option value="default">Model default (active policy)</option>
                  <option value="policy">Specific policy</option>
                  <option value="bypass">Skip record scope</option>
                </UiSelect>
                {form.recordScopeMode === 'policy' ? (
                  <UiSelect
                    size="sm"
                    ariaLabel="Record policy"
                    value={form.recordPolicyId}
                    onChange={(event) => setForm((current) => (
                      current ? { ...current, recordPolicyId: String(event.target.value) } : current
                    ))}
                  >
                    <option value="">Select a policy…</option>
                    {(recordPoliciesQuery.data ?? []).map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.name}
                        {policy.enabled ? ' (active)' : ''}
                      </option>
                    ))}
                  </UiSelect>
                ) : null}
              </div>
            </FormSection>

            <FunctionCacheConfig
              targetFn={{
                method: 'GET',
                cacheEnabled: form.runtime.cacheEnabled,
                cacheTtlMs: form.runtime.cacheTtlMs,
                cacheByParam: form.runtime.cacheByParam,
                cacheByUser: form.runtime.cacheByUser,
              }}
              updateTarget={({ method: _method, ...cacheUpdates }) => setForm((current) => (
                current ? { ...current, runtime: { ...current.runtime, ...cacheUpdates } } : current
              ))}
            />
          </div>
        );
      case 'hooks': {
        const hooks = form.runtime.hooks ?? {};
        const beforeConfigured = Boolean(hooks.before);
        const afterConfigured = Boolean(hooks.after);
        return (
          <FormSection
            title="Hooks"
            ink="contrast"
            hint="Fire-and-forget workflow triggers before/after this API executes."
          >
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  {beforeConfigured || afterConfigured
                    ? [
                      beforeConfigured ? 'Before' : null,
                      afterConfigured ? 'After' : null,
                    ].filter(Boolean).join(' · ')
                    : 'No hooks configured'}
                </p>
              </div>
              <AppButton type="button" intent="secondary" size="sm" onClick={() => setHooksModalOpen(true)}>
                Edit Hooks
              </AppButton>
            </div>
          </FormSection>
        );
      }
      case 'test': {
        const editingOperation = editingDefinition
          ? (target.operationId
            ? editingDefinition.operations.find((item) => item.id === target.operationId)
            : editingDefinition.operations[0])
          : null;
        return editingDefinition && editingOperation ? (
          <DataApiOperationTestPanel
            definitionId={editingDefinition.id}
            method={editingOperation.method}
            path={editingOperation.pathPattern}
          />
        ) : null;
      }
      default:
        return null;
    }
  };

  const dialogTitle = mode === 'edit' ? 'Design API' : 'Create API';
  const publishLabel = mode === 'edit' ? 'Save & publish' : 'Create API';
  const PublishIcon = mode === 'edit' ? Settings2 : Plus;
  const canTestOperation = mode === 'edit' && Boolean(editingDefinition) && Boolean(
    target.operationId
      ? editingDefinition?.operations.some((item) => item.id === target.operationId)
      : editingDefinition?.operations.length,
  );
  const visibleConfigTabs = CONFIG_TABS.filter((tab) => {
    if (tab.id === 'test') {
      return canTestOperation;
    }
    return isReadOperation || !['relations', 'computed', 'query'].includes(tab.id);
  });

  return (
    <>
    <CreateEditModalShell
      size={isMaximized ? 'maximized' : '5xl'}
      gradient={false}
      shellClassName={cn(
        CONFIGURE_API_DIALOG_SHELL_CLASS,
        !isMaximized && 'h-[min(88vh,56rem)]',
      )}
      title={(
        <span className="inline-flex items-center gap-2">
          {mode === 'edit' ? <Settings2 className="h-4 w-4" /> : <Route className="h-4 w-4" />}
          {dialogTitle}
        </span>
      )}
      subtitle={contextHeaderBand}
      subtitleTone="shell"
      subtitleClassName="!py-2"
      metaBand={apiNameHeaderBand}
      metaBandTone="elevated"
      metaBandClassName="!pt-3.5 !pb-3"
      onClose={isSubmitting ? () => undefined : onClose}
      onBackdropClick={isSubmitting ? () => undefined : onClose}
      closeOnEscape={!isSubmitting}
      showCloseButton={!isSubmitting}
      headerExtra={(
        <AppButton
          closeIcon
          size="icon-sm"
          aria-label={isMaximized ? 'Restore dialog size' : 'Maximize dialog'}
          title={isMaximized ? 'Restore size' : 'Maximize'}
          disabled={isSubmitting}
          onClick={() => setIsMaximized((value) => !value)}
        >
          {isMaximized ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </AppButton>
      )}
      bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      bodyClassName={CONFIGURE_API_DIALOG_BODY_CLASS}
      footerClassName="!mt-0"
      footer={(
        <>
          <AppButton intent="cancel" disabled={isSubmitting} onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent={mode === 'edit' ? 'primary' : 'create'}
            disabled={!canPublish}
            onClick={() => { void handlePublish(); }}
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PublishIcon className="h-3.5 w-3.5" />
            )}
            {publishLabel}
          </AppButton>
        </>
      )}
    >
      <div className={CONFIGURE_API_DIALOG_COLUMNS_CLASS}>
        <aside className={CONFIGURE_API_DIALOG_SIDEBAR_CLASS}>
          <div>
            <span className="ps-[3px] text-[10px] font-semibold text-slate-600">API model</span>
            <div className="mt-[2px] flex flex-col gap-2 ps-[3px]" role="radiogroup" aria-label="API model">
              {modelOptions.map((option) => {
                const selected = form.model === option;
                const httpMethod = resolveComposerHttpMethod(option);
                const methodTheme = METHOD_THEME[httpMethod];

                return (
                  <AppButton
                    key={option}
                    type="button"
                    intent="cancel"
                    size="sm"
                    className={cn(
                      'w-full justify-between gap-2 font-semibold',
                      selected && API_MODEL_SELECTED_BUTTON_CLASS[httpMethod],
                    )}
                    aria-pressed={selected}
                    aria-label={`${capitalizeModelUsageLabel(getComposerOptionUsageLabel(option, target.objectType))} ${httpMethod}`}
                    onClick={() => handleModelChange(option)}
                  >
                    <span className="min-w-0 truncate text-left">
                      {capitalizeModelUsageLabel(getComposerOptionUsageLabel(option, target.objectType))}
                    </span>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center justify-center rounded-full border px-1.5 py-0.5 text-center font-mono text-[9px] font-bold leading-none',
                        METHOD_BADGE_WIDTH_CLASS,
                        selected ? methodTheme.innerActive : methodTheme.badge,
                      )}
                    >
                      {httpMethod}
                    </span>
                  </AppButton>
                );
              })}
            </div>
          </div>
        </aside>

        <div className={cn(CONFIGURE_API_DIALOG_MAIN_CLASS, 'p-4')}>
          <div className={CONFIGURE_API_DIALOG_TABS_ROW_CLASS} role="tablist" aria-label="API configuration">
            {visibleConfigTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={cn(
                  CONFIGURE_API_DIALOG_TAB_BUTTON_CLASS,
                  activeTab === tab.id && CONFIGURE_API_DIALOG_TAB_BUTTON_ACTIVE_CLASS,
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={CONFIGURE_API_DIALOG_TAB_PANEL_CLASS} role="tabpanel">
            {renderTabContent()}
            {error ? <p className="shrink-0 pt-2 text-xs font-semibold text-rose-600">{error}</p> : null}
          </div>
        </div>
      </div>
    </CreateEditModalShell>

    {isAccessModalOpen ? (
      <AccessControlModal
        open
        titlePath={pathPreview}
        accessControl={form.accessControl}
        onClose={() => setAccessModalOpen(false)}
        onChange={(accessControl) => setForm((current) => (
          current ? { ...current, accessControl } : current
        ))}
        onSave={() => setAccessModalOpen(false)}
      />
    ) : null}

    {isHooksModalOpen ? (
      <ServerFunctionHooksModal
        open
        titlePath={pathPreview}
        hooks={form.runtime.hooks ?? {}}
        onClose={() => setHooksModalOpen(false)}
        onChange={(hooks) => setForm((current) => (
          current ? { ...current, runtime: { ...current.runtime, hooks } } : current
        ))}
        onSave={() => setHooksModalOpen(false)}
      />
    ) : null}
    </>
  );
};
