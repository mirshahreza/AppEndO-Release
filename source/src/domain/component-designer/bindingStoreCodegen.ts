import type { DesignerBindingDefinitions, DesignerDocument, DesignerStoreSegment } from './types';
import { getStoreSegments } from './bindingRegistry';
import { collectDocumentStorePlan, type ResolvedStoreWriteBinding } from './bindingStoreEngine';
import { documentUsesDynamicActionStore, documentUsesNavigateStorePlaceholders } from './bindingDynamicActionsEngine';
import { collectDocumentChartPlan } from './bindingChartEngine';
import { documentHasDashboardFilterBar } from './bindingFilterBindingsEngine';
import { collectDocumentGridDetailFlows } from './bindingGridDetailEngine';
import { collectGridRowActionsFromColumns } from './designerGridActionColumns';
import {
  APP_TABLE_GRID_PALETTE_ITEM_ID,
  parseDesignerAppTableGridColumns,
} from './designerDataGridColumns';
import { isDesignerGridToolbarEnabled, parseDesignerGridToolbarConfig } from './designerGridToolbarConfig';
import { getNodePaletteItemId } from './runtimeShared';
import { extractFormulaDependencyPaths, isFormulaBindingDefinition } from './bindingFormulaEngine';

/**
 * Bug found: a chart with a Filters-step toolbar (search/dropdown/date-range/refresh) needs the
 * real `{ store, patch }` pair from `useDesignerStore` — the generated `<DesignerChartRuntimeToolbar
 * onStorePathChange={patchDesignerStore} .../>` calls `patch` directly — but this check never
 * considered chart toolbars, so a chart-only document (no other store reads/writes/segments)
 * fell through to the OTHER declaration branch (`fetchHooksReferenceDesignerStore` in
 * bindingCodegen.ts), which only declares a static empty `const designerStore = {}` with NO
 * `patch` function at all, producing a "patchDesignerStore is not defined" runtime error.
 *
 * Also (Phase 47): property bindings with `sourceType: 'formula'` that reference `store.*`
 * compile to live `designerStore?.…` expressions — without this gate a formula-only document
 * would get the static empty store stub and evaluate against `{}`.
 */
export const documentUsesFormulaStoreReferences = (document: DesignerDocument): boolean =>
  Object.values(document.nodes).some((node) =>
    Object.values(node.binding).some((definition) => {
      if (!definition || !isFormulaBindingDefinition(definition)) {
        return false;
      }
      const formula = (
        typeof definition.sourcePath === 'string' && definition.sourcePath.trim().length > 0
          ? definition.sourcePath
          : typeof definition.dataPath === 'string'
            ? definition.dataPath
            : ''
      );
      return extractFormulaDependencyPaths(formula).store.length > 0;
    }),
  );

/** True when App Table Grid toolbar / row actions / disable rules need a live designerStore. */
export const documentAppTableGridUsesStore = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): boolean => {
  const detailFlows = collectDocumentGridDetailFlows(document, bindingDefinitions);
  const flowGridNodeIds = new Set(detailFlows.map((flow) => flow.gridNodeId));

  return Object.values(document.nodes).some((node) => {
    if (getNodePaletteItemId(node) !== APP_TABLE_GRID_PALETTE_ITEM_ID) {
      return false;
    }

    if (isDesignerGridToolbarEnabled(parseDesignerGridToolbarConfig(node.props.toolbarConfig))) {
      return true;
    }

    if (flowGridNodeIds.has(node.id)) {
      return true;
    }

    const columns = parseDesignerAppTableGridColumns(node.props.columns);
    return columns.some((column) => {
      const usesCurrentUserStore = (rule: { preset?: string } | undefined): boolean =>
        rule?.preset === 'current-user-row' || rule?.preset === 'users-login-as';

      if (usesCurrentUserStore(column.cellDisabledWhen) || usesCurrentUserStore(column.actionDisabledWhen)) {
        return true;
      }
      if (
        column.cellDisabledWhen?.preset === 'expression'
        && /\b(?:store|designerStore)\./.test(column.cellDisabledWhen.expression ?? '')
      ) {
        return true;
      }
      if (
        column.actionDisabledWhen?.preset === 'expression'
        && /\b(?:store|designerStore)\./.test(column.actionDisabledWhen.expression ?? '')
      ) {
        return true;
      }
      return (column.actions ?? []).some((action) => (
        usesCurrentUserStore(action.disabledWhen)
        || (
          action.disabledWhen?.preset === 'expression'
          && /\b(?:store|designerStore)\./.test(action.disabledWhen.expression ?? '')
        )
      ));
    }) || collectGridRowActionsFromColumns(columns).length > 0;
  });
};

export const DESIGNER_STORE_VAR = 'designerStore';
export const DESIGNER_STORE_PATCH_VAR = 'patchDesignerStore';

const serializeInitialValue = (value: unknown): string => {
  if (value === undefined) {
    return 'undefined';
  }

  return JSON.stringify(value);
};

export const buildStoreInitialStateLiteral = (
  storeSegments: Record<string, DesignerStoreSegment>,
): string => {
  const initial: Record<string, unknown> = {};

  for (const segment of Object.values(storeSegments)) {
    if (segment.initialValue !== undefined) {
      const pathParts = segment.id.includes('.') ? [segment.id] : [segment.id];
      if (pathParts.length === 1) {
        initial[pathParts[0]] = segment.initialValue;
      }
    } else {
      initial[segment.id] = {};
    }
  }

  if (Object.keys(initial).length === 0) {
    return '{}';
  }

  return JSON.stringify(initial);
};

export const renderDesignerStoreHookDefinition = (): string[] => [
  'function useDesignerStore<T extends Record<string, unknown>>(initial: T) {',
  '  const [store, setStore] = React.useState<T>(initial);',
  '  const patch = React.useCallback((path: string, value: unknown) => {',
  '    setStore((previous) => {',
  '      const next = { ...previous };',
  '      setNestedPayloadValue(next, path, value);',
  '      return next as T;',
  '    });',
  '  }, []);',
  '  return { store, patch };',
  '}',
];

export const renderDesignerStoreHookLines = (
  bindingDefinitions: DesignerBindingDefinitions,
): string[] => {
  const storeSegments = getStoreSegments(bindingDefinitions);
  if (Object.keys(storeSegments).length === 0) {
    return [];
  }

  const initialLiteral = buildStoreInitialStateLiteral(storeSegments);
  return [
    `  const { store: ${DESIGNER_STORE_VAR}, patch: ${DESIGNER_STORE_PATCH_VAR} } = useDesignerStore<Record<string, unknown>>(${initialLiteral});`,
  ];
};

export const designerStoreCodegenRequired = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): boolean => {
  const plan = collectDocumentStorePlan(document, bindingDefinitions);
  // Bug found: a chart with a Filters-step toolbar (search/dropdown/date-range/refresh) needs the
  // real `{ store, patch }` pair from `useDesignerStore` — the generated `<DesignerChartRuntimeToolbar
  // onStorePathChange={patchDesignerStore} .../>` calls `patch` directly — but this check never
  // considered chart toolbars, so a chart-only document (no other store reads/writes/segments)
  // fell through to the OTHER declaration branch (`fetchHooksReferenceDesignerStore` in
  // bindingCodegen.ts), which only declares a static empty `const designerStore = {}` with NO
  // `patch` function at all, producing a "patchDesignerStore is not defined" runtime error.
  const chartToolbarUsesStore = collectDocumentChartPlan(document, bindingDefinitions)
    .chartListFetches.some((entry) => entry.toolbarConfig.enabled === true);
  return plan.readBindings.length > 0
    || plan.writeBindings.length > 0
    || Object.keys(getStoreSegments(bindingDefinitions)).length > 0
    || documentUsesDynamicActionStore(document)
    || documentUsesNavigateStorePlaceholders(document)
    || chartToolbarUsesStore
    || documentHasDashboardFilterBar(document)
    || documentAppTableGridUsesStore(document, bindingDefinitions)
    || documentUsesFormulaStoreReferences(document);
};

export const resolveStoreWriteValueExpression = (binding: ResolvedStoreWriteBinding): string => {
  switch (binding.targetEvent) {
    case 'onChange':
    case 'onBlur':
      return 'event.target.value';
    case 'onClick':
      return 'true';
    case 'onSortChange':
      return 'descriptor';
    case 'onPageChange':
      return 'nextPage';
    case 'onTaskDrag':
    case 'onCardMove':
      return 'event?.target?.value ?? null';
    default:
      return 'event?.target?.value ?? null';
  }
};

export const renderStorePatchStatement = (
  binding: ResolvedStoreWriteBinding,
  indent: string,
): string[] => {
  const valueExpression = resolveStoreWriteValueExpression(binding);
  return [`${indent}${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(binding.storePath)}, ${valueExpression});`];
};
