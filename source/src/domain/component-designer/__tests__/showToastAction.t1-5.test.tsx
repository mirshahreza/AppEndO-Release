/**
 * @vitest-environment jsdom
 *
 * Phase T1-5 — Show Toast action + removal of heroui.toast palette widget.
 */
import * as React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Toast } from '@heroui/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import {
  collectDocumentBindingPlan,
  createDynamicActionsEventBindingDefinition,
  eventBindingKeyForEvent,
} from '../bindingEngine';
import { createDynamicAction } from '../bindingDynamicActionsEngine';
import { executeDynamicAction } from '../bindingDynamicActionsRuntime';
import { DESIGNER_PALETTE, getPaletteItemById } from '../catalog';
import { PHASE_P_WAVE2_PARITY_IDS } from '../toolboxInventory';
import { validateDesignerDocument } from '../validation';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../propRegistry';

const showAppFeedbackToastMock = vi.hoisted(() => vi.fn());

vi.mock('../../../shared/ui/appFeedbackToast', () => ({
  showAppFeedbackToast: showAppFeedbackToastMock,
  mapFeedbackToastVariantToType: (variant?: string | null) => {
    switch (variant) {
      case 'danger':
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'success':
        return 'success';
      default:
        return 'info';
    }
  },
  dismissAppFeedbackToast: vi.fn(),
  subscribeAppFeedbackToast: () => () => undefined,
}));

vi.mock('@heroui/react', async () => {
  const actual = await vi.importActual<typeof import('@heroui/react')>('@heroui/react');
  return {
    ...actual,
    Toast: {
      ...(actual.Toast as object),
      Provider: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="toast-provider">{children}</div>
      ),
    },
  };
});

describe('T1-5 Show Toast action + legacy heroui.toast removal', () => {
  beforeEach(() => {
    showAppFeedbackToastMock.mockClear();
  });

  it('keeps heroui.toast in the Toolbox as the Base Components toast section (p-103)', () => {
    expect(getPaletteItemById('heroui.toast')?.id).toBe('heroui.toast');
    expect(DESIGNER_PALETTE.some((item) => item.id === 'heroui.toast')).toBe(true);
    expect(PHASE_P_WAVE2_PARITY_IDS.includes('heroui.toast' as never)).toBe(false);
  });

  it('compiles Show Toast dynamic action to HeroUI toast(...)', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.button-solid',
      parentId: state.document.rootNodeId,
    });
    const buttonId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    const toastAction = createDynamicAction('showToast');
    toastAction.toastTitle = 'Saved';
    toastAction.toastDescription = 'Row updated';
    toastAction.toastVariant = 'success';
    toastAction.toastDuration = 2500;

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [toastAction]),
    });

    const plan = collectDocumentBindingPlan(state.document, state.bindingDefinitions);
    const clickBinding = plan.eventBindings.find((binding) => binding.nodeId === buttonId);
    expect(clickBinding?.trueActions).toEqual([
      expect.objectContaining({
        type: 'showToast',
        toastTitle: 'Saved',
        toastDescription: 'Row updated',
        toastVariant: 'success',
        toastDuration: 2500,
      }),
    ]);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain("import {");
    expect(tsx).toMatch(/toast/);
    expect(tsx).toContain('Toast');
    expect(tsx).toContain('<Toast.Provider');
    expect(tsx).toContain('toast("Saved", { description: "Row updated", variant: "success", timeout: 2500 })');
  });

  it('executes Show Toast at preview runtime via AppToast feedback host', async () => {
    await executeDynamicAction(
      {
        id: 'da_toast',
        type: 'showToast',
        toastTitle: 'Hello',
        toastDescription: 'World',
        toastVariant: 'accent',
        toastDuration: 1000,
      },
      {
        designerStore: {},
        patchStore: () => {},
      },
    );

    expect(showAppFeedbackToastMock).toHaveBeenCalledWith('Hello', {
      variant: 'accent',
      durationMs: 1000,
    });
  });

  it('fires Show Toast when clicking a button in interactive DesignerDocumentPreview', async () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.button-solid',
      parentId: state.document.rootNodeId,
    });
    const buttonId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    const toastAction = createDynamicAction('showToast');
    toastAction.toastTitle = 'Clicked';
    toastAction.toastVariant = 'default';

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [toastAction]),
    });

    render(
      <Toast.Provider>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          interactive: true,
        })}
      </Toast.Provider>,
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(showAppFeedbackToastMock).toHaveBeenCalledWith(
        'Clicked',
        expect.objectContaining({ variant: 'default' }),
      );
    });
  });

  it('loads a legacy heroui.toast node without crashing and emits a warning diagnostic', () => {
    const state = createInitialDesignerState();
    const rootId = state.document.rootNodeId;
    const toastNodeId = 'legacy_toast_node';

    state.document.nodes[rootId] = {
      ...state.document.nodes[rootId],
      children: [toastNodeId],
    };
    state.document.nodes[toastNodeId] = {
      id: toastNodeId,
      type: 'container',
      parentId: rootId,
      order: 0,
      props: {
        [DESIGNER_PALETTE_ITEM_ID_PROP]: 'heroui.toast',
        title: 'Old toast',
        description: 'Should not crash',
      },
      layout: {},
      binding: {},
      children: [],
    };

    expect(() => {
      render(<>{renderDesignerDocumentPreview(state.document)}</>);
    }).not.toThrow();

    expect(screen.getByTestId('legacy-heroui-toast')).toBeTruthy();

    const diagnostics = validateDesignerDocument(state.document);
    expect(diagnostics.some((issue) =>
      issue.code === 'legacy-palette-item' && issue.nodeId === toastNodeId,
    )).toBe(false);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).not.toContain('<Toast.Title');
  });
});
