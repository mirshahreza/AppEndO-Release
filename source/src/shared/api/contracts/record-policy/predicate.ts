import { z } from 'zod';
import { MAX_PREDICATE_AST_DEPTH, MAX_PREDICATE_AST_NODES } from './constants';

/** Closed comparison / boolean / scope operators for Record Policy predicates (RPE-1). */
export const RECORD_POLICY_PREDICATE_OPS = [
  'and',
  'or',
  'not',
  'eq',
  'neq',
  'in',
  'notIn',
  'gt',
  'gte',
  'lt',
  'lte',
  'isNull',
  'isNotNull',
  'startswith',
  'contains',
  'inSubtree',
  'inScopeSet',
] as const;

export type RecordPolicyPredicateOp = (typeof RECORD_POLICY_PREDICATE_OPS)[number];

const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const recordPolicyLiteralValueSchema = z.union([
  jsonPrimitiveSchema,
  z.array(jsonPrimitiveSchema),
]);

export type RecordPolicyLiteralValue = z.infer<typeof recordPolicyLiteralValueSchema>;

/** Allowed server-context refs for Record Policy predicates (D4). Never clientContext. */
export const RECORD_POLICY_CONTEXT_REF_PATTERNS = [
  /^user\.[A-Za-z_][A-Za-z0-9_]*$/,
  /^role\.[A-Za-z_][A-Za-z0-9_]*$/,
  /^sys\.[A-Za-z_][A-Za-z0-9_]*$/,
  /^scope\.[A-Za-z_][A-Za-z0-9_]*$/,
] as const;

export const isAllowedRecordPolicyContextRef = (ref: string): boolean => (
  RECORD_POLICY_CONTEXT_REF_PATTERNS.some((pattern) => pattern.test(ref))
);

/** @deprecated Use isAllowedRecordPolicyContextRef */
export const isAllowedRecordPolicySessionRef = isAllowedRecordPolicyContextRef;
/** @deprecated Use RECORD_POLICY_CONTEXT_REF_PATTERNS */
export const RECORD_POLICY_SESSION_REF_PATTERNS = RECORD_POLICY_CONTEXT_REF_PATTERNS;

export const recordPolicyValueRefSchema = z.union([
  z.object({ literal: recordPolicyLiteralValueSchema }).strict(),
  z.object({
    ref: z.string().min(1).superRefine((ref, ctx) => {
      if (!isAllowedRecordPolicyContextRef(ref)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Context ref "${ref}" is not in the allowlist (use user.*, role.*, sys.*, or scope.*)`,
        });
      }
    }),
  }).strict(),
]);

export type RecordPolicyValueRef = z.infer<typeof recordPolicyValueRefSchema>;

type PredicateNode = {
  op: RecordPolicyPredicateOp;
  field?: string;
  value?: RecordPolicyValueRef;
  args?: PredicateNode[];
};

export const recordPolicyPredicateNodeSchema: z.ZodType<PredicateNode> = z.lazy(() => {
  const fieldSchema = z.string().min(1);
  return z.discriminatedUnion('op', [
    z.object({
      op: z.literal('and'),
      args: z.array(recordPolicyPredicateNodeSchema).min(1),
    }).strict(),
    z.object({
      op: z.literal('or'),
      args: z.array(recordPolicyPredicateNodeSchema).min(1),
    }).strict(),
    z.object({
      op: z.literal('not'),
      args: z.tuple([recordPolicyPredicateNodeSchema]),
    }).strict(),
    z.object({
      op: z.literal('eq'),
      field: fieldSchema,
      value: recordPolicyValueRefSchema,
    }).strict(),
    z.object({
      op: z.literal('neq'),
      field: fieldSchema,
      value: recordPolicyValueRefSchema,
    }).strict(),
    z.object({
      op: z.literal('in'),
      field: fieldSchema,
      value: recordPolicyValueRefSchema,
    }).strict(),
    z.object({
      op: z.literal('notIn'),
      field: fieldSchema,
      value: recordPolicyValueRefSchema,
    }).strict(),
    z.object({
      op: z.literal('gt'),
      field: fieldSchema,
      value: recordPolicyValueRefSchema,
    }).strict(),
    z.object({
      op: z.literal('gte'),
      field: fieldSchema,
      value: recordPolicyValueRefSchema,
    }).strict(),
    z.object({
      op: z.literal('lt'),
      field: fieldSchema,
      value: recordPolicyValueRefSchema,
    }).strict(),
    z.object({
      op: z.literal('lte'),
      field: fieldSchema,
      value: recordPolicyValueRefSchema,
    }).strict(),
    z.object({
      op: z.literal('isNull'),
      field: fieldSchema,
    }).strict(),
    z.object({
      op: z.literal('isNotNull'),
      field: fieldSchema,
    }).strict(),
    z.object({
      op: z.literal('startswith'),
      field: fieldSchema,
      value: recordPolicyValueRefSchema,
    }).strict(),
    z.object({
      op: z.literal('contains'),
      field: fieldSchema,
      value: recordPolicyValueRefSchema,
    }).strict(),
    z.object({
      op: z.literal('inSubtree'),
      field: fieldSchema,
      value: recordPolicyValueRefSchema,
    }).strict(),
    z.object({
      op: z.literal('inScopeSet'),
      field: fieldSchema,
      value: recordPolicyValueRefSchema,
    }).strict(),
  ]);
});

export type RecordPolicyPredicateNode = z.infer<typeof recordPolicyPredicateNodeSchema>;

export type RecordPolicyPredicateValidationIssue = {
  code: 'DEPTH' | 'SIZE' | 'FIELD' | 'REF' | 'SHAPE' | 'SCOPE_REF';
  message: string;
  path?: string;
};

const countPredicateNodes = (node: RecordPolicyPredicateNode): number => {
  if (node.op === 'and' || node.op === 'or') {
    return 1 + node.args.reduce((sum, child) => sum + countPredicateNodes(child), 0);
  }
  if (node.op === 'not') {
    return 1 + countPredicateNodes(node.args[0]);
  }
  return 1;
};

const maxPredicateDepth = (node: RecordPolicyPredicateNode, depth = 1): number => {
  if (node.op === 'and' || node.op === 'or') {
    return Math.max(depth, ...node.args.map((child) => maxPredicateDepth(child, depth + 1)));
  }
  if (node.op === 'not') {
    return maxPredicateDepth(node.args[0], depth + 1);
  }
  return depth;
};

const collectFields = (node: RecordPolicyPredicateNode, out: Set<string>): void => {
  if (node.op === 'and' || node.op === 'or') {
    node.args.forEach((child) => collectFields(child, out));
    return;
  }
  if (node.op === 'not') {
    collectFields(node.args[0], out);
    return;
  }
  if ('field' in node && typeof node.field === 'string') {
    out.add(node.field);
  }
};

const collectRefs = (node: RecordPolicyPredicateNode, out: Set<string>): void => {
  if (node.op === 'and' || node.op === 'or') {
    node.args.forEach((child) => collectRefs(child, out));
    return;
  }
  if (node.op === 'not') {
    collectRefs(node.args[0], out);
    return;
  }
  if ('value' in node && node.value && 'ref' in node.value) {
    out.add(node.value.ref);
  }
};

const assertScopeOpsUseScopeRefs = (
  node: RecordPolicyPredicateNode,
  issues: RecordPolicyPredicateValidationIssue[],
): void => {
  if (node.op === 'and' || node.op === 'or') {
    node.args.forEach((child) => assertScopeOpsUseScopeRefs(child, issues));
    return;
  }
  if (node.op === 'not') {
    assertScopeOpsUseScopeRefs(node.args[0], issues);
    return;
  }
  if (node.op === 'inSubtree' || node.op === 'inScopeSet') {
    const ref = node.value && 'ref' in node.value ? node.value.ref : null;
    if (!ref || !ref.startsWith('scope.')) {
      issues.push({
        code: 'SCOPE_REF',
        message: `${node.op} requires a scope.<dimensionKey> server-context ref`,
        path: node.field,
      });
    }
  }
};

export type ValidateRecordPolicyPredicateInput = {
  predicate: unknown;
  /** When set, every leaf field must be in this set (model columns). */
  allowedFields?: ReadonlySet<string> | readonly string[];
  /** Optional extra allowlist for `user.*` context keys (without `user.` prefix). */
  allowedUserAttrKeys?: ReadonlySet<string> | readonly string[];
};

/**
 * Parse + structural limits + optional field/attr allowlists.
 * Does not compile to WHERE (RPE-4).
 */
export const validateRecordPolicyPredicate = (
  input: ValidateRecordPolicyPredicateInput,
): { ok: true; predicate: RecordPolicyPredicateNode } | { ok: false; issues: RecordPolicyPredicateValidationIssue[] } => {
  const parsed = recordPolicyPredicateNodeSchema.safeParse(input.predicate);
  if (!parsed.success) {
    return {
      ok: false,
      issues: [{
        code: 'SHAPE',
        message: parsed.error.issues[0]?.message ?? 'Invalid predicate shape',
      }],
    };
  }

  const predicate = parsed.data;
  const issues: RecordPolicyPredicateValidationIssue[] = [];

  const size = countPredicateNodes(predicate);
  if (size > MAX_PREDICATE_AST_NODES) {
    issues.push({
      code: 'SIZE',
      message: `Predicate exceeds max nodes (${MAX_PREDICATE_AST_NODES})`,
    });
  }

  const depth = maxPredicateDepth(predicate);
  if (depth > MAX_PREDICATE_AST_DEPTH) {
    issues.push({
      code: 'DEPTH',
      message: `Predicate exceeds max depth (${MAX_PREDICATE_AST_DEPTH})`,
    });
  }

  assertScopeOpsUseScopeRefs(predicate, issues);

  if (input.allowedFields) {
    const allowed = input.allowedFields instanceof Set
      ? input.allowedFields
      : new Set(input.allowedFields);
    const fields = new Set<string>();
    collectFields(predicate, fields);
    for (const field of fields) {
      if (!allowed.has(field)) {
        issues.push({
          code: 'FIELD',
          message: `Field is not on the model: ${field}`,
          path: field,
        });
      }
    }
  }

  if (input.allowedUserAttrKeys) {
    const allowedAttrs = input.allowedUserAttrKeys instanceof Set
      ? input.allowedUserAttrKeys
      : new Set(input.allowedUserAttrKeys);
    const refs = new Set<string>();
    collectRefs(predicate, refs);
    for (const ref of refs) {
      if (!ref.startsWith('user.')) {
        continue;
      }
      const key = ref.slice('user.'.length);
      if (!allowedAttrs.has(key)) {
        issues.push({
          code: 'REF',
          message: `User context key is not allowlisted: ${key}`,
          path: ref,
        });
      }
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, predicate };
};

export const listRecordPolicyPredicateFields = (predicate: RecordPolicyPredicateNode): string[] => {
  const fields = new Set<string>();
  collectFields(predicate, fields);
  return [...fields].sort();
};
