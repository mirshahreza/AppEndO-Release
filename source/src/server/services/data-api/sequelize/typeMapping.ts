import { DataTypes } from 'sequelize';
import type { SchemaFieldInfo, SchemaFieldType } from '../../../utils/dataSourceSchemaIntrospection';

export const toCamelCaseField = (name: string): string => {
  const normalized = name.trim();
  if (!normalized.includes('_')) {
    return normalized.charAt(0).toLowerCase() + normalized.slice(1);
  }

  return normalized
    .toLowerCase()
    .replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
};

export const toPascalCaseModelName = (objectName: string): string => {
  const base = objectName
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');

  return base || 'EdgeModel';
};

export const mapSuggestedFieldTypeToSequelize = (fieldType: SchemaFieldType): string => {
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

export const resolveSequelizeDataType = (sequelizeType: string) => {
  switch (sequelizeType) {
    case 'BOOLEAN':
      return DataTypes.BOOLEAN;
    case 'INTEGER':
      return DataTypes.INTEGER;
    case 'DOUBLE':
      return DataTypes.DOUBLE;
    case 'DATE':
      return DataTypes.DATE;
    case 'TEXT':
      return DataTypes.TEXT;
    case 'JSON':
      return DataTypes.JSON;
    case 'BLOB':
      return DataTypes.BLOB;
    default:
      return DataTypes.STRING;
  }
};

export const mapSchemaFieldToColumn = (field: SchemaFieldInfo) => {
  const sequelizeType = mapSuggestedFieldTypeToSequelize(field.suggestedFieldType);
  return {
    name: field.name,
    field: toCamelCaseField(field.name),
    dataType: field.dataType,
    sequelizeType,
    allowNull: field.nullable,
    isPrimaryKey: field.isPrimaryKey,
    isForeignKey: false,
  };
};
