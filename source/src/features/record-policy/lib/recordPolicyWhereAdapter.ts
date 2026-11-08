import type {
  RecordPolicyPredicateNode,
  RecordPolicyValueRef,
} from '../../../shared/api/contracts/record-policy';
import { validateRecordPolicyPredicate } from '../../../shared/api/contracts/record-policy';
import {
  createWhereCondition,
  createWhereGroup,
  type WhereConditionNode,
  type WhereGroupNode,
  type WhereNode,
  type WhereValueKind,
} from '../../../shared/ui/where-builder/whereBuilderModel';
import {
  recordPolicyOpToWhereOperator,
  whereOperatorToRecordPolicyOp,
} from './recordPolicyWhereOperators';

const newNodeId = (): string => `rp_${Math.random().toString(36).slice(2, 10)}`;

const formatLiteralForWhere = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map((item) => (item === null ? 'null' : String(item))).join(',');
  }
  if (value === null) {
    return 'null';
  }
  return String(value);
};

const parseLiteralFromWhere = (raw: string): unknown => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  if (trimmed === 'null') {
    return null;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  if (trimmed.includes(',')) {
    return trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  }
  return trimmed;
};

const valueRefFromWhere = (
  value: string,
  valueKind: WhereValueKind = 'literal',
): RecordPolicyValueRef => {
  if (valueKind === 'context') {
    return { ref: value.trim() };
  }
  return { literal: parseLiteralFromWhere(value) as string | number | boolean | null | Array<string | number | boolean | null> };
};

const whereValueFromRef = (value?: RecordPolicyValueRef): { value: string; valueKind: WhereValueKind } => {
  if (value && 'ref' in value) {
    return { value: value.ref, valueKind: 'context' };
  }
  if (value && 'literal' in value) {
    return { value: formatLiteralForWhere(value.literal), valueKind: 'literal' };
  }
  return { value: '', valueKind: 'literal' };
};

const isLeafPredicate = (
  node: RecordPolicyPredicateNode,
): node is RecordPolicyPredicateNode & { field: string } => (
  node.op !== 'and' && node.op !== 'or' && node.op !== 'not'
);

const predicateLeafToWhereCondition = (node: RecordPolicyPredicateNode): WhereConditionNode => {
  if (!isLeafPredicate(node)) {
    return createWhereCondition('id', 'eq', '', newNodeId());
  }
  const { value, valueKind } = whereValueFromRef('value' in node ? node.value : undefined);
  return createWhereCondition(
    node.field,
    recordPolicyOpToWhereOperator(node.op),
    value,
    newNodeId(),
    valueKind,
  );
};

const predicateNodeToWhereNode = (node: RecordPolicyPredicateNode): WhereNode => {
  if (node.op === 'and' || node.op === 'or') {
    return createWhereGroup(
      node.op,
      node.args.map((child) => predicateNodeToWhereNode(child)),
      newNodeId(),
    );
  }
  if (node.op === 'not' && node.args[0]) {
    return predicateNodeToWhereNode(node.args[0]);
  }
  return predicateLeafToWhereCondition(node);
};

/** Convert a closed predicate AST into a `UiWhereBuilder` tree. */
export const predicateToWhereGroup = (
  predicate: RecordPolicyPredicateNode,
  rootId = 'rp-root',
): WhereGroupNode => {
  if (predicate.op === 'and' || predicate.op === 'or') {
    return {
      kind: 'group',
      id: rootId,
      op: predicate.op,
      children: predicate.args.map((child) => predicateNodeToWhereNode(child)),
    };
  }
  if (predicate.op === 'not' && predicate.args[0]) {
    return predicateToWhereGroup(predicate.args[0], rootId);
  }
  return {
    kind: 'group',
    id: rootId,
    op: 'and',
    children: [predicateLeafToWhereCondition(predicate)],
  };
};

const whereConditionToPredicateLeaf = (node: WhereConditionNode): RecordPolicyPredicateNode => {
  const op = whereOperatorToRecordPolicyOp(node.operator) as Exclude<
    RecordPolicyPredicateNode['op'],
    'and' | 'or' | 'not'
  >;
  if (op === 'isNull' || op === 'isNotNull') {
    return { op, field: node.field.trim() };
  }
  return {
    op,
    field: node.field.trim(),
    value: valueRefFromWhere(node.value, node.valueKind),
  } as RecordPolicyPredicateNode;
};

const whereNodeToPredicate = (node: WhereNode): RecordPolicyPredicateNode | null => {
  if (node.kind === 'manual') {
    return null;
  }
  if (node.kind === 'group') {
    return whereGroupToPredicate(node, false);
  }
  if (!node.field.trim()) {
    return null;
  }
  return whereConditionToPredicateLeaf(node);
};

/** Convert a `UiWhereBuilder` tree back into a closed predicate AST. */
export const whereGroupToPredicate = (
  group: WhereGroupNode,
  collapseRootAndWrapper = true,
): RecordPolicyPredicateNode | null => {
  if (group.children.length === 0) {
    return null;
  }
  // Only collapse a redundant root AND wrapper. Nested groups keep their combinator
  // so "Add group" round-trips even when the new group has a single starter condition.
  if (collapseRootAndWrapper && group.children.length === 1 && group.op === 'and') {
    const child = group.children[0]!;
    if (child.kind === 'group') {
      return whereGroupToPredicate(child, true);
    }
    return whereNodeToPredicate(child);
  }
  const args = group.children
    .map((child) => whereNodeToPredicate(child))
    .filter((node): node is RecordPolicyPredicateNode => Boolean(node));
  if (args.length === 0) {
    return null;
  }
  if (collapseRootAndWrapper && args.length === 1 && group.op === 'and') {
    return args[0]!;
  }
  return { op: group.op, args };
};

export type ValidatePredicateFromWhereInput = {
  group: WhereGroupNode;
  allowedFields?: readonly string[];
  allowedUserAttrKeys?: readonly string[];
};

export const validatePredicateFromWhereGroup = (
  input: ValidatePredicateFromWhereInput,
): { ok: true; predicate: RecordPolicyPredicateNode } | { ok: false; message: string } => {
  const predicate = whereGroupToPredicate(input.group);
  if (!predicate) {
    return { ok: false, message: 'Add at least one condition.' };
  }
  const validated = validateRecordPolicyPredicate({
    predicate,
    allowedFields: input.allowedFields,
    allowedUserAttrKeys: input.allowedUserAttrKeys,
  });
  if (validated.ok === false) {
    return { ok: false, message: validated.issues[0]?.message ?? 'Invalid predicate.' };
  }
  return validated;
};
