import { readRowUiColor, normalizeHexColor } from '../../shared/lib/uiColorUtils';
import {
  formatBoundPlaceholder,
  getNodePropertyBinding,
  resolvePropertyBindingDataPath,
} from './bindingEngine';
import {
  findAncestorDataRegion,
  getNodeRegionColumnBinding,
  resolveAncestorRegionDataVar,
} from './bindingRegionEngine';
import { normalizeDesignerOptionItems } from './designerAutocompleteItems';
import { normalizeBoundDesignerOptionItems } from './designerOptionItems';
import {
  resolveCanvasImageAlt,
  resolveCanvasImageSrc,
  resolveCanvasInputPlaceholder,
  resolveCanvasInputValue,
  resolveCanvasTextContent,
} from './bindingCanvasResolver';
import { coerceApiRecordValue } from './bindingResourceModel';
import { getStoreSegments } from './bindingRegistry';
import { getNodeStoreReadBindingForProp } from './bindingStoreEngine';
import { applyPersistedDesignerStoreSegments } from './bindingStorePersistence';
import { mergeInitialGridQueryIntoStore } from './designerInitialGridQueryStore';
import {
  evaluateDesignerFormulaValue,
  getNodeFormulaBindingForProp,
  isFormulaBindingDefinition,
  resolveFormulaExpressionText,
} from './bindingFormulaEngine';
import type { PreviewCultureFormatOptions, PreviewBoundFieldKind } from './previewCultureFormatting';
import {
  formatPreviewCultureScalar,
  resolvePreviewBoundFieldKind,
} from './previewCultureFormatting';
import {
  isTranslationTextContentMode,
  resolveTranslatableTextPreview,
} from './translatableTextContent';
import type { DesignerBindingDefinitions, DesignerDocument, DesignerNode } from './types';
import type { DesignerPreviewBindingBridge } from './runtimeTypes';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readPath = (input: unknown, path: string): unknown => {
  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  return segments.reduce<unknown>((current, segment) => {
    if (isRecord(current)) {
      return current[segment];
    }
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      return current[Number(segment)];
    }
    return undefined;
  }, input);
};

const normalizeDataPath = (dataPath: string): string =>
  dataPath.trim().replace(/^dataContext\./, '').replace(/^data\./, '');

const formatPreviewValue = (
  value: unknown,
  cultureFormat?: PreviewCultureFormatOptions,
  fieldKind: PreviewBoundFieldKind = 'text',
): string | undefined => {
  if (cultureFormat) {
    const formatted = formatPreviewCultureScalar(value, cultureFormat, fieldKind);
    if (formatted !== undefined) {
      return formatted;
    }
  }

  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};
export const buildPreviewDataContext = (previewResults: Record<string, unknown>): Record<string, unknown> => {
  const context: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(previewResults)) {
    if (value !== undefined && value !== null) {
      context[key] = value;
    }
  }

  return context;
};

const getQueryParams = (): Record<string, string> => {
  const params: Record<string, string> = {};
  if (typeof window === 'undefined') {
    return params;
  }

  const parseSearch = (search: string) => {
    const searchParams = new URLSearchParams(search);
    for (const [key, val] of searchParams.entries()) {
      params[key] = val;
    }
  };

  parseSearch(window.location.search);

  if (window.parent !== window) {
    try {
      parseSearch(window.parent.location.search);
    } catch {
      // Ignore cross-origin parent access errors
    }
  }

  return params;
};

/** Merge React Router / deep-link path params into the designer store (path params win over URL search). */
export const mergeDesignerRouteParamsIntoStore = (
  store: Record<string, unknown>,
  routeParams: Record<string, string> | undefined,
): Record<string, unknown> => {
  if (!routeParams) {
    return store;
  }

  const pathEntries = Object.entries(routeParams).filter(
    ([, value]) => typeof value === 'string' && value.trim().length > 0,
  );
  if (pathEntries.length === 0) {
    return store;
  }

  const pathParams = Object.fromEntries(pathEntries.map(([key, value]) => [key, value.trim()]));
  const existingUrl = (
    store.urlParams && typeof store.urlParams === 'object' && !Array.isArray(store.urlParams)
      ? store.urlParams as Record<string, unknown>
      : {}
  );
  const existingQuery = (
    store.query && typeof store.query === 'object' && !Array.isArray(store.query)
      ? store.query as Record<string, unknown>
      : {}
  );
  const mergedUrl = { ...existingUrl, ...pathParams };
  const mergedQuery = { ...existingQuery, ...pathParams };
  const next: Record<string, unknown> = {
    ...store,
    urlParams: mergedUrl,
    query: mergedQuery,
    params: mergedUrl,
    routeParams: mergedUrl,
  };

  if (typeof pathParams.id === 'string' && pathParams.id.length > 0) {
    const selection = (
      next.selection && typeof next.selection === 'object' && !Array.isArray(next.selection)
        ? { ...(next.selection as Record<string, unknown>) }
        : {}
    );
    selection.id = pathParams.id;
    next.selection = selection;
  }

  return next;
};

export const buildPreviewDesignerStore = (
  bindingDefinitions: DesignerBindingDefinitions | Record<string, unknown> | undefined,
  routeParams?: Record<string, string>,
  documentKey?: string,
  document?: DesignerDocument,
): Record<string, unknown> => {
  const initial: Record<string, unknown> = {};
  const segments = getStoreSegments((bindingDefinitions ?? {}) as DesignerBindingDefinitions);

  if (segments && typeof segments === 'object') {
    for (const segment of Object.values(segments)) {
      if (segment.initialValue !== undefined) {
        initial[segment.id] = structuredClone(segment.initialValue);
      } else {
        initial[segment.id] = {};
      }
    }
  }

  const queryParams = getQueryParams();
  initial.urlParams = queryParams;
  initial.query = queryParams;
  initial.params = queryParams;
  initial.routeParams = queryParams;

  const withRoute = mergeDesignerRouteParamsIntoStore(initial, routeParams);
  const withPersist = applyPersistedDesignerStoreSegments(withRoute, bindingDefinitions, documentKey);
  if (!document) {
    return withPersist;
  }
  return mergeInitialGridQueryIntoStore(
    withPersist,
    document,
    (bindingDefinitions ?? {}) as DesignerBindingDefinitions,
  );
};

/** CD-J02 — inject simulated preview role into store.user.role for visibility conditions. */
export const buildPreviewDesignerStoreWithRole = (
  bindingDefinitions: DesignerBindingDefinitions | Record<string, unknown> | undefined,
  simulatedRole: string,
  routeParams?: Record<string, string>,
  documentKey?: string,
  document?: DesignerDocument,
): Record<string, unknown> => {
  const store = buildPreviewDesignerStore(bindingDefinitions, routeParams, documentKey, document);
  const role = simulatedRole.trim();
  if (role.length === 0) {
    return store;
  }

  return patchNestedStoreValue(store, 'user.role', role);
};

export type DesignerAuthUserSnapshot = {
  id: number;
  email: string;
  role: string;
  roles: string[];
  /** Optional display name; falls back to email when omitted. */
  displayName?: string;
};

/** Published runtime — hydrate store.user for visibility expressions + session bindings. */
export const buildPreviewDesignerStoreWithAuthUser = (
  bindingDefinitions: DesignerBindingDefinitions | Record<string, unknown> | undefined,
  user: DesignerAuthUserSnapshot | null | undefined,
  routeParams?: Record<string, string>,
  documentKey?: string,
  document?: DesignerDocument,
): Record<string, unknown> => {
  const store = buildPreviewDesignerStore(bindingDefinitions, routeParams, documentKey, document);
  if (!user) {
    return store;
  }

  let next = patchNestedStoreValue(store, 'user.id', user.id);
  next = patchNestedStoreValue(next, 'user.email', user.email);
  next = patchNestedStoreValue(next, 'user.role', user.role.trim().toUpperCase());
  next = patchNestedStoreValue(next, 'user.roles', user.roles.map((role) => role.trim().toUpperCase()));
  const displayName = typeof user.displayName === 'string' && user.displayName.trim().length > 0
    ? user.displayName.trim()
    : user.email;
  next = patchNestedStoreValue(next, 'user.displayName', displayName);
  return next;
};

export const patchNestedStoreValue = (
  store: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> => {
  const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) {
    return store;
  }

  const next = { ...store };
  let cursor: Record<string, unknown> = next;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const existing = cursor[segment];
    const branch = isRecord(existing) ? { ...existing } : {};
    cursor[segment] = branch;
    cursor = branch;
  }

  cursor[segments[segments.length - 1]] = value;
  return next;
};

const resolveStoreValue = (
  designerStore: Record<string, unknown>,
  storePath: string,
): unknown => {
  const normalized = storePath.startsWith('store.') ? storePath.slice('store.'.length) : storePath;
  return readPath(designerStore, normalized);
};

const resolvePreviewBindingKey = (nodeId: string, bindingKey: string): string => `node:${nodeId}:${bindingKey}`;

export const createDesignerPreviewBindingBridge = (params: {
  previewResults: Record<string, unknown>;
  designerStore: Record<string, unknown>;
  dataContext: Record<string, unknown>;
  document?: DesignerDocument;
  setValueStorePathsByNodeId?: Map<string, string>;
  cultureFormat?: PreviewCultureFormatOptions;
  translate?: (key: string) => string;
}): DesignerPreviewBindingBridge => {
  const {
    previewResults,
    designerStore,
    dataContext,
    document,
    setValueStorePathsByNodeId,
    cultureFormat,
    translate,
  } = params;

  const resolveBoundValue = (node: DesignerNode, targetProp: string, staticValue: unknown): unknown => {    const previewKey = resolvePreviewBindingKey(node.id, `prop:${targetProp}`);
    if (Object.prototype.hasOwnProperty.call(previewResults, previewKey)) {
      return previewResults[previewKey];
    }

    const dynamicStorePath = targetProp === 'value'
      ? setValueStorePathsByNodeId?.get(node.id)
      : undefined;
    if (dynamicStorePath) {
      const dynamicValue = resolveStoreValue(designerStore, dynamicStorePath);
      if (dynamicValue !== undefined) {
        return dynamicValue;
      }
    }

    const regionColumnBinding = getNodeRegionColumnBinding(node, targetProp);
    if (regionColumnBinding && document) {
      const ancestor = findAncestorDataRegion(document, node.id);
      if (ancestor) {
        const dataVar = resolveAncestorRegionDataVar(document, ancestor);
        const regionRecord = coerceApiRecordValue(readPath(dataContext, dataVar));
        if (regionRecord) {
          let columnValue = regionRecord[regionColumnBinding.column];
          if (columnValue === undefined && regionColumnBinding.column === 'uiColor') {
            columnValue = readRowUiColor(regionRecord) ?? undefined;
          }
          if (columnValue === undefined && regionColumnBinding.column === 'uiHtml') {
            columnValue = regionRecord.ui_html ?? regionRecord.uiHtml ?? undefined;
          }
          if (columnValue !== undefined && regionColumnBinding.column === 'uiColor') {
            return normalizeHexColor(columnValue) ?? columnValue;
          }
          if (columnValue !== undefined) {
            return columnValue;
          }
        }
      }
    }

    const storeBinding = getNodeStoreReadBindingForProp(node, targetProp);
    if (storeBinding) {
      const storeValue = resolveStoreValue(designerStore, storeBinding.storePath);
      if (storeValue !== undefined) {
        return storeValue;
      }
      return formatBoundPlaceholder(`store.${storeBinding.storePath}`);
    }

    const formulaBinding = getNodeFormulaBindingForProp(node, targetProp);
    if (formulaBinding) {
      const formulaValue = evaluateDesignerFormulaValue(
        formulaBinding.formula,
        designerStore,
        isRecord(dataContext) ? dataContext : null,
      );
      if (formulaValue !== undefined) {
        return formulaValue;
      }
      return formatBoundPlaceholder(`formula:${formulaBinding.formula}`);
    }

    const binding = getNodePropertyBinding(node, targetProp);
    if (!binding) {
      return staticValue;
    }

    if (isFormulaBindingDefinition(binding.definition)) {
      const formula = resolveFormulaExpressionText(binding.definition);
      if (formula) {
        const formulaValue = evaluateDesignerFormulaValue(
          formula,
          designerStore,
          isRecord(dataContext) ? dataContext : null,
        );
        if (formulaValue !== undefined) {
          return formulaValue;
        }
        return formatBoundPlaceholder(`formula:${formula}`);
      }
    }

    const dataPath = resolvePropertyBindingDataPath(binding.definition);
    if (!dataPath) {
      return staticValue;
    }

    if (dataPath.startsWith('store.')) {
      const storeValue = resolveStoreValue(designerStore, dataPath);
      if (storeValue !== undefined) {
        return storeValue;
      }
      return formatBoundPlaceholder(dataPath);
    }

    const normalizedPath = normalizeDataPath(dataPath);
    const contextValue = readPath(dataContext, normalizedPath);
    if (contextValue !== undefined) {
      return contextValue;
    }

    return formatBoundPlaceholder(dataPath);
  };

  return {
    resolveTextContent: (node, fallback) => {
      const legacyTextKey = typeof node.props.textTranslationKey === 'string'
        ? node.props.textTranslationKey.trim()
        : '';
      if (translate && legacyTextKey && !getNodePropertyBinding(node, 'text')) {
        const legacyTranslated = translate(legacyTextKey);
        if (legacyTranslated.trim().length > 0 && legacyTranslated !== legacyTextKey) {
          return legacyTranslated;
        }
      }

      if (translate && isTranslationTextContentMode(node) && !getNodePropertyBinding(node, 'text')) {
        return resolveTranslatableTextPreview(node, translate, fallback);
      }

      const bound = resolveBoundValue(node, 'text', node.props.text);
      const formatted = formatPreviewValue(bound, cultureFormat, 'text');
      if (formatted !== undefined && formatted.trim().length > 0) {
        return formatted;
      }

      return resolveCanvasTextContent(node, fallback);
    },
    resolveInputPlaceholder: (node, fallback) => {
      const bound = resolveBoundValue(node, 'placeholder', node.props.placeholder);
      const formatted = formatPreviewValue(bound, cultureFormat, 'text');
      if (formatted !== undefined) {
        return formatted;
      }
      return resolveCanvasInputPlaceholder(node, fallback);
    },
    resolveInputValue: (node) => {
      const bound = resolveBoundValue(node, 'value', node.props.value);
      const fieldKind = resolvePreviewBoundFieldKind(node);
      const formatted = formatPreviewValue(bound, cultureFormat, fieldKind);
      if (formatted !== undefined) {
        return formatted;
      }
      return resolveCanvasInputValue(node);
    },
    resolveSelectSelectedKeys: (node) => {
      const bound = resolveBoundValue(node, 'selectedKeys', node.props.selectedKeys);
      const formatted = formatPreviewValue(bound, cultureFormat, 'text');
      if (formatted !== undefined && formatted.trim().length > 0) {
        return formatted;
      }
      return undefined;
    },
    resolveSelectItems: (node) => {
      const bound = resolveBoundValue(node, 'items', node.props.items);
      const normalized = normalizeBoundDesignerOptionItems(bound, node.props.items);
      return normalized.length > 0 ? normalized : undefined;
    },
    resolveChoiceGroupSelectedValues: (node) => {
      const bound = resolveBoundValue(node, 'isSelected', node.props.isSelected);
      if (Array.isArray(bound)) {
        return bound.map((entry) => String(entry)).filter((entry) => entry.length > 0);
      }
      if (typeof bound === 'string') {
        return bound.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
      }
      if (typeof bound === 'boolean') {
        return bound ? [] : [];
      }
      if (bound === undefined || bound === null) {
        return undefined;
      }
      return [String(bound)];
    },
    resolveSwitchIsSelected: (node, fallback) => {
      const bound = resolveBoundValue(
        node,
        'isSelected',
        node.props.isSelected ?? node.props.defaultSelected,
      );
      if (typeof bound === 'boolean') {
        return bound;
      }
      if (bound === 'true' || bound === '1' || bound === 1) {
        return true;
      }
      if (bound === 'false' || bound === '0' || bound === 0) {
        return false;
      }
      return fallback;
    },
    resolveImageSrc: (node, fallback) => {
      const bound = resolveBoundValue(node, 'src', node.props.src);
      const formatted = formatPreviewValue(bound);
      if (formatted !== undefined) {
        return formatted;
      }
      return resolveCanvasImageSrc(node, fallback);
    },
    resolveImageAlt: (node, fallback) => {
      const bound = resolveBoundValue(node, 'alt', node.props.alt);
      const formatted = formatPreviewValue(bound);
      if (formatted !== undefined) {
        return formatted;
      }
      return resolveCanvasImageAlt(node, fallback);
    },
    // Bug found (cluster D): heroui.card's title/description and heroui.accordion-item's
    // title are declared as bindable Inspector fields (generic 'string' type), but the
    // structural renderers read them as plain static node.props with no binding awareness
    // at all — a Property Binding configured for these fields was 100% invisible in the
    // live/interactive canvas preview. resolveTextContent above only ever reads the `text`
    // prop, so it can't be reused for `title`/`description`; this generic variant fixes that.
    resolveTextProp: (node, targetProp, fallback) => {
      const staticValue = (node.props as Record<string, unknown>)[targetProp];
      const bound = resolveBoundValue(node, targetProp, staticValue);
      const formatted = formatPreviewValue(bound, cultureFormat, 'text');
      if (formatted !== undefined && formatted.trim().length > 0) {
        return formatted;
      }
      return typeof staticValue === 'string' && staticValue.trim().length > 0 ? staticValue : fallback;
    },
    resolveNumberProp: (node, targetProp, fallback) => {
      const staticValue = (node.props as Record<string, unknown>)[targetProp];
      const bound = resolveBoundValue(node, targetProp, staticValue);
      if (bound !== undefined && bound !== null) {
        const parsed = Number(bound);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      return fallback;
    },
  };
};

export const resolveRepeaterPreviewItems = (
  dataPath: string,
  designerStore: Record<string, unknown>,
  dataContext: Record<string, unknown>,
  scopeItem?: unknown,
): unknown[] => {
  const normalized = dataPath.trim();
  let source: unknown;

  if (normalized.startsWith('store.')) {
    source = resolveStoreValue(designerStore, normalized);
  } else if (normalized.startsWith('item.')) {
    const remainder = normalized.slice('item.'.length);
    source = readPath(scopeItem, remainder);
  } else {
    source = readPath(dataContext, normalizeDataPath(normalized));
  }

  if (Array.isArray(source) && source.length > 0) {
    return source;
  }

  return [
    { id: 1, label: 'Preview item 1' },
    { id: 2, label: 'Preview item 2' },
    { id: 3, label: 'Preview item 3' },
  ];
};
