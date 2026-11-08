/**
 * @vitest-environment jsdom
 * Bug found (gap analysis U7 / phase 28): heroui.checkbox-group could not load options from an
 * API/LOV source in export (only static placeholders were emitted) and region submit sent a
 * comma-separated string instead of a string[] payload for multi-select role assignment.
 * Fixed in tsxParityPalette.ts, bindingRegionEngine.ts, DesignerRuntimeParityPalette.tsx,
 * designerPreviewResolvers.ts, useDesignerOptionItems.ts, designerChoiceGroupOptions.ts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { DesignerDocumentPreview } from '../designerRuntimePreview';
import { DesignerRuntimeCheckboxGroup } from '../DesignerRuntimeParityPalette';
import { generateDesignerTsx } from '../codegen';
import { buildRegionSubmitPayload, collectRegionFormDataFromContainer } from '../bindingMutationRuntime';
import { collectRegionFormFieldMappings, resolveDefaultRegionFieldTransform } from '../bindingRegionEngine';
import {
  createPropertyBindingDefinition,
  propertyBindingKeyForProp,
  eventBindingKeyForEvent,
} from '../bindingEngine';
import {
  REGION_DATA_SOURCE_BINDING_KEY,
  createRegionColumnBindingDefinition,
  createRegionDataSourceBindingDefinition,
  createRegionSubmitEventBindingDefinition,
} from '../bindingRegionEngine';
import { createDefaultBindingDefinitions } from '../bindingRegistry';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import type { DesignerState } from '../types';
import type { RuntimeRenderOptions } from '../runtimeTypes';

const ROLES_ENDPOINT = '/api/roles';

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: parentId ?? state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState, parentId: string): string => {
  const parent = state.document.nodes[parentId];
  return parent.children[parent.children.length - 1] as string;
};


describe('roles assignment checkbox-group phase 28 fix (U7)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('exports dynamic checkbox options from apiRef instead of static placeholders', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.checkbox-group');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'optionsSource',
      value: 'apiRef',
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: propertyBindingKeyForProp('items'),
      definition: createPropertyBindingDefinition('items', 'lovData_roles', {
        fetchEndpoint: ROLES_ENDPOINT,
      }),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('checkbox-group apiRef items', tsx);

    expect(tsx).toContain('mapDesignerListBoxItems');
    expect(tsx).toMatch(/\.map\(\(item\) => \(\s*<Checkbox/);
    expect(tsx).not.toContain('>Option 1<');
  });

  it('maps checkbox-group region fields to commaSeparatedArray submit payloads', () => {
    let state = insertItem(createInitialDesignerState(), 'html.form');
    const formId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'user-roles',
      dataSource: {
        id: 'user-roles',
        name: 'User Roles',
        endpoint: '/api/users/1/roles',
        fields: ['id', 'roleIds'],
        primaryKey: 'id',
        kind: 'record',
        operations: {
          create: { method: 'POST', endpoint: '/api/users/1/roles' },
          update: { method: 'PUT', endpoint: '/api/users/1/roles/:id' },
        },
      },
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('user-roles'),
    });
    state = insertItem(state, 'heroui.checkbox-group', formId);
    const checkboxId = lastChildId(state, formId);
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: checkboxId,
      bindingKey: propertyBindingKeyForProp('isSelected'),
      definition: createRegionColumnBindingDefinition('isSelected', 'roleIds'),
    });

    const node = state.document.nodes[checkboxId]!;
    expect(resolveDefaultRegionFieldTransform(node)).toBe('commaSeparatedArray');

    const mappings = collectRegionFormFieldMappings(state.document, formId, state.bindingDefinitions);
    const container = document.createElement('div');
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = checkboxId;
    hidden.value = 'ADMIN,EDITOR';
    container.appendChild(hidden);

    const formData = collectRegionFormDataFromContainer(container, mappings.map((mapping) => mapping.formFieldName));
    const payload = buildRegionSubmitPayload(formData, mappings);
    expect(payload.roleIds).toEqual(['ADMIN', 'EDITOR']);
  });

  it('submits multi-select roleIds as a string[] payload after apiRef options load', async () => {
    let state = insertItem(createInitialDesignerState(), 'html.form');
    const formId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'user-roles',
      dataSource: {
        id: 'user-roles',
        name: 'User Roles',
        endpoint: '/api/users/1/roles',
        fields: ['id', 'roleIds'],
        primaryKey: 'id',
        kind: 'record',
        operations: {
          create: { method: 'POST', endpoint: '/api/users/1/roles' },
          update: { method: 'PUT', endpoint: '/api/users/1/roles/:id' },
        },
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('user-roles'),
    });

    state = insertItem(state, 'heroui.checkbox-group', formId);
    const checkboxId = lastChildId(state, formId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: checkboxId,
      key: 'optionsSource',
      value: 'apiRef',
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: checkboxId,
      bindingKey: propertyBindingKeyForProp('items'),
      definition: createPropertyBindingDefinition('items', 'lovData_roles', {
        fetchEndpoint: ROLES_ENDPOINT,
      }),
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: checkboxId,
      bindingKey: propertyBindingKeyForProp('isSelected'),
      definition: createRegionColumnBindingDefinition('isSelected', 'roleIds'),
    });

    state = insertItem(state, 'heroui.button-solid', formId);
    const buttonId = lastChildId(state, formId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: buttonId,
      key: 'text',
      value: 'Save roles',
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createRegionSubmitEventBindingDefinition('onClick'),
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : String(input);
      if (url.includes(ROLES_ENDPOINT)) {
        return new Response(JSON.stringify({
          items: [
            { id: 'ADMIN', label: 'Admin' },
            { id: 'EDITOR', label: 'Editor' },
            { id: 'VIEWER', label: 'Viewer' },
          ],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <DesignerDocumentPreview
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        interactive
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeTruthy();
      expect(screen.getByText('Editor')).toBeTruthy();
    });

    const hiddenInput = document.querySelector(`[name="${checkboxId}"]`) as HTMLInputElement | null;
    expect(hiddenInput).not.toBeNull();
    hiddenInput!.value = 'ADMIN,EDITOR';

    fireEvent.click(screen.getByText('Save roles'));

    await waitFor(() => {
      const mutationCall = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST'
          || (init as RequestInit | undefined)?.method === 'PUT',
      );
      expect(mutationCall).toBeTruthy();
    });

    const mutationCall = fetchMock.mock.calls.find(
      ([, init]) => {
        const method = (init as RequestInit | undefined)?.method;
        return method === 'POST' || method === 'PUT';
      },
    ) as [string, RequestInit];
    const payload = JSON.parse(String(mutationCall[1].body));
    expect(payload.roleIds).toEqual(['ADMIN', 'EDITOR']);
  });

  it('keeps static checkbox-group export unchanged when optionsSource is static', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.checkbox-group');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'optionsSource',
      value: 'static',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'isSelected',
      value: 'option-1,option-2',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('checkbox-group static', tsx);
    expect(tsx).toContain('Option 1');
    expect(tsx).toContain('defaultValue={["option-1","option-2"]}');
    expect(tsx).not.toMatch(/items=\{mapDesigner/);
  });

  it('preview runtime loads apiRef options for checkbox-group', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.checkbox-group');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'optionsSource',
      value: 'apiRef',
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: propertyBindingKeyForProp('items'),
      definition: createPropertyBindingDefinition('items', 'lovData_roles', {
        fetchEndpoint: ROLES_ENDPOINT,
      }),
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      items: [
        { id: 'ADMIN', label: 'Admin' },
        { id: 'MANAGER', label: 'Manager' },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const node = state.document.nodes[nodeId]!;
    const runtimeOptions: RuntimeRenderOptions = {
      mode: 'runtime',
      bindingDefinitions: createDefaultBindingDefinitions(),
    };

    render(<DesignerRuntimeCheckboxGroup node={node} options={runtimeOptions} />);

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeTruthy();
      expect(screen.getByText('Manager')).toBeTruthy();
    });
  });
});
