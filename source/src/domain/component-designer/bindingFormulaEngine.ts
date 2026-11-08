import {
  compileDesignerConditionExpression,
  isSafeDesignerRuntimeExpression,
} from './visibilityConditionEngine';
import type { DesignerBindingDefinition, DesignerNode } from './types';

const propertyBindingKeyForProp = (targetProp: string): string => `prop:${targetProp}`;

/**
 * Shared value-expression compiler (Phase 47).
 * Same rewrite rules as visibility (`store.*` / `data.*` → safe optional chains),
 * but empty input becomes `null` (not `true`) because this is a value formula, not a boolean gate.
 */
export const normalizeFormulaExpressionText = (formula: string): string => {
  const trimmed = formula.trim();
  if (trimmed.startsWith('=')) {
    return trimmed.slice(1).trim();
  }
  return trimmed;
};

export const compileDesignerFormulaExpression = (formula: string): string => {
  const expression = normalizeFormulaExpressionText(formula);
  if (expression.length === 0) {
    return 'null';
  }
  return compileDesignerConditionExpression(expression);
};

/**
 * Runtime evaluation of a property formula against the live designerStore / dataContext.
 * Preview uses this; Export inlines {@link compileDesignerFormulaExpression} as real TS.
 */
export const evaluateDesignerFormulaValue = (
  formula: string,
  designerStore: Record<string, unknown>,
  dataContext: Record<string, unknown> | null,
  scope: { item?: unknown; index?: number } = {},
): unknown => {
  const expression = normalizeFormulaExpressionText(formula);
  if (expression.length === 0) {
    return undefined;
  }
  if (!isSafeDesignerRuntimeExpression(expression)) {
    return undefined;
  }

  try {
    const compiled = compileDesignerConditionExpression(expression);
    const evaluator = new Function(
      'designerStore',
      'dataContext',
      'item',
      'index',
      `return (${compiled});`,
    ) as (
      designerStore: Record<string, unknown>,
      dataContext: Record<string, unknown> | null,
      item: unknown,
      index: number | undefined,
    ) => unknown;
    return evaluator(designerStore, dataContext, scope.item, scope.index);
  } catch {
    return undefined;
  }
};

/** Alias — generalized expression engine for any bindable prop value (not only visibility). */
export const evaluateDesignerExpressionValue = evaluateDesignerFormulaValue;

export type FormulaDependencyPaths = {
  store: string[];
  data: string[];
};

/**
 * Simple dependency extraction: store./data./dataContext. paths referenced in the formula.
 * Used as change triggers — Preview re-evaluates whenever designerStore/dataContext updates;
 * callers can also use these paths for diagnostics / explicit subscriptions.
 */
export const extractFormulaDependencyPaths = (formula: string): FormulaDependencyPaths => {
  const expression = normalizeFormulaExpressionText(formula);
  const store = new Set<string>();
  const data = new Set<string>();

  for (const match of expression.matchAll(/\bstore\.([A-Za-z0-9_.-]+)/g)) {
    const path = match[1]?.trim();
    if (path) {
      store.add(path);
    }
  }

  for (const match of expression.matchAll(/\b(?:data|dataContext)\.([A-Za-z0-9_.-]+)/g)) {
    const path = match[1]?.trim();
    if (path) {
      data.add(path);
    }
  }

  return {
    store: [...store],
    data: [...data],
  };
};

export const isFormulaBindingDefinition = (
  definition: DesignerBindingDefinition | null | undefined,
): boolean => definition?.sourceType === 'formula';

export const resolveFormulaExpressionText = (
  definition: DesignerBindingDefinition | null | undefined,
): string | undefined => {
  if (!definition || definition.sourceType !== 'formula') {
    return undefined;
  }

  if (typeof definition.sourcePath === 'string' && definition.sourcePath.trim().length > 0) {
    return definition.sourcePath.trim();
  }

  if (typeof definition.dataPath === 'string' && definition.dataPath.trim().length > 0) {
    return definition.dataPath.trim();
  }

  return undefined;
};

export const createFormulaBindingDefinition = (
  targetProp: string,
  formula: string,
): { bindingKey: string; definition: DesignerBindingDefinition } => {
  const trimmed = formula.trim();
  const dependencies = extractFormulaDependencyPaths(trimmed);
  return {
    bindingKey: propertyBindingKeyForProp(targetProp),
    definition: {
      sourceType: 'formula',
      bindingRole: 'property',
      targetProp,
      sourcePath: trimmed,
      dataPath: trimmed,
      formulaExpression: trimmed,
      // Persist extracted deps so Export/diagnostics can see triggers without re-parsing.
      formulaDependencies: [
        ...dependencies.store.map((path) => `store.${path}`),
        ...dependencies.data.map((path) => `data.${path}`),
      ],
    },
  };
};

export type ResolvedFormulaBinding = {
  bindingKey: string;
  nodeId: string;
  targetProp: string;
  formula: string;
  dependencies: FormulaDependencyPaths;
  definition: DesignerBindingDefinition;
};

export const collectNodeFormulaBindings = (node: DesignerNode): ResolvedFormulaBinding[] => {
  const resolved: ResolvedFormulaBinding[] = [];

  for (const [bindingKey, definition] of Object.entries(node.binding)) {
    if (!definition || !isFormulaBindingDefinition(definition)) {
      continue;
    }

    const formula = resolveFormulaExpressionText(definition);
    if (!formula) {
      continue;
    }

    const targetProp = (
      typeof definition.targetProp === 'string' && definition.targetProp.trim().length > 0
        ? definition.targetProp.trim()
        : bindingKey.startsWith('prop:')
          ? bindingKey.slice('prop:'.length)
          : ''
    ).trim();
    if (!targetProp) {
      continue;
    }

    resolved.push({
      bindingKey,
      nodeId: node.id,
      targetProp,
      formula,
      dependencies: extractFormulaDependencyPaths(formula),
      definition: {
        ...definition,
        sourceType: 'formula',
        bindingRole: 'property',
        targetProp,
        sourcePath: formula,
        dataPath: formula,
      },
    });
  }

  return resolved;
};

export const getNodeFormulaBindingForProp = (
  node: DesignerNode,
  targetProp: string,
): ResolvedFormulaBinding | null => {
  for (const binding of collectNodeFormulaBindings(node)) {
    if (binding.targetProp === targetProp) {
      return binding;
    }
  }
  return null;
};

export const formatFormulaBoundPlaceholder = (formula: string): string => {
  const compact = formula.trim().replace(/\s+/g, ' ');
  const clipped = compact.length > 48 ? `${compact.slice(0, 45)}…` : compact;
  return `[Formula: ${clipped}]`;
};
