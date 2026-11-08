import { collectDocumentBindingPlan, eventBindingKeyForEvent, getNodePropertyBinding } from '../bindingEngine';
import {
  createTsxBindingRenderContext,
  resolveNodePropertyBindingExpression,
} from '../bindingCodegen';
import { generateDesignerTsx } from '../codegen';
import {
  applyResponseDataPath,
  coerceApiRecordValue,
  normalizeHydrationResolvedValue,
} from '../bindingResourceModel';
import {
  collectDocumentRegionPlan,
  regionColumnToExpression,
} from '../bindingRegionEngine';
import {
  collectDocumentGridPlan,
  resolveGridListDataVarName,
} from '../bindingGridEngine';
import { collectDocumentRepeaterPlan } from '../bindingRepeaterEngine';
import {
  buildGridDetailRowActionPreview,
  collectDocumentGridDetailFlows,
} from '../bindingGridDetailEngine';
import {
  collectDocumentChartPlan,
  parseDesignerChartFieldMapping,
  resolveChartDataFromRows,
  resolveChartListDataVarName,
} from '../bindingChartEngine';
import {
  collectDocumentVizPlan,
  resolveVizDataFromRows,
  resolveVizListDataVarName,
} from '../bindingVizEngine';
import {
  collectDocumentContentPlan,
  resolveContentCsvFromRows,
  resolveContentListDataVarName,
} from '../bindingContentEngine';
import {
  collectDocumentStorePlan,
  resolveStorePathExpression,
} from '../bindingStoreEngine';
import {
  collectDynamicActionSetValueStorePaths,
  resolveDynamicSetValueBindingExpression,
} from '../bindingDynamicActionsCodegen';
import {
  defaultSetValueStorePathForNode,
  resolveDynamicActions,
  visibilityStorePathForNode,
} from '../bindingDynamicActionsEngine';
import { buildPayloadFromFormData } from '../bindingMutationRuntime';
import { mapLovApiItemsToSelectOptions, resolvePropertyBindingLovMapping } from '../bindingLovRegistry';
import { parseDesignerVizFieldMapping } from '../visualizationDataTransform';
import { transformApiRowsToChartData } from '../bindingChartEngine';
import {
  transformApiRowsToKanbanBoard,
  transformApiRowsToSheetData,
  transformApiRowsToTimelineEvents,
  transformApiRowsToTreeNodes,
} from '../visualizationDataTransform';
import { patchNestedStoreValue } from '../designerPreviewResolvers';
import { executeDynamicAction } from '../bindingDynamicActionsRuntime';
import {
  evaluateEngineEntityPickerNormalizer,
  evaluateExportEntityPickerNormalizer,
  exportTsxIncludesEntityPickerRuntimeHelpers,
} from './entityPickerCodegenEval';
import type { BindingParityComparison, BindingParityFixture } from './types';

const deepEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const asRows = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((row): row is Record<string, unknown> =>
    typeof row === 'object' && row !== null && !Array.isArray(row),
  );
};

/**
 * Strip TypeScript-only syntax so generated binding expressions can run in `new Function`.
 *
 * Bug found (section 2.2 — binding architecture review): the `Array<...>` cast pattern below
 * only matched a single level of `[^>]+` (no nested `>`), so a genuinely-generated codegen
 * expression like `x as Array<Record<string, unknown>>` (used by Chart/Viz's own `rows`
 * expressions, and now Grid's too) stripped only up to the FIRST `>` — leaving a dangling `>`
 * behind that made the "stripped" expression invalid JS (`SyntaxError: Unexpected token ':'`).
 * This went unnoticed because no prior test evaluated those particular codegen expression
 * strings through `evaluateCodegenExpression` (Chart/Viz's harness evaluators call the
 * underlying transform helper functions directly instead). Fixed to allow one level of nested
 * angle brackets, matching the actual cast shapes this codebase's codegen emits.
 */
const stripTypeScriptFromExpression = (expression: string): string =>
  expression
    .replace(/\s+as\s+Array<(?:[^<>]|<[^<>]*>)*>/g, '')
    .replace(/\s+as\s+Record<(?:[^<>]|<[^<>]*>)*>/g, '')
    .replace(/:\s*Record<string,\s*unknown>/g, '')
    .replace(/:\s*unknown/g, '')
    .replace(/\((\w+):\s*[^)]+\)/g, '($1)');

/** Evaluate a codegen expression string with shared transform helpers in scope. */
export const evaluateCodegenExpression = (
  expression: string,
  scope: Record<string, unknown>,
): unknown => {
  const sanitized = stripTypeScriptFromExpression(expression);
  const scopeKeys = Object.keys(scope);
  const scopeValues = Object.values(scope);
  const helpers = {
    transformApiRowsToChartData,
    transformApiRowsToTreeNodes,
    transformApiRowsToTimelineEvents,
    transformApiRowsToKanbanBoard,
    transformApiRowsToSheetData,
    JSON,
    Array,
    String,
    Boolean,
    Number,
    Object,
    Record: Object,
  };
  const helperKeys = Object.keys(helpers);
  const helperValues = Object.values(helpers);

  // eslint-disable-next-line no-new-func
  const evaluator = new Function(
    ...helperKeys,
    ...scopeKeys,
    `return (${sanitized});`,
  );
  return evaluator(...helperValues, ...scopeValues);
};

const hydrateListVar = (
  fixture: BindingParityFixture,
  _dataVar: string,
  responseMapping?: { arrayPath?: string; dataPath?: string },
): unknown => {
  const normalized = normalizeHydrationResolvedValue(
    applyResponseDataPath(fixture.mockApiPayload, responseMapping),
    'rows',
  );
  return normalized;
};

const buildDataContext = (fixture: BindingParityFixture): Record<string, unknown> => {
  const { document, bindingDefinitions } = fixture.state;
  const context: Record<string, unknown> = {};

  const regionPlan = collectDocumentRegionPlan(document, bindingDefinitions);
  for (const fetch of regionPlan.regionFetches) {
    context[fetch.dataVar] = normalizeHydrationResolvedValue(
      applyResponseDataPath(fixture.mockApiPayload, fetch.responseMapping),
      'record',
    );
  }

  const gridPlan = collectDocumentGridPlan(document, bindingDefinitions);
  for (const fetch of gridPlan.gridListFetches) {
    context[fetch.dataVar] = hydrateListVar(fixture, fetch.dataVar, fetch.responseMapping);
  }

  const repeaterPlan = collectDocumentRepeaterPlan(document, bindingDefinitions);
  for (const fetch of repeaterPlan.repeaterListFetches) {
    context[fetch.dataVar] = hydrateListVar(fixture, fetch.dataVar, fetch.responseMapping);
  }

  const chartPlan = collectDocumentChartPlan(document, bindingDefinitions);
  for (const fetch of chartPlan.chartListFetches) {
    context[fetch.dataVar] = hydrateListVar(fixture, fetch.dataVar, fetch.responseMapping);
  }

  const vizPlan = collectDocumentVizPlan(document, bindingDefinitions);
  for (const fetch of vizPlan.vizListFetches) {
    context[fetch.dataVar] = hydrateListVar(fixture, fetch.dataVar, fetch.responseMapping);
  }

  const contentPlan = collectDocumentContentPlan(document, bindingDefinitions);
  for (const fetch of contentPlan.contentListFetches) {
    context[fetch.dataVar] = hydrateListVar(fixture, fetch.dataVar, fetch.responseMapping);
  }

  const propertyBinding = getNodePropertyBinding(
    document.nodes[fixture.nodeId]!,
    'items',
  );
  if (propertyBinding?.definition) {
    const lovMapping = resolvePropertyBindingLovMapping(propertyBinding.definition, bindingDefinitions);
    if (lovMapping) {
      const lovVar = propertyBinding.definition.dataPath ?? 'lovData';
      context[lovVar] = mapLovApiItemsToSelectOptions(fixture.mockApiPayload, lovMapping);
    }
  }

  return context;
};

/**
 * Data context built the same way real generated (exported) code actually computes its
 * fetch-hook variables — i.e. `applyResponseDataPath` only, with NO `normalizeHydrationResolvedValue`
 * rows/record coercion on top (see `renderGridListFetchHookLines`/`renderChartFetchHookLines`/etc. in
 * `bindingCodegen.ts`, which emit exactly `useMemo(() => applyResponseDataPath(raw, mapping))`).
 *
 * `buildDataContext` above is intentionally *not* used for this: it normalizes every fetch var via
 * `normalizeHydrationResolvedValue(..., 'rows')` before either engine or codegen evaluators ever see
 * it, which silently hides any divergence that only appears when the raw API payload doesn't already
 * unwrap to an array (a single-object response, an unexpected key, etc.) — exactly the shape codegen
 * itself never guarantees. Use this context whenever a test wants to prove codegen is safe against the
 * data shape it will actually receive at runtime, not the pre-sanitized shape the shared fixture harness
 * hands both sides for convenience.
 */
export const buildRawCodegenDataContext = (fixture: BindingParityFixture): Record<string, unknown> => {
  const { document, bindingDefinitions } = fixture.state;
  const context: Record<string, unknown> = {};

  const regionPlan = collectDocumentRegionPlan(document, bindingDefinitions);
  for (const fetch of regionPlan.regionFetches) {
    context[fetch.dataVar] = coerceApiRecordValue(
      applyResponseDataPath(fixture.mockApiPayload, fetch.responseMapping),
    );
  }

  const gridPlan = collectDocumentGridPlan(document, bindingDefinitions);
  for (const fetch of gridPlan.gridListFetches) {
    context[fetch.dataVar] = applyResponseDataPath(fixture.mockApiPayload, fetch.responseMapping);
  }

  const repeaterPlan = collectDocumentRepeaterPlan(document, bindingDefinitions);
  for (const fetch of repeaterPlan.repeaterListFetches) {
    context[fetch.dataVar] = applyResponseDataPath(fixture.mockApiPayload, fetch.responseMapping);
  }

  const chartPlan = collectDocumentChartPlan(document, bindingDefinitions);
  for (const fetch of chartPlan.chartListFetches) {
    context[fetch.dataVar] = applyResponseDataPath(fixture.mockApiPayload, fetch.responseMapping);
  }

  const vizPlan = collectDocumentVizPlan(document, bindingDefinitions);
  for (const fetch of vizPlan.vizListFetches) {
    context[fetch.dataVar] = applyResponseDataPath(fixture.mockApiPayload, fetch.responseMapping);
  }

  const contentPlan = collectDocumentContentPlan(document, bindingDefinitions);
  for (const fetch of contentPlan.contentListFetches) {
    context[fetch.dataVar] = applyResponseDataPath(fixture.mockApiPayload, fetch.responseMapping);
  }

  return context;
};

const evaluateRegionParity = (fixture: BindingParityFixture): BindingParityComparison => {
  const { document, bindingDefinitions } = fixture.state;
  const regionPlan = collectDocumentRegionPlan(document, bindingDefinitions);
  const columnBinding = regionPlan.regionColumnBindings.find(
    (entry) => entry.nodeId === fixture.nodeId && entry.targetProp === fixture.targetProp,
  );
  const dataContext = buildDataContext(fixture);

  const engineData = columnBinding
    ? evaluateCodegenExpression(
      regionColumnToExpression(columnBinding.dataVar, columnBinding.column),
      dataContext,
    )
    : null;

  const bindingContext = createTsxBindingRenderContext(document, bindingDefinitions);
  const codegenExpression = resolveNodePropertyBindingExpression(
    fixture.nodeId,
    fixture.targetProp ?? 'value',
    bindingContext,
  );
  const codegenData = codegenExpression
    ? evaluateCodegenExpression(codegenExpression, dataContext)
    : null;

  return {
    capability: fixture.capability,
    fixtureId: fixture.id,
    engineData,
    codegenData,
    matches: deepEqual(engineData, codegenData),
    engineLabel: 'regionColumnToExpression + hydrated regionData',
    codegenLabel: 'resolveNodePropertyBindingExpression',
  };
};

const evaluateGridParity = (fixture: BindingParityFixture): BindingParityComparison => {
  const { document, bindingDefinitions } = fixture.state;
  const dataContext = buildDataContext(fixture);
  const dataVar = resolveGridListDataVarName(fixture.nodeId);
  const engineData = dataContext[dataVar];

  const bindingContext = createTsxBindingRenderContext(document, bindingDefinitions);
  const codegenExpression = resolveNodePropertyBindingExpression(fixture.nodeId, 'rows', bindingContext);
  const codegenData = codegenExpression
    ? evaluateCodegenExpression(codegenExpression, dataContext)
    : null;

  return {
    capability: fixture.capability,
    fixtureId: fixture.id,
    engineData,
    codegenData,
    matches: deepEqual(engineData, codegenData),
    engineLabel: 'hydrated gridList dataVar rows',
    codegenLabel: 'resolveNodePropertyBindingExpression(rows)',
  };
};

const evaluateGridDetailParity = (fixture: BindingParityFixture): BindingParityComparison => {
  const { document, bindingDefinitions } = fixture.state;
  const flows = collectDocumentGridDetailFlows(document, bindingDefinitions);
  const flow = flows[0];
  const row = asRows(
    hydrateListVar(fixture, resolveGridListDataVarName(fixture.nodeId), { arrayPath: 'items' },
    ),
  )[0] ?? { id: 7 };

  const designerStore: Record<string, unknown> = {};
  if (flow) {
    buildGridDetailRowActionPreview(flow, row, flow.config.rowActionId, {
      patchStore: (path, value) => {
        Object.assign(designerStore, patchNestedStoreValue(designerStore, path, value));
      },
      patchStoreState: (updater) => {
        Object.assign(designerStore, updater({ ...designerStore }));
      },
    });
  }

  const engineData = {
    selectionUserId: readNested(designerStore, 'selection.userId'),
    modalVisible: flow
      ? readNested(designerStore, visibilityStorePathForNode(flow.config.detailModalNodeId))
      : undefined,
  };

  const tsx = generateDesignerTsx(document, bindingDefinitions);
  const codegenUsesSelectionPath = tsx.includes('selection.userId');
  const codegenPatchesVisibility = flow
    ? tsx.includes(visibilityStorePathForNode(flow.config.detailModalNodeId))
    : false;

  const codegenData = {
    selectionStorePathPresent: codegenUsesSelectionPath,
    visibilityStorePatchPresent: codegenPatchesVisibility,
    handlerPresent: flow ? tsx.includes(flow.handlerName) : false,
  };

  return {
    capability: fixture.capability,
    fixtureId: fixture.id,
    engineData,
    codegenData,
    matches: Boolean(codegenData.handlerPresent && codegenData.selectionStorePathPresent && codegenData.visibilityStorePatchPresent),
    engineLabel: 'buildGridDetailRowActionPreview store patches',
    codegenLabel: 'generateDesignerTsx grid detail handler + store paths',
    notes: 'Structural/codegen presence check — runtime row-action execution differs between preview handlers and export hooks.',
  };
};

const readNested = (store: Record<string, unknown>, path: string): unknown => {
  const segments = path.split('.').filter(Boolean);
  let cursor: unknown = store;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object') {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
};

const evaluateChartParity = (fixture: BindingParityFixture): BindingParityComparison => {
  const { document, bindingDefinitions } = fixture.state;
  const node = document.nodes[fixture.nodeId]!;
  const fieldMapping = parseDesignerChartFieldMapping(node.props.chartFieldMapping);
  const rows = asRows(buildDataContext(fixture)[resolveChartListDataVarName(fixture.nodeId)]);

  const engineResolved = resolveChartDataFromRows(rows, fieldMapping, 'revenue,cost');
  const engineData = engineResolved.data;

  const codegenData = fieldMapping
    ? transformApiRowsToChartData(rows, fieldMapping)
    : rows;

  return {
    capability: fixture.capability,
    fixtureId: fixture.id,
    engineData,
    codegenData,
    matches: deepEqual(engineData, codegenData),
    engineLabel: 'resolveChartDataFromRows().data',
    codegenLabel: 'transformApiRowsToChartData (codegen data prop expression)',
  };
};

const evaluateVizParity = (fixture: BindingParityFixture): BindingParityComparison => {
  const { document, bindingDefinitions } = fixture.state;
  const node = document.nodes[fixture.nodeId]!;
  const fieldMapping = parseDesignerVizFieldMapping(node.props.vizFieldMapping);
  const dataVar = resolveVizListDataVarName(fixture.nodeId);
  const rows = asRows(buildDataContext(fixture)[dataVar]);

  const engineData = resolveVizDataFromRows(rows, fieldMapping);

  let codegenData: unknown = rows;
  if (fieldMapping?.kind === 'kanban') {
    codegenData = transformApiRowsToKanbanBoard(rows, fieldMapping);
  } else if (fieldMapping?.kind === 'tree') {
    codegenData = transformApiRowsToTreeNodes(rows, fieldMapping);
  } else if (fieldMapping?.kind === 'timeline' || fieldMapping?.kind === 'gantt') {
    codegenData = transformApiRowsToTimelineEvents(rows, fieldMapping);
  } else if (fieldMapping?.kind === 'sheet') {
    codegenData = transformApiRowsToSheetData(rows, fieldMapping);
  }

  return {
    capability: fixture.capability,
    fixtureId: fixture.id,
    engineData,
    codegenData,
    matches: deepEqual(engineData, codegenData),
    engineLabel: 'resolveVizDataFromRows',
    codegenLabel: 'viz transform helper (codegen data prop expression)',
  };
};

const evaluateStoreParity = (fixture: BindingParityFixture): BindingParityComparison => {
  const { document, bindingDefinitions } = fixture.state;
  const storePlan = collectDocumentStorePlan(document, bindingDefinitions);
  const readBinding = storePlan.readBindings.find((entry) => entry.nodeId === fixture.nodeId);
  const designerStore = {
    filters: { countryId: 'de' },
    selection: { countryId: 'us' },
  };

  const engineExpression = readBinding
    ? resolveStorePathExpression(readBinding.storePath)
    : null;
  const engineData = engineExpression
    ? evaluateCodegenExpression(engineExpression, { designerStore })
    : null;

  const bindingContext = createTsxBindingRenderContext(document, bindingDefinitions);
  const setValuePaths = collectDynamicActionSetValueStorePaths(document);
  const codegenExpression = readBinding
    ? resolveDynamicSetValueBindingExpression(
      fixture.nodeId,
      'rows',
      resolveStorePathExpression(readBinding.storePath),
      setValuePaths,
    )
    : resolveNodePropertyBindingExpression(fixture.nodeId, 'rows', bindingContext);

  const codegenData = codegenExpression
    ? evaluateCodegenExpression(codegenExpression, { designerStore })
    : null;

  return {
    capability: fixture.capability,
    fixtureId: fixture.id,
    engineData,
    codegenData,
    matches: deepEqual(engineData, codegenData),
    engineLabel: 'resolveStorePathExpression',
    codegenLabel: 'codegen store read expression',
  };
};

const evaluateContentParity = (fixture: BindingParityFixture): BindingParityComparison => {
  const { document, bindingDefinitions } = fixture.state;
  const dataVar = resolveContentListDataVarName(fixture.nodeId);
  const rows = asRows(buildDataContext(fixture)[dataVar]);

  const engineData = resolveContentCsvFromRows(rows);

  const bindingContext = createTsxBindingRenderContext(document, bindingDefinitions);
  const codegenExpression = resolveNodePropertyBindingExpression(fixture.nodeId, 'steps', bindingContext);
  const codegenData = codegenExpression
    ? evaluateCodegenExpression(codegenExpression, { [dataVar]: rows })
    : null;

  return {
    capability: fixture.capability,
    fixtureId: fixture.id,
    engineData,
    codegenData,
    matches: deepEqual(engineData, codegenData),
    engineLabel: 'resolveContentCsvFromRows (preview)',
    codegenLabel: 'resolveContentCsvExpression (codegen)',
  };
};

const evaluateDynamicActionsParity = (fixture: BindingParityFixture): BindingParityComparison => {
  const { document, bindingDefinitions } = fixture.state;
  const plan = collectDocumentBindingPlan(document, bindingDefinitions);
  const clickDefinition = document.nodes[fixture.nodeId]?.binding[eventBindingKeyForEvent('onClick')];
  const resolvedActions = clickDefinition
    ? resolveDynamicActions(clickDefinition, bindingDefinitions)
    : [];

  const designerStore: Record<string, unknown> = {};
  const enginePatches: Array<{ path: string; value: unknown }> = [];
  const runtimeContext = {
    designerStore,
    patchStore: (path: string, value: unknown) => {
      enginePatches.push({ path, value });
      Object.assign(designerStore, patchNestedStoreValue(designerStore, path, value));
    },
  };
  for (const action of resolvedActions) {
    if (action.type === 'refreshDataSource') {
      continue;
    }
    void executeDynamicAction(action, runtimeContext);
  }

  const panelId = document.nodes[fixture.state.document.rootNodeId].children.find(
    (childId) => document.nodes[childId]?.props?._designerPaletteItemId === 'layout.stack-compact',
  );
  const engineData = {
    setValuePath: defaultSetValueStorePathForNode(fixture.nodeId),
    setValue: readNested(designerStore, defaultSetValueStorePathForNode(fixture.nodeId)),
    visibilityPath: panelId ? visibilityStorePathForNode(panelId) : undefined,
    visibility: panelId ? readNested(designerStore, visibilityStorePathForNode(panelId)) : undefined,
    patchCount: enginePatches.length,
  };

  const tsx = generateDesignerTsx(document, bindingDefinitions);
  const codegenData = {
    setValuePath: defaultSetValueStorePathForNode(fixture.nodeId),
    setValueLiteralPresent: tsx.includes('"clicked"'),
    visibilityPath: panelId ? visibilityStorePathForNode(panelId) : undefined,
    visibilityPatchPresent: panelId ? tsx.includes(visibilityStorePathForNode(panelId)) : false,
    refreshHookPresent: tsx.includes('refresh_regionData_users') || tsx.includes('refreshDataContext'),
  };

  return {
    capability: fixture.capability,
    fixtureId: fixture.id,
    engineData,
    codegenData,
    matches: Boolean(
      engineData.setValue === 'clicked'
      && engineData.visibility === true
      && codegenData.setValueLiteralPresent
      && codegenData.visibilityPatchPresent,
    ),
    engineLabel: 'executeDynamicActions store patches',
    codegenLabel: 'generateDesignerTsx dynamic action preamble',
    notes: 'refreshDataSource side-effect not compared — only setValue/showHide store outcomes.',
  };
};

const evaluateMutationParity = (fixture: BindingParityFixture): BindingParityComparison => {
  const { document, bindingDefinitions } = fixture.state;
  const plan = collectDocumentBindingPlan(document, bindingDefinitions);
  const submitBinding = plan.eventBindings.find(
    (entry) => entry.nodeId === fixture.nodeId && entry.targetEvent === 'onSubmit',
  );

  const inputIds = document.nodes[fixture.nodeId]?.children ?? [];
  const formData = new FormData();
  for (const childId of inputIds) {
    const node = document.nodes[childId];
    if (!node) {
      continue;
    }
    if (node.props._designerPaletteItemId === 'heroui.input-text') {
      formData.set(childId, String((fixture.mockApiPayload as Record<string, unknown>).email ?? ''));
    }
  }

  const engineData = buildPayloadFromFormData(formData, submitBinding?.payloadMapping);

  // TSX validity (does it actually compile) is already verified for every fixture,
  // including this one, via the properly-awaited `expectValidTsx` check in
  // bindingParitySnapshot.test.ts. This function only evaluates payload-mapping parity.
  const tsx = generateDesignerTsx(document, bindingDefinitions);
  const codegenData: unknown = {
    endpoint: submitBinding?.endpoint,
    actionType: submitBinding?.actionType,
    payloadMappingKeys: Object.keys(submitBinding?.payloadMapping ?? {}),
    usesDesignerFetch: tsx.includes('designerFetch'),
    usesBuildPayload: tsx.includes('buildPayloadFromFormData') || tsx.includes('FormData'),
  };

  return {
    capability: fixture.capability,
    fixtureId: fixture.id,
    engineData,
    codegenData,
    matches: deepEqual(
      engineData,
      Object.fromEntries(
        Object.entries(submitBinding?.payloadMapping ?? {}).map(([apiField, formField]) => [
          apiField,
          formData.get(formField),
        ]),
      ),
    ),
    engineLabel: 'buildPayloadFromFormData (preview mutation runtime)',
    codegenLabel: 'compiled mutation handler structure',
    notes: 'Export uses DOM-scoped FormData collection; preview uses bindingMutationRuntime directly.',
  };
};

const evaluateEntityPickerParity = (fixture: BindingParityFixture): BindingParityComparison => {
  const { document, bindingDefinitions } = fixture.state;
  const engineData = evaluateEngineEntityPickerNormalizer(fixture.mockApiPayload);

  const tsx = generateDesignerTsx(document, bindingDefinitions);
  let codegenData: unknown = null;
  let codegenExecuted = false;
  let codegenError: string | undefined;

  if (exportTsxIncludesEntityPickerRuntimeHelpers(tsx)) {
    try {
      codegenData = evaluateExportEntityPickerNormalizer(tsx, fixture.mockApiPayload);
      codegenExecuted = true;
    } catch (error) {
      codegenError = error instanceof Error ? error.message : String(error);
    }
  }

  const dataMatches = codegenExecuted && deepEqual(engineData, codegenData);

  return {
    capability: fixture.capability,
    fixtureId: fixture.id,
    engineData,
    codegenData,
    matches: dataMatches,
    engineLabel: 'bindingEntityPickerCodegen normalizeEntityPickerItems (engine source)',
    codegenLabel: 'compiled export normalizeEntityPickerItems execution',
    notes: codegenError
      ? `Export helper execution failed: ${codegenError}`
      : !exportTsxIncludesEntityPickerRuntimeHelpers(tsx)
        ? 'Export TSX omits useEntityPickerOptions/normalizeEntityPickerItems runtime helpers.'
        : undefined,
  };
};

const mapDesignerLovItemsCodegen = (
  rawItems: unknown,
  returnColumn: string,
  displayColumn: string,
): Array<{ id: string; textValue: string }> => {
  const items = Array.isArray(rawItems) ? rawItems : [];
  return items
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const id = String(record[returnColumn] ?? '').trim();
      if (!id) {
        return null;
      }
      const textValue = String(record[displayColumn] ?? id).trim();
      return { id, textValue: textValue || id };
    })
    .filter((entry): entry is { id: string; textValue: string } => entry !== null);
};

const evaluateLovParity = (fixture: BindingParityFixture): BindingParityComparison => {
  const { document, bindingDefinitions } = fixture.state;
  const propertyBinding = getNodePropertyBinding(document.nodes[fixture.nodeId]!, 'items');
  const lovMapping = propertyBinding?.definition
    ? resolvePropertyBindingLovMapping(propertyBinding.definition, bindingDefinitions)
    : undefined;

  const engineData = lovMapping
    ? mapLovApiItemsToSelectOptions(fixture.mockApiPayload, lovMapping)
    : [];

  const record = fixture.mockApiPayload && typeof fixture.mockApiPayload === 'object'
    ? fixture.mockApiPayload as Record<string, unknown>
    : null;
  const rawRows = Array.isArray(record?.items)
    ? record.items
    : Array.isArray(fixture.mockApiPayload)
      ? fixture.mockApiPayload
      : [];

  const codegenData = lovMapping
    ? mapDesignerLovItemsCodegen(rawRows, lovMapping.returnColumn, lovMapping.displayColumn)
    : [];

  const tsx = generateDesignerTsx(document, bindingDefinitions);

  return {
    capability: fixture.capability,
    fixtureId: fixture.id,
    engineData,
    codegenData,
    matches: deepEqual(engineData, codegenData) && tsx.includes('mapDesignerLovItems'),
    engineLabel: 'mapLovApiItemsToSelectOptions (preview — unwraps {items:[]} from API)',
    codegenLabel: 'mapDesignerLovItems (export — expects pre-unwrapped rows from fetch hook)',
    notes: deepEqual(engineData, codegenData)
      ? 'Row mapping matches when both receive equivalent row arrays. Parity risk remains in fetch/unwrap layer before mapping.'
      : 'Column mapping or payload unwrap differs between preview LOV path and export helper.',
  };
};

const EVALUATORS: Record<BindingParityFixture['capability'], (fixture: BindingParityFixture) => BindingParityComparison> = {
  Region: evaluateRegionParity,
  Grid: evaluateGridParity,
  GridDetail: evaluateGridDetailParity,
  Chart: evaluateChartParity,
  Viz: evaluateVizParity,
  Store: evaluateStoreParity,
  Content: evaluateContentParity,
  DynamicActions: evaluateDynamicActionsParity,
  Mutation: evaluateMutationParity,
  EntityPicker: evaluateEntityPickerParity,
  LOV: evaluateLovParity,
};

export const compareBindingParity = (fixture: BindingParityFixture): BindingParityComparison => {
  const evaluate = EVALUATORS[fixture.capability];
  return evaluate(fixture);
};

export const compareAllBindingParities = (fixtures: BindingParityFixture[]): BindingParityComparison[] =>
  fixtures.map((fixture) => compareBindingParity(fixture));

export const summarizeBindingParityMismatches = (
  results: BindingParityComparison[],
): BindingParityComparison[] => results.filter((result) => !result.matches);
