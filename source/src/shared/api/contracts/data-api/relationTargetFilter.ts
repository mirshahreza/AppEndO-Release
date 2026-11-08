import { z } from 'zod';

/** Operators for static AND filters on the association target (form lookup scope). */
export const RELATION_TARGET_FILTER_OPS = [
  'eq',
  'neq',
  'in',
  'isNull',
  'isNotNull',
] as const;

export type RelationTargetFilterOp = (typeof RELATION_TARGET_FILTER_OPS)[number];

export const relationTargetFilterOpSchema = z.enum(RELATION_TARGET_FILTER_OPS);

export const relationTargetFilterConditionSchema = z.object({
  /** Target model column name. */
  column: z.string().min(1),
  op: relationTargetFilterOpSchema,
  /**
   * Scalar for eq/neq; comma-separated list for in.
   * Omitted / ignored for isNull and isNotNull.
   */
  value: z.string().optional(),
}).strict();

export type RelationTargetFilterCondition = z.infer<typeof relationTargetFilterConditionSchema>;

export type RelationTargetFilterOpOption = {
  value: RelationTargetFilterOp;
  label: string;
  needsValue: boolean;
};

export const RELATION_TARGET_FILTER_OP_OPTIONS: readonly RelationTargetFilterOpOption[] = [
  { value: 'eq', label: 'Equals', needsValue: true },
  { value: 'neq', label: 'Not equals', needsValue: true },
  { value: 'in', label: 'In list', needsValue: true },
  { value: 'isNull', label: 'Is null', needsValue: false },
  { value: 'isNotNull', label: 'Is not null', needsValue: false },
];

export const relationTargetFilterOpNeedsValue = (op: RelationTargetFilterOp): boolean => (
  RELATION_TARGET_FILTER_OP_OPTIONS.find((option) => option.value === op)?.needsValue ?? true
);

export const createEmptyRelationTargetFilterCondition = (): RelationTargetFilterCondition => ({
  column: '',
  op: 'eq',
  value: '',
});

/** Drop incomplete rows; strip value when the operator does not use it. */
export const normalizeRelationTargetFilter = (
  conditions: ReadonlyArray<Partial<RelationTargetFilterCondition> | null | undefined>,
): RelationTargetFilterCondition[] => {
  const next: RelationTargetFilterCondition[] = [];
  for (const raw of conditions) {
    if (!raw || typeof raw !== 'object') {
      continue;
    }
    const column = typeof raw.column === 'string' ? raw.column.trim() : '';
    const op = RELATION_TARGET_FILTER_OPS.includes(raw.op as RelationTargetFilterOp)
      ? (raw.op as RelationTargetFilterOp)
      : null;
    if (!column || !op) {
      continue;
    }
    if (!relationTargetFilterOpNeedsValue(op)) {
      next.push({ column, op });
      continue;
    }
    const value = typeof raw.value === 'string' ? raw.value.trim() : '';
    if (!value) {
      continue;
    }
    next.push({ column, op, value });
  }
  return next;
};

/** Human summary for aside / chips (e.g. `active = true`). */
export const formatRelationTargetFilterCondition = (
  condition: RelationTargetFilterCondition,
): string => {
  switch (condition.op) {
    case 'eq':
      return `${condition.column} = ${condition.value ?? ''}`;
    case 'neq':
      return `${condition.column} ≠ ${condition.value ?? ''}`;
    case 'in':
      return `${condition.column} in (${condition.value ?? ''})`;
    case 'isNull':
      return `${condition.column} is null`;
    case 'isNotNull':
      return `${condition.column} is not null`;
    default:
      return condition.column;
  }
};
