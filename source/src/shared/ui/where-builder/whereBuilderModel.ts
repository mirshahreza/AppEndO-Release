export type WhereCombinator = 'and' | 'or';

export type WhereValueType = 'text' | 'number' | 'boolean' | 'date';

export type WhereFieldOption = {
  id: string;
  label: string;
};

export type WhereField = {
  id: string;
  label: string;
  type?: WhereValueType;
  /** Closed value list — eq/neq render a select (or combobox when allowCustomValue). */
  options?: readonly WhereFieldOption[];
  allowCustomValue?: boolean;
};

export type WhereOperator = {
  id: string;
  label: string;
  needsValue: boolean;
  valueArity?: 1 | 2;
  types?: readonly WhereValueType[];
};

export type WhereValueKind = 'literal' | 'context';

export type WhereContextValueShape = 'scalar' | 'collection';

export type WhereContextFilterMode = 'scalar' | 'collection' | 'scope';

export type WhereContextItem = {
  id: string;
  label?: string;
  /** When omitted, inferred from the context key id. */
  valueShape?: WhereContextValueShape;
};

const WHERE_CONTEXT_COLLECTION_KEYS = new Set(['sys.roles']);

export const inferWhereContextValueShape = (contextKey: string): WhereContextValueShape => {
  if (WHERE_CONTEXT_COLLECTION_KEYS.has(contextKey) || contextKey.startsWith('scope.')) {
    return 'collection';
  }
  return 'scalar';
};

export const resolveWhereContextValueShape = (item: WhereContextItem): WhereContextValueShape => (
  item.valueShape ?? inferWhereContextValueShape(item.id)
);

export const whereContextFilterModeForOperator = (operatorId: string): WhereContextFilterMode | null => {
  if (operatorId === 'in' || operatorId === 'notIn') {
    return 'collection';
  }
  if (operatorId === 'inScopeSet' || operatorId === 'inSubtree') {
    return 'scope';
  }
  if (
    operatorId === 'eq'
    || operatorId === 'neq'
    || operatorId === 'gt'
    || operatorId === 'gte'
    || operatorId === 'lt'
    || operatorId === 'lte'
    || operatorId === 'startsWith'
    || operatorId === 'contains'
    || operatorId === 'between'
  ) {
    return 'scalar';
  }
  return null;
};

export const filterWhereContextItemsForOperator = (
  operatorId: string,
  items: readonly WhereContextItem[],
): readonly WhereContextItem[] => {
  const mode = whereContextFilterModeForOperator(operatorId);
  if (!mode) {
    return [];
  }
  if (mode === 'scope') {
    return items.filter((item) => item.id.startsWith('scope.'));
  }
  if (mode === 'collection') {
    return items.filter((item) => resolveWhereContextValueShape(item) === 'collection');
  }
  return items.filter((item) => resolveWhereContextValueShape(item) === 'scalar');
};

export const isWhereContextRefValidForOperator = (
  operatorId: string,
  contextRef: string,
  items: readonly WhereContextItem[],
): boolean => (
  filterWhereContextItemsForOperator(operatorId, items).some((item) => item.id === contextRef)
);

export type WhereConditionNode = {
  kind: 'condition';
  id: string;
  field: string;
  operator: string;
  value: string;
  valueKind?: WhereValueKind;
  endValueKind?: WhereValueKind;
};

export type WhereManualNode = {
  kind: 'manual';
  id: string;
  expression: string;
};

export type WhereGroupNode = {
  kind: 'group';
  id: string;
  op: WhereCombinator;
  children: WhereNode[];
};

export type WhereNode = WhereGroupNode | WhereConditionNode | WhereManualNode;

export const DEFAULT_WHERE_OPERATORS: readonly WhereOperator[] = [
  { id: 'eq', label: 'Equal', needsValue: true, types: ['text', 'number', 'boolean', 'date'] },
  { id: 'neq', label: 'Not equal', needsValue: true, types: ['text', 'number', 'boolean', 'date'] },
  { id: 'in', label: 'In', needsValue: true, types: ['text'] },
  { id: 'notIn', label: 'Not in', needsValue: true, types: ['text'] },
  { id: 'gt', label: 'Greater Than', needsValue: true, types: ['number', 'date'] },
  { id: 'gte', label: 'Greater or equal', needsValue: true, types: ['number', 'date'] },
  { id: 'lt', label: 'Less Than', needsValue: true, types: ['number', 'date'] },
  { id: 'lte', label: 'Less or equal', needsValue: true, types: ['number', 'date'] },
  { id: 'between', label: 'Between', needsValue: true, valueArity: 2, types: ['number', 'date'] },
  { id: 'isNull', label: 'Is empty', needsValue: false },
  { id: 'isNotNull', label: 'Is not empty', needsValue: false },
  { id: 'startsWith', label: 'Starts With', needsValue: true, types: ['text'] },
  { id: 'contains', label: 'Contains', needsValue: true, types: ['text'] },
];

export const SAMPLE_WHERE_FIELDS: readonly WhereField[] = [
  { id: 'firstName', label: 'First Name', type: 'text' },
  { id: 'lastName', label: 'Last Name', type: 'text' },
  { id: 'age', label: 'Age', type: 'number' },
  { id: 'isDeveloper', label: 'Is Developer', type: 'boolean' },
  { id: 'primaryFramework', label: 'Primary Framework', type: 'text' },
  { id: 'hireDate', label: 'Hire Date', type: 'date' },
];

export const SAMPLE_WHERE_CONTEXT_ITEMS: readonly WhereContextItem[] = [
  { id: 'user.id', label: 'user.id', valueShape: 'scalar' },
  { id: 'user.email', label: 'user.email', valueShape: 'scalar' },
  { id: 'sys.roles', label: 'sys.roles', valueShape: 'collection' },
  { id: 'scope.org', label: 'scope.org', valueShape: 'collection' },
  { id: 'scope.geo', label: 'scope.geo', valueShape: 'collection' },
];

const newWhereId = (): string => `where_${Math.random().toString(36).slice(2, 10)}`;

export const createWhereCondition = (
  field: string,
  operator = 'eq',
  value = '',
  id = newWhereId(),
  valueKind: WhereValueKind = 'literal',
): WhereConditionNode => ({
  kind: 'condition',
  id,
  field,
  operator,
  value,
  valueKind,
});

export const createWhereGroup = (
  op: WhereCombinator = 'and',
  children: WhereNode[] = [],
  id = newWhereId(),
): WhereGroupNode => ({
  kind: 'group',
  id,
  op,
  children,
});

export const createWhereManual = (
  expression = '',
  id = newWhereId(),
): WhereManualNode => ({
  kind: 'manual',
  id,
  expression,
});

export const createEmptyWhereTree = (id = 'where-root'): WhereGroupNode => (
  createWhereGroup('and', [], id)
);

export const createSampleWhereTree = (
  fixture: 'simple' | 'nested' | 'empty',
): WhereGroupNode => {
  if (fixture === 'empty') {
    return createEmptyWhereTree();
  }
  const firstName = createWhereCondition('firstName', 'startsWith', 'Andre', 'where-firstName');
  const lastName = createWhereCondition('lastName', 'in', 'Davolio, Buchanan', 'where-lastName');
  if (fixture === 'simple') {
    return createWhereGroup('and', [firstName, lastName], 'where-root');
  }
  return createWhereGroup('and', [
    firstName,
    lastName,
    createWhereCondition('age', 'gt', '30', 'where-age'),
    createWhereGroup('or', [
      createWhereCondition('isDeveloper', 'eq', 'true', 'where-isDeveloper'),
      createWhereCondition('primaryFramework', 'eq', 'React', 'where-framework'),
    ], 'where-nested'),
    createWhereCondition('hireDate', 'between', '2023-11-28,2023-11-30', 'where-hireDate'),
  ], 'where-root');
};

export const getWhereNodeAt = (
  node: WhereNode,
  path: readonly number[],
): WhereNode | null => {
  if (path.length === 0) {
    return node;
  }
  if (node.kind !== 'group') {
    return null;
  }
  const [head, ...rest] = path;
  const child = node.children[head];
  return child ? getWhereNodeAt(child, rest) : null;
};

export const updateWhereNodeAt = (
  node: WhereNode,
  path: readonly number[],
  updater: (current: WhereNode) => WhereNode,
): WhereNode => {
  if (path.length === 0) {
    return updater(node);
  }
  if (node.kind !== 'group') {
    return node;
  }
  const [head, ...rest] = path;
  return {
    ...node,
    children: node.children.map((child, index) => (
      index === head ? updateWhereNodeAt(child, rest, updater) : child
    )),
  };
};

export const setWhereGroupOp = (
  root: WhereGroupNode,
  path: readonly number[],
  op: WhereCombinator,
): WhereGroupNode => {
  const next = updateWhereNodeAt(root, path, (node) => (
    node.kind === 'group' ? { ...node, op } : node
  ));
  return next.kind === 'group' ? next : root;
};

export type WhereConditionPatch = Partial<
  Pick<WhereConditionNode, 'field' | 'operator' | 'value' | 'valueKind' | 'endValueKind'>
>;

export const patchWhereCondition = (
  root: WhereGroupNode,
  path: readonly number[],
  patch: WhereConditionPatch,
): WhereGroupNode => {
  const next = updateWhereNodeAt(root, path, (node) => (
    node.kind === 'condition' ? { ...node, ...patch } : node
  ));
  return next.kind === 'group' ? next : root;
};

export const addWhereChild = (
  root: WhereGroupNode,
  groupPath: readonly number[],
  child: WhereNode,
): WhereGroupNode => {
  const next = updateWhereNodeAt(root, groupPath, (node) => (
    node.kind === 'group' ? { ...node, children: [...node.children, child] } : node
  ));
  return next.kind === 'group' ? next : root;
};

export const replaceWhereNodeAt = (
  root: WhereGroupNode,
  path: readonly number[],
  nextNode: WhereNode,
): WhereGroupNode => {
  if (path.length === 0) {
    return root;
  }
  const next = updateWhereNodeAt(root, path, () => nextNode);
  return next.kind === 'group' ? next : root;
};

export const patchWhereManual = (
  root: WhereGroupNode,
  path: readonly number[],
  expression: string,
): WhereGroupNode => {
  const next = updateWhereNodeAt(root, path, (node) => (
    node.kind === 'manual' ? { ...node, expression } : node
  ));
  return next.kind === 'group' ? next : root;
};

export const findWherePathById = (
  node: WhereNode,
  id: string,
  path: readonly number[] = [],
): number[] | null => {
  if (node.id === id) {
    return [...path];
  }
  if (node.kind !== 'group') {
    return null;
  }
  for (let index = 0; index < node.children.length; index += 1) {
    const found = findWherePathById(node.children[index]!, id, [...path, index]);
    if (found) {
      return found;
    }
  }
  return null;
};

const pathsEqual = (left: readonly number[], right: readonly number[]): boolean => (
  left.length === right.length && left.every((value, index) => value === right[index])
);

const isPathPrefix = (prefix: readonly number[], path: readonly number[]): boolean => (
  prefix.length <= path.length && prefix.every((value, index) => value === path[index])
);

const whereGroupHeight = (node: WhereNode): number => {
  if (node.kind !== 'group') {
    return 0;
  }
  if (node.children.length === 0) {
    return 1;
  }
  return 1 + Math.max(...node.children.map((child) => whereGroupHeight(child)));
};

const moveArrayItem = <T,>(items: readonly T[], from: number, to: number): T[] => {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) {
    return next;
  }
  next.splice(to, 0, item);
  return next;
};

const adjustPathAfterRemoval = (
  destParentPath: readonly number[],
  fromPath: readonly number[],
): number[] => {
  const fromParentPath = fromPath.slice(0, -1);
  const fromIndex = fromPath[fromPath.length - 1]!;
  if (fromParentPath.length > destParentPath.length) {
    return [...destParentPath];
  }
  if (!fromParentPath.every((value, index) => value === destParentPath[index])) {
    return [...destParentPath];
  }
  if (destParentPath.length === fromParentPath.length) {
    return [...destParentPath];
  }
  const branch = destParentPath[fromParentPath.length]!;
  if (branch > fromIndex) {
    const next = [...destParentPath];
    next[fromParentPath.length] = branch - 1;
    return next;
  }
  return [...destParentPath];
};

export const WHERE_GROUP_DROP_PREFIX = 'where-drop:';

export const whereGroupDropId = (groupId: string): string => `${WHERE_GROUP_DROP_PREFIX}${groupId}`;

export const moveWhereNodeTo = (
  root: WhereGroupNode,
  fromPath: readonly number[],
  destParentPath: readonly number[],
  destIndex: number,
  maxDepth = 3,
): WhereGroupNode => {
  if (fromPath.length === 0) {
    return root;
  }
  const source = getWhereNodeAt(root, fromPath);
  const destParent = getWhereNodeAt(root, destParentPath);
  if (!source || !destParent || destParent.kind !== 'group') {
    return root;
  }
  if (source.kind === 'group' && isPathPrefix(fromPath, destParentPath)) {
    return root;
  }
  if (source.kind === 'group' && destParentPath.length + whereGroupHeight(source) > maxDepth) {
    return root;
  }

  const fromParentPath = fromPath.slice(0, -1);
  const fromIndex = fromPath[fromPath.length - 1]!;
  if (pathsEqual(fromParentPath, destParentPath)) {
    const lastIndex = destParent.children.length - 1;
    const to = destIndex >= destParent.children.length ? lastIndex : destIndex;
    if (to < 0 || to === fromIndex) {
      return root;
    }
    const next = updateWhereNodeAt(root, destParentPath, (node) => (
      node.kind === 'group'
        ? { ...node, children: moveArrayItem(node.children, fromIndex, to) }
        : node
    ));
    return next.kind === 'group' ? next : root;
  }

  const insertAt = Math.max(0, Math.min(destIndex, destParent.children.length));
  const without = removeWhereNodeAt(root, fromPath);
  const adjustedDest = adjustPathAfterRemoval(destParentPath, fromPath);
  const destAfter = getWhereNodeAt(without, adjustedDest);
  if (!destAfter || destAfter.kind !== 'group') {
    return root;
  }
  const clamped = Math.max(0, Math.min(insertAt, destAfter.children.length));
  const next = updateWhereNodeAt(without, adjustedDest, (node) => (
    node.kind === 'group'
      ? {
          ...node,
          children: [
            ...node.children.slice(0, clamped),
            source,
            ...node.children.slice(clamped),
          ],
        }
      : node
  ));
  return next.kind === 'group' ? next : root;
};

export const moveWhereNodeByDrag = (
  root: WhereGroupNode,
  activeId: string,
  overId: string,
  maxDepth = 3,
): WhereGroupNode => {
  if (activeId === overId) {
    return root;
  }
  const fromPath = findWherePathById(root, activeId);
  if (!fromPath || fromPath.length === 0) {
    return root;
  }
  if (overId.startsWith(WHERE_GROUP_DROP_PREFIX)) {
    const groupId = overId.slice(WHERE_GROUP_DROP_PREFIX.length);
    const destParentPath = findWherePathById(root, groupId);
    if (!destParentPath) {
      return root;
    }
    const destParent = getWhereNodeAt(root, destParentPath);
    if (!destParent || destParent.kind !== 'group') {
      return root;
    }
    return moveWhereNodeTo(root, fromPath, destParentPath, destParent.children.length, maxDepth);
  }
  const overPath = findWherePathById(root, overId);
  if (!overPath) {
    return root;
  }
  if (overPath.length === 0) {
    return moveWhereNodeTo(root, fromPath, [], root.children.length, maxDepth);
  }
  return moveWhereNodeTo(
    root,
    fromPath,
    overPath.slice(0, -1),
    overPath[overPath.length - 1]!,
    maxDepth,
  );
};

export const moveWhereNodeAt = (
  root: WhereGroupNode,
  path: readonly number[],
  delta: -1 | 1,
): WhereGroupNode => {
  if (path.length === 0) {
    return root;
  }
  return moveWhereNodeTo(root, path, path.slice(0, -1), path[path.length - 1]! + delta);
};

export const removeWhereNodeAt = (
  root: WhereGroupNode,
  path: readonly number[],
): WhereGroupNode => {
  if (path.length === 0) {
    return root;
  }
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1]!;
  const next = updateWhereNodeAt(root, parentPath, (node) => (
    node.kind === 'group'
      ? { ...node, children: node.children.filter((_, childIndex) => childIndex !== index) }
      : node
  ));
  return next.kind === 'group' ? next : root;
};

const SQL_OP_TOKEN: Record<string, string> = {
  eq: '=',
  neq: '<>',
  in: 'IN',
  notIn: 'NOT IN',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  isNull: 'IS NULL',
  isNotNull: 'IS NOT NULL',
  startsWith: 'STARTS WITH',
  contains: 'CONTAINS',
  between: 'BETWEEN',
};

export const whereFieldType = (field: WhereField | undefined): WhereValueType => (
  field?.type ?? 'text'
);

export const operatorsForField = (
  field: WhereField | undefined,
  operators: readonly WhereOperator[] = DEFAULT_WHERE_OPERATORS,
): readonly WhereOperator[] => {
  const type = whereFieldType(field);
  const matched = operators.filter((operator) => !operator.types || operator.types.includes(type));
  return matched.length > 0 ? matched : operators;
};

export const whereOperatorValueArity = (
  operatorId: string,
  operators: readonly WhereOperator[] = DEFAULT_WHERE_OPERATORS,
): 0 | 1 | 2 => {
  const operator = operators.find((item) => item.id === operatorId);
  if (!operator?.needsValue) {
    return 0;
  }
  return operator.valueArity === 2 ? 2 : 1;
};

export const splitWhereValue = (value: string): [string, string] => {
  const comma = value.indexOf(',');
  if (comma < 0) {
    return [value, ''];
  }
  return [value.slice(0, comma).trim(), value.slice(comma + 1).trim()];
};

export const joinWhereValue = (start: string, end: string): string => (
  end.trim().length > 0 ? `${start},${end}` : start
);

const quoteLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`;

const formatConditionValue = (
  operator: string,
  value: string,
  valueKind: WhereValueKind = 'literal',
  endValueKind: WhereValueKind = 'literal',
): string => {
  if (operator === 'in' || operator === 'notIn') {
    if (valueKind === 'context') {
      return value;
    }
    const items = value.split(',').map((item) => item.trim()).filter(Boolean);
    return `(${items.map((item) => quoteLiteral(item)).join(', ')})`;
  }
  if (operator === 'between') {
    const [start, end] = splitWhereValue(value);
    const left = valueKind === 'context' ? start : quoteLiteral(start);
    const right = endValueKind === 'context' ? end : quoteLiteral(end);
    return `${left} AND ${right}`;
  }
  return valueKind === 'context' ? value : quoteLiteral(value);
};

const fieldLabelForPreview = (
  fieldId: string,
  fields?: readonly WhereField[],
): string => fields?.find((item) => item.id === fieldId)?.label ?? fieldId;

const optionLabelForPreview = (
  fieldId: string,
  value: string,
  fields?: readonly WhereField[],
): string => {
  const field = fields?.find((item) => item.id === fieldId);
  return field?.options?.find((item) => item.id === value)?.label ?? value;
};

const formatWhereNodePreview = (
  node: WhereNode,
  fields?: readonly WhereField[],
): string => {
  if (node.kind === 'manual') {
    const expression = node.expression.trim();
    return expression.length > 0 ? expression : 'TRUE';
  }
  if (node.kind === 'condition') {
    const token = SQL_OP_TOKEN[node.operator] ?? node.operator;
    const fieldLabel = fieldLabelForPreview(node.field, fields);
    if (node.operator === 'isNull' || node.operator === 'isNotNull') {
      return `${fieldLabel} ${token}`;
    }
    const labeledValue = node.valueKind === 'context'
      ? node.value
      : node.operator === 'in' || node.operator === 'notIn' || node.operator === 'between'
        ? node.value
        : optionLabelForPreview(node.field, node.value, fields);
    return `${fieldLabel} ${token} ${formatConditionValue(
      node.operator,
      labeledValue,
      node.valueKind,
      node.endValueKind,
    )}`;
  }
  if (node.children.length === 0) {
    return 'TRUE';
  }
  const joiner = ` ${node.op.toUpperCase()} `;
  const body = node.children.map((child) => {
    const formatted = formatWhereNodePreview(child, fields);
    return child.kind === 'group' ? `(${formatted})` : formatted;
  }).join(joiner);
  return body;
};

export const formatWherePreview = (
  root: WhereGroupNode,
  fields?: readonly WhereField[],
): string => (
  formatWhereNodePreview(root, fields)
);

export const toWhereManualNode = (node: WhereNode): WhereManualNode => {
  if (node.kind === 'manual') {
    return node;
  }
  const expression = node.kind === 'group'
    ? `(${formatWhereNodePreview(node)})`
    : formatWhereNodePreview(node);
  return createWhereManual(expression, node.id);
};

export const switchWhereNodeToManual = (
  root: WhereGroupNode,
  path: readonly number[],
): WhereGroupNode => {
  if (path.length === 0) {
    return root;
  }
  const current = getWhereNodeAt(root, path);
  if (!current || current.kind === 'manual') {
    return root;
  }
  return replaceWhereNodeAt(root, path, toWhereManualNode(current));
};

export const whereOperatorNeedsValue = (
  operatorId: string,
  operators: readonly WhereOperator[] = DEFAULT_WHERE_OPERATORS,
): boolean => (
  operators.find((item) => item.id === operatorId)?.needsValue ?? true
);
