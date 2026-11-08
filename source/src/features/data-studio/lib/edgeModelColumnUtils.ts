import type { EdgeModelColumn } from '../../../shared/api/contracts/data-api';
import type { SchemaFieldInfo } from '../../../shared/api/queries/data-sources';
import {
  inferSequelizeTypeFromNativeType,
  mapSuggestedFieldTypeToSequelize,
} from './edgeSequelizeTypes';

/** Lowercase English letters and underscore; must start with a letter. */
export const EDGE_COLUMN_NAME_RE = /^[a-z][a-z_]*$/;
const EDGE_COLUMN_NAME_INPUT_CHAR_RE = /^[a-z_]$/;

export const EDGE_COLUMN_NAME_HELPER_TEXT =
  'English letters and underscores only; start with a letter (e.g. customer_name).';

/** Strip disallowed characters while typing; first character must be a lowercase letter. */
export const sanitizeEdgeColumnNameInput = (value: string): string => {
  const lowered = value.toLowerCase();
  let result = '';

  for (const char of lowered) {
    if (!EDGE_COLUMN_NAME_INPUT_CHAR_RE.test(char)) {
      continue;
    }
    if (result.length === 0 && char === '_') {
      continue;
    }
    result += char;
  }

  return result;
};

export const validateEdgeColumnName = (
  value: string,
  options?: { required?: boolean; fieldLabel?: string },
): string | null => {
  const trimmed = value.trim();
  const label = options?.fieldLabel ?? 'Column name';

  if (!trimmed) {
    return options?.required === false ? null : `${label} is required.`;
  }

  if (!EDGE_COLUMN_NAME_RE.test(trimmed)) {
    return `${label} must use English letters and underscores only, and start with a letter.`;
  }

  return null;
};

export const toCamelCaseField = (name: string): string => {
  const normalized = name.trim();
  if (!normalized.includes('_')) {
    return normalized.charAt(0).toLowerCase() + normalized.slice(1);
  }

  return normalized
    .toLowerCase()
    .replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
};

export const buildNextBlankColumnName = (columns: ReadonlyArray<Pick<EdgeModelColumn, 'name'>>): string => {
  let name = 'new_column';
  let suffix = 2;

  while (columns.some((column) => column.name === name)) {
    name = `new_column_${suffix}`;
    suffix += 1;
  }

  return name;
};

export const createEdgeModelColumnFromField = (field: SchemaFieldInfo): EdgeModelColumn => ({
  name: field.name,
  field: toCamelCaseField(field.name),
  dataType: field.dataType,
  sequelizeType: mapSuggestedFieldTypeToSequelize(field.suggestedFieldType),
  allowNull: field.nullable,
  isPrimaryKey: field.isPrimaryKey,
  isForeignKey: false,
});

export const createEdgeModelColumnFromNativeType = (
  name: string,
  nativeType: string,
  options: {
    nullable?: boolean;
    isPrimaryKey?: boolean;
  } = {},
): EdgeModelColumn => ({
  name,
  field: toCamelCaseField(name),
  dataType: nativeType,
  sequelizeType: inferSequelizeTypeFromNativeType(nativeType),
  allowNull: options.nullable ?? true,
  isPrimaryKey: options.isPrimaryKey ?? false,
  isForeignKey: false,
});

export const patchEdgeModelColumn = (
  column: EdgeModelColumn,
  patch: Partial<EdgeModelColumn>,
): EdgeModelColumn => {
  const next = { ...column, ...patch };

  if (patch.name && !patch.field) {
    next.field = toCamelCaseField(patch.name);
  }

  if (patch.dataType && !patch.sequelizeType) {
    next.sequelizeType = inferSequelizeTypeFromNativeType(patch.dataType);
  }

  return next;
};
