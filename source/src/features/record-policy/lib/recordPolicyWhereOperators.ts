import type { WhereOperator } from '../../../shared/ui/where-builder/whereBuilderModel';
import { RECORD_POLICY_LEAF_OPS } from '../components/RecordPolicyRuleBuilder';

const RECORD_POLICY_OP_LABELS = Object.fromEntries(
  RECORD_POLICY_LEAF_OPS.map((item) => [item.value, item.label]),
) as Record<string, string>;

/** Record-policy predicate operators mapped for `UiWhereBuilder`. */
export const RECORD_POLICY_WHERE_OPERATORS: readonly WhereOperator[] = [
  { id: 'eq', label: RECORD_POLICY_OP_LABELS.eq ?? 'Equals', needsValue: true, types: ['text', 'number', 'boolean', 'date'] },
  { id: 'neq', label: RECORD_POLICY_OP_LABELS.neq ?? 'Not equals', needsValue: true, types: ['text', 'number', 'boolean', 'date'] },
  { id: 'in', label: RECORD_POLICY_OP_LABELS.in ?? 'In list', needsValue: true, types: ['text'] },
  { id: 'notIn', label: RECORD_POLICY_OP_LABELS.notIn ?? 'Not in list', needsValue: true, types: ['text'] },
  { id: 'gt', label: RECORD_POLICY_OP_LABELS.gt ?? 'Greater than', needsValue: true, types: ['number', 'date'] },
  { id: 'gte', label: RECORD_POLICY_OP_LABELS.gte ?? 'Greater or equal', needsValue: true, types: ['number', 'date'] },
  { id: 'lt', label: RECORD_POLICY_OP_LABELS.lt ?? 'Less than', needsValue: true, types: ['number', 'date'] },
  { id: 'lte', label: RECORD_POLICY_OP_LABELS.lte ?? 'Less or equal', needsValue: true, types: ['number', 'date'] },
  { id: 'isNull', label: RECORD_POLICY_OP_LABELS.isNull ?? 'Is null', needsValue: false },
  { id: 'isNotNull', label: RECORD_POLICY_OP_LABELS.isNotNull ?? 'Is not null', needsValue: false },
  { id: 'startsWith', label: RECORD_POLICY_OP_LABELS.startswith ?? 'Starts with', needsValue: true, types: ['text'] },
  { id: 'contains', label: RECORD_POLICY_OP_LABELS.contains ?? 'Contains', needsValue: true, types: ['text'] },
  { id: 'inScopeSet', label: RECORD_POLICY_OP_LABELS.inScopeSet ?? 'In scope set', needsValue: true, types: ['text'] },
  { id: 'inSubtree', label: RECORD_POLICY_OP_LABELS.inSubtree ?? 'In subtree', needsValue: true, types: ['text'] },
];

export const whereOperatorToRecordPolicyOp = (operatorId: string): string => (
  operatorId === 'startsWith' ? 'startswith' : operatorId
);

export const recordPolicyOpToWhereOperator = (op: string): string => (
  op === 'startswith' ? 'startsWith' : op
);
