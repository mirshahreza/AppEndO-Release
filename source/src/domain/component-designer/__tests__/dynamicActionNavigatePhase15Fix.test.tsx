/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit item 101): Dynamic Actions had no `navigate` type — "after save, go to
 * the detail page for this record" was impossible in Preview and Export. Fixed in types.ts,
 * bindingDynamicActionsEngine.ts, bindingDynamicActionsRuntime.ts, bindingPreviewHandlers.ts,
 * bindingCodegen.ts, codegen.ts, InspectorDynamicActionsField.tsx, designerRuntimePreview.tsx:
 * new `navigate` action with `{store.x}` / `{selection.id}` template resolution, Preview injects
 * `useNavigate` via router bridge, Export emits conditional `import { useNavigate }` + call.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { generateDesignerTsx } from '../codegen';
import {
  createDynamicActionsEventBindingDefinition,
  eventBindingKeyForEvent,
} from '../bindingEngine';
import {
  createDynamicAction,
  resolveDynamicActions,
  resolveNavigateTargetExpressionForCodegen,
  resolveNavigateTargetTemplate,
} from '../bindingDynamicActionsEngine';
import { executeDynamicAction } from '../bindingDynamicActionsRuntime';
import { DesignerDocumentPreview } from '../designerRuntimePreview';
import { createInitialDesignerState, designerReducer } from '../state';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { InspectorDynamicActionsField } from '../../../features/component-designer/components/InspectorDynamicActionsField';
import { DesignerDialogHostContext } from '../../../shared/ui/designerDialogHostContext';
import type { DesignerDynamicAction } from '../types';

afterEach(() => {
  cleanup();
});

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location-pathname">{location.pathname}</div>;
};

const buildNavigateDocument = (navigateTarget: string, navigateReplace = false) => {
  let state = createInitialDesignerState();
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'heroui.button-solid',
    parentId: state.document.rootNodeId,
  });
  const buttonId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

  const navigateAction = createDynamicAction('navigate');
  navigateAction.navigateTarget = navigateTarget;
  navigateAction.navigateReplace = navigateReplace;

  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: buttonId,
    bindingKey: eventBindingKeyForEvent('onClick'),
    definition: createDynamicActionsEventBindingDefinition('onClick', [navigateAction]),
  });

  return { state, buttonId, navigateAction };
};

describe('resolveNavigateTargetTemplate / codegen expression (item 101)', () => {
  it('substitutes store placeholders and encodes path segments', () => {
    expect(resolveNavigateTargetTemplate('/orders/{selection.id}', {
      selection: { id: '42' },
    })).toBe('/orders/42');

    expect(resolveNavigateTargetTemplate('/orders/{store.selection.id}', {
      selection: { id: 'a/b' },
    })).toBe('/orders/a%2Fb');

    expect(resolveNavigateTargetTemplate('/dashboard', {})).toBe('/dashboard');

    expect(resolveNavigateTargetTemplate('/orders/{selection.id}', {})).toBe('/orders/');
  });

  it('emits a runnable codegen expression for mixed literal + placeholder templates', () => {
    const expr = resolveNavigateTargetExpressionForCodegen('/orders/{selection.id}');
    // eslint-disable-next-line no-new-func
    const path = new Function('designerStore', `return (${expr});`)({ selection: { id: 7 } });
    expect(path).toBe('/orders/7');

    expect(resolveNavigateTargetExpressionForCodegen('/dashboard')).toBe('"/dashboard"');
  });

  it('can resolve a create response before navigating to the real record id', () => {
    const expr = resolveNavigateTargetExpressionForCodegen(
      '/contents/edit/{response.data.id}',
      'mutationResponse',
    );
    // eslint-disable-next-line no-new-func
    const path = new Function(
      'designerStore',
      'mutationResponse',
      `return (${expr});`,
    )({}, { data: { id: 73 } });
    expect(path).toBe('/contents/edit/73');
  });
});

describe('navigate dynamic action resolution + runtime', () => {
  it('resolves navigate actions with target + replace flag', () => {
    const { navigateAction, state } = buildNavigateDocument('/orders/{selection.id}', true);
    const definition = createDynamicActionsEventBindingDefinition('onClick', [navigateAction]);
    const resolved = resolveDynamicActions(definition, state.bindingDefinitions);
    expect(resolved).toEqual([
      expect.objectContaining({
        type: 'navigate',
        navigateTarget: '/orders/{selection.id}',
        navigateReplace: true,
      }),
    ]);
  });

  it('drops navigate actions with an empty target', () => {
    const action = createDynamicAction('navigate');
    action.navigateTarget = '   ';
    const definition = createDynamicActionsEventBindingDefinition('onClick', [action]);
    expect(resolveDynamicActions(definition, createInitialDesignerState().bindingDefinitions)).toHaveLength(0);
  });

  it('calls the injected navigate callback with a resolved path', async () => {
    const navigate = vi.fn();
    await executeDynamicAction(
      {
        id: 'da_nav',
        type: 'navigate',
        navigateTarget: '/orders/{selection.id}',
        navigateReplace: true,
      },
      {
        designerStore: { selection: { id: '99' } },
        patchStore: () => {},
        navigate,
      },
    );

    expect(navigate).toHaveBeenCalledWith('/orders/99', { replace: true });
  });

  it('is a no-op when navigate callback is missing', async () => {
    await expect(executeDynamicAction(
      {
        id: 'da_nav',
        type: 'navigate',
        navigateTarget: '/orders/1',
        navigateReplace: false,
      },
      {
        designerStore: {},
        patchStore: () => {},
      },
    )).resolves.toBeUndefined();
  });
});

describe('Preview: navigate action fires real react-router navigation', () => {
  it('navigates to a static path from interactive DesignerDocumentPreview', async () => {
    const { state } = buildNavigateDocument('/orders/detail');

    render(
      <MemoryRouter initialEntries={['/start']}>
        <Routes>
          <Route
            path="*"
            element={(
              <>
                <LocationProbe />
                <DesignerDocumentPreview
                  document={state.document}
                  bindingDefinitions={state.bindingDefinitions}
                  interactive
                />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location-pathname').textContent).toBe('/start');

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByTestId('location-pathname').textContent).toBe('/orders/detail');
    });
  });

  it('resolves store placeholders when designerStore is seeded on renderDesignerDocumentPreview', async () => {
    const { state } = buildNavigateDocument('/orders/{selection.id}');
    const navigate = vi.fn();

    const { renderDesignerDocumentPreview } = await import('../designerRuntimePreview');
    render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          interactive: true,
          designerStore: { selection: { id: 'abc' } },
          navigate,
        })}
      </>,
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/orders/abc', { replace: false });
    });
  });
});

describe('Export: navigate action codegen', () => {
  it('emits useNavigate import + navigate(...) call with resolved expression', () => {
    const { state } = buildNavigateDocument('/orders/{selection.id}', true);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    expect(tsx).toContain("import { useNavigate } from 'react-router-dom';");
    expect(tsx).toContain('const navigate = useNavigate();');
    expect(tsx).toContain('navigate(');
    expect(tsx).toContain('designerStore?.selection?.id');
    expect(tsx).toContain('replace: true');
    assertValidTsxSyntax('navigate dynamic action export', tsx);
  });

  it('does not change export output for documents without navigate actions', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.button-solid',
      parentId: state.document.rootNodeId,
    });
    const buttonId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;
    const toastAction = createDynamicAction('showToast');
    toastAction.toastTitle = 'Saved';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [toastAction]),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).not.toContain('useNavigate');
    expect(tsx).not.toContain('react-router-dom');
    expect(tsx).toContain('toast("Saved"');
  });
});

describe('Inspector: Navigate action type is selectable and editable', () => {
  it('lets a user pick Navigate and type a target path', () => {
    const state = createInitialDesignerState();
    const initialAction = createDynamicAction('setValue');
    const onChange = vi.fn();

    const { rerender } = render(
      <DesignerDialogHostContext.Provider value>
        <InspectorDynamicActionsField
          document={state.document}
          bindingDefinitions={state.bindingDefinitions}
          trueActions={[initialAction]}
          onChange={onChange}
        />
      </DesignerDialogHostContext.Provider>,
    );

    const actionTypeSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(within(actionTypeSelect).getByText('Navigate')).toBeTruthy();

    fireEvent.change(actionTypeSelect, { target: { value: 'navigate' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [nextActions] = onChange.mock.calls[0] as [DesignerDynamicAction[]];
    expect(nextActions[0]?.type).toBe('navigate');
    expect(nextActions[0]?.navigateTarget).toBe('/');

    onChange.mockClear();
    rerender(
      <DesignerDialogHostContext.Provider value>
        <InspectorDynamicActionsField
          document={state.document}
          bindingDefinitions={state.bindingDefinitions}
          trueActions={nextActions}
          onChange={onChange}
        />
      </DesignerDialogHostContext.Provider>,
    );

    expect(screen.getByText('Target path')).toBeTruthy();
    const targetInput = screen.getByPlaceholderText('/orders/{selection.id}') as HTMLInputElement;
    fireEvent.change(targetInput, { target: { value: '/orders/{selection.id}' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const [afterTarget] = onChange.mock.calls[0] as [DesignerDynamicAction[]];
    expect(afterTarget[0]?.type).toBe('navigate');
    expect(afterTarget[0]?.navigateTarget).toBe('/orders/{selection.id}');
  });
});
