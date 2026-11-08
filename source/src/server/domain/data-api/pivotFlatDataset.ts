import { QueryTypes, fn, col, literal, type ModelCtor, type Sequelize, type WhereOptions } from 'sequelize';
import type {
  PivotAggregation,
  PivotResult,
  PivotSpec,
} from '../../../shared/api/contracts/data-api';
import {
  DEFAULT_PIVOT_CELL_CAP,
  DEFAULT_PIVOT_TIMEOUT_MS,
  PIVOT_EMPTY_MEMBER_KEY,
  PIVOT_TOTAL_MEMBER_KEY,
  encodePivotMemberKey,
  emptyPivotResult,
} from '../../../shared/api/contracts/data-api';
import { compileJsonExtractionSql, quoteSqlIdentifier, type JsonFieldExtraction } from './jsonFieldExtraction';

export type { JsonFieldExtraction };

export type PivotDatasetColumn = {
  field: string;
  sqlExpr?: string;
};

export type PivotDatasetQuery = {
  dialect: string;
  tableName: string;
  schema?: string | null;
  columns: PivotDatasetColumn[];
  sequelize: Sequelize;
  whereSql?: string;
  replacements?: Record<string, unknown>;
  where?: WhereOptions;
  jsonExtractions?: JsonFieldExtraction[];
  cellCap?: number;
  timeoutMs?: number;
};

const aggregationSql = (
  aggregation: PivotAggregation,
  expr: string,
): string => {
  switch (aggregation) {
    case 'sum':
      return `SUM(${expr})`;
    case 'avg':
      return `AVG(${expr})`;
    case 'min':
      return `MIN(${expr})`;
    case 'max':
      return `MAX(${expr})`;
    case 'countDistinct':
      return `COUNT(DISTINCT ${expr})`;
    case 'count':
    default:
      return `COUNT(${expr})`;
  }
};

const qualifyTable = (query: PivotDatasetQuery): string => {
  const table = quoteSqlIdentifier(query.tableName, query.dialect);
  if (!query.schema) {
    return table;
  }
  return `${quoteSqlIdentifier(query.schema, query.dialect)}.${table}`;
};

const dateTruncSql = (expr: string, grain: string, dialect: string): string => {
  const normalized = dialect.trim().toLowerCase();
  if (grain === 'month') {
    if (normalized === 'mssql') return `CONVERT(char(7), ${expr}, 126)`;
    if (normalized === 'mysql') return `DATE_FORMAT(${expr}, '%Y-%m')`;
    if (normalized === 'sqlite') return `strftime('%Y-%m', ${expr})`;
    return `TO_CHAR(${expr}, 'YYYY-MM')`;
  }
  if (grain === 'hour') {
    if (normalized === 'mssql') return `CONVERT(varchar(13), ${expr}, 126)`;
    if (normalized === 'mysql') return `DATE_FORMAT(${expr}, '%Y-%m-%d %H')`;
    if (normalized === 'sqlite') return `strftime('%Y-%m-%d %H', ${expr})`;
    return `TO_CHAR(${expr}, 'YYYY-MM-DD HH24')`;
  }
  if (normalized === 'mssql') return `CAST(${expr} AS DATE)`;
  if (normalized === 'mysql') return `DATE(${expr})`;
  if (normalized === 'sqlite') return `date(${expr})`;
  return `CAST(${expr} AS DATE)`;
};

const resolveFieldExpr = (query: PivotDatasetQuery, field: string): string => {
  const extraction = query.jsonExtractions?.find((item) => item.outputField === field);
  if (extraction) {
    return compileJsonExtractionSql(extraction, query.dialect);
  }
  const column = query.columns.find((item) => item.field === field);
  if (column?.sqlExpr) {
    return column.sqlExpr;
  }
  return quoteSqlIdentifier(field, query.dialect);
};

const toNumber = (value: unknown): number | null => {
  if (value == null) {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const memberFromRow = (row: Record<string, unknown>, fields: string[]): { key: string; labels: unknown[] } => {
  if (fields.length === 0) {
    return { key: PIVOT_EMPTY_MEMBER_KEY, labels: [] };
  }
  const labels = fields.map((field) => row[field] ?? row[field.toLowerCase()] ?? null);
  return { key: encodePivotMemberKey(labels), labels };
};

const collectMembers = (
  rows: Array<Record<string, unknown>>,
  fields: string[],
): Array<{ key: string; labels: unknown[] }> => {
  if (fields.length === 0) {
    return [{ key: PIVOT_EMPTY_MEMBER_KEY, labels: [] }];
  }
  const seen = new Map<string, { key: string; labels: unknown[] }>();
  for (const row of rows) {
    const member = memberFromRow(row, fields);
    if (!seen.has(member.key)) {
      seen.set(member.key, member);
    }
  }
  return [...seen.values()];
};

const applyTotals = (
  result: PivotResult,
  spec: PivotSpec,
): PivotResult => {
  if (!spec.totals?.rows && !spec.totals?.columns) {
    return result;
  }

  const measureCount = result.measures.length;
  const cells = [...result.cells];
  const rowMembers = [...result.rowAxis.members];
  const colMembers = [...result.colAxis.members];

  const addAggregated = (
    rowKey: string,
    colKey: string,
    matcher: (cell: PivotResult['cells'][number]) => boolean,
  ) => {
    const values = Array.from({ length: measureCount }, () => 0);
    let any = false;
    for (const cell of result.cells) {
      if (!matcher(cell)) {
        continue;
      }
      any = true;
      cell.values.forEach((value, index) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          values[index] += value;
        }
      });
    }
    if (any) {
      cells.push({ rowKey, colKey, values });
    }
  };

  if (spec.totals.columns) {
    colMembers.push({ key: PIVOT_TOTAL_MEMBER_KEY, labels: ['Total'] });
    for (const row of rowMembers) {
      addAggregated(row.key, PIVOT_TOTAL_MEMBER_KEY, (cell) => cell.rowKey === row.key);
    }
  }

  if (spec.totals.rows) {
    rowMembers.push({ key: PIVOT_TOTAL_MEMBER_KEY, labels: ['Total'] });
    for (const col of colMembers) {
      if (col.key === PIVOT_TOTAL_MEMBER_KEY) {
        continue;
      }
      addAggregated(PIVOT_TOTAL_MEMBER_KEY, col.key, (cell) => cell.colKey === col.key);
    }
  }

  return {
    ...result,
    rowAxis: { ...result.rowAxis, members: rowMembers },
    colAxis: { ...result.colAxis, members: colMembers },
    cells,
  };
};

export const groupedRowsToPivotResult = (
  groupedRows: Array<Record<string, unknown>>,
  spec: PivotSpec,
): PivotResult => {
  const rowFields = spec.rows.map((item) => item.field);
  const colFields = spec.columns.map((item) => item.field);
  const result = emptyPivotResult(spec);
  result.rowAxis.members = collectMembers(groupedRows, rowFields);
  result.colAxis.members = collectMembers(groupedRows, colFields);
  result.cells = groupedRows.map((row) => {
    const rowMember = memberFromRow(row, rowFields);
    const colMember = memberFromRow(row, colFields);
    const values = spec.measures.map((_, index) => toNumber(row[`m${index}`] ?? row[`M${index}`]));
    return { rowKey: rowMember.key, colKey: colMember.key, values };
  });
  return applyTotals(result, spec);
};

export const assertPivotFieldsAllowed = (
  spec: PivotSpec,
  allowedFields: Set<string>,
): void => {
  const used = [
    ...spec.rows.map((item) => item.field),
    ...spec.columns.map((item) => item.field),
    ...spec.measures.map((item) => item.field),
    ...Object.keys(spec.filters ?? {}),
  ];
  const unknown = used.filter((field) => !allowedFields.has(field));
  if (unknown.length > 0) {
    throw new Error(`Pivot field(s) are not in the prepared dataset: ${unknown.join(', ')}.`);
  }
};

/**
 * Compile a prepared dataset query + PivotSpec into one GROUP BY aggregation
 * and return a PivotResult. Does not materialize raw fact rows in Node.
 */
export const pivotFlatDataset = async (
  datasetQuery: PivotDatasetQuery,
  spec: PivotSpec,
): Promise<PivotResult> => {
  const allowed = new Set(datasetQuery.columns.map((column) => column.field));
  for (const extraction of datasetQuery.jsonExtractions ?? []) {
    allowed.add(extraction.outputField);
  }
  assertPivotFieldsAllowed(spec, allowed);

  const cellCap = datasetQuery.cellCap ?? DEFAULT_PIVOT_CELL_CAP;
  const timeoutMs = datasetQuery.timeoutMs ?? DEFAULT_PIVOT_TIMEOUT_MS;
  const axisFields = [...spec.rows, ...spec.columns];
  const selectParts: string[] = [];
  const groupExprs: string[] = [];

  for (const axis of axisFields) {
    let expr = resolveFieldExpr(datasetQuery, axis.field);
    if (axis.grain) {
      expr = dateTruncSql(expr, axis.grain, datasetQuery.dialect);
    }
    selectParts.push(`${expr} AS ${quoteSqlIdentifier(axis.field, datasetQuery.dialect)}`);
    groupExprs.push(expr);
  }
  spec.measures.forEach((measure, index) => {
    const expr = measure.aggregation === 'count' && measure.field === '*'
      ? 'COUNT(*)'
      : aggregationSql(measure.aggregation, resolveFieldExpr(datasetQuery, measure.field));
    selectParts.push(`${expr} AS ${quoteSqlIdentifier(`m${index}`, datasetQuery.dialect)}`);
  });

  if (selectParts.length === 0) {
    return emptyPivotResult(spec);
  }

  const groupSql = groupExprs.length > 0
    ? ` GROUP BY ${groupExprs.join(', ')}`
    : '';
  const whereSql = datasetQuery.whereSql?.trim() ? ` WHERE ${datasetQuery.whereSql}` : '';
  const limit = cellCap + 1;
  const dialect = datasetQuery.dialect.trim().toLowerCase();
  const limitSql = dialect === 'mssql' || dialect === 'oracle'
    ? ''
    : ` LIMIT ${limit}`;
  const topSql = dialect === 'mssql' ? `TOP (${limit}) ` : '';
  const fetchSql = dialect === 'oracle' ? ` FETCH FIRST ${limit} ROWS ONLY` : '';

  const sql = `SELECT ${topSql}${selectParts.join(', ')} FROM ${qualifyTable(datasetQuery)}${whereSql}${groupSql}${limitSql}${fetchSql}`;

  const rows = await datasetQuery.sequelize.query(sql, {
    type: QueryTypes.SELECT,
    replacements: datasetQuery.replacements,
    benchmark: false,
    // Sequelize timeout is dialect-specific; callers also wrap with Promise.race.
  }) as Array<Record<string, unknown>>;

  if (rows.length > cellCap) {
    throw new Error(`Pivot result exceeded the cell cap of ${cellCap}.`);
  }

  void timeoutMs;
  return groupedRowsToPivotResult(rows, spec);
};

const sequelizeAggregation = (
  aggregation: PivotAggregation,
  expr: ReturnType<typeof col> | ReturnType<typeof literal>,
) => {
  switch (aggregation) {
    case 'sum':
      return fn('SUM', expr);
    case 'avg':
      return fn('AVG', expr);
    case 'min':
      return fn('MIN', expr);
    case 'max':
      return fn('MAX', expr);
    case 'countDistinct':
      return fn('COUNT', fn('DISTINCT', expr));
    case 'count':
    default:
      return fn('COUNT', expr);
  }
};

export type PivotSequelizeDataset = {
  ModelCtor: ModelCtor;
  sequelize: Sequelize;
  dialect: string;
  spec: PivotSpec;
  where?: WhereOptions;
  jsonExtractions?: JsonFieldExtraction[];
  allowedFields: Set<string>;
  cellCap?: number;
};

export const pivotSequelizeDataset = async (
  input: PivotSequelizeDataset,
): Promise<PivotResult> => {
  assertPivotFieldsAllowed(input.spec, input.allowedFields);
  const cellCap = input.cellCap ?? DEFAULT_PIVOT_CELL_CAP;
  const groupFields = [
    ...input.spec.rows.map((item) => item.field),
    ...input.spec.columns.map((item) => item.field),
  ];

  const resolveExpr = (field: string) => {
    const extraction = input.jsonExtractions?.find((item) => item.outputField === field);
    if (extraction) {
      return literal(compileJsonExtractionSql(extraction, input.dialect));
    }
    return col(field);
  };

  const attributes: Array<[unknown, string] | string> = [
    ...groupFields,
    ...input.spec.measures.map((measure, index) => [
      sequelizeAggregation(measure.aggregation, resolveExpr(measure.field)),
      `m${index}`,
    ] as [unknown, string]),
  ];

  const isGrouped = groupFields.length > 0;
  const rows = await input.ModelCtor.findAll({
    where: input.where,
    attributes: attributes as never,
    group: isGrouped ? groupFields : undefined,
    // Model defaultScope / LIMIT otherwise ORDER BY the PK, which SQL Server rejects on aggregates.
    order: isGrouped ? groupFields.map((field) => [field, 'ASC']) : [],
    ...(isGrouped ? { limit: cellCap + 1 } : {}),
    raw: true,
  }) as unknown as Array<Record<string, unknown>>;

  if (isGrouped && rows.length > cellCap) {
    throw new Error(`Pivot result exceeded the cell cap of ${cellCap}.`);
  }

  return groupedRowsToPivotResult(rows, input.spec);
};
