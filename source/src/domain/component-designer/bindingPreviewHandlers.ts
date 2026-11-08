import {
  collectDocumentBindingPlan,
  collectNodeEventBindings,
  resolveDesignerEventJsxAttributeName,
  type ResolvedEventBinding,
} from './bindingEngine';
import type * as React from 'react';
import type { DesignerBindingDefinitions, DesignerDocument, DesignerNode } from './types';
import {
  executeDesignerFormSubmit,
  executeDesignerMutation,
  executeDesignerRegionSubmit,
  executeDesignerValueMutation,
  resolveStoreWriteValueFromEvent,
  setNestedPayloadValue,
  type BindingMutationCallbacks,
} from './bindingMutationRuntime';
import { executeDynamicActions } from './bindingDynamicActionsRuntime';
import type { DynamicActionNavigateFn } from './bindingDynamicActionsRuntime';
import { patchNestedStoreValue } from './designerPreviewResolvers';

export type PreviewEventHandlerContext = {
  bindingContext: Record<string, unknown>;
  designerStore: Record<string, unknown>;
  /** Live store reader — preferred for Dynamic Actions so selection is not stale. */
  getDesignerStore?: () => Record<string, unknown>;
  patchStore: (path: string, value: unknown) => void;
  patchStoreState?: (updater: (store: Record<string, unknown>) => Record<string, unknown>) => void;
  refreshDataSource?: (dataSourceRef: string) => Promise<void>;
  /** Injected from React (`useNavigate`) for Dynamic Action `navigate` steps. */
  navigate?: DynamicActionNavigateFn;
  onGridRowAction?: (row: Record<string, unknown>, actionId: string) => void;
  resolveGridRowAction?: (gridNodeId: string) => ((row: Record<string, unknown>, actionId: string) => void) | undefined;
  onGridCellClick?: (row: Record<string, unknown>, column: import('./designerDataGridColumns').DesignerDataGridColumn) => void;
  resolveGridCellClick?: (gridNodeId: string) => ((row: Record<string, unknown>, column: import('./designerDataGridColumns').DesignerDataGridColumn) => void) | undefined;
  resolveGridRefresh?: (gridNodeId: string) => (() => void) | undefined;
  resolveChartRefresh?: (chartNodeId: string) => (() => void) | undefined;
  resolveVizRefresh?: (vizNodeId: string) => (() => void) | undefined;
  mutationCallbacks: BindingMutationCallbacks;
  isSubmitting: boolean;
  document?: DesignerDocument;
  bindingDefinitions?: DesignerBindingDefinitions;
  seedRegionFromRow?: (modalNodeId: string, row: Record<string, unknown>) => void;
};

const resolveNodePreviewEventBindings = (
  node: DesignerNode,
  context: PreviewEventHandlerContext,
): ResolvedEventBinding[] => {
  if (context.document && context.bindingDefinitions) {
    return collectDocumentBindingPlan(context.document, context.bindingDefinitions)
      .eventBindings
      .filter((binding) => binding.nodeId === node.id);
  }

  return collectNodeEventBindings(node, context.bindingDefinitions);
};

const runDynamicActionsForBinding = (
  binding: ResolvedEventBinding,
  context: PreviewEventHandlerContext,
  event?: Event,
): void => {
  void executeDynamicActions(binding.trueActions, {
    designerStore: context.designerStore,
    getDesignerStore: context.getDesignerStore,
    patchStore: context.patchStore,
    refreshDataSource: context.refreshDataSource,
    navigate: context.navigate,
  }, event);
};

/**
 * Run success trueActions only when the mutation Promise resolves with `true`.
 * HTTP/network failures reject (after onError) — catch swallows so the Preview
 * error banner/toast stays the sole failure UX (parity with Export, which throws
 * before rendering the success chain).
 */
const runSuccessActionsAfterMutation = (
  mutation: Promise<boolean>,
  binding: ResolvedEventBinding,
  context: PreviewEventHandlerContext,
  event: Event,
): void => {
  void mutation
    .then((succeeded) => {
      if (succeeded) {
        runDynamicActionsForBinding(binding, context, event);
      }
    })
    .catch(() => {
      // Failure already reported via BindingMutationCallbacks.onError.
    });
};

const createPreviewEventHandler = (
  binding: ResolvedEventBinding,
  context: PreviewEventHandlerContext,
): ((event: Event) => void) => {
  const callbacks: BindingMutationCallbacks = {
    ...context.mutationCallbacks,
    patchStore: (path, value) => {
      setNestedPayloadValue(context.designerStore, path, value);
      context.patchStore(path, value);
    },
  };

  const dynamicOnly = Boolean(binding.trueActions?.length)
    && !binding.endpoint
    && !binding.regionSubmitPlan
    && !binding.storeWritePath;

  if (dynamicOnly) {
    return (event: Event) => {
      if (binding.targetEvent === 'onClick') {
        event.preventDefault?.();
      }
      runDynamicActionsForBinding(binding, context, event);
    };
  }

  if (binding.targetEvent === 'onSubmit') {
    return (event: Event) => {
      runSuccessActionsAfterMutation(
        executeDesignerFormSubmit(
          event as unknown as React.FormEvent<HTMLFormElement>,
          binding,
          context.bindingContext,
          callbacks,
          context.document,
          context.designerStore,
        ),
        binding,
        context,
        event,
      );
    };
  }

  if (binding.regionSubmitPlan && binding.targetEvent === 'onClick') {
    return (event: Event) => {
      event.preventDefault?.();
      const plan = binding.regionSubmitPlan;
      if (!plan) {
        return;
      }

      const currentTarget = event.currentTarget as HTMLElement | null;
      const linkedFormId = currentTarget?.getAttribute('form');
      let form = currentTarget?.closest('form') as HTMLFormElement | null;
      if (!form && linkedFormId) {
        form = document.getElementById(linkedFormId) as HTMLFormElement | null
          ?? document.querySelector(`[data-designer-node-id="${linkedFormId}"]`) as HTMLFormElement | null;
      }
      const submitRoot = form
        ?? document.querySelector(`[data-designer-node-id="${plan.regionNodeId}"]`);

      if (!submitRoot) {
        return;
      }

      runSuccessActionsAfterMutation(
        executeDesignerRegionSubmit(submitRoot, binding, context.bindingContext, callbacks, context.document, context.designerStore),
        binding,
        context,
        event,
      );
    };
  }

  if (
    binding.targetEvent === 'onChange'
    || binding.targetEvent === 'onBlur'
    || binding.targetEvent === 'onTaskDrag'
    || binding.targetEvent === 'onCardMove'
  ) {
    const debounceMs = binding.definition.debounceMs;
    if (debounceMs && debounceMs > 0 && binding.endpoint) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      return (event: Event) => {
        if (binding.storeWritePath) {
          context.patchStore(
            binding.storeWritePath,
            resolveStoreWriteValueFromEvent(event, binding.targetEvent),
          );
        }
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          runSuccessActionsAfterMutation(
            executeDesignerValueMutation(
              event as unknown as React.ChangeEvent<HTMLInputElement>,
              binding,
              context.bindingContext,
              callbacks,
            ),
            binding,
            context,
            event,
          );
        }, debounceMs);
      };
    }

    return (event: Event) => {
      if (binding.targetEvent === 'onClick') {
        event.preventDefault?.();
      }
      if (binding.storeWritePath) {
        context.patchStore(
          binding.storeWritePath,
          resolveStoreWriteValueFromEvent(event, binding.targetEvent),
        );
      }

      if (binding.endpoint) {
        runSuccessActionsAfterMutation(
          executeDesignerValueMutation(
            event as unknown as React.ChangeEvent<HTMLInputElement>,
            binding,
            context.bindingContext,
            callbacks,
          ),
          binding,
          context,
          event,
        );
        return;
      }

      runDynamicActionsForBinding(binding, context, event);
    };
  }

  if (binding.storeWritePath && !binding.endpoint) {
    return (event: Event) => {
      context.patchStore(
        binding.storeWritePath!,
        resolveStoreWriteValueFromEvent(event, binding.targetEvent),
      );
      runDynamicActionsForBinding(binding, context, event);
    };
  }

  return (event: Event) => {
    event.preventDefault?.();
    if (binding.targetEvent === 'onClick' && binding.endpoint) {
      runSuccessActionsAfterMutation(
        executeDesignerMutation(binding, context.bindingContext, {}, callbacks),
        binding,
        context,
        event,
      );
      return;
    }

    if (binding.storeWritePath) {
      context.patchStore(
        binding.storeWritePath,
        resolveStoreWriteValueFromEvent(event, binding.targetEvent),
      );
    }

    runDynamicActionsForBinding(binding, context, event);
  };
};

export const buildPreviewBindingContext = (
  designerStore: Record<string, unknown>,
  dataContext: Record<string, unknown>,
): Record<string, unknown> => ({
  ...(typeof dataContext === 'object' && dataContext !== null ? dataContext : {}),
  ...(typeof designerStore === 'object' && designerStore !== null ? designerStore : {}),
});

export const resolveCanvasPreviewEventProps = (
  node: DesignerNode,
  context: PreviewEventHandlerContext,
): Record<string, (event: Event) => void> => {
  const handlers: Record<string, (event: Event) => void> = {};

  for (const binding of resolveNodePreviewEventBindings(node, context)) {
    handlers[resolveDesignerEventJsxAttributeName(binding.targetEvent)] = createPreviewEventHandler(
      binding,
      context,
    );
  }

  return handlers;
};

export const patchDesignerStorePath = (
  store: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> => patchNestedStoreValue(store, path, value);
