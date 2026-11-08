import * as React from 'react';
import { Info, Plus, Trash2 } from 'lucide-react';
import type {
  DesignerAction,
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerDynamicAction,
  DesignerNode,
} from '../../../domain/component-designer/types';
import {
  createDynamicActionsEventBindingDefinition,
  createEventBindingDefinition,
  DESIGNER_EVENT_BINDING_LABELS,
  eventBindingKeyForEvent,
  getNodeEventBinding,
  resolveBindingRequestHeaders,
  resolveBindingUrlParams,
  type DesignerEventBindingTarget,
} from '../../../domain/component-designer/bindingEngine';
import {
  createDynamicAction,
  sanitizeTrueActions,
} from '../../../domain/component-designer/bindingDynamicActionsEngine';
import {
  createRegionSubmitEventBindingDefinition,
  isRegionSubmitBindingDefinition,
  resolveDataRegionForSubmit,
} from '../../../domain/component-designer/bindingRegionEngine';
import {
  resolveDataSourceOperationEndpoint,
  type DesignerDataResourceCrudKey,
} from '../../../domain/component-designer/bindingResourceModel';
import {
  buildRegionSubmitRequestPreview,
  type RequestPreviewSummary,
} from '../../../domain/component-designer/bindingPayloadPreview';
import { AppButton } from '../../../shared/ui/AppButton';
import { UiInput, UiSelect } from '../../../shared/ui';
import { ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_DELETE_CLASS } from '../../../shared/ui/surfaceClasses';
import { cn } from '../../../lib/utils';
import { BindingRequestPreview } from './BindingRequestPreview';
import { DesignerFieldRow } from './DesignerFieldRow';
import { InspectorBindingRequestConfig } from './InspectorBindingRequestConfig';
import { InspectorDynamicActionsField } from './InspectorDynamicActionsField';
import { preventInspectorDetailsToggle } from './inspectorDetailsGuard';
import {
  INSPECTOR_TEXT_2XS,
  INSPECTOR_TEXT_SM,
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';

type InspectorEventBindingPanelProps = {
  node: DesignerNode;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  targetEvent: DesignerEventBindingTarget;
  dispatch: React.Dispatch<DesignerAction>;
};

const ACTION_OPTIONS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

type ActionMode = 'none' | 'regionSubmit' | 'refreshDataSource' | 'dynamicActions' | 'manual';

type BuilderTier = 'simple' | 'guided' | 'advanced';

const GUIDED_OPERATIONS: DesignerDataResourceCrudKey[] = ['create', 'update', 'delete', 'list', 'detail'];

type PayloadEntry = {
  id: string;
  key: string;
  value: string;
};

const createPayloadEntry = (key = '', value = ''): PayloadEntry => ({
  id: `payload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  key,
  value,
});

const payloadRecordToEntries = (payloadMapping: Record<string, string> | undefined): PayloadEntry[] => {
  const entries = Object.entries(payloadMapping ?? {}).map(([key, value]) => createPayloadEntry(key, value));
  return entries.length > 0 ? entries : [createPayloadEntry()];
};

const payloadEntriesToRecord = (entries: PayloadEntry[]): Record<string, string> =>
  Object.fromEntries(
    entries
      .filter((entry) => entry.key.trim().length > 0 && entry.value.trim().length > 0)
      .map((entry) => [entry.key.trim(), entry.value.trim()]),
  );

const isRefreshDataSourceBinding = (definition: { trueActions?: DesignerDynamicAction[] } | undefined): boolean => {
  const actions = sanitizeTrueActions(definition?.trueActions);
  return actions.length === 1 && actions[0]?.type === 'refreshDataSource';
};

/** Native HTML popover — escapes Properties panel overflow; shows request preview on demand. */
const RegionSubmitPreviewInfo: React.FC<{ summary: RequestPreviewSummary | null }> = ({ summary }) => {
  const reactId = React.useId();
  const popoverId = `region-submit-preview-${reactId.replace(/:/g, '')}`;
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const positionPanel = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(288, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      let top = rect.bottom + 6;
      panel.style.width = `${width}px`;
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.margin = '0';
      // Flip above the trigger when the panel would overflow the viewport bottom.
      requestAnimationFrame(() => {
        const panelRect = panel.getBoundingClientRect();
        if (panelRect.bottom > window.innerHeight - 8) {
          top = Math.max(8, rect.top - panelRect.height - 6);
          panel.style.top = `${top}px`;
        }
      });
    };

    const onToggle = (event: Event) => {
      const toggleEvent = event as ToggleEvent;
      const nextOpen = toggleEvent.newState === 'open';
      setOpen(nextOpen);
      if (nextOpen) {
        positionPanel();
      }
    };

    panel.addEventListener('toggle', onToggle);
    return () => panel.removeEventListener('toggle', onToggle);
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={popoverId}
        className={cn(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
          'text-slate-400 transition-colors',
          'hover:bg-emerald-50 hover:text-emerald-700',
          open && 'bg-emerald-50 text-emerald-700',
        )}
        aria-label="Request preview"
        title="Request preview"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <Info className="h-3 w-3" strokeWidth={2.25} aria-hidden />
      </button>
      <div
        ref={panelRef}
        id={popoverId}
        popover="auto"
        className={cn(
          'fixed z-[9999] max-h-[min(24rem,calc(100dvh-2rem))] overflow-auto',
          'rounded-md border border-emerald-200 bg-white p-2.5 shadow-lg',
        )}
      >
        <p className={`${INSPECTOR_TEXT_SM} text-emerald-800`}>
          Payload and API call are built automatically from record-field bindings in the parent context.
        </p>
        <div className="mt-2">
          <BindingRequestPreview summary={summary} />
        </div>
      </div>
    </>
  );
};

const resolveInitialActionMode = (node: DesignerNode, targetEvent: DesignerEventBindingTarget): ActionMode => {
  const rawDefinition = node.binding[eventBindingKeyForEvent(targetEvent)];
  if (!rawDefinition) {
    return 'none';
  }

  if (isRegionSubmitBindingDefinition(rawDefinition)) {
    return 'regionSubmit';
  }

  if (isRefreshDataSourceBinding(rawDefinition)) {
    return 'refreshDataSource';
  }

  if (sanitizeTrueActions(rawDefinition.trueActions).length > 0) {
    return 'dynamicActions';
  }

  const endpoint = rawDefinition.endpoint ?? rawDefinition.endpointRef;
  const storeWritePath = rawDefinition.storeWritePath?.trim();
  if (endpoint || storeWritePath) {
    return 'manual';
  }

  return 'none';
};

const resolveInitialBuilderTier = (node: DesignerNode, targetEvent: DesignerEventBindingTarget): BuilderTier => {
  const mode = resolveInitialActionMode(node, targetEvent);
  if (mode === 'manual') {
    return 'advanced';
  }
  return 'simple';
};

export const InspectorEventBindingPanel: React.FC<InspectorEventBindingPanelProps> = ({
  node,
  document,
  bindingDefinitions,
  targetEvent,
  dispatch,
}) => {
  const bindingKey = eventBindingKeyForEvent(targetEvent);
  const existing = getNodeEventBinding(node, targetEvent);
  const rawDefinition = node.binding[bindingKey];
  const regionContext = React.useMemo(() => resolveDataRegionForSubmit(document, node.id), [document, node.id]);
  const regionSubmitEligible = Boolean(regionContext) && (targetEvent === 'onClick' || targetEvent === 'onSubmit');
  const dataSourceOptions = React.useMemo(
    () => Object.values(bindingDefinitions.dataSources),
    [bindingDefinitions.dataSources],
  );

  const [actionMode, setActionMode] = React.useState<ActionMode>(() => resolveInitialActionMode(node, targetEvent));
  const [builderTier, setBuilderTier] = React.useState<BuilderTier>(() => resolveInitialBuilderTier(node, targetEvent));
  const [guidedResourceRef, setGuidedResourceRef] = React.useState(() => {
    const ref = existing?.definition.dataSourceRef ?? dataSourceOptions[0]?.id ?? '';
    return typeof ref === 'string' ? ref : '';
  });
  const [guidedOperation, setGuidedOperation] = React.useState<DesignerDataResourceCrudKey>('create');
  const [endpoint, setEndpoint] = React.useState(
    existing?.definition.endpoint ?? existing?.definition.endpointRef ?? '',
  );
  const [actionType, setActionType] = React.useState(existing?.definition.actionType ?? 'POST');
  const [payloadEntries, setPayloadEntries] = React.useState<PayloadEntry[]>(() =>
    payloadRecordToEntries(existing?.definition.payloadMapping),
  );
  const [urlParams, setUrlParams] = React.useState<Record<string, string>>(() =>
    existing ? resolveBindingUrlParams(existing.definition) : {},
  );
  const [headers, setHeaders] = React.useState<Record<string, string>>(() =>
    existing ? resolveBindingRequestHeaders(existing.definition) : {},
  );
  const [storeWritePath, setStoreWritePath] = React.useState(
    existing?.definition.storeWritePath ?? rawDefinition?.storeWritePath ?? '',
  );
  const [trueActions, setTrueActions] = React.useState<DesignerDynamicAction[]>(() =>
    sanitizeTrueActions(rawDefinition?.trueActions),
  );
  const [refreshDataSourceRef, setRefreshDataSourceRef] = React.useState(() => {
    const actions = sanitizeTrueActions(rawDefinition?.trueActions);
    return actions[0]?.type === 'refreshDataSource' ? (actions[0]?.dataSourceRef ?? '') : '';
  });

  React.useEffect(() => {
    const next = getNodeEventBinding(node, targetEvent);
    const nextRawDefinition = node.binding[bindingKey];
    setActionMode(resolveInitialActionMode(node, targetEvent));
    setBuilderTier(resolveInitialBuilderTier(node, targetEvent));
    setTrueActions(sanitizeTrueActions(nextRawDefinition?.trueActions ?? next?.definition.trueActions));
    const refreshActions = sanitizeTrueActions(nextRawDefinition?.trueActions);
    setRefreshDataSourceRef(
      refreshActions[0]?.type === 'refreshDataSource' ? (refreshActions[0]?.dataSourceRef ?? '') : '',
    );
    setEndpoint(
      next?.definition.endpoint ??
        next?.definition.endpointRef ??
        nextRawDefinition?.endpoint ??
        nextRawDefinition?.endpointRef ??
        '',
    );
    setActionType(next?.definition.actionType ?? nextRawDefinition?.actionType ?? 'POST');
    setPayloadEntries(payloadRecordToEntries(next?.definition.payloadMapping ?? nextRawDefinition?.payloadMapping));
    setUrlParams(
      next
        ? resolveBindingUrlParams(next.definition)
        : resolveBindingUrlParams(nextRawDefinition ?? { sourceType: 'static' }),
    );
    setHeaders(
      next
        ? resolveBindingRequestHeaders(next.definition)
        : resolveBindingRequestHeaders(nextRawDefinition ?? { sourceType: 'static' }),
    );
    setStoreWritePath(next?.definition.storeWritePath ?? nextRawDefinition?.storeWritePath ?? '');
  }, [bindingKey, node, targetEvent]);

  const clearBinding = () => {
    dispatch({ type: 'remove-node-binding', nodeId: node.id, bindingKey });
  };

  const commitDynamicActions = (nextActions: DesignerDynamicAction[]) => {
    setTrueActions(nextActions);
    if (nextActions.length === 0) {
      clearBinding();
      return;
    }

    dispatch({
      type: 'set-node-binding',
      nodeId: node.id,
      bindingKey,
      definition: createDynamicActionsEventBindingDefinition(targetEvent, nextActions),
    });
  };

  const commitRefreshDataSource = (dataSourceRef: string) => {
    const trimmed = dataSourceRef.trim();
    setRefreshDataSourceRef(trimmed);
    if (!trimmed) {
      clearBinding();
      return;
    }

    const action = createDynamicAction('refreshDataSource');
    action.dataSourceRef = trimmed;
    dispatch({
      type: 'set-node-binding',
      nodeId: node.id,
      bindingKey,
      definition: createDynamicActionsEventBindingDefinition(targetEvent, [action]),
    });
  };

  const commitRegionSubmit = (nextStoreWritePath = storeWritePath) => {
    const trimmedStoreWritePath = nextStoreWritePath.trim();
    // Bug found (parity audit item 34): rebuilding via createRegionSubmitEventBindingDefinition()
    // without args always wiped trueActions/invalidateQueries (the wizard success chain). Preserve
    // the current definition and only override storeWritePath.
    const currentDefinition =
      node.binding[bindingKey] ??
      existing?.definition ??
      rawDefinition ??
      createRegionSubmitEventBindingDefinition(targetEvent);
    dispatch({
      type: 'set-node-binding',
      nodeId: node.id,
      bindingKey,
      definition: {
        ...currentDefinition,
        sourceType: currentDefinition.sourceType ?? 'apiRef',
        bindingRole: 'event',
        targetEvent,
        regionSubmit: true,
        storeWritePath: trimmedStoreWritePath.length > 0 ? trimmedStoreWritePath : undefined,
      },
    });
  };

  const commitManual = (
    nextEndpoint: string,
    nextActionType: (typeof ACTION_OPTIONS)[number],
    nextPayloadEntries: PayloadEntry[],
    nextUrlParams: Record<string, string>,
    nextHeaders: Record<string, string>,
    nextStoreWritePath: string,
  ) => {
    const trimmedEndpoint = nextEndpoint.trim();
    const trimmedStoreWritePath = nextStoreWritePath.trim();

    if (trimmedEndpoint.length === 0 && trimmedStoreWritePath.length === 0) {
      clearBinding();
      return;
    }

    if (trimmedEndpoint.length === 0) {
      dispatch({
        type: 'set-node-binding',
        nodeId: node.id,
        bindingKey,
        definition: {
          sourceType: 'store',
          bindingRole: 'event',
          targetEvent,
          storeWritePath: trimmedStoreWritePath,
        },
      });
      return;
    }

    dispatch({
      type: 'set-node-binding',
      nodeId: node.id,
      bindingKey,
      definition: createEventBindingDefinition(
        targetEvent,
        trimmedEndpoint,
        nextActionType,
        payloadEntriesToRecord(nextPayloadEntries),
        {
          urlParams: nextUrlParams,
          headers: nextHeaders,
          storeWritePath: trimmedStoreWritePath.length > 0 ? trimmedStoreWritePath : undefined,
        },
      ),
    });
  };

  const updatePayloadEntries = (nextEntries: PayloadEntry[]) => {
    setPayloadEntries(nextEntries);
    if (actionMode === 'manual' && (endpoint.trim().length > 0 || storeWritePath.trim().length > 0)) {
      commitManual(endpoint, actionType, nextEntries, urlParams, headers, storeWritePath);
    }
  };

  const handleActionModeChange = (nextMode: ActionMode) => {
    setActionMode(nextMode);

    if (nextMode === 'none') {
      clearBinding();
      return;
    }

    if (nextMode === 'regionSubmit') {
      commitRegionSubmit();
      return;
    }

    if (nextMode === 'refreshDataSource') {
      commitRefreshDataSource(refreshDataSourceRef || dataSourceOptions[0]?.id || '');
      return;
    }

    if (nextMode === 'dynamicActions') {
      const nonRefreshActions = trueActions.filter((action) => action.type !== 'refreshDataSource');
      commitDynamicActions(nonRefreshActions);
      return;
    }

    commitManual(endpoint, actionType, payloadEntries, urlParams, headers, storeWritePath);
  };

  const commitGuidedOperation = (resourceRef: string, operation: DesignerDataResourceCrudKey) => {
    const trimmedRef = resourceRef.trim();
    const dataSource = trimmedRef ? bindingDefinitions.dataSources[trimmedRef] : undefined;
    if (!dataSource) {
      clearBinding();
      return;
    }

    if (operation === 'list' || operation === 'detail') {
      setActionMode('refreshDataSource');
      commitRefreshDataSource(trimmedRef);
      return;
    }

    const nextEndpoint = resolveDataSourceOperationEndpoint(dataSource, operation);
    const nextMethod = operation === 'create' ? 'POST' : operation === 'update' ? 'PUT' : 'DELETE';

    setActionMode('manual');
    setEndpoint(nextEndpoint);
    setActionType(nextMethod);
    commitManual(nextEndpoint, nextMethod, payloadEntries, urlParams, headers, storeWritePath);
  };

  const handleBuilderTierChange = (nextTier: BuilderTier) => {
    setBuilderTier(nextTier);

    if (nextTier === 'simple') {
      if (actionMode === 'manual') {
        handleActionModeChange(regionSubmitEligible ? 'regionSubmit' : 'none');
      }
      return;
    }

    if (nextTier === 'guided') {
      commitGuidedOperation(guidedResourceRef, guidedOperation);
      return;
    }

    if (actionMode !== 'manual') {
      handleActionModeChange('manual');
    }
  };

  const regionSubmitPreview = regionContext
    ? buildRegionSubmitRequestPreview(document, bindingDefinitions, regionContext.regionNode.id, 'createEdit')
    : null;

  return (
    <div className="space-y-3" {...preventInspectorDetailsToggle}>
      <p className={`ps-[4px] ${INSPECTOR_TEXT_XS} font-bold uppercase tracking-wider text-slate-700`}>
        {DESIGNER_EVENT_BINDING_LABELS[targetEvent]}
      </p>

      <DesignerFieldRow label="Builder">
        <UiSelect
          size="sm"
          className="w-full"
          value={builderTier}
          onChange={(event) => handleBuilderTierChange(event.target.value as BuilderTier)}
        >
          <option value="simple">Simple (presets)</option>
          <option value="guided">Guided (resource + operation)</option>
          <option value="advanced">Advanced (manual API)</option>
        </UiSelect>
      </DesignerFieldRow>

      {builderTier === 'guided' ? (
        <div className="space-y-2 rounded-md border border-indigo-200 bg-indigo-50/50 p-2.5">
          <DesignerFieldRow label="Resource">
            <UiSelect
              size="sm"
              className="w-full"
              value={guidedResourceRef}
              onChange={(event) => {
                const nextRef = event.target.value;
                setGuidedResourceRef(nextRef);
                commitGuidedOperation(nextRef, guidedOperation);
              }}
            >
              <option value="">Select resource…</option>
              {dataSourceOptions.map((dataSource) => (
                <option key={dataSource.id} value={dataSource.id}>
                  {dataSource.name}
                </option>
              ))}
            </UiSelect>
          </DesignerFieldRow>
          <DesignerFieldRow label="Operation">
            <UiSelect
              size="sm"
              className="w-full"
              value={guidedOperation}
              onChange={(event) => {
                const nextOperation = event.target.value as DesignerDataResourceCrudKey;
                setGuidedOperation(nextOperation);
                commitGuidedOperation(guidedResourceRef, nextOperation);
              }}
            >
              {GUIDED_OPERATIONS.map((operation) => (
                <option key={operation} value={operation}>
                  {operation}
                </option>
              ))}
            </UiSelect>
          </DesignerFieldRow>
          {guidedResourceRef ? (
            <p className={`ps-[4px] font-mono ${INSPECTOR_TEXT_2XS} text-indigo-800`}>
              {resolveDataSourceOperationEndpoint(bindingDefinitions.dataSources[guidedResourceRef], guidedOperation)}
            </p>
          ) : null}
        </div>
      ) : null}

      {builderTier !== 'guided' ? (
        <DesignerFieldRow
          label="Action"
          labelExtra={
            actionMode === 'regionSubmit'
              ? <RegionSubmitPreviewInfo summary={regionSubmitPreview} />
              : null
          }
        >
          <UiSelect
            size="sm"
            className="w-full"
            value={actionMode}
            onChange={(event) => handleActionModeChange(event.target.value as ActionMode)}
          >
            <option value="none">No action</option>
            {regionSubmitEligible ? <option value="regionSubmit">Submit this form / record</option> : null}
            <option value="refreshDataSource">Refresh data</option>
            <option value="dynamicActions">Dynamic actions (show/hide, set value…)</option>
            {builderTier === 'advanced' ? <option value="manual">Call API (advanced)</option> : null}
          </UiSelect>
        </DesignerFieldRow>
      ) : null}

      {actionMode === 'regionSubmit' ? (
        <DesignerFieldRow label="Store Write Path">
          <UiInput
            size="sm"
            className="w-full"
            placeholder="selection.submitted (optional)"
            value={storeWritePath}
            onChange={(event) => {
              const nextValue = event.target.value;
              setStoreWritePath(nextValue);
              commitRegionSubmit(nextValue);
            }}
          />
        </DesignerFieldRow>
      ) : null}

      {actionMode === 'refreshDataSource' ? (
        <div className={`space-y-2 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2.5`}>
          <DesignerFieldRow label="Resource">
            <UiSelect
              size="sm"
              nested
              className="w-full"
              value={refreshDataSourceRef}
              onChange={(event) => commitRefreshDataSource(event.target.value)}
            >
              <option value="">Select resource…</option>
              {dataSourceOptions.map((dataSource) => (
                <option key={dataSource.id} value={dataSource.id}>
                  {dataSource.name}
                </option>
              ))}
            </UiSelect>
          </DesignerFieldRow>
          {dataSourceOptions.length === 0 ? (
            <p className={`ps-[4px] ${INSPECTOR_TEXT_XS} text-slate-500`}>Add a resource under Data Resources first.</p>
          ) : null}
        </div>
      ) : null}

      {actionMode === 'dynamicActions' ? (
        <InspectorDynamicActionsField
          document={document}
          bindingDefinitions={bindingDefinitions}
          trueActions={trueActions.filter((action) => action.type !== 'refreshDataSource')}
          onChange={commitDynamicActions}
        />
      ) : null}

      {actionMode === 'manual' && builderTier === 'advanced' ? (
        <>
          <DesignerFieldRow label="Store Write Path">
            <UiInput
              size="sm"
              className="w-full"
              placeholder="selection.countryId (optional)"
              value={storeWritePath}
              onChange={(event) => {
                const nextValue = event.target.value;
                setStoreWritePath(nextValue);
                commitManual(endpoint, actionType, payloadEntries, urlParams, headers, nextValue);
              }}
            />
          </DesignerFieldRow>

          <DesignerFieldRow label="Method">
            <UiSelect
              size="sm"
              className="w-full"
              value={actionType}
              onChange={(event) => {
                const nextValue = event.target.value as (typeof ACTION_OPTIONS)[number];
                setActionType(nextValue);
                commitManual(endpoint, nextValue, payloadEntries, urlParams, headers, storeWritePath);
              }}
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </UiSelect>
          </DesignerFieldRow>

          <DesignerFieldRow label="Endpoint">
            <UiInput
              size="sm"
              className="w-full"
              placeholder="/api/v1/users/{userId}"
              value={endpoint}
              onChange={(event) => {
                const nextValue = event.target.value;
                setEndpoint(nextValue);
                commitManual(nextValue, actionType, payloadEntries, urlParams, headers, storeWritePath);
              }}
            />
          </DesignerFieldRow>

          <InspectorBindingRequestConfig
            endpoint={endpoint}
            urlParams={urlParams}
            headers={headers}
            onUrlParamsChange={(next) => {
              setUrlParams(next);
              if (endpoint.trim().length > 0) {
                commitManual(endpoint, actionType, payloadEntries, next, headers, storeWritePath);
              }
            }}
            onHeadersChange={(next) => {
              setHeaders(next);
              if (endpoint.trim().length > 0) {
                commitManual(endpoint, actionType, payloadEntries, urlParams, next, storeWritePath);
              }
            }}
          />

          {targetEvent === 'onSubmit' ? (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-[2px]">
                  <span className={`ps-[4px] ${INSPECTOR_TEXT_XS} font-semibold text-slate-700`}>Payload Mapping</span>
                  <span className={`ps-[4px] ${INSPECTOR_TEXT_XS} text-slate-500`}>
                    Use dotted paths for nested JSON (e.g. user.profile.email).
                  </span>
                </div>
                <AppButton
                  type="button"
                  intent="secondary"
                  size="sm"
                  className={`h-7 px-2 ${INSPECTOR_TEXT_XS}`}
                  onClick={() => updatePayloadEntries([...payloadEntries, createPayloadEntry()])}
                >
                  <Plus className="mr-1 h-3 w-3" strokeWidth={2} />
                  Add Field
                </AppButton>
              </div>

              <div className="space-y-2">
                {payloadEntries.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px] items-center gap-2">
                    <UiInput
                      size="sm"
                      className="w-full"
                      placeholder="user.profile.email"
                      ariaLabel="Payload API field"
                      value={entry.key}
                      onChange={(event) => {
                        const nextEntries = payloadEntries.map((candidate) =>
                          candidate.id === entry.id ? { ...candidate, key: event.target.value } : candidate,
                        );
                        updatePayloadEntries(nextEntries);
                      }}
                    />
                    <UiInput
                      size="sm"
                      className="w-full"
                      placeholder="form.field"
                      ariaLabel="Payload form field"
                      value={entry.value}
                      onChange={(event) => {
                        const nextEntries = payloadEntries.map((candidate) =>
                          candidate.id === entry.id ? { ...candidate, value: event.target.value } : candidate,
                        );
                        updatePayloadEntries(nextEntries);
                      }}
                    />
                    <AppButton
                      type="button"
                      size="icon-sm"
                      className={`${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_DELETE_CLASS}`}
                      aria-label="Remove payload mapping row"
                      disabled={payloadEntries.length <= 1}
                      onClick={() => {
                        const nextEntries = payloadEntries.filter((candidate) => candidate.id !== entry.id);
                        updatePayloadEntries(nextEntries.length > 0 ? nextEntries : [createPayloadEntry()]);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </AppButton>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
