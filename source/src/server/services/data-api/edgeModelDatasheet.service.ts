import { literal, type ModelCtor } from 'sequelize';
import type { EdgeModelColumn, EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import {
  coerceDatasheetRow,
  DatasheetCellError,
} from '../../../shared/api/contracts/data-api/datasheetCoerce';
import {
  parseDatasheetSelectSql,
  buildDatasheetSelectSql,
} from '../../../shared/api/contracts/data-api/datasheetWhereSql';
import {
  assertDatasheetLimit,
} from '../../../shared/api/contracts/data-api/datasheetWindow';
import type { StoredDataSource } from '../../db/dataSourcesStore';
import { HttpError, isHttpError } from '../../errors/HttpError';
import { getEdgeModelById } from './edgeModelStore';
import { EdgeSequelizeFactory } from './sequelize/edgeSequelizeFactory';
import { resolvePrimaryKeyFields } from './sequelize/buildDynamicModel';

export type DatasheetQueryInput = {
  sql?: unknown;
};

export type DatasheetCommitRowInput = {
  isNew?: unknown;
  key?: unknown;
  values?: unknown;
};

export type DatasheetDeleteRowInput = {
  key?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const serializeCell = (value: unknown): unknown => {
  if (typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Buffer.isBuffer(value)) {
    return null;
  }
  return value;
};

const serializeRow = (row: Record<string, unknown>): Record<string, unknown> => {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    next[key] = serializeCell(value);
  }
  return next;
};

const isBlobColumn = (column: EdgeModelColumn): boolean =>
  column.sequelizeType === 'BLOB' || column.dataType.toUpperCase().includes('BINARY');

const visibleColumns = (model: EdgeModelDefinition): EdgeModelColumn[] =>
  model.columns.filter((column) => !isBlobColumn(column));

const keyFromRow = (
  row: Record<string, unknown>,
  pkFields: string[],
): Record<string, unknown> | null => {
  const key: Record<string, unknown> = {};
  for (const field of pkFields) {
    const value = row[field];
    if (value == null || value === '') {
      return null;
    }
    key[field] = value;
  }
  return key;
};

const sequelizeErrorField = (
  error: unknown,
  columns: EdgeModelColumn[],
): string | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const record = error as {
    errors?: Array<{ path?: string }>;
    fields?: Record<string, unknown>;
  };
  const path = record.errors?.[0]?.path;
  if (typeof path === 'string') {
    const match = columns.find((column) => column.field === path || column.name === path);
    return match?.field ?? path;
  }
  if (record.fields && typeof record.fields === 'object') {
    const name = Object.keys(record.fields)[0];
    if (name) {
      const match = columns.find((column) => column.field === name || column.name === name);
      return match?.field ?? name;
    }
  }
  return undefined;
};

export class EdgeModelDatasheetService {
  private readonly sequelizeFactory: EdgeSequelizeFactory;

  constructor(private readonly getDataSources: () => StoredDataSource[]) {
    this.sequelizeFactory = new EdgeSequelizeFactory({ getDataSources });
  }

  private resolveModel(modelId: string): EdgeModelDefinition {
    const model = getEdgeModelById(modelId);
    if (!model) {
      throw new HttpError(404, 'Edge model not found.');
    }
    if (model.objectType !== 'TABLE' && model.objectType !== 'VIEW') {
      throw new HttpError(400, 'Datasheet is available for tables and views only.');
    }
    return model;
  }

  private resolveSource(model: EdgeModelDefinition): StoredDataSource {
    const source = this.getDataSources().find((item) => item.id === model.dataSourceId);
    if (!source) {
      throw new HttpError(400, `Data source not found: ${model.dataSourceId}`);
    }
    return source;
  }

  private async resolveCtor(model: EdgeModelDefinition): Promise<ModelCtor> {
    this.resolveSource(model);
    await this.sequelizeFactory.getOrCreate(model.dataSourceId);
    const models = this.sequelizeFactory.buildModelGraph([model]);
    const ctor = models.get(model.id);
    if (!ctor) {
      throw new HttpError(500, 'Failed to build Edge model.');
    }
    return ctor;
  }

  private assertWritable(model: EdgeModelDefinition): void {
    if (model.readOnly || model.objectType === 'VIEW') {
      throw new HttpError(400, 'This object is read-only.');
    }
  }

  private resolveQueryColumns(
    visible: EdgeModelColumn[],
    names: string[] | null,
  ): EdgeModelColumn[] {
    if (!names || names.length === 0) {
      return visible;
    }
    const matched: EdgeModelColumn[] = [];
    for (const name of names) {
      const column = visible.find((item) => (
        item.name.toLowerCase() === name.toLowerCase()
        || item.field.toLowerCase() === name.toLowerCase()
      ));
      if (!column) {
        throw new HttpError(400, `Unknown column: ${name}`);
      }
      if (!matched.some((item) => item.field === column.field)) {
        matched.push(column);
      }
    }
    for (let index = visible.length - 1; index >= 0; index -= 1) {
      const column = visible[index];
      if (column.isPrimaryKey && !matched.some((item) => item.field === column.field)) {
        matched.unshift(column);
      }
    }
    return matched;
  }

  async query(modelId: string, input: DatasheetQueryInput) {
    const model = this.resolveModel(modelId);
    const source = this.resolveSource(model);
    let parsed;
    try {
      parsed = parseDatasheetSelectSql(typeof input.sql === 'string' ? input.sql : '');
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : 'Invalid SQL sentence.');
    }
    const limit = assertDatasheetLimit(parsed.limit);
    const visible = visibleColumns(model);
    const selected = this.resolveQueryColumns(visible, parsed.columnNames);
    const selectSql = buildDatasheetSelectSql({
      sourceType: source.type,
      schema: model.schema,
      objectName: model.objectName,
      columnNames: selected.map((column) => column.name),
      limit,
      whereSql: parsed.whereSql,
    });
    const ModelCtor = await this.resolveCtor(model);
    try {
      const rowsResult = await ModelCtor.findAll({
        where: parsed.whereSql ? literal(`(${parsed.whereSql})`) : undefined,
        limit,
        offset: 0,
        attributes: selected.map((column) => column.field),
      });
      const rows = rowsResult.map((row) => {
        const plain = row.get({ plain: true }) as Record<string, unknown>;
        return serializeRow(plain);
      });
      return {
        columns: selected,
        primaryKey: model.primaryKey,
        readOnly: model.readOnly || model.objectType === 'VIEW',
        selectSql,
        rows,
        limit,
        totalCount: rows.length < limit ? rows.length : undefined,
      };
    } catch (error) {
      if (isHttpError(error)) {
        throw error;
      }
      throw new HttpError(
        400,
        error instanceof Error ? error.message : 'Failed to run the SQL sentence.',
      );
    }
  }

  async commitRow(modelId: string, input: DatasheetCommitRowInput) {
    const model = this.resolveModel(modelId);
    this.assertWritable(model);
    const isNew = Boolean(input.isNew);
    const values = asRecord(input.values);
    const columns = visibleColumns(model);
    const ModelCtor = await this.resolveCtor(model);
    const pkFields = resolvePrimaryKeyFields(model.columns, model.primaryKey);

    let payload: Record<string, unknown>;
    try {
      payload = coerceDatasheetRow(columns, values, {
        omitEmptyPrimaryKey: isNew,
        omitPrimaryKey: !isNew,
      });
    } catch (error) {
      if (error instanceof DatasheetCellError) {
        throw new HttpError(400, error.message, { field: error.field });
      }
      throw error;
    }

    try {
      if (isNew) {
        const created = await ModelCtor.create(payload);
        return serializeRow(created.get({ plain: true }) as Record<string, unknown>);
      }
      const key = asRecord(input.key);
      const where = Object.keys(key).length > 0 ? key : keyFromRow(values, pkFields);
      if (!where) {
        throw new HttpError(400, 'Primary key is required to update.');
      }
      const [count] = await ModelCtor.update(payload, { where });
      if (count === 0) {
        throw new HttpError(404, 'Row was not found.');
      }
      const fresh = await ModelCtor.findOne({
        where,
        attributes: columns.map((column) => column.field),
      });
      if (!fresh) {
        throw new HttpError(404, 'Row was not found.');
      }
      return serializeRow(fresh.get({ plain: true }) as Record<string, unknown>);
    } catch (error) {
      if (isHttpError(error)) {
        throw error;
      }
      const field = sequelizeErrorField(error, columns);
      const message = error instanceof Error ? error.message : 'Failed to save row.';
      throw new HttpError(400, message, field ? { field } : {});
    }
  }

  async deleteRow(modelId: string, input: DatasheetDeleteRowInput) {
    const model = this.resolveModel(modelId);
    this.assertWritable(model);
    const key = asRecord(input.key);
    if (Object.keys(key).length === 0) {
      throw new HttpError(400, 'Primary key is required to delete.');
    }
    const ModelCtor = await this.resolveCtor(model);
    try {
      const count = await ModelCtor.destroy({ where: key });
      if (count === 0) {
        throw new HttpError(404, 'Row was not found.');
      }
    } catch (error) {
      if (isHttpError(error)) {
        throw error;
      }
      throw new HttpError(
        400,
        error instanceof Error ? error.message : 'Failed to delete row.',
      );
    }
  }
}
