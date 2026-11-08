import type { Model, ModelCtor, Sequelize } from 'sequelize';
import type { EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';
import type { SchemaFieldInfo } from '../../../utils/dataSourceSchemaIntrospection';
import {
  mapSchemaFieldToColumn,
  resolveSequelizeDataType,
  toCamelCaseField,
  toPascalCaseModelName,
} from './typeMapping';

export type BuildDynamicModelInput = {
  dataSourceId: string;
  schema?: string | null;
  objectName: string;
  objectType?: 'TABLE' | 'VIEW';
  fields: SchemaFieldInfo[];
};

export const buildEdgeModelColumnsFromFields = (fields: SchemaFieldInfo[]) => (
  fields.map((field) => mapSchemaFieldToColumn(field))
);

export const resolvePrimaryKeyFromFields = (fields: SchemaFieldInfo[]): string | string[] => {
  const primaryKeys = fields.filter((field) => field.isPrimaryKey).map((field) => field.name);
  if (primaryKeys.length === 0) {
    return 'id';
  }
  if (primaryKeys.length === 1) {
    return primaryKeys[0];
  }
  return primaryKeys;
};

export const buildDynamicModelAttributes = (
  columns: EdgeModelDefinition['columns'],
  primaryKey: string | string[],
) => {
  const attributes: Record<string, unknown> = {};
  const singlePrimaryKey = typeof primaryKey === 'string' ? primaryKey : null;

  for (const column of columns) {
    const isPrimaryKey = Array.isArray(primaryKey)
      ? primaryKey.includes(column.name)
      : column.name === primaryKey;
    // BIGSERIAL / identity PKs introspect as INTEGER + allowNull=false; without
    // autoIncrement Sequelize requires an explicit id on create.
    const autoIncrement = Boolean(
      isPrimaryKey
      && singlePrimaryKey
      && column.name === singlePrimaryKey
      && (column.sequelizeType === 'INTEGER' || column.dataType?.toLowerCase() === 'bigint'),
    );

    attributes[column.field] = {
      type: resolveSequelizeDataType(column.sequelizeType),
      allowNull: column.allowNull,
      primaryKey: isPrimaryKey,
      autoIncrement,
      field: column.name,
    };
  }

  return attributes;
};

export const defineDynamicModel = (
  sequelize: Sequelize,
  def: Pick<EdgeModelDefinition, 'sequelize' | 'columns' | 'primaryKey' | 'objectType'>,
): ModelCtor<Model> => {
  const attributes = buildDynamicModelAttributes(def.columns, def.primaryKey);
  return sequelize.define(def.sequelize.modelName, attributes, {
    tableName: def.sequelize.tableName,
    schema: def.sequelize.schema,
    timestamps: false,
    freezeTableName: true,
  });
};

export const buildModelDefinitionDraft = (
  input: BuildDynamicModelInput,
): Omit<EdgeModelDefinition, 'id' | 'schemaFingerprint' | 'status' | 'created_at' | 'updated_at' | 'associations'> => {
  const columns = buildEdgeModelColumnsFromFields(input.fields);
  const primaryKey = resolvePrimaryKeyFromFields(input.fields);
  const modelName = toPascalCaseModelName(input.objectName);
  const objectType = input.objectType ?? 'TABLE';

  return {
    dataSourceId: input.dataSourceId,
    schema: input.schema ?? null,
    objectName: input.objectName,
    objectType,
    sequelize: {
      modelName,
      tableName: input.objectName,
      schema: input.schema ?? undefined,
    },
    columns,
    primaryKey,
    readOnly: objectType === 'VIEW',
    labels: {
      title: input.objectName,
    },
  };
};

export const resolvePrimaryKeyField = (
  columns: EdgeModelDefinition['columns'],
  primaryKey: string | string[],
): string => {
  if (Array.isArray(primaryKey)) {
    const first = columns.find((column) => column.name === primaryKey[0]);
    return first?.field ?? toCamelCaseField(primaryKey[0]);
  }

  const match = columns.find((column) => column.name === primaryKey);
  return match?.field ?? toCamelCaseField(primaryKey);
};

export const resolvePrimaryKeyFields = (
  columns: EdgeModelDefinition['columns'],
  primaryKey: string | string[],
): string[] => {
  if (Array.isArray(primaryKey)) {
    return primaryKey.map((name) => {
      const match = columns.find((column) => column.name === name);
      return match?.field ?? toCamelCaseField(name);
    });
  }

  return [resolvePrimaryKeyField(columns, primaryKey)];
};

/** Composite PK encoded in a single `:pk` segment (Designer delete URLs). */
const COMPOSITE_PK_SEPARATOR = '|';

export const resolvePrimaryKeyWhere = (
  columns: EdgeModelDefinition['columns'],
  primaryKey: string | string[],
  params: Record<string, string> | undefined,
): Record<string, unknown> => {
  if (Array.isArray(primaryKey)) {
    const encoded = params?.pk;
    if (typeof encoded === 'string' && encoded.includes(COMPOSITE_PK_SEPARATOR)) {
      const parts = encoded.split(COMPOSITE_PK_SEPARATOR);
      if (parts.length === primaryKey.length && parts.every((part) => part.length > 0)) {
        const where: Record<string, unknown> = {};
        for (let index = 0; index < primaryKey.length; index += 1) {
          const pkName = primaryKey[index]!;
          const column = columns.find((item) => item.name === pkName);
          const field = column?.field ?? toCamelCaseField(pkName);
          where[field] = parts[index];
        }
        return where;
      }
    }

    const where: Record<string, unknown> = {};
    for (const pkName of primaryKey) {
      const column = columns.find((item) => item.name === pkName);
      const field = column?.field ?? toCamelCaseField(pkName);
      const value = params?.[field] ?? params?.[pkName];
      if (value === undefined) {
        throw new Error('Composite primary key parameters are required.');
      }
      where[field] = value;
    }
    return where;
  }

  const field = resolvePrimaryKeyField(columns, primaryKey);
  const rawValue = params?.pk ?? params?.[field] ?? params?.[primaryKey];
  if (rawValue === undefined) {
    throw new Error('Primary key parameter is required.');
  }
  const column = columns.find((item) => item.field === field || item.name === primaryKey);
  const isIntegerPk = column?.sequelizeType === 'INTEGER' || column?.sequelizeType === 'BIGINT';
  if (isIntegerPk) {
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      return { [field]: Math.trunc(rawValue) };
    }
    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (/^\d+$/.test(trimmed)) {
        return { [field]: Number(trimmed) };
      }
      throw new Error('Primary key parameter is invalid.');
    }
  }
  return { [field]: rawValue };
};
