import type { SchemaFieldInfo } from '../../../shared/api/queries/data-sources';

export const ROUTE_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export type RouteHttpMethod = typeof ROUTE_HTTP_METHODS[number];

export type RouteFieldType = 'string' | 'number' | 'integer' | 'boolean';

export type RouteValidationField = {
  id: string;
  name: string;
  type: RouteFieldType;
  required: boolean;
  enum?: string[];
  format?: string;
  isArray?: boolean;
};

export type RouteComposerOption =
  | 'GET_LIST'
  | 'GET_ONE'
  | 'GET_LOOKUP'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'POST_PIVOT';

export type DataApiObjectType = 'TABLE' | 'VIEW';

export const validationFieldsFromSchemaFields = (
  schemaFields: Array<{ name: string; suggestedFieldType: RouteFieldType; nullable: boolean }>,
): RouteValidationField[] => (
  schemaFields.map((field, index) => ({
    id: `field-${field.name}-${index}`,
    name: field.name,
    type: field.suggestedFieldType,
    required: !field.nullable,
  }))
);

export const isMethodSupportedForObjectType = (
  objectType: DataApiObjectType,
  method: RouteHttpMethod,
): boolean => {
  if (objectType === 'VIEW') {
    return method === 'GET';
  }
  if (method === 'PATCH') {
    return objectType === 'TABLE';
  }
  return true;
};

export const getSupportedMethodsForObjectType = (
  objectType: DataApiObjectType,
): RouteHttpMethod[] => (
  ROUTE_HTTP_METHODS.filter((method) => isMethodSupportedForObjectType(objectType, method))
);

export type { SchemaFieldInfo };
