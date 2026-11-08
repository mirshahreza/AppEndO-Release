/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit / Auto Form Builder critical gaps — phase 17):
 * 1) Wizard offered Reset/Close success options but `buildSubmitBinding` only wired toast/refresh
 *    (reset/close were console.warn no-ops).
 * 2) "From API" entry existed only in empty catalog list mode — merge-into-Form/Modal path was
 *    implemented in domain but unreachable from the canvas editor UI.
 * 3) Endpoint was always required (no static form); standalone edit/detail forms always bound
 *    load URL params to `selection.<pk>` with no warning and no URL-param alternative.
 * Fixed in autoFormTemplateBuilder.ts / bindingResourceModel.ts / AutoFormWizardDialog.tsx /
 * useDesignerVersions.ts / ComponentDesignerView.tsx: shared `buildFormSuccessTrueActions`,
 * post-clone finalize for reset/close, canvas "From API" entry + explicit merge target,
 * static form mode, standalone-edit warning, and `detailIdSource: 'urlParam'`.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { generateDesignerTsx } from '../codegen';
import {
  buildAutoFormDocument,
  findAutoFormSubmitButtonNodeId,
  mergeAutoFormIntoDocument,
  resolveAutoFormInsertTarget,
  type AutoFormFieldConfig,
} from '../autoFormTemplateBuilder';
import { buildDataSourceFromEndpoint } from '../bindingResourceModel';
import { createInitialDesignerState, designerReducer } from '../state';
import { getNodeRegionDataSourceRef } from '../bindingRegionEngine';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../propRegistry';
import type { ApiFormField } from '../apiFieldSchema';
import type { DesignerNode } from '../types';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { AutoFormWizardDialog } from '../../../features/component-designer/components/AutoFormWizardDialog';

vi.mock('../../../shared/api/queries/my-apis', () => ({
  useAccessibleApiRoutesQuery: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock('../../../shared/api/queries/api-endpoint-schema', () => ({
  useApiEndpointSchemaQuery: () => ({ data: null, isLoading: false, isError: false }),
  resolveEndpointFormFieldsFromOpenApi: () => [],
}));

const renderWizard = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

const ORDER_FIELDS: ApiFormField[] = [
  { name: 'title', type: 'string', location: 'body', required: true },
  { name: 'status', type: 'string', location: 'body', required: true, enum: ['draft', 'paid'] },
];

const buildFieldConfigs = (fields: ApiFormField[]): AutoFormFieldConfig[] =>
  fields.map((field) => ({
    field,
    enabled: true,
    label: field.name,
    controlPaletteItemId: field.enum ? 'heroui.select' : 'heroui.input-text',
  }));

const insertNode = (
  state: ReturnType<typeof createInitialDesignerState>,
  itemId: string,
  parentId: string,
) => {
  const next = designerReducer(state, { type: 'insert-palette-item', itemId, parentId });
  const parent = next.document.nodes[parentId];
  const childId = parent.children[parent.children.length - 1];
  return { state: next, nodeId: childId };
};

const findFormNode = (nodes: Record<string, DesignerNode>): DesignerNode | undefined =>
  Object.values(nodes).find((node) => node.props[DESIGNER_PALETTE_ITEM_ID_PROP] === 'html.form');

describe('autoFormBuilderCriticalFixesPhase17', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('item 1 — reset/close success behaviors are real', () => {
    it('wires toast + refresh + reset + close on a Create form inside a Modal (document + export)', () => {
      let state = createInitialDesignerState();
      const modalInsert = insertNode(state, 'heroui.modal', state.document.rootNodeId);
      state = modalInsert.state;
      const formInsert = insertNode(state, 'html.form', modalInsert.nodeId);
      state = formInsert.state;

      const dataSource = buildDataSourceFromEndpoint('/api/orders', {
        fields: ['id', 'title', 'status'],
        primaryKey: 'id',
        method: 'POST',
      });

      const merged = mergeAutoFormIntoDocument(
        state.document,
        {
          ...state.bindingDefinitions,
          dataSources: { ...state.bindingDefinitions.dataSources, [dataSource.id]: dataSource },
        },
        {
          title: 'New order',
          includeTitle: true,
          dataSource,
          scenario: 'create',
          fields: buildFieldConfigs(ORDER_FIELDS),
          submitLabel: 'Create',
          successBehaviors: ['toast', 'refresh', 'reset', 'close'],
          layout: 'single',
        },
        { mode: 'form-region', formNodeId: formInsert.nodeId },
      );

      const submitNodeId = findAutoFormSubmitButtonNodeId(merged.document, formInsert.nodeId);
      expect(submitNodeId).toBeTruthy();
      const trueActions = merged.document.nodes[submitNodeId!]?.binding?.['event:onClick']?.trueActions ?? [];
      expect(trueActions.map((action) => action.type)).toEqual([
        'showToast',
        'refreshDataSource',
        'resetForm',
        'showHide',
      ]);
      expect(trueActions.find((action) => action.type === 'resetForm')?.targetNodeId).toBe(formInsert.nodeId);
      expect(trueActions.find((action) => action.type === 'showHide')).toMatchObject({
        targetNodeId: modalInsert.nodeId,
        showHideEffect: 'hide',
      });

      const tsx = generateDesignerTsx(merged.document, merged.bindingDefinitions);
      assertValidTsxSyntax('auto-form all success behaviors', tsx);
      expect(tsx).toContain('as HTMLFormElement | null)?.reset?.();');
      expect(tsx).toMatch(/patchDesignerStore\(/);
    });

    it('wires reset on a fresh buildAutoFormDocument (no modal — close skipped with warn)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const dataSource = buildDataSourceFromEndpoint('/api/orders', {
        fields: ['id', 'title'],
        primaryKey: 'id',
        method: 'POST',
      });
      const result = buildAutoFormDocument({
        title: 'Order',
        includeTitle: false,
        dataSource,
        scenario: 'create',
        fields: buildFieldConfigs(ORDER_FIELDS.slice(0, 1)),
        submitLabel: 'Save',
        successBehaviors: ['toast', 'refresh', 'reset', 'close'],
        layout: 'single',
      });

      const formNode = findFormNode(result.document.nodes);
      expect(formNode).toBeTruthy();
      const submitNodeId = findAutoFormSubmitButtonNodeId(result.document, formNode!.id);
      const trueActions = result.document.nodes[submitNodeId!]?.binding?.['event:onClick']?.trueActions ?? [];
      expect(trueActions.map((action) => action.type)).toEqual([
        'showToast',
        'refreshDataSource',
        'resetForm',
      ]);
      expect(trueActions.find((action) => action.type === 'resetForm')?.targetNodeId).toBe(formNode!.id);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Close dialog'),
      );
    });
  });

  describe('item 2 — merge path into existing Modal', () => {
    it('merges generated fields into a selected Modal form without wiping sibling canvas nodes', () => {
      let state = createInitialDesignerState();
      const gridInsert = insertNode(state, 'heroui.data-grid', state.document.rootNodeId);
      const modalInsert = insertNode(gridInsert.state, 'heroui.modal', state.document.rootNodeId);
      const formInsert = insertNode(modalInsert.state, 'html.form', modalInsert.nodeId);
      state = formInsert.state;

      const target = resolveAutoFormInsertTarget(state.document, modalInsert.nodeId);
      expect(target).toEqual({ mode: 'form-region', formNodeId: formInsert.nodeId });

      const dataSource = buildDataSourceFromEndpoint('/api/orders', {
        fields: ['id', 'title', 'status'],
        primaryKey: 'id',
        method: 'POST',
      });

      const merged = mergeAutoFormIntoDocument(
        state.document,
        state.bindingDefinitions,
        {
          title: 'Edit order',
          includeTitle: false,
          dataSource,
          scenario: 'edit',
          fields: buildFieldConfigs(ORDER_FIELDS),
          submitLabel: 'Update',
          successBehaviors: ['toast'],
          layout: 'single',
        },
        target!,
      );

      expect(merged.document.nodes[gridInsert.nodeId]).toBeDefined();
      expect(merged.document.nodes[modalInsert.nodeId]).toBeDefined();
      expect(getNodeRegionDataSourceRef(merged.document.nodes[formInsert.nodeId]!)).toBe(dataSource.id);

      const formChildren = merged.document.nodes[formInsert.nodeId]?.children ?? [];
      expect(formChildren.length).toBeGreaterThan(0);

      const titleControl = Object.values(merged.document.nodes).find(
        (node) => node.props.name === 'title',
      );
      expect(titleControl).toBeTruthy();
      expect(titleControl?.parentId).toBeTruthy();
      const walkToRoot = (nodeId: string | null | undefined): boolean => {
        let cursor = nodeId ?? null;
        while (cursor) {
          if (cursor === formInsert.nodeId) {
            return true;
          }
          cursor = merged.document.nodes[cursor]?.parentId ?? null;
        }
        return false;
      };
      expect(walkToRoot(titleControl!.id)).toBe(true);
    });
  });

  describe('item 3 — static form + standalone edit guidance', () => {
    it('builds a static form with no data source and no region submit', () => {
      const result = buildAutoFormDocument({
        title: 'Static contact',
        includeTitle: true,
        staticForm: true,
        scenario: 'create',
        fields: buildFieldConfigs(ORDER_FIELDS.slice(0, 1)),
        submitLabel: 'Submit',
        successBehaviors: ['toast', 'reset'],
        layout: 'single',
      });

      const formNode = findFormNode(result.document.nodes);
      expect(formNode).toBeTruthy();
      expect(getNodeRegionDataSourceRef(formNode!)).toBeUndefined();
      expect(Object.keys(result.bindingDefinitions.dataSources)).toHaveLength(0);

      const submitNodeId = findAutoFormSubmitButtonNodeId(result.document, formNode!.id);
      const submitBinding = result.document.nodes[submitNodeId!]?.binding?.['event:onClick'];
      expect(submitBinding?.regionSubmit).not.toBe(true);
      expect(submitBinding?.trueActions?.map((action) => action.type)).toEqual(['showToast', 'resetForm']);

      const tsx = generateDesignerTsx(result.document, result.bindingDefinitions);
      assertValidTsxSyntax('static auto-form', tsx);
    });

    it('uses params.<pk> when detailIdSource is urlParam', () => {
      const dataSource = buildDataSourceFromEndpoint('/api/orders/{id}', {
        fields: ['id', 'title'],
        primaryKey: 'id',
        method: 'GET',
      });
      const result = buildAutoFormDocument({
        title: 'Order detail',
        includeTitle: false,
        dataSource,
        scenario: 'edit',
        fields: buildFieldConfigs(ORDER_FIELDS.slice(0, 1)),
        submitLabel: 'Update',
        successBehaviors: ['toast'],
        layout: 'single',
        detailIdSource: 'urlParam',
      });

      const formNode = findFormNode(result.document.nodes);
      const regionBinding = formNode?.binding?.regionDataSource;
      expect(regionBinding?.loadOperation).toBe('detail');
      expect(regionBinding?.urlParams).toEqual({ id: 'params.id' });
    });

    it('shows the standalone-edit warning on Layout for catalog API entry (createEdit default)', () => {
      renderWizard(
        <AutoFormWizardDialog
          open
          onClose={() => undefined}
          onGenerate={vi.fn()}
          entryMode="catalog"
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Go to step 3: Layout/i }));

      expect(screen.getByTestId('auto-form-standalone-edit-warning').textContent).toMatch(
        /Record selection required/i,
      );
      expect(screen.getByLabelText(/Record id source/i)).toBeTruthy();
    });

    it('does not show the standalone-edit warning for canvas entry mode', () => {
      renderWizard(
        <AutoFormWizardDialog
          open
          onClose={() => undefined}
          onGenerate={vi.fn()}
          entryMode="canvas"
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Go to step 3: Layout/i }));

      expect(screen.queryByTestId('auto-form-standalone-edit-warning')).toBeNull();
    });

    it('hides the standalone-edit warning when Static form (no API) is selected', () => {
      renderWizard(
        <AutoFormWizardDialog
          open
          onClose={() => undefined}
          onGenerate={vi.fn()}
          entryMode="catalog"
        />,
      );

      fireEvent.click(screen.getByLabelText('Static form (no API)'));
      fireEvent.click(screen.getByRole('button', { name: /Go to step 3: Layout/i }));

      expect(screen.queryByTestId('auto-form-standalone-edit-warning')).toBeNull();
    });
  });
});
