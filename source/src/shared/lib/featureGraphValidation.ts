import type { FeatureGraph, FeatureGraphNode } from './aiIndexCodegen';

export class FeatureGraphValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeatureGraphValidationError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const readString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new FeatureGraphValidationError(`${field} must be a non-empty string.`);
  }
  return value;
};

const readStringAllowEmpty = (value: unknown, field: string): string => {
  if (typeof value !== 'string') {
    throw new FeatureGraphValidationError(`${field} must be a string.`);
  }
  return value;
};

const readNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new FeatureGraphValidationError('Expected string or null.');
  }
  return value;
};

const readStringArray = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value)) {
    throw new FeatureGraphValidationError(`${field} must be an array.`);
  }
  return value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw new FeatureGraphValidationError(`${field}[${index}] must be a string.`);
    }
    return entry;
  });
};

const parseFeatureGraphNode = (value: unknown, index: number): FeatureGraphNode => {
  if (!isRecord(value)) {
    throw new FeatureGraphValidationError(`nodes[${index}] must be an object.`);
  }

  if (!isRecord(value.ui)) {
    throw new FeatureGraphValidationError(`nodes[${index}].ui must be an object.`);
  }
  if (!isRecord(value.api)) {
    throw new FeatureGraphValidationError(`nodes[${index}].api must be an object.`);
  }

  const ui = value.ui;
  const api = value.api;

  return {
    pageKey: readString(value.pageKey, `nodes[${index}].pageKey`),
    label: readString(value.label, `nodes[${index}].label`),
    menuGroup: readNullableString(value.menuGroup),
    routePattern: readStringAllowEmpty(value.routePattern, `nodes[${index}].routePattern`),
    inStudioMenu: value.inStudioMenu === true,
    ui: {
      pageModule: readNullableString(ui.pageModule),
      loaderRef: readString(ui.loaderRef, `nodes[${index}].ui.loaderRef`),
      page: readNullableString(ui.page),
      feature: readNullableString(ui.feature),
      domain: readNullableString(ui.domain),
      workspace: readNullableString(ui.workspace),
    },
    api: {
      routes: readStringArray(api.routes, `nodes[${index}].api.routes`),
      apiPrefixes: readStringArray(api.apiPrefixes, `nodes[${index}].api.apiPrefixes`),
      contracts: readNullableString(api.contracts),
      services: readStringArray(api.services, `nodes[${index}].api.services`),
    },
    tests: readNullableString(value.tests),
    notes: readNullableString(value.notes),
  };
};

/** Validate unknown JSON as FeatureGraph — AE-3.2 schema hook. */
export const validateFeatureGraph = (value: unknown): FeatureGraph => {
  if (!isRecord(value)) {
    throw new FeatureGraphValidationError('Feature graph root must be an object.');
  }

  if (!isRecord(value.source)) {
    throw new FeatureGraphValidationError('Feature graph source must be an object.');
  }

  const version = readString(value.version, 'version');
  const generatedAt = readString(value.generatedAt, 'generatedAt');
  const source = value.source;

  if (!Array.isArray(value.nodes)) {
    throw new FeatureGraphValidationError('Feature graph nodes must be an array.');
  }

  const nodes = value.nodes.map((node, index) => parseFeatureGraphNode(node, index));

  return {
    version,
    generatedAt,
    source: {
      navigation: readString(source.navigation, 'source.navigation'),
      pageModulesDir: readString(source.pageModulesDir, 'source.pageModulesDir'),
    },
    nodes,
  };
};
