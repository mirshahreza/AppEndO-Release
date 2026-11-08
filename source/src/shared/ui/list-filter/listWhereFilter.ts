import {
  createEmptyWhereTree,
  createWhereCondition,
  createWhereGroup,
  formatWherePreview,
  splitWhereValue,
  whereOperatorNeedsValue,
  type WhereCombinator,
  type WhereConditionNode,
  type WhereField,
  type WhereGroupNode,
  type WhereNode,
  type WhereOperator,
} from '../where-builder/whereBuilderModel';

export type ListWhereConditionIr = {
  kind: 'condition';
  field: string;
  operator: string;
  value: string;
  endValue?: string;
};

export type ListWhereGroupIr = {
  kind: 'group';
  op: WhereCombinator;
  children: ListWhereIr[];
};

export type ListWhereIr = ListWhereConditionIr | ListWhereGroupIr;

const MAX_GROUP_CHILDREN = 24;
const MAX_DEPTH = 4;
const MAX_JSON_CHARS = 8_000;

const asCombinator = (value: unknown): WhereCombinator => (
  value === 'or' ? 'or' : 'and'
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const conditionIsComplete = (
  node: WhereConditionNode,
  operators?: readonly WhereOperator[],
): boolean => {
  if (!node.field.trim()) return false;
  if (!node.operator.trim()) return false;
  if (!whereOperatorNeedsValue(node.operator, operators)) return true;
  if (node.operator === 'between') {
    const [start, end] = splitWhereValue(node.value);
    return Boolean(start.trim() && end.trim());
  }
  return Boolean(node.value.trim());
};

const sanitizeNode = (
  raw: unknown,
  fields: ReadonlySet<string>,
  operators: ReadonlySet<string>,
  depth: number,
): WhereNode | null => {
  if (!isRecord(raw) || depth > MAX_DEPTH) return null;
  const kind = raw.kind;
  if (kind === 'condition') {
    const field = typeof raw.field === 'string' ? raw.field.trim() : '';
    const operator = typeof raw.operator === 'string' ? raw.operator.trim() : 'eq';
    if (!field || (fields.size > 0 && !fields.has(field))) return null;
    if (operators.size > 0 && !operators.has(operator)) return null;
    return {
      kind: 'condition',
      id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `where_${depth}`,
      field,
      operator,
      value: typeof raw.value === 'string' ? raw.value : '',
      valueKind: raw.valueKind === 'context' ? 'context' : 'literal',
      endValueKind: raw.endValueKind === 'context' ? 'context' : 'literal',
    };
  }
  if (kind === 'group') {
    const childrenRaw = Array.isArray(raw.children) ? raw.children.slice(0, MAX_GROUP_CHILDREN) : [];
    const children = childrenRaw
      .map((child) => sanitizeNode(child, fields, operators, depth + 1))
      .filter((child): child is WhereNode => child !== null && child.kind !== 'manual');
    return createWhereGroup(
      asCombinator(raw.op),
      children,
      typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `where_group_${depth}`,
    );
  }
  return null;
};

export const sanitizeListWhereTree = (
  raw: unknown,
  fields: readonly WhereField[],
  operators?: readonly WhereOperator[],
): WhereGroupNode => {
  const fieldIds = new Set(fields.map((item) => item.id));
  const operatorIds = new Set((operators ?? []).map((item) => item.id));
  const node = sanitizeNode(raw, fieldIds, operatorIds, 0);
  if (!node || node.kind !== 'group') {
    return createEmptyWhereTree();
  }
  return node;
};

const nodeToIr = (
  node: WhereNode,
  operators?: readonly WhereOperator[],
): ListWhereIr | null => {
  if (node.kind === 'manual') return null;
  if (node.kind === 'condition') {
    if (!conditionIsComplete(node, operators)) return null;
    const [start, end] = splitWhereValue(node.value);
    return {
      kind: 'condition',
      field: node.field,
      operator: node.operator,
      value: node.operator === 'between' ? start : node.value.trim(),
      endValue: node.operator === 'between' ? end : undefined,
    };
  }
  const children = node.children
    .map((child) => nodeToIr(child, operators))
    .filter((child): child is ListWhereIr => child !== null);
  if (children.length === 0) return null;
  if (children.length === 1) return children[0]!;
  return { kind: 'group', op: node.op, children };
};

export const listWhereTreeToIr = (
  tree: WhereGroupNode,
  operators?: readonly WhereOperator[],
): ListWhereIr | null => nodeToIr(tree, operators);

export const isListWhereTreeActive = (
  tree: WhereGroupNode,
  operators?: readonly WhereOperator[],
): boolean => listWhereTreeToIr(tree, operators) !== null;

export const countListWhereConditions = (
  tree: WhereGroupNode,
  operators?: readonly WhereOperator[],
): number => {
  const visit = (node: ListWhereIr | null): number => {
    if (!node) return 0;
    if (node.kind === 'condition') return 1;
    return node.children.reduce((sum, child) => sum + visit(child), 0);
  };
  return visit(listWhereTreeToIr(tree, operators));
};

export const formatListWhereSummary = (
  tree: WhereGroupNode,
  fields: readonly WhereField[],
): string => {
  if (!isListWhereTreeActive(tree)) return '';
  const preview = formatWherePreview(tree, fields);
  return preview === 'TRUE' ? '' : preview;
};

export const serializeListWhereTree = (tree: WhereGroupNode): string => {
  const json = JSON.stringify(tree);
  return json.length > MAX_JSON_CHARS ? JSON.stringify(createEmptyWhereTree()) : json;
};

export const parseListWhereTreeParam = (
  raw: unknown,
  fields: readonly WhereField[],
  operators?: readonly WhereOperator[],
): WhereGroupNode | null => {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  if (raw.length > MAX_JSON_CHARS) return null;
  try {
    return sanitizeListWhereTree(JSON.parse(raw), fields, operators);
  } catch {
    return null;
  }
};

export const createSeededWhereTree = (
  field: string,
  operator: string,
  value: string,
): WhereGroupNode => (
  createWhereGroup('and', [createWhereCondition(field, operator, value)])
);

export const whereTreeHasField = (tree: WhereGroupNode, field: string): boolean => {
  const visit = (node: WhereNode): boolean => {
    if (node.kind === 'condition') return node.field === field && Boolean(node.value.trim());
    if (node.kind === 'group') return node.children.some(visit);
    return false;
  };
  return visit(tree);
};

export const collectListWhereFieldValues = (
  ir: ListWhereIr | null,
  field: string,
): string[] => {
  if (!ir) return [];
  if (ir.kind === 'condition') {
    if (ir.field !== field) return [];
    if (ir.operator === 'in' || ir.operator === 'notIn') {
      return ir.value.split(',').map((item) => item.trim()).filter(Boolean);
    }
    if (ir.operator === 'eq' || ir.operator === 'contains' || ir.operator === 'startsWith') {
      return ir.value.trim() ? [ir.value.trim()] : [];
    }
    return [];
  }
  return ir.children.flatMap((child) => collectListWhereFieldValues(child, field));
};

export const mergeWhereCondition = (
  tree: WhereGroupNode,
  field: string,
  operator: string,
  value: string,
): WhereGroupNode => {
  if (whereTreeHasField(tree, field)) return tree;
  return {
    ...tree,
    children: [...tree.children, createWhereCondition(field, operator, value)],
  };
};

const csvValues = (value: string): string[] => (
  value.split(',').map((item) => item.trim()).filter(Boolean)
);

const rowCellString = (row: Record<string, unknown>, field: string): string => {
  const value = row[field];
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  return String(value);
};

const rowCellNumber = (row: Record<string, unknown>, field: string): number | null => {
  const value = row[field];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(rowCellString(row, field));
  return Number.isFinite(parsed) ? parsed : null;
};

const evaluateListWhereConditionOnRecord = (
  row: Record<string, unknown>,
  condition: ListWhereConditionIr,
): boolean => {
  const cellRaw = row[condition.field];
  const operator = condition.operator;
  const value = condition.value.trim();
  const cellStr = rowCellString(row, condition.field);
  const cellLower = cellStr.toLowerCase();
  const valueLower = value.toLowerCase();

  if (operator === 'isNull') {
    return cellRaw == null || cellStr === '';
  }
  if (operator === 'isNotNull') {
    return cellRaw != null && cellStr !== '';
  }
  if (operator === 'in') {
    const options = csvValues(condition.value).map((item) => item.toLowerCase());
    return options.length > 0 && options.includes(cellLower);
  }
  if (operator === 'notIn') {
    const options = csvValues(condition.value).map((item) => item.toLowerCase());
    return options.length === 0 || !options.includes(cellLower);
  }
  if (operator === 'between') {
    const endRaw = condition.endValue ?? splitWhereValue(condition.value)[1];
    const left = rowCellNumber(row, condition.field);
    const right = Number(endRaw.trim());
    if (left == null || !Number.isFinite(right)) {
      return cellLower >= valueLower && cellLower <= endRaw.trim().toLowerCase();
    }
    return left >= Number(value) && left <= right;
  }
  if (operator === 'contains') {
    return valueLower.length === 0 || cellLower.includes(valueLower);
  }
  if (operator === 'startsWith') {
    return valueLower.length === 0 || cellLower.startsWith(valueLower);
  }
  if (operator === 'eq') {
    return cellLower === valueLower;
  }
  if (operator === 'neq') {
    return cellLower !== valueLower;
  }
  const cellNum = rowCellNumber(row, condition.field);
  const valueNum = Number(value);
  if (cellNum != null && Number.isFinite(valueNum)) {
    if (operator === 'gt') return cellNum > valueNum;
    if (operator === 'gte') return cellNum >= valueNum;
    if (operator === 'lt') return cellNum < valueNum;
    if (operator === 'lte') return cellNum <= valueNum;
  }
  if (operator === 'gt') return cellLower > valueLower;
  if (operator === 'gte') return cellLower >= valueLower;
  if (operator === 'lt') return cellLower < valueLower;
  if (operator === 'lte') return cellLower <= valueLower;
  return false;
};

/** Client-side row test for list pages that already hold rows in memory (CRUD Set, previews). */
export const evaluateListWhereIrOnRecord = (
  row: Record<string, unknown>,
  ir: ListWhereIr | null,
): boolean => {
  if (!ir) return true;
  if (ir.kind === 'condition') {
    return evaluateListWhereConditionOnRecord(row, ir);
  }
  const results = ir.children.map((child) => evaluateListWhereIrOnRecord(row, child));
  if (results.length === 0) return true;
  return ir.op === 'or' ? results.some(Boolean) : results.every(Boolean);
};

export const filterRecordsByListWhereTree = <TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  tree: WhereGroupNode,
  operators?: readonly WhereOperator[],
): TRow[] => {
  const ir = listWhereTreeToIr(tree, operators);
  if (!ir) return [...rows];
  return rows.filter((row) => evaluateListWhereIrOnRecord(row, ir));
};
