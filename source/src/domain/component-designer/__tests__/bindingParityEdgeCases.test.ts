import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  createDynamicActionsEventBindingDefinition,
  eventBindingKeyForEvent,
  propertyBindingKeyForProp,
} from '../bindingEngine';
import {
  createRegionColumnBindingDefinition,
  createRegionDataSourceBindingDefinition,
  getNodeRegionColumnBinding,
  REGION_DATA_SOURCE_BINDING_KEY,
  regionColumnToExpression,
  collectDocumentRegionPlan,
} from '../bindingRegionEngine';
import {
  createDynamicAction,
  defaultSetValueStorePathForNode,
  resolveDynamicActions,
} from '../bindingDynamicActionsEngine';
import { patchNestedStoreValue } from '../designerPreviewResolvers';
import { executeDynamicAction } from '../bindingDynamicActionsRuntime';
import {
  createTsxBindingRenderContext,
  resolveBoundEventAttribute,
  resolveNodePropertyBindingExpression,
} from '../bindingCodegen';
import { generateDesignerTsx } from '../codegen';
import { applyResponseDataPath, normalizeHydrationResolvedValue } from '../bindingResourceModel';
import {
  GRID_LIST_RESOURCE_BINDING_KEY,
  createGridListResourceBindingDefinition,
  resolveGridListDataVarName,
} from '../bindingGridEngine';
import { buildBindingParityFixture } from '../bindingParity/fixtures';
import { buildRawCodegenDataContext, evaluateCodegenExpression } from '../bindingParity/harness';
import type { BindingParityFixture } from '../bindingParity/types';

const withMockPayload = (
  fixture: BindingParityFixture,
  mockApiPayload: unknown,
): BindingParityFixture => ({ ...fixture, mockApiPayload });

/**
 * Section 2.2 — binding architecture review. Fixture-comprehensiveness gap-filling: the
 * existing bindingParity/fixtures.ts (one fixture per capability) always uses a well-formed,
 * happy-path API payload. That happy-path shape flows through `bindingParity/harness.ts`'s
 * `buildDataContext`, which normalizes every list fetch var via
 * `normalizeHydrationResolvedValue(..., 'rows')` before EITHER the engine or codegen evaluator
 * runs — which means a divergence that only appears for a malformed (non-array) raw API
 * response is invisible to the standing per-capability snapshot suite, no matter how many
 * happy-path fixtures exist. These tests exercise codegen against the data shape it will
 * actually receive at runtime (via `buildRawCodegenDataContext`, mirroring
 * `applyResponseDataPath`-only fetch-hook codegen with no extra normalization) instead.
 */
describe('binding parity edge cases — malformed/non-array API payload shapes', () => {
  it('Grid rows codegen guards a single-object (non-array) API response, matching preview\'s fallback', () => {
    // Regression for bindingCodegen.ts resolveNodePropertyBindingExpression's 'rows' branch:
    // grid's codegen expression previously returned the bare fetch dataVar with no
    // Array.isArray guard (Chart/Viz/Content list bindings already had one). A malformed
    // API response that unwraps to a single record object (not a list) would reach
    // `<Table.Body items={...}>` / `<AppTableGrid rows={...}>` as a non-iterable value and
    // crash the exported app at render time, while preview's own `gridRows` resolution in
    // designerRuntimePreview.tsx already falls back to `undefined` for the same shape.
    const malformedPayload = { data: { id: 99, name: 'Solo Record' } };
    const fixture = withMockPayload(buildBindingParityFixture('Grid'), malformedPayload);
    const { document, bindingDefinitions } = fixture.state;

    // Engine side: exactly what `fetchDesignerHydrationData` (real preview hydration) computes.
    const engineNormalized = normalizeHydrationResolvedValue(
      applyResponseDataPath(malformedPayload, undefined),
      'rows',
    );
    expect(Array.isArray(engineNormalized)).toBe(true);
    expect(engineNormalized).toEqual([{ id: 99, name: 'Solo Record' }]);

    // Codegen side: exactly what the generated fetch hook computes (`applyResponseDataPath`
    // only — no rows normalization), fed into the real codegen expression string.
    const rawContext = buildRawCodegenDataContext(fixture);
    const bindingContext = createTsxBindingRenderContext(document, bindingDefinitions);
    const codegenExpression = resolveNodePropertyBindingExpression(fixture.nodeId, 'rows', bindingContext);
    expect(codegenExpression).toBeTruthy();

    const codegenResult = evaluateCodegenExpression(codegenExpression!, rawContext);
    expect(Array.isArray(codegenResult)).toBe(true);
    expect(codegenResult).toEqual([]);
  });

  it('Grid rows codegen guards a null API response the same way preview does', () => {
    const fixture = withMockPayload(buildBindingParityFixture('Grid'), null);
    const { document, bindingDefinitions } = fixture.state;

    const engineNormalized = normalizeHydrationResolvedValue(applyResponseDataPath(null, undefined), 'rows');
    expect(engineNormalized).toEqual([]);

    const rawContext = buildRawCodegenDataContext(fixture);
    const bindingContext = createTsxBindingRenderContext(document, bindingDefinitions);
    const codegenExpression = resolveNodePropertyBindingExpression(fixture.nodeId, 'rows', bindingContext)!;
    const codegenResult = evaluateCodegenExpression(codegenExpression, rawContext);
    expect(codegenResult).toEqual([]);
  });

  it('Grid rows codegen still resolves a well-formed array response identically to preview (no regression on the happy path)', () => {
    const fixture = buildBindingParityFixture('Grid');
    const { document, bindingDefinitions } = fixture.state;

    const engineNormalized = normalizeHydrationResolvedValue(
      applyResponseDataPath(fixture.mockApiPayload, undefined),
      'rows',
    );

    const rawContext = buildRawCodegenDataContext(fixture);
    const bindingContext = createTsxBindingRenderContext(document, bindingDefinitions);
    const codegenExpression = resolveNodePropertyBindingExpression(fixture.nodeId, 'rows', bindingContext)!;
    const codegenResult = evaluateCodegenExpression(codegenExpression, rawContext);

    expect(codegenResult).toEqual(engineNormalized);
    expect(codegenResult).toEqual([
      { id: 1, name: 'Widget A', qty: 10 },
      { id: 2, name: 'Widget B', qty: 5 },
    ]);
  });

  it('Grid rows codegen does not double-unwrap responseMapping.arrayPath after applyResponseDataPath', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.app-table-grid',
      parentId: state.document.rootNodeId,
    });
    const gridId = state.document.nodes[state.document.rootNodeId]!.children.at(-1)!;
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'revisions',
      dataSource: {
        id: 'revisions',
        name: 'Revisions',
        endpoint: '/api/cms/revisions',
        primaryKey: 'id',
        fields: ['id', 'revisionNo', 'title'],
        operations: { list: { method: 'GET', endpoint: '/api/cms/revisions' } },
        responseMapping: { arrayPath: 'data', totalPath: 'count', dataPath: 'data' },
      },
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('revisions'),
    });

    const rows = [{ id: 'r1', revisionNo: 1, title: 'First' }];
    const mockApiPayload = { success: true, data: rows, count: 1 };
    const dataVar = resolveGridListDataVarName(gridId);
    const rawContext = {
      [dataVar]: applyResponseDataPath(mockApiPayload, { arrayPath: 'data', dataPath: 'data' }),
    };
    const bindingContext = createTsxBindingRenderContext(state.document, state.bindingDefinitions);
    const codegenExpression = resolveNodePropertyBindingExpression(gridId, 'rows', bindingContext)!;
    const codegenResult = evaluateCodegenExpression(codegenExpression, rawContext);

    expect(codegenResult).toEqual(rows);
  });

  it('Chart/Viz/Content list bindings were already safe against a non-array response (confirms no sibling gap of the same class)', () => {
    for (const capability of ['Chart', 'Viz', 'Content'] as const) {
      const malformedPayload = { data: { id: 1, name: 'Solo' } };
      const fixture = withMockPayload(buildBindingParityFixture(capability), malformedPayload);
      const { document, bindingDefinitions } = fixture.state;
      const rawContext = buildRawCodegenDataContext(fixture);
      const bindingContext = createTsxBindingRenderContext(document, bindingDefinitions);
      const codegenExpression = resolveNodePropertyBindingExpression(fixture.nodeId, fixture.targetProp ?? 'data', bindingContext);
      expect(codegenExpression).toBeTruthy();
      // Must not throw when evaluated against the raw (unnormalized) malformed payload.
      expect(() => evaluateCodegenExpression(codegenExpression!, rawContext)).not.toThrow();
    }
  });
});

describe('binding parity edge cases — Region column value binding actually reaches exported JSX', () => {
  it('generateDesignerTsx emits a real `value={...}` attribute for a Region-column-bound input, not just a resolvable expression', () => {
    // Bug found (section 2.2 — binding architecture review), tsxPropMapper.ts
    // buildNodeJsxAttributesWithBindings: `collectNodePropertyBindings` (bindingEngine.ts)
    // deliberately excludes `sourceType: 'regionColumn'` bindings from `plan.propertyBindings`
    // — they're tracked separately in `plan.regionPlan.regionColumnBindings`. But this
    // function's bound-attribute-emission loop only ever iterated `plan.propertyBindings` and
    // store-read bindings, never region column bindings — so a Region-bound `value` (the
    // flagship "Region" binding capability, exercised by every bound form field in the
    // catalog) was silently DROPPED from every exported/published form's JSX, even though
    // `resolveNodePropertyBindingExpression` correctly resolves the underlying expression when
    // called directly (which is all the pre-existing `evaluateRegionParity` harness evaluator
    // ever checked — it never verified the expression actually reaches a real JSX attribute).
    // Preview renders the value correctly via a completely separate resolution path
    // (designerRuntimePreview.tsx), so this divergence was invisible to any DOM-level preview
    // test and to the binding-parity snapshot suite alike.
    const fixture = buildBindingParityFixture('Region');
    const tsx = generateDesignerTsx(fixture.state.document, fixture.state.bindingDefinitions);

    expect(tsx).toContain('firstName');
    // Bug found (parity audit item 29): heroui.input-text now exports the rich `UiInput`
    // wrapper (from @/shared/ui/HeroFieldControls) instead of the raw @heroui/react `Input`
    // primitive — updated to match the current (correct) exported tag name.
    expect(tsx).toMatch(/<UiInput[^>]*\bvalue=\{regionData_users\?\.firstName\}/);
  });
});

describe('binding parity edge cases — Region column null/blank field values', () => {
  it('a null column value resolves identically between the engine expression and the codegen expression', () => {
    const fixture = buildBindingParityFixture('Region');
    const nullPayload = { id: 42, firstName: null, email: 'elena@example.com', status: 'active' };
    const updated = withMockPayload(fixture, nullPayload);
    const { document, bindingDefinitions } = updated.state;

    const regionPlan = collectDocumentRegionPlan(document, bindingDefinitions);
    const columnBinding = regionPlan.regionColumnBindings.find(
      (entry) => entry.nodeId === updated.nodeId && entry.targetProp === updated.targetProp,
    )!;
    const dataVar = columnBinding.dataVar;
    const recordContext = {
      [dataVar]: normalizeHydrationResolvedValue(applyResponseDataPath(nullPayload, undefined), 'record'),
    };

    const engineResult = evaluateCodegenExpression(
      regionColumnToExpression(columnBinding.dataVar, columnBinding.column),
      recordContext,
    );

    const bindingContext = createTsxBindingRenderContext(document, bindingDefinitions);
    const codegenExpression = resolveNodePropertyBindingExpression(updated.nodeId, updated.targetProp ?? 'value', bindingContext)!;
    const codegenResult = evaluateCodegenExpression(codegenExpression, recordContext);

    expect(codegenResult).toBe(engineResult);
    expect(codegenResult).toBeNull();
  });
});

describe('binding parity edge cases — cross-capability node (Region value binding + DynamicActions onChange together)', () => {
  const buildCrossCapabilityFixture = () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.form',
      parentId: state.document.rootNodeId,
    });
    const formId = state.document.nodes[state.document.rootNodeId]!.children.at(-1)!;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        primaryKey: 'id',
        fields: ['id', 'firstName', 'email'],
        kind: 'record',
        operations: {
          list: { method: 'GET', endpoint: '/api/users' },
          detail: { method: 'GET', endpoint: '/api/users/:id' },
        },
      },
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('users'),
    });

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: formId,
    });
    const inputId = state.document.nodes[formId]!.children.at(-1)!;

    // Capability 1: Region column value binding.
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputId,
      bindingKey: propertyBindingKeyForProp('value'),
      definition: createRegionColumnBindingDefinition('value', 'firstName'),
    });

    // Capability 2 on the SAME node: a DynamicActions onChange (setValue on itself's mirror path).
    const setValueAction = createDynamicAction('setValue');
    setValueAction.targetNodeId = inputId;
    setValueAction.storePath = defaultSetValueStorePathForNode(inputId);
    setValueAction.staticValue = 'changed';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputId,
      bindingKey: eventBindingKeyForEvent('onChange'),
      definition: createDynamicActionsEventBindingDefinition('onChange', [setValueAction]),
    });

    return { state, formId, inputId };
  };

  it('codegen emits both the Region value expression and the DynamicActions onChange handler on the same node, without either clobbering the other', () => {
    const { state, inputId } = buildCrossCapabilityFixture();
    const { document, bindingDefinitions } = state;
    const bindingContext = createTsxBindingRenderContext(document, bindingDefinitions);

    const valueExpression = resolveNodePropertyBindingExpression(inputId, 'value', bindingContext);
    expect(valueExpression).toBeTruthy();
    expect(valueExpression).toContain('firstName');

    const onChangeAttr = resolveBoundEventAttribute(inputId, 'onChange', bindingContext);
    expect(onChangeAttr).toBeTruthy();
    expect(onChangeAttr).toContain('onChange');

    // Full-document codegen: both must appear on the generated input element, and the
    // dynamic action's setValue literal must be present in the handler preamble.
    const tsx = generateDesignerTsx(document, bindingDefinitions);
    expect(tsx).toContain('firstName');
    expect(tsx).toContain('"changed"');
  });

  it('engine dispatches the DynamicActions onChange store patch independent of (and without disturbing) the Region value binding resolution', () => {
    const { state, inputId } = buildCrossCapabilityFixture();
    const { document, bindingDefinitions } = state;

    // Region side still resolves the bound value from hydrated record data.
    const regionPlan = collectDocumentRegionPlan(document, bindingDefinitions);
    const columnBinding = regionPlan.regionColumnBindings.find(
      (entry) => entry.nodeId === inputId && entry.targetProp === 'value',
    )!;
    const recordContext = { [columnBinding.dataVar]: { id: 1, firstName: 'Elena' } };
    const resolvedValue = evaluateCodegenExpression(
      regionColumnToExpression(columnBinding.dataVar, columnBinding.column),
      recordContext,
    );
    expect(resolvedValue).toBe('Elena');

    // DynamicActions side independently patches the store when onChange fires.
    const clickDefinition = document.nodes[inputId]?.binding[eventBindingKeyForEvent('onChange')];
    expect(clickDefinition).toBeTruthy();
    const resolvedActions = resolveDynamicActions(clickDefinition!, bindingDefinitions);
    expect(resolvedActions).toHaveLength(1);

    const designerStore: Record<string, unknown> = {};
    const runtimeContext = {
      designerStore,
      patchStore: (path: string, value: unknown) => {
        Object.assign(designerStore, patchNestedStoreValue(designerStore, path, value));
      },
    };
    for (const action of resolvedActions) {
      void executeDynamicAction(action, runtimeContext);
    }

    const setPath = defaultSetValueStorePathForNode(inputId).split('.');
    let cursor: unknown = designerStore;
    for (const segment of setPath) {
      cursor = (cursor as Record<string, unknown>)?.[segment];
    }
    expect(cursor).toBe('changed');

    // Confirm the region-column binding lookup for 'value' still finds the Region binding
    // untouched by the sibling event binding sharing the same node.
    const valueBinding = getNodeRegionColumnBinding(document.nodes[inputId]!, 'value');
    expect(valueBinding?.definition.sourceType).toBe('regionColumn');
    expect(valueBinding?.column).toBe('firstName');
  });
});
