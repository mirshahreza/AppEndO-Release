import type {
  RecordPolicyPredicateNode,
  RecordPolicyValueRef,
} from '../../../shared/api/contracts/record-policy';

const formatValueRef = (value: RecordPolicyValueRef): string => {
  if ('literal' in value) {
    if (Array.isArray(value.literal)) {
      return `[${value.literal.map((item) => JSON.stringify(item)).join(', ')}]`;
    }
    return JSON.stringify(value.literal);
  }
  return value.ref;
};

/** Human-readable English summary of a closed predicate AST. */
export const formatRecordPolicyPredicatePreview = (node: RecordPolicyPredicateNode): string => {
  switch (node.op) {
    case 'and':
      return node.args.map((child) => `(${formatRecordPolicyPredicatePreview(child)})`).join(' AND ');
    case 'or':
      return node.args.map((child) => `(${formatRecordPolicyPredicatePreview(child)})`).join(' OR ');
    case 'not':
      return `NOT (${formatRecordPolicyPredicatePreview(node.args[0])})`;
    case 'eq':
      return `${node.field} = ${formatValueRef(node.value)}`;
    case 'neq':
      return `${node.field} ≠ ${formatValueRef(node.value)}`;
    case 'in':
      return `${node.field} IN ${formatValueRef(node.value)}`;
    case 'notIn':
      return `${node.field} NOT IN ${formatValueRef(node.value)}`;
    case 'gt':
      return `${node.field} > ${formatValueRef(node.value)}`;
    case 'gte':
      return `${node.field} ≥ ${formatValueRef(node.value)}`;
    case 'lt':
      return `${node.field} < ${formatValueRef(node.value)}`;
    case 'lte':
      return `${node.field} ≤ ${formatValueRef(node.value)}`;
    case 'isNull':
      return `${node.field} IS NULL`;
    case 'isNotNull':
      return `${node.field} IS NOT NULL`;
    case 'startswith':
      return `${node.field} STARTS WITH ${formatValueRef(node.value)}`;
    case 'contains':
      return `${node.field} CONTAINS ${formatValueRef(node.value)}`;
    case 'inSubtree':
      return `${node.field} IN SUBTREE OF ${formatValueRef(node.value)}`;
    case 'inScopeSet':
      return `${node.field} IN SCOPE ${formatValueRef(node.value)}`;
    default:
      return 'Unknown condition';
  }
};
