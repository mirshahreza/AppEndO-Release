export const EDGE_SEQUELIZE_TYPE_OPTIONS = [
  'BOOLEAN',
  'INTEGER',
  'DOUBLE',
  'STRING',
  'DATE',
  'TEXT',
  'JSON',
] as const;

export type EdgeSequelizeType = (typeof EDGE_SEQUELIZE_TYPE_OPTIONS)[number];

export const mapSuggestedFieldTypeToSequelize = (
  fieldType: 'string' | 'number' | 'integer' | 'boolean',
): EdgeSequelizeType => {
  switch (fieldType) {
    case 'boolean':
      return 'BOOLEAN';
    case 'integer':
      return 'INTEGER';
    case 'number':
      return 'DOUBLE';
    default:
      return 'STRING';
  }
};

export const inferSequelizeTypeFromNativeType = (nativeType: string): EdgeSequelizeType => {
  const normalized = nativeType.trim().toLowerCase();

  if (/(bool|bit)/.test(normalized)) {
    return 'BOOLEAN';
  }

  if (/(int|serial|year)/.test(normalized)) {
    return 'INTEGER';
  }

  if (/(double|float|real|decimal|numeric|money|number)/.test(normalized)) {
    return 'DOUBLE';
  }

  if (/(date|time|timestamp|interval)/.test(normalized)) {
    return 'DATE';
  }

  if (/(json|jsonb)/.test(normalized)) {
    return 'JSON';
  }

  if (/(text|clob|blob|bytea|binary|xml)/.test(normalized)) {
    return 'TEXT';
  }

  return 'STRING';
};
