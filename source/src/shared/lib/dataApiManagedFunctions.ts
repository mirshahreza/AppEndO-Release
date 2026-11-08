import type { EdgeApiDefinition, EdgeApiOperation } from '../api/contracts/data-api';

const slugifySegment = (value: string): string => (
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'api'
);

const stripSchemaPrefix = (objectName: string): string => {
  const trimmed = objectName.trim();
  if (!trimmed) return '';
  const parts = trimmed.split('.');
  return parts[parts.length - 1] ?? trimmed;
};

const toObjectFolderSlug = (objectName: string): string => {
  const base = stripSchemaPrefix(objectName)
    .replace(/^(sp|fn|usp|proc)_/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();

  return base.replace(/^-+|-+$/g, '') || 'object';
};

export const extractApiSlugFromBasePath = (basePath: string): string => {
  const segments = basePath.trim().replace(/\/$/, '').split('/').filter(Boolean);
  const last = segments[segments.length - 1] ?? 'api';
  return slugifySegment(last);
};

export const deriveConfigureDataApiKey = (apiName: string): string => (
  slugifySegment(apiName)
);

export const toDataApiObjectFolderSlug = (objectName: string): string => (
  toObjectFolderSlug(objectName)
);

export const buildDataApiManagedFunctionFolder = (objectName: string): string => (
  toDataApiObjectFolderSlug(objectName)
);

export const buildDataApiManagedFunctionName = (
  definition: EdgeApiDefinition,
  operation: EdgeApiOperation,
): string => {
  const keySlug = slugifySegment(definition.key);
  const apiSlug = extractApiSlugFromBasePath(definition.basePath);
  const preferredName = keySlug || apiSlug;
  const enabledOperations = definition.operations.filter((item) => item.enabled);

  if (enabledOperations.length <= 1) {
    return preferredName;
  }

  const operationSuffix = slugifySegment(operation.kind);
  if (!operationSuffix || operationSuffix === preferredName) {
    return preferredName;
  }

  return `${preferredName}-${operationSuffix}`;
};
