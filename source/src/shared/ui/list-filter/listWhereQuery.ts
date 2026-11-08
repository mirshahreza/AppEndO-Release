import type { ListWhereConditionIr, ListWhereIr } from './listWhereFilter';
import { splitWhereValue } from '../where-builder/whereBuilderModel';

export type ListWhereColumnType = 'string' | 'number' | 'boolean' | 'date' | 'enum';

export type ListWhereColumn = {
  path: string;
  type: ListWhereColumnType;
  /** Store booleans as 0/1 (Prisma app logs). */
  booleanAsInt?: boolean;
  transformValue?: (value: string) => string;
  /** Treat Equal as CONTAINS (request id inside a JSON blob). */
  preferContains?: boolean;
};

export type ListWhereColumnMap = Record<string, ListWhereColumn>;

const csvValues = (value: string): string[] => (
  value.split(',').map((item) => item.trim()).filter(Boolean)
);

const toBoolean = (value: string): boolean => (
  value.trim().toLowerCase() === 'true' || value.trim() === '1'
);

const toNumber = (value: string): number | null => {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toDate = (value: string, endOfDay = false): Date | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const scalarValue = (column: ListWhereColumn, raw: string): unknown => {
  const value = column.transformValue ? column.transformValue(raw) : raw.trim();
  if (column.type === 'number') return toNumber(value);
  if (column.type === 'boolean') {
    const flag = toBoolean(value);
    return column.booleanAsInt ? (flag ? 1 : 0) : flag;
  }
  if (column.type === 'date') return toDate(value);
  return value;
};

const conditionToSequelize = (
  condition: ListWhereConditionIr,
  column: ListWhereColumn,
  Op: Record<string, symbol>,
): Record<string, unknown> | null => {
  const likeValue = column.transformValue
    ? column.transformValue(condition.value)
    : condition.value.trim();
  const operator = column.preferContains && condition.operator === 'eq'
    ? 'contains'
    : condition.operator;
  if (operator === 'isNull') {
    return { [column.path]: { [Op.is]: null } };
  }
  if (operator === 'isNotNull') {
    return { [column.path]: { [Op.ne]: null } };
  }
  if (operator === 'contains') {
    return { [column.path]: { [Op.like]: `%${likeValue}%` } };
  }
  if (operator === 'startsWith') {
    return { [column.path]: { [Op.like]: `${likeValue}%` } };
  }
  if (operator === 'in') {
    const values = csvValues(condition.value).map((item) => scalarValue(column, item));
    return values.length > 0 ? { [column.path]: { [Op.in]: values } } : null;
  }
  if (operator === 'notIn') {
    const values = csvValues(condition.value).map((item) => scalarValue(column, item));
    return values.length > 0 ? { [column.path]: { [Op.notIn]: values } } : null;
  }
  if (operator === 'between') {
    const start = scalarValue(column, condition.value);
    const endRaw = condition.endValue ?? splitWhereValue(condition.value)[1];
    const end = column.type === 'date'
      ? toDate(endRaw, true)
      : scalarValue(column, endRaw);
    if (start == null || end == null) return null;
    return { [column.path]: { [Op.gte]: start, [Op.lte]: end } };
  }
  const value = operator === 'lte' && column.type === 'date'
    ? toDate(condition.value, true)
    : scalarValue(column, condition.value);
  if (value == null || value === '') return null;
  if (operator === 'neq') return { [column.path]: { [Op.ne]: value } };
  if (operator === 'gt') return { [column.path]: { [Op.gt]: value } };
  if (operator === 'gte') return { [column.path]: { [Op.gte]: value } };
  if (operator === 'lt') return { [column.path]: { [Op.lt]: value } };
  if (operator === 'lte') return { [column.path]: { [Op.lte]: value } };
  return { [column.path]: value };
};

export const listWhereIrToSequelize = (
  ir: ListWhereIr | null,
  columns: ListWhereColumnMap,
  Op: Record<string, symbol>,
): Record<string, unknown> | null => {
  if (!ir) return null;
  if (ir.kind === 'condition') {
    const column = columns[ir.field];
    if (!column) return null;
    return conditionToSequelize(ir, column, Op);
  }
  const children = ir.children
    .map((child) => listWhereIrToSequelize(child, columns, Op))
    .filter((child): child is Record<string, unknown> => child !== null);
  if (children.length === 0) return null;
  if (children.length === 1) return children[0]!;
  return { [ir.op === 'or' ? Op.or : Op.and]: children };
};

type PrismaContains = (value: string) => unknown;

const conditionToPrisma = (
  condition: ListWhereConditionIr,
  column: ListWhereColumn,
  contains: PrismaContains,
): Record<string, unknown> | null => {
  const raw = column.transformValue
    ? column.transformValue(condition.value)
    : condition.value.trim();
  const operator = column.preferContains && condition.operator === 'eq'
    ? 'contains'
    : condition.operator;
  if (operator === 'isNull') {
    return { [column.path]: null };
  }
  if (operator === 'isNotNull') {
    return { NOT: { [column.path]: null } };
  }
  if (operator === 'contains') {
    return { [column.path]: contains(raw) };
  }
  if (operator === 'startsWith') {
    return { [column.path]: { startsWith: raw } };
  }
  if (operator === 'in') {
    const values = csvValues(condition.value)
      .map((item) => scalarValue(column, item))
      .filter((item) => item != null && item !== '');
    return values.length > 0 ? { [column.path]: { in: values } } : null;
  }
  if (operator === 'notIn') {
    const values = csvValues(condition.value)
      .map((item) => scalarValue(column, item))
      .filter((item) => item != null && item !== '');
    return values.length > 0 ? { [column.path]: { notIn: values } } : null;
  }
  if (operator === 'between') {
    const start = scalarValue(column, condition.value);
    const endRaw = condition.endValue ?? splitWhereValue(condition.value)[1];
    const end = column.type === 'date'
      ? toDate(endRaw, true)
      : scalarValue(column, endRaw);
    if (start == null || end == null) return null;
    return { [column.path]: { gte: start, lte: end } };
  }
  const value = operator === 'lte' && column.type === 'date'
    ? toDate(condition.value, true)
    : scalarValue(column, condition.value);
  if (value == null || value === '') return null;
  if (operator === 'neq') return { [column.path]: { not: value } };
  if (operator === 'gt') return { [column.path]: { gt: value } };
  if (operator === 'gte') return { [column.path]: { gte: value } };
  if (operator === 'lt') return { [column.path]: { lt: value } };
  if (operator === 'lte') return { [column.path]: { lte: value } };
  return { [column.path]: value };
};

export const listWhereIrToPrisma = (
  ir: ListWhereIr | null,
  columns: ListWhereColumnMap,
  contains: PrismaContains,
): Record<string, unknown> | null => {
  if (!ir) return null;
  if (ir.kind === 'condition') {
    const column = columns[ir.field];
    if (!column) return null;
    return conditionToPrisma(ir, column, contains);
  }
  const children = ir.children
    .map((child) => listWhereIrToPrisma(child, columns, contains))
    .filter((child): child is Record<string, unknown> => child !== null);
  if (children.length === 0) return null;
  if (children.length === 1) return children[0]!;
  return { [ir.op === 'or' ? 'OR' : 'AND']: children };
};
