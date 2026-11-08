import type { SchemaFieldInfo } from '../../../shared/api/queries/data-sources';
import type { DataApiWizardObjectType, DataApiWizardRouteEntry } from './dataApiWizard';
import {
  validationFieldsFromSchemaFields,
  type RouteComposerOption,
  type RouteHttpMethod,
  type RouteValidationField,
} from './routeComposerTypes';

export const slugifyRouteSegment = (value: string): string => (
  value.trim().toLowerCase().replace(/\s+/g, '-').replace(/^-+|-+$/g, '')
);

export const stripSchemaPrefix = (objectName: string): string => {
  const trimmed = objectName.trim();
  if (!trimmed) return '';
  const parts = trimmed.split('.');
  return parts[parts.length - 1] ?? trimmed;
};

export const toUrlFriendlySlug = (value: string): string => {
  const base = stripSchemaPrefix(value)
    .replace(/^(sp|fn|usp|proc)_/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();

  return base.replace(/^-+|-+$/g, '');
};

export const suggestRouteFolder = (objectName: string): string => {
  const slug = toUrlFriendlySlug(objectName);
  return slug || 'general';
};

export const deriveRouteFolderFromBasePath = (basePath: string): string => {
  const trimmed = basePath.trim().replace(/\/$/, '');
  if (!trimmed) return 'collection';
  const parts = trimmed.split('/').filter(Boolean);
  if (parts[0] === 'api') {
    return parts[1] ?? 'collection';
  }
  return parts[parts.length - 1] ?? 'collection';
};

export const deriveBasePathFromRouteFolder = (folder: string): string => {
  const slug = slugifyRouteSegment(folder) || 'collection';
  return `/api/${slug}`;
};

export const resolveComposerHttpMethod = (option: RouteComposerOption): RouteHttpMethod => {
  if (option === 'GET_LIST' || option === 'GET_ONE' || option === 'GET_LOOKUP') return 'GET';
  if (option === 'POST_PIVOT') return 'POST';
  return option;
};

export const getComposerOptionLabel = (option: RouteComposerOption): string => {
  if (option === 'GET_LIST') return 'GET';
  if (option === 'GET_ONE') return 'GET ONE';
  if (option === 'GET_LOOKUP') return 'LOOKUP';
  if (option === 'POST_PIVOT') return 'PIVOT';
  return option;
};

export const getComposerOptionUsageLabel = (
  option: RouteComposerOption,
  objectType: DataApiWizardObjectType = 'TABLE',
): string => {
  switch (option) {
    case 'GET_LIST':
      return 'read list';
    case 'GET_ONE':
      return objectType === 'VIEW' ? 'read by key' : 'read by key';
    case 'GET_LOOKUP':
      return 'lookup by alternate key';
    case 'POST':
      return 'create';
    case 'PUT':
      return 'update by key';
    case 'PATCH':
      return 'partial update by key';
    case 'DELETE':
      return 'delete by key';
    case 'POST_PIVOT':
      return 'pivot';
    default:
      return 'route';
  }
};

const capitalizeUsageLabel = (value: string): string => (
  value.replace(/\b\w/g, (char) => char.toUpperCase())
);

export const getComposerOptionSelectLabel = (
  option: RouteComposerOption,
  objectType: DataApiWizardObjectType = 'TABLE',
): string => (
  `${capitalizeUsageLabel(getComposerOptionUsageLabel(option, objectType))} / ${getComposerOptionLabel(option)}`
);

export const getComposerOptionBadgeLabel = (option: RouteComposerOption): string => (
  getComposerOptionLabel(option)
);

export const METHOD_BADGE_WIDTH_CLASS = 'w-14';

export const getComposerOptionsForObjectType = (
  objectType: DataApiWizardObjectType,
): RouteComposerOption[] => {
  if (objectType === 'VIEW') return ['GET_LIST', 'GET_ONE', 'GET_LOOKUP', 'POST_PIVOT'];
  return ['GET_LIST', 'GET_ONE', 'GET_LOOKUP', 'POST', 'PUT', 'PATCH', 'DELETE', 'POST_PIVOT'];
};

export const isRestCollectionObjectType = (
  objectType: DataApiWizardObjectType,
): boolean => objectType === 'TABLE' || objectType === 'VIEW';

export const resolveRoutePathName = (
  folder: string,
  pathName: string,
  objectType: DataApiWizardObjectType,
): string => {
  const trimmedPathName = pathName.trim();
  if (trimmedPathName) return trimmedPathName;
  if (isRestCollectionObjectType(objectType)) {
    return slugifyRouteSegment(folder) || folder.trim();
  }
  return '';
};

export const isCanonicalRouteVariant = (
  folder: string,
  pathName: string,
  objectType: DataApiWizardObjectType,
): boolean => {
  if (!isRestCollectionObjectType(objectType)) {
    return true;
  }
  const folderSlug = slugifyRouteSegment(folder);
  const variantSlug = slugifyRouteSegment(pathName);
  return !variantSlug || variantSlug === folderSlug;
};

export const countRoutesWithSameOption = (
  routes: Array<Pick<DataApiWizardRouteEntry, 'option' | 'folder'>>,
  option: RouteComposerOption,
  folder: string,
): number => {
  const folderSlug = slugifyRouteSegment(folder);
  return routes.filter((route) => (
    route.option === option
    && slugifyRouteSegment(route.folder) === folderSlug
  )).length;
};

export const requiresRouteVariant = (
  routes: Array<Pick<DataApiWizardRouteEntry, 'option' | 'folder'>>,
  option: RouteComposerOption,
  folder: string,
): boolean => countRoutesWithSameOption(routes, option, folder) > 0;

export const suggestRouteVariant = (
  option: RouteComposerOption,
  existingCount: number,
): string => {
  const index = existingCount + 1;
  switch (option) {
    case 'GET_LIST':
      return index === 2 ? 'list' : `list-${index - 1}`;
    case 'GET_ONE':
      return index === 2 ? 'summary' : `view-${index - 1}`;
    case 'GET_LOOKUP':
      return index === 1 ? 'by-code' : `lookup-${index}`;
    case 'POST':
      return index === 2 ? 'bulk' : `create-${index - 1}`;
    case 'PUT':
      return `update-${index}`;
    case 'PATCH':
      return `patch-${index}`;
    case 'DELETE':
      return `delete-${index}`;
    case 'POST_PIVOT':
      return index === 1 ? 'pivot' : `pivot-${index}`;
    default:
      return `route-${index}`;
  }
};

export const routeVariantUsesViewQuery = (
  option: RouteComposerOption,
  objectType: DataApiWizardObjectType,
): boolean => option === 'GET_ONE' && isRestCollectionObjectType(objectType);

export const composerOptionRequiresPrimaryKey = (
  option: RouteComposerOption,
  objectType: DataApiWizardObjectType,
): boolean => {
  if (objectType !== 'TABLE' && objectType !== 'VIEW') {
    return false;
  }
  return option === 'GET_ONE' || option === 'PUT' || option === 'PATCH' || option === 'DELETE';
};

export const composerOptionUsesPrimaryKeyInPath = (
  option: RouteComposerOption,
  objectType: DataApiWizardObjectType,
): boolean => composerOptionRequiresPrimaryKey(option, objectType);

export const routeEntrySupportsOutputFieldEditing = (
  option: RouteComposerOption,
  objectType: DataApiWizardObjectType,
): boolean => (
  (option === 'GET_LIST' || option === 'GET_ONE' || option === 'GET_LOOKUP' || option === 'POST_PIVOT')
  && (objectType === 'TABLE' || objectType === 'VIEW')
);

export const routeEntrySupportsFieldEditing = (
  option: RouteComposerOption,
  objectType: DataApiWizardObjectType,
): boolean => {
  if (objectType === 'VIEW') {
    return false;
  }
  return option === 'POST' || option === 'PUT' || option === 'PATCH';
};

/** Builds the full REST path for one composed route — mirrors legacy CRUD-Gen `buildRouteEntryPath`. */
export const buildRouteEntryPath = (
  folder: string,
  pathName: string,
  option: RouteComposerOption,
  objectType: DataApiWizardObjectType,
  primaryKey: string,
): string => {
  const folderSlug = slugifyRouteSegment(folder) || 'general';

  if (isRestCollectionObjectType(objectType)) {
    const variantSlug = slugifyRouteSegment(pathName);
    const hasVariant = Boolean(variantSlug) && variantSlug !== folderSlug;

    if (composerOptionUsesPrimaryKeyInPath(option, objectType)) {
      const pkSegment = slugifyRouteSegment(primaryKey) || 'id';
      const base = `/api/${folderSlug}/:${pkSegment}`;
      if (hasVariant && routeVariantUsesViewQuery(option, objectType)) {
        return `${base}?view=${variantSlug}`;
      }
      if (hasVariant) {
        return `/api/${folderSlug}/${variantSlug}/:${pkSegment}`;
      }
      return base;
    }

    if (option === 'GET_LOOKUP') {
      const codeSegment = hasVariant ? variantSlug : 'code';
      return `/api/${folderSlug}/by-${codeSegment}/:code`;
    }

    if (option === 'POST_PIVOT') {
      const pivotSlug = hasVariant ? variantSlug : 'pivot';
      return `/api/${folderSlug}/${pivotSlug}`;
    }

    if (hasVariant) {
      return `/api/${folderSlug}/${variantSlug}`;
    }
    return `/api/${folderSlug}`;
  }

  return `/api/${folderSlug}`;
};

export const applySharedRouteFolder = (
  routeFolder: string,
  routes: DataApiWizardRouteEntry[],
  objectType: DataApiWizardObjectType,
): DataApiWizardRouteEntry[] => {
  const trimmed = routeFolder.trim();
  return routes.map((route) => {
    const canonical = isCanonicalRouteVariant(route.folder, route.pathName, objectType);
    return {
      ...route,
      folder: trimmed,
      ...(canonical && isRestCollectionObjectType(objectType) && trimmed
        ? { pathName: trimmed }
        : {}),
    };
  });
};

export const parseRouteEntryFromPathPattern = (
  pathPattern: string,
  objectType: DataApiWizardObjectType,
): { folder: string; pathName: string } => {
  const [rawPath, queryString] = pathPattern.split('?');
  const viewMatch = queryString?.match(/(?:^|&)view=([^&]+)/);
  const viewName = viewMatch?.[1] ? decodeURIComponent(viewMatch[1]) : '';

  const segments = rawPath.replace(/\/$/, '').split('/').filter(Boolean);
  const folder = segments[0] === 'api' ? (segments[1] ?? 'general') : (segments[0] ?? 'general');

  if (!isRestCollectionObjectType(objectType)) {
    return { folder, pathName: folder };
  }

  if (viewName) {
    return { folder, pathName: viewName };
  }

  const afterFolder = segments[0] === 'api' ? segments.slice(2) : segments.slice(1);
  if (afterFolder.length === 0) {
    return { folder, pathName: folder };
  }

  if (afterFolder.length === 1 && afterFolder[0].startsWith(':')) {
    return { folder, pathName: folder };
  }

  if (afterFolder.length >= 2 && afterFolder[1].startsWith(':')) {
    return { folder, pathName: afterFolder[0] };
  }

  if (afterFolder.length === 1) {
    return { folder, pathName: afterFolder[0] };
  }

  return { folder, pathName: folder };
};

export const isSchemaFieldWritableForRequest = (
  column: SchemaFieldInfo,
  primaryKey: string,
): boolean => {
  const pk = primaryKey.trim();
  if (pk && column.name === pk) {
    return false;
  }

  return !column.isPrimaryKey;
};

export const getInputFieldColumnsForOption = (
  option: RouteComposerOption,
  objectType: DataApiWizardObjectType,
  columnOptions: SchemaFieldInfo[],
  primaryKey: string,
): SchemaFieldInfo[] => {
  if (!routeEntrySupportsFieldEditing(option, objectType)) {
    return [];
  }

  return columnOptions.filter((column) => isSchemaFieldWritableForRequest(column, primaryKey));
};

export const getOutputFieldColumnsForOption = (
  option: RouteComposerOption,
  objectType: DataApiWizardObjectType,
  columnOptions: SchemaFieldInfo[],
): SchemaFieldInfo[] => {
  if (!routeEntrySupportsOutputFieldEditing(option, objectType)) {
    return [];
  }

  return columnOptions;
};

export const suggestFieldsForOption = (
  option: RouteComposerOption,
  objectType: DataApiWizardObjectType,
  columnOptions: SchemaFieldInfo[],
  primaryKey: string,
): RouteValidationField[] => {
  const inputColumns = getInputFieldColumnsForOption(
    option,
    objectType,
    columnOptions,
    primaryKey,
  );

  if (inputColumns.length === 0 || objectType !== 'TABLE') {
    return [];
  }

  const method = resolveComposerHttpMethod(option);
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    return validationFieldsFromSchemaFields(inputColumns);
  }

  return [];
};

export const suggestOutputFieldsForOption = (
  option: RouteComposerOption,
  objectType: DataApiWizardObjectType,
  columnOptions: SchemaFieldInfo[],
): string[] => {
  const outputColumns = getOutputFieldColumnsForOption(option, objectType, columnOptions);
  return outputColumns.map((column) => column.name);
};
