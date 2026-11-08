import {
  showAppFeedbackToast,
} from '../../shared/ui/appFeedbackToast';
import { patchNestedStoreValue } from './designerPreviewResolvers';
import {
  compileDynamicActionValueExpression,
  resolveMutationRuntimeUrl,
  resolveNavigateTargetTemplate,
  resolveStoreTemplateRecord,
} from './bindingDynamicActionsEngine';
import { isSafeDesignerRuntimeExpression } from './visibilityConditionEngine';
import { resolveChartDataPointClickPayload } from './bindingChartEngine';
import { designerFetch, parseApiErrorMessage } from './bindingMutationRuntime';
import {
  exportDesignerData,
  resolveRegisteredDesignerExportPayload,
} from './designerDataExport';
import type { ResolvedDynamicAction } from './bindingDynamicActionsEngine';
import { resolveWorkflowInputFromStore } from './triggerWorkflowAction';

export type DynamicActionNavigateFn = (to: string, options?: { replace?: boolean }) => void;

export type DynamicActionRuntimeContext = {
  designerStore: Record<string, unknown>;
  /** Prefer a live getter so chained actions see the latest selection after open-modal patches. */
  getDesignerStore?: () => Record<string, unknown>;
  patchStore: (path: string, value: unknown) => void;
  refreshDataSource?: (
    dataSourceRef: string,
    dataVar?: string,
    options?: { notifyOnError?: boolean; bypassServerCache?: boolean },
  ) => Promise<void>;
  /** Injected from React (`useNavigate`) — required for `navigate` actions. */
  navigate?: DynamicActionNavigateFn;
  /** Optional fetch override (tests / custom hosts) for `exportData` xlsx/pdf. */
  fetchImpl?: typeof fetch;
};

const readActionDesignerStore = (context: DynamicActionRuntimeContext): Record<string, unknown> => (
  context.getDesignerStore?.() ?? context.designerStore
);

const feedbackToast = (
  text: string,
  variant?: string | null,
  durationMs?: number,
): void => {
  showAppFeedbackToast(text, { variant, durationMs });
};

const endpointRequiresRecordId = (endpoint: string): boolean => /:[a-zA-Z_][a-zA-Z0-9_]*/.test(endpoint);

const isDeleteMutation = (action: Extract<ResolvedDynamicAction, { type: 'callMutation' }>): boolean => (
  action.mutationOperation === 'delete' || action.method === 'DELETE'
);

const readDeletedCount = async (response: Response): Promise<number | null> => {
  try {
    const payload = await response.clone().json() as { data?: { deleted?: unknown } };
    const deleted = payload?.data?.deleted;
    return typeof deleted === 'number' && Number.isFinite(deleted) ? deleted : null;
  } catch {
    return null;
  }
};

/** Returns `false` to signal the calling chain (see {@link executeDynamicActions}) should stop —
 * only `callMutation` ever does this, on a failed request, so a Delete's chained refresh/toast
 * success actions do not run after the mutation itself failed. */
export const executeDynamicAction = async (
  action: ResolvedDynamicAction,
  context: DynamicActionRuntimeContext,
  event?: Event,
): Promise<boolean | void> => {
  const designerStore = readActionDesignerStore(context);

  switch (action.type) {
    case 'refreshDataSource':
      if (context.refreshDataSource) {
        await context.refreshDataSource(action.dataSourceRef, undefined, { bypassServerCache: true });
      }
      return;
    case 'setValue': {
      const value = action.valueSource === 'expression'
        ? evaluateDynamicActionExpression(action.valueExpression ?? '', context, event)
        : action.staticValue ?? '';
      context.patchStore(action.storePath, value);
      return;
    }
    case 'showHide': {
      const current = readNestedStoreValue(designerStore, action.visibilityStorePath);
      const nextValue = action.showHideEffect === 'show'
        ? true
        : action.showHideEffect === 'hide'
          ? false
          : !Boolean(current);
      context.patchStore(action.visibilityStorePath, nextValue);
      return;
    }
    case 'showToast': {
      feedbackToast(
        action.toastTitle,
        action.toastVariant,
        typeof action.toastDuration === 'number' ? action.toastDuration : undefined,
      );
      return;
    }
    case 'callMutation': {
      if (!action.endpoint.trim()) {
        feedbackToast('Mutation is not configured for this action.', 'danger');
        return false;
      }

      const recordId = action.mutationRecordIdStorePath
        ? readNestedStoreValue(designerStore, action.mutationRecordIdStorePath)
        : undefined;
      const missingRecordId = recordId === undefined || recordId === null || String(recordId).length === 0;
      if (missingRecordId && (isDeleteMutation(action) || endpointRequiresRecordId(action.endpoint))) {
        feedbackToast('No record selected.', 'danger');
        return false;
      }

      const url = resolveMutationRuntimeUrl(action.endpoint, recordId);
      try {
        const response = await designerFetch(url, {
          method: action.method,
          headers: { 'Content-Type': 'application/json' },
          ...(isDeleteMutation(action)
            ? {}
            : { body: JSON.stringify(resolveStoreTemplateRecord(action.mutationBody ?? {}, designerStore)) }),
        });
        if (!response.ok) {
          const message = await parseApiErrorMessage(response);
          feedbackToast(message, 'danger');
          return false;
        }
        if (isDeleteMutation(action)) {
          const deleted = await readDeletedCount(response);
          if (deleted === 0) {
            feedbackToast('Record not found.', 'danger');
            return false;
          }
        }
        return true;
      } catch (mutationFailure) {
        const message = mutationFailure instanceof Error ? mutationFailure.message : 'Request failed';
        feedbackToast(message, 'danger');
        return false;
      }
    }
    case 'resetForm': {
      // Uncontrolled Data Region fields are never store-bound, so the only reliable way to clear
      // them is the DOM form's own native `.reset()` — a no-op when the target isn't a real
      // `<form>` element (e.g. a plain container region), which is an acceptable limitation.
      const target = document.querySelector(`[data-designer-node-id="${action.targetNodeId}"]`);
      if (target instanceof HTMLFormElement) {
        target.reset();
      }
      return;
    }
    case 'navigate': {
      if (!context.navigate) {
        return;
      }
      const to = resolveNavigateTargetTemplate(action.navigateTarget, designerStore);
      if (!to) {
        return;
      }
      context.navigate(to, { replace: action.navigateReplace });
      return;
    }
    case 'updateFilterFromClick': {
      const value = action.filterValueSource === 'expression'
        ? evaluateDynamicActionExpression(action.filterValueExpression ?? '', context, event)
        : action.filterValueSource === 'clickSeriesKey'
          ? resolveChartDataPointClickPayload(event ?? ({} as Event))?.seriesKey
            ?? (event?.target as { seriesKey?: unknown } | null)?.seriesKey
          : resolveChartDataPointClickPayload(event ?? ({} as Event))?.category
            ?? (event?.target as { value?: unknown } | null)?.value;
      context.patchStore(action.filterStorePath, value ?? '');
      return;
    }
    case 'exportData': {
      const payload = resolveRegisteredDesignerExportPayload(action.exportSource);
      if (!payload) {
        feedbackToast('Nothing to export — bind a grid or chart first.', 'warning');
        return false;
      }
      try {
        await exportDesignerData({
          format: action.exportFormat,
          rows: payload.rows,
          columns: payload.columns,
          filename: action.exportFilename ?? payload.filename,
          fetchImpl: context.fetchImpl,
        });
        return true;
      } catch (exportFailure) {
        const message = exportFailure instanceof Error ? exportFailure.message : 'Export failed';
        feedbackToast(message, 'danger');
        return false;
      }
    }
    case 'triggerWorkflow': {
      const input = resolveWorkflowInputFromStore(designerStore, action.payloadMapping);
      try {
        const response = await designerFetch(action.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input, startType: 'MANUAL_API' }),
        });
        if (!response.ok) {
          const message = await parseApiErrorMessage(response);
          feedbackToast(message, 'danger');
          return false;
        }
        return true;
      } catch (workflowFailure) {
        const message = workflowFailure instanceof Error ? workflowFailure.message : 'Workflow start failed';
        feedbackToast(message, 'danger');
        return false;
      }
    }
  }
};

export const executeDynamicActions = async (
  actions: ResolvedDynamicAction[] | undefined,
  context: DynamicActionRuntimeContext,
  event?: Event,
): Promise<void> => {
  for (const action of actions ?? []) {
    const result = await executeDynamicAction(action, context, event);
    if (result === false) {
      break;
    }
  }
};

const readNestedStoreValue = (store: Record<string, unknown>, path: string): unknown => {
  const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
  let cursor: unknown = store;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object') {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
};

const evaluateDynamicActionExpression = (
  expression: string,
  context: DynamicActionRuntimeContext,
  event?: Event,
): unknown => {
  const trimmed = expression.trim();
  if (!trimmed) {
    return null;
  }

  try {
    if (!isSafeDesignerRuntimeExpression(trimmed)) {
      return null;
    }
    const compiled = compileDynamicActionValueExpression(trimmed);
    const target = event?.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    const evaluator = new Function(
      'designerStore',
      'event',
      'value',
      `return (${compiled});`,
    );
    return evaluator(readActionDesignerStore(context), event, target?.value ?? '');
  } catch {
    return null;
  }
};

export const patchDesignerStorePath = (
  store: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> => patchNestedStoreValue(store, path, value);
