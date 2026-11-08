import type { DesignerBindingDefinition, DesignerBindingDefinitions, DesignerStoreSegment, GridDetailFlowConfig } from './types';
import { sanitizeDataSourceDefinition, sanitizeLovDefinition } from './bindingLovRegistry';
import { sanitizeTrueActions } from './bindingDynamicActionsEngine';
import { sanitizeGridDetailFlowConfig } from './bindingGridDetailConfig';

export type { DesignerBindingDefinition, DesignerBindingDefinitions, DesignerStoreSegment } from './types';
export type { DataSourceDefinition, LovDefinition } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeBindingDefinition = (value: unknown): DesignerBindingDefinition => {
  if (!isRecord(value)) {
    return { sourceType: 'static' };
  }

  const sourceType = value.sourceType;
  const safeSourceType = sourceType === 'apiRef' || sourceType === 'expression' || sourceType === 'static' || sourceType === 'store' || sourceType === 'regionColumn' || sourceType === 'session' || sourceType === 'formula'
    ? sourceType
    : 'static';

  const candidate = value as DesignerBindingDefinition;
  const sanitized: DesignerBindingDefinition = {
    ...candidate,
    sourceType: safeSourceType,
  };

  if (safeSourceType === 'session') {
    const sessionField = candidate.sessionField;
    if (
      sessionField === 'userId'
      || sessionField === 'email'
      || sessionField === 'role'
      || sessionField === 'displayName'
    ) {
      sanitized.sessionField = sessionField;
    } else {
      delete sanitized.sessionField;
    }
  }

  if (safeSourceType === 'formula') {
    const formulaText = (
      typeof candidate.sourcePath === 'string' && candidate.sourcePath.trim().length > 0
        ? candidate.sourcePath.trim()
        : typeof candidate.dataPath === 'string' && candidate.dataPath.trim().length > 0
          ? candidate.dataPath.trim()
          : typeof candidate.formulaExpression === 'string' && candidate.formulaExpression.trim().length > 0
            ? candidate.formulaExpression.trim()
            : ''
    );
    if (formulaText.length > 0) {
      sanitized.sourcePath = formulaText;
      sanitized.dataPath = formulaText;
      sanitized.formulaExpression = formulaText;
    }
    const formulaDependencies = Array.isArray(candidate.formulaDependencies)
      ? candidate.formulaDependencies
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0)
      : undefined;
    if (formulaDependencies && formulaDependencies.length > 0) {
      sanitized.formulaDependencies = formulaDependencies;
    } else {
      delete sanitized.formulaDependencies;
    }
  } else {
    delete sanitized.formulaExpression;
    delete sanitized.formulaDependencies;
  }

  if (Array.isArray(candidate.trueActions)) {
    sanitized.trueActions = sanitizeTrueActions(candidate.trueActions);
  }

  const filterBindings = Array.isArray(candidate.filterBindings)
    ? candidate.filterBindings
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0)
    : undefined;
  if (filterBindings && filterBindings.length > 0) {
    sanitized.filterBindings = filterBindings;
  } else {
    delete sanitized.filterBindings;
  }

  const gridDetailFlow = sanitizeGridDetailFlowConfig(candidate.gridDetailFlow);
  if (gridDetailFlow) {
    sanitized.gridDetailFlow = gridDetailFlow;
  }

  return sanitized;
};

const sanitizeStoreSegment = (value: unknown): DesignerStoreSegment | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.trim().length === 0) {
    return null;
  }

  const persist = value.persist;
  const safePersist = persist === 'session' || persist === 'local' ? persist : 'none';

  return {
    id: value.id.trim(),
    initialValue: value.initialValue,
    hydrateFrom: typeof value.hydrateFrom === 'string' ? value.hydrateFrom : undefined,
    persist: safePersist,
  };
};

export const createDefaultBindingDefinitions = (): DesignerBindingDefinitions => ({
  definitions: {
    defaultVisibility: {
      sourceType: 'static',
      sourcePath: 'true',
      fallbackValue: true,
    },
  },
  storeSegments: {},
  dataSources: {},
  lovs: {},
});

const sanitizeRegistryCollections = (input: Record<string, unknown>) => {
  const storeSegments: Record<string, DesignerStoreSegment> = {};
  if (isRecord(input.storeSegments)) {
    for (const [key, value] of Object.entries(input.storeSegments)) {
      const segment = sanitizeStoreSegment({ ...(isRecord(value) ? value : {}), id: key });
      if (segment) {
        storeSegments[segment.id] = segment;
      }
    }
  }

  const dataSources: DesignerBindingDefinitions['dataSources'] = {};
  if (isRecord(input.dataSources)) {
    for (const [key, value] of Object.entries(input.dataSources)) {
      const dataSource = sanitizeDataSourceDefinition(isRecord(value) ? { ...value, id: key } : { id: key }, key);
      if (dataSource) {
        dataSources[dataSource.id] = dataSource;
      }
    }
  }

  const lovs: DesignerBindingDefinitions['lovs'] = {};
  if (isRecord(input.lovs)) {
    for (const [key, value] of Object.entries(input.lovs)) {
      const lov = sanitizeLovDefinition(isRecord(value) ? { ...value, id: key } : { id: key }, key);
      if (lov) {
        lovs[lov.id] = lov;
      }
    }
  }

  return { storeSegments, dataSources, lovs };
};

export const normalizeBindingDefinitions = (input: unknown): DesignerBindingDefinitions => {
  if (isRecord(input) && isRecord(input.definitions)) {
    const definitions: Record<string, DesignerBindingDefinition> = {};
    for (const [key, value] of Object.entries(input.definitions)) {
      definitions[key] = sanitizeBindingDefinition(value);
    }

    const { storeSegments, dataSources, lovs } = sanitizeRegistryCollections(input);

    return { definitions, storeSegments, dataSources, lovs };
  }

  if (isRecord(input)) {
    const definitions: Record<string, DesignerBindingDefinition> = {};
    for (const [key, value] of Object.entries(input)) {
      if (key === 'storeSegments' || key === 'definitions' || key === 'dataSources' || key === 'lovs') {
        continue;
      }
      definitions[key] = sanitizeBindingDefinition(value);
    }

    const { storeSegments, dataSources, lovs } = sanitizeRegistryCollections(input);

    return { definitions, storeSegments, dataSources, lovs };
  }

  return createDefaultBindingDefinitions();
};

export const coerceBindingDefinitions = (
  input: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition>,
): DesignerBindingDefinitions => {
  if (typeof input === 'object' && input !== null && 'definitions' in input) {
    return normalizeBindingDefinitions(input);
  }

  return normalizeBindingDefinitions({ definitions: input, storeSegments: {}, dataSources: {}, lovs: {} });
};

export const getBindingDefinitionEntries = (
  registry: DesignerBindingDefinitions,
): Record<string, DesignerBindingDefinition> => registry.definitions;

export const getStoreSegments = (
  registry: DesignerBindingDefinitions,
): Record<string, DesignerStoreSegment> => registry.storeSegments;

export const getDataSources = (
  registry: DesignerBindingDefinitions,
): DesignerBindingDefinitions['dataSources'] => registry.dataSources;

export const getLovs = (
  registry: DesignerBindingDefinitions,
): DesignerBindingDefinitions['lovs'] => registry.lovs;

export const cloneBindingDefinitions = (
  registry: DesignerBindingDefinitions,
): DesignerBindingDefinitions => structuredClone(registry);

export {
  remapDataSourceReferencesInDocument,
  remapDataSourceReferencesInNode,
} from './bindingRegistryRemap';
