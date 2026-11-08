import type { EdgeApiOperation, EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import { defaultWriteClientContext } from '../../../shared/api/contracts/client-context';
import type { FunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import type { SchemaFieldInfo } from '../../../shared/api/queries/data-sources';
import {
  deriveDataApiBasePath,
  deriveDataApiKey,
  deriveDataApiLabel,
} from '../../../shared/lib/edgeApiOperations';
import {
  getSupportedMethodsForObjectType,
  type RouteComposerOption,
  type RouteValidationField,
} from './routeComposerTypes';
import {
  applySharedRouteFolder,
  buildRouteEntryPath,
  deriveBasePathFromRouteFolder,
  deriveRouteFolderFromBasePath,
  getComposerOptionsForObjectType,
  isCanonicalRouteVariant,
  parseRouteEntryFromPathPattern,
  resolveComposerHttpMethod,
  routeEntrySupportsFieldEditing,
  routeEntrySupportsOutputFieldEditing,
  slugifyRouteSegment,
  suggestFieldsForOption,
  suggestOutputFieldsForOption,
  suggestRouteFolder,
} from './dataApiRouteMethods';

export type DataApiWizardObjectType = 'TABLE' | 'VIEW';

export type DataApiWizardRouteEntry = {
  id: string;
  option: RouteComposerOption;
  folder: string;
  pathName: string;
  note?: string;
  outputFields?: string[];
  fields?: RouteValidationField[];
};

export type DataApiWizardMethodOption = {
  option: RouteComposerOption;
  method: EdgeApiOperation['method'];
  kind: EdgeApiOperation['kind'];
  label: string;
  description: string;
};

export const DATA_API_WIZARD_METHOD_OPTIONS: DataApiWizardMethodOption[] = [
  { option: 'GET_LIST', method: 'GET', kind: 'list', label: 'List', description: 'GET collection with filter, sort, and paging.' },
  { option: 'GET_ONE', method: 'GET', kind: 'getOne', label: 'Get one', description: 'GET single row by primary key.' },
  { option: 'GET_LOOKUP', method: 'GET', kind: 'lookup', label: 'Lookup', description: 'GET single row by alternate key (code / slug).' },
  { option: 'POST', method: 'POST', kind: 'create', label: 'Create', description: 'POST new row through Sequelize.' },
  { option: 'PUT', method: 'PUT', kind: 'update', label: 'Update', description: 'PUT full row update by primary key.' },
  { option: 'PATCH', method: 'PATCH', kind: 'patch', label: 'Patch', description: 'PATCH partial row update by primary key.' },
  { option: 'DELETE', method: 'DELETE', kind: 'delete', label: 'Delete', description: 'DELETE row by primary key.' },
  { option: 'POST_PIVOT', method: 'POST', kind: 'pivot', label: 'Pivot', description: 'POST pivot spec and return an aggregated matrix.' },
];

export type DataApiWizardPreset = 'collection' | 'readOnly' | 'lookup';

export type DataApiWizardState = {
  label: string;
  key: string;
  basePath: string;
  routeFolder: string;
  routes: DataApiWizardRouteEntry[];
  primaryKey: string;
  accessControl: FunctionAccessControl;
};

const createOperationSuffix = (): string => Math.random().toString(36).slice(2, 8);

const createRouteId = (): string => `route-${Math.random().toString(36).slice(2, 9)}`;

const resolveMethodOption = (option: RouteComposerOption): DataApiWizardMethodOption | undefined => (
  DATA_API_WIZARD_METHOD_OPTIONS.find((item) => item.option === option)
);

const isWizardOptionSupported = (
  objectType: DataApiWizardObjectType,
  option: RouteComposerOption,
): boolean => {
  if (option === 'POST_PIVOT') {
    return objectType === 'TABLE' || objectType === 'VIEW';
  }
  const method = resolveComposerHttpMethod(option);
  if (option === 'GET_LIST' || option === 'GET_ONE' || option === 'GET_LOOKUP') {
    return getSupportedMethodsForObjectType(objectType).includes('GET');
  }
  return getSupportedMethodsForObjectType(objectType).includes(method);
};

export const getSupportedWizardMethodOptions = (
  objectType: DataApiWizardObjectType,
): DataApiWizardMethodOption[] => (
  DATA_API_WIZARD_METHOD_OPTIONS.filter((option) => isWizardOptionSupported(objectType, option.option))
);

export const createDefaultEnabledOptions = (
  objectType: DataApiWizardObjectType,
  preset: DataApiWizardPreset = 'collection',
): Record<RouteComposerOption, boolean> => {
  const supported = new Set(
    getSupportedWizardMethodOptions(objectType).map((option) => option.option),
  );
  const readOnly = preset === 'readOnly';
  const lookupOnly = preset === 'lookup';

  return {
    GET_LIST: !lookupOnly && supported.has('GET_LIST'),
    GET_ONE: !lookupOnly && supported.has('GET_ONE'),
    GET_LOOKUP: lookupOnly && supported.has('GET_LOOKUP'),
    POST: !readOnly && !lookupOnly && supported.has('POST'),
    PUT: !readOnly && !lookupOnly && supported.has('PUT'),
    PATCH: !readOnly && !lookupOnly && supported.has('PATCH'),
    DELETE: !readOnly && !lookupOnly && supported.has('DELETE'),
    POST_PIVOT: false,
  };
};

const mapSequelizeTypeToSuggested = (
  sequelizeType: string,
): SchemaFieldInfo['suggestedFieldType'] => {
  const upper = sequelizeType.toUpperCase();
  if (upper.includes('BOOL')) return 'boolean';
  if (upper.includes('INT')) return 'integer';
  if (upper.includes('DOUBLE') || upper.includes('DEC') || upper.includes('NUM') || upper.includes('FLOAT')) {
    return 'number';
  }
  return 'string';
};

export const edgeModelColumnsToSchemaFields = (model: EdgeModelDefinition): SchemaFieldInfo[] => (
  model.columns.map((column) => ({
    name: column.name,
    dataType: column.dataType,
    suggestedFieldType: mapSequelizeTypeToSuggested(column.sequelizeType),
    nullable: column.allowNull,
    isPrimaryKey: column.isPrimaryKey,
  }))
);

export const resolveEdgeModelPrimaryKey = (model: EdgeModelDefinition): string => {
  if (typeof model.primaryKey === 'string') {
    return model.primaryKey;
  }
  return model.primaryKey[0] ?? '';
};

export const createDefaultRoutes = (
  objectType: DataApiWizardObjectType,
  columnOptions: SchemaFieldInfo[],
  primaryKey: string,
  routeFolder: string,
  preset: DataApiWizardPreset = 'collection',
): DataApiWizardRouteEntry[] => {
  const enabled = createDefaultEnabledOptions(objectType, preset);
  const routes: DataApiWizardRouteEntry[] = [];
  const folder = routeFolder.trim() || suggestRouteFolder('collection');

  for (const option of getComposerOptionsForObjectType(objectType)) {
    if (!enabled[option] || !isWizardOptionSupported(objectType, option)) {
      continue;
    }

    const inputFields = suggestFieldsForOption(option, objectType, columnOptions, primaryKey);
    const outputFields = suggestOutputFieldsForOption(option, objectType, columnOptions);

    routes.push({
      id: createRouteId(),
      option,
      folder,
      pathName: folder,
      ...(routeEntrySupportsOutputFieldEditing(option, objectType) && outputFields.length > 0
        ? { outputFields }
        : {}),
      ...(routeEntrySupportsFieldEditing(option, objectType) && inputFields.length > 0
        ? { fields: inputFields }
        : {}),
    });
  }

  return routes;
};

export const syncWizardRouteFolder = (
  state: DataApiWizardState,
  routeFolder: string,
  objectType: DataApiWizardObjectType,
): DataApiWizardState => {
  const trimmed = routeFolder.trim();
  return {
    ...state,
    routeFolder: trimmed,
    basePath: deriveBasePathFromRouteFolder(trimmed),
    routes: applySharedRouteFolder(trimmed, state.routes, objectType),
  };
};

export const syncWizardBasePath = (
  state: DataApiWizardState,
  basePath: string,
  objectType: DataApiWizardObjectType,
): DataApiWizardState => {
  const routeFolder = deriveRouteFolderFromBasePath(basePath);
  return syncWizardRouteFolder({
    ...state,
    basePath: basePath.trim(),
  }, routeFolder, objectType);
};

export const createInitialDataApiWizardState = (
  objectName: string,
  objectType: DataApiWizardObjectType,
  accessControl: FunctionAccessControl,
  columnOptions: SchemaFieldInfo[] = [],
  primaryKey = '',
): DataApiWizardState => {
  const routeFolder = suggestRouteFolder(objectName);
  const basePath = deriveDataApiBasePath(objectName);

  return {
    label: deriveDataApiLabel(objectName),
    key: deriveDataApiKey(objectName),
    basePath,
    routeFolder,
    routes: createDefaultRoutes(
      objectType,
      columnOptions,
      primaryKey,
      routeFolder,
      objectType === 'VIEW' ? 'readOnly' : 'collection',
    ),
    primaryKey,
    accessControl,
  };
};

const buildListQuery = (): NonNullable<EdgeApiOperation['query']> => ({
  allowFilter: true,
  allowSort: true,
  maxPageSize: 100,
  defaultPageSize: 20,
});

const buildGetOneQuery = (): NonNullable<EdgeApiOperation['query']> => ({
  allowFilter: false,
  allowSort: false,
  maxPageSize: 1,
  defaultPageSize: 1,
});

const columnNamesToModelFields = (
  model: EdgeModelDefinition | undefined,
  columnNames: string[],
): string[] => {
  if (!model) {
    return columnNames;
  }

  return columnNames.map((name) => {
    const column = model.columns.find((item) => item.name === name);
    return column?.field ?? name;
  });
};

const validationFieldsToWriteFields = (
  model: EdgeModelDefinition | undefined,
  fields: RouteValidationField[] | undefined,
): { write: string[]; required: string[] } => {
  if (!fields || fields.length === 0) {
    return { write: [], required: [] };
  }

  const write = fields
    .map((field) => {
      const column = model?.columns.find((item) => item.name === field.name);
      return column?.field ?? field.name;
    })
    .filter(Boolean);

  const required = fields
    .filter((field) => field.required)
    .map((field) => {
      const column = model?.columns.find((item) => item.name === field.name);
      return column?.field ?? field.name;
    })
    .filter(Boolean);

  return { write, required };
};

const kindFromOption = (option: RouteComposerOption): EdgeApiOperation['kind'] => {
  const match = resolveMethodOption(option);
  return match?.kind ?? 'list';
};

const inferPathNameFromOperation = (
  operation: EdgeApiOperation,
  objectType: DataApiWizardObjectType,
): { folder: string; pathName: string } => (
  parseRouteEntryFromPathPattern(operation.pathPattern, objectType)
);

const inferOptionFromOperation = (operation: EdgeApiOperation): RouteComposerOption | null => {
  const byKind = DATA_API_WIZARD_METHOD_OPTIONS.find((item) => item.kind === operation.kind);
  if (byKind) {
    return byKind.option;
  }

  if (operation.method === 'GET') {
    return operation.pathPattern.includes('/:') ? 'GET_ONE' : 'GET_LIST';
  }

  return null;
};

export const routesFromExistingOperations = (
  operations: EdgeApiOperation[],
  basePath: string,
  objectType: DataApiWizardObjectType,
  model?: EdgeModelDefinition,
): DataApiWizardRouteEntry[] => {
  const columnNameByField = new Map(
    (model?.columns ?? []).map((column) => [column.field, column.name]),
  );

  return operations
    .filter((operation) => operation.enabled)
    .map((operation) => {
      const option = inferOptionFromOperation(operation);
      if (!option) {
        return null;
      }

      const readColumnNames = (operation.fields?.read ?? [])
        .map((field) => columnNameByField.get(field) ?? field);
      const writeFields = operation.fields?.write ?? [];
      const writeColumnNames = writeFields.map((field) => columnNameByField.get(field) ?? field);
      const requiredSet = new Set(operation.fields?.required ?? []);

      const fields: RouteValidationField[] = writeColumnNames.map((name, index) => ({
        id: `field-${name}-${index}`,
        name,
        type: 'string',
        required: requiredSet.has(name) || requiredSet.has(columnNameByField.get(name) ?? ''),
      }));

      const { folder, pathName } = inferPathNameFromOperation(operation, objectType);

      return {
        id: operation.id || createRouteId(),
        option,
        folder,
        pathName,
        ...(readColumnNames.length > 0 ? { outputFields: readColumnNames } : {}),
        ...(fields.length > 0 ? { fields } : {}),
      } satisfies DataApiWizardRouteEntry;
    })
    .filter((route): route is DataApiWizardRouteEntry => route !== null);
};

export const buildEdgeApiOperationsFromWizard = (
  objectType: DataApiWizardObjectType,
  routes: DataApiWizardRouteEntry[],
  primaryKey: string,
  model?: EdgeModelDefinition,
): EdgeApiOperation[] => {
  if (routes.length === 0) {
    return [];
  }

  const suffix = createOperationSuffix();

  return routes.map((route, index) => {
    const methodOption = resolveMethodOption(route.option);
    const kind = methodOption?.kind ?? kindFromOption(route.option);
    const method = methodOption?.method ?? resolveComposerHttpMethod(route.option);
    const pathPattern = buildRouteEntryPath(
      route.folder,
      route.pathName,
      route.option,
      objectType,
      primaryKey || 'pk',
    );

    const operation: EdgeApiOperation = {
      id: route.id.startsWith('op_') ? route.id : `op_${kind}_${suffix}_${index}`,
      method,
      kind,
      pathPattern,
      enabled: true,
    };

    if (kind === 'list' || kind === 'pivot') {
      operation.query = buildListQuery();
    } else if (kind === 'getOne' || kind === 'lookup') {
      operation.query = buildGetOneQuery();
    }

    const readFields = columnNamesToModelFields(model, route.outputFields ?? []);
    if (readFields.length > 0) {
      operation.fields = {
        ...operation.fields,
        read: readFields,
      };
    }

    const { write, required } = validationFieldsToWriteFields(model, route.fields);
    if (write.length > 0 || required.length > 0) {
      operation.fields = {
        ...operation.fields,
        write: write.length > 0 ? write : undefined,
        required: required.length > 0 ? required : undefined,
      };
    }

    if (kind === 'create' || kind === 'update' || kind === 'patch' || kind === 'delete') {
      operation.clientContext = defaultWriteClientContext();
    }

    if (
      route.outputFields
      && route.outputFields.length > 0
      && !isCanonicalRouteVariant(route.folder, route.pathName, objectType)
      && kind === 'getOne'
      && operation.query
    ) {
      const viewKey = slugifyRouteSegment(route.pathName) || route.pathName.trim();
      operation.query = {
        ...operation.query,
        views: {
          [viewKey]: readFields,
        },
      };
    }

    return operation;
  });
};

export const summarizeWizardOperations = (
  objectType: DataApiWizardObjectType,
  routes: DataApiWizardRouteEntry[],
  primaryKey: string,
): Array<{ method: string; path: string; label: string }> => (
  routes.map((route) => {
    const methodOption = resolveMethodOption(route.option);
    return {
      method: methodOption?.method ?? resolveComposerHttpMethod(route.option),
      path: buildRouteEntryPath(
        route.folder,
        route.pathName,
        route.option,
        objectType,
        primaryKey || 'pk',
      ),
      label: methodOption?.label ?? route.option,
    };
  })
);

// Backward-compatible export for tests that still pass enabledOptions.
export const buildEdgeApiOperationsFromEnabledOptions = (
  basePath: string,
  objectType: DataApiWizardObjectType,
  enabledOptions: Record<RouteComposerOption, boolean>,
): EdgeApiOperation[] => {
  const routeFolder = deriveRouteFolderFromBasePath(basePath);
  const routes: DataApiWizardRouteEntry[] = [];

  for (const option of getSupportedWizardMethodOptions(objectType)) {
    if (!enabledOptions[option.option]) {
      continue;
    }
    routes.push({
      id: createRouteId(),
      option: option.option,
      folder: routeFolder,
      pathName: routeFolder,
    });
  }

  return buildEdgeApiOperationsFromWizard(
    objectType,
    routes,
    '',
  );
};
