import { WorkflowDomainError } from '../errors';
import type { CanonicalExpression, CanonicalMapping, CanonicalMappingValue, CanonicalPath, CanonicalPathRoot, JsonValue } from '../awm/types';

/**
 * Canonical expression/mapping evaluator — sole runtime authority per
 * docs/standards/workflow-engine-testing.md (doc 05 §26)
 *
 * Repository Reality Audit (carried forward from Slice 4's
 * `publication/rules/expressionValidation.ts`): no runtime expression evaluator existed anywhere
 * in this repository before Slice 5 — this is new Workflow-owned domain logic (not a platform
 * primitive), built here because the durable execution engine cannot dispatch DECISION/SWITCH/
 * ACTION/END/FAIL nodes or context assignments without it.
 *
 * Deterministic only: no clock, randomness, environment, network, filesystem or identity access.
 * `PURE_FUNCTION` is unreachable in practice — Slice 4's publication validator already rejects
 * every `PURE_FUNCTION` usage with `WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT` because no
 * pure-function registry exists (see `expressionValidation.ts`'s `runPureFunctionAvailabilityValidation`
 * comment); a published model can therefore never contain one, and this evaluator throws the same
 * missing-platform-contract error defensively rather than silently guessing a behavior.
 */

/** Internal sentinel — "no value at this path", distinct from JSON `null` (doc 05 section 26). Never leaks outside this module. */
const MISSING: unique symbol = Symbol('workflow-expression-missing');
type EvalValue = JsonValue | typeof MISSING;

export type EvaluationContext = {
  workflowInput: JsonValue;
  variables: Readonly<Record<string, JsonValue>>;
  nodeOutputs: Readonly<Record<string, JsonValue>>;
  currentNodeInput: JsonValue;
  /** Legal only while evaluating WAIT_EVENT satisfaction/output assignments or event-start input/correlation (doc 05 section 26) — absent in Slice 5's ACTION/DECISION/SWITCH/END/FAIL-only runtime. */
  currentEvent?: JsonValue;
  /** Legal only while completing the owning WORK_ITEM node (doc 05 section 26) — absent in Slice 5's runtime. */
  currentWorkItem?: { outcome: JsonValue; output: JsonValue };
  /** WFV2-2 — legal only while evaluating a FOR_EACH node's own `input` mapping, one binding per item. */
  currentItem?: JsonValue;
  currentItemIndex?: number;
};

const expressionFailure = (message: string, details?: Record<string, unknown>): WorkflowDomainError =>
  new WorkflowDomainError('WF_EXEC_EXPRESSION_FAILED', message, details);

const isFiniteNumber = (v: EvalValue): v is number => typeof v === 'number' && Number.isFinite(v);

/** Typed canonical JSON equality (doc 05 section 26) — structural, key-order-insensitive, never coerces. Exported for reuse by SWITCH_CASE matching (node execution). */
export function typedEqual(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => typedEqual(item, b[i]));
  }
  if (Array.isArray(a) || Array.isArray(b)) return false;
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) return false;
    return aKeys.every((k) => typedEqual((a as Record<string, JsonValue>)[k], (b as Record<string, JsonValue>)[k]));
  }
  return false;
}

function resolvePathRoot(root: CanonicalPathRoot, context: EvaluationContext): EvalValue {
  switch (root.type) {
    case 'WORKFLOW_INPUT':
      return context.workflowInput;
    case 'WORKFLOW_VARIABLE':
      return Object.prototype.hasOwnProperty.call(context.variables, root.variableKey) ? context.variables[root.variableKey] : MISSING;
    case 'NODE_OUTPUT':
      return Object.prototype.hasOwnProperty.call(context.nodeOutputs, root.nodeKey) ? context.nodeOutputs[root.nodeKey] : MISSING;
    case 'CURRENT_NODE_INPUT':
      return context.currentNodeInput;
    case 'CURRENT_EVENT':
      return context.currentEvent === undefined ? MISSING : context.currentEvent;
    case 'CURRENT_WORK_ITEM':
      if (context.currentWorkItem === undefined) return MISSING;
      return root.projection === 'OUTCOME' ? context.currentWorkItem.outcome : context.currentWorkItem.output;
    case 'CURRENT_ITEM':
      return context.currentItem === undefined ? MISSING : context.currentItem;
    case 'CURRENT_ITEM_INDEX':
      return context.currentItemIndex === undefined ? MISSING : context.currentItemIndex;
    /* istanbul ignore next -- exhaustiveness guard */
    default: {
      const exhaustive: never = root;
      throw expressionFailure(`Unknown CanonicalPathRoot type: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function resolvePath(path: CanonicalPath, context: EvaluationContext): EvalValue {
  let current: EvalValue = resolvePathRoot(path.root, context);
  for (const segment of path.segments) {
    if (current === MISSING) return MISSING;
    if (current === null || typeof current !== 'object') return MISSING;
    if (typeof segment === 'number') {
      if (!Array.isArray(current) || segment < 0 || segment >= current.length) return MISSING;
      current = current[segment];
    } else {
      if (Array.isArray(current) || !Object.prototype.hasOwnProperty.call(current, segment)) return MISSING;
      current = (current as Record<string, JsonValue>)[segment];
    }
  }
  return current;
}

/** Any operand except COALESCE/PATH/IS_NULL/IS_NOT_NULL treating MISSING is a deterministic evaluation failure (doc 05 section 26: a missing value may be emitted only where the owning mapping contract permits omission — never mid-expression). */
const requireValue = (value: EvalValue, opLabel: string): JsonValue => {
  if (value === MISSING) {
    throw expressionFailure(`Operand of ${opLabel} resolved to a missing path value.`);
  }
  return value;
};

function evaluateInternal(expression: CanonicalExpression, context: EvaluationContext): EvalValue {
  switch (expression.op) {
    case 'LITERAL':
      return expression.value;
    case 'PATH':
      return resolvePath(expression.path, context);
    case 'NOT': {
      const value = requireValue(evaluateInternal(expression.value, context), 'NOT');
      if (typeof value !== 'boolean') throw expressionFailure('NOT requires a boolean operand.');
      return !value;
    }
    case 'AND': {
      for (const child of expression.values) {
        const value = requireValue(evaluateInternal(child, context), 'AND');
        if (typeof value !== 'boolean') throw expressionFailure('AND requires boolean operands.');
        if (!value) return false;
      }
      return true;
    }
    case 'OR': {
      for (const child of expression.values) {
        const value = requireValue(evaluateInternal(child, context), 'OR');
        if (typeof value !== 'boolean') throw expressionFailure('OR requires boolean operands.');
        if (value) return true;
      }
      return false;
    }
    case 'EQ':
    case 'NE': {
      const left = requireValue(evaluateInternal(expression.left, context), expression.op);
      const right = requireValue(evaluateInternal(expression.right, context), expression.op);
      const eq = typedEqual(left, right);
      return expression.op === 'EQ' ? eq : !eq;
    }
    case 'LT':
    case 'LTE':
    case 'GT':
    case 'GTE': {
      const left = requireValue(evaluateInternal(expression.left, context), expression.op);
      const right = requireValue(evaluateInternal(expression.right, context), expression.op);
      let cmp: number;
      if (isFiniteNumber(left) && isFiniteNumber(right)) {
        cmp = left < right ? -1 : left > right ? 1 : 0;
      } else if (typeof left === 'string' && typeof right === 'string') {
        cmp = left < right ? -1 : left > right ? 1 : 0; // ordinal Unicode code-point ordering (JS default string compare)
      } else {
        throw expressionFailure(`${expression.op} requires two finite numbers or two strings.`);
      }
      if (expression.op === 'LT') return cmp < 0;
      if (expression.op === 'LTE') return cmp <= 0;
      if (expression.op === 'GT') return cmp > 0;
      return cmp >= 0;
    }
    case 'IS_NULL':
    case 'IS_NOT_NULL': {
      const value = requireValue(evaluateInternal(expression.value, context), expression.op);
      const isNull = value === null;
      return expression.op === 'IS_NULL' ? isNull : !isNull;
    }
    case 'ADD':
    case 'SUB':
    case 'MUL':
    case 'DIV':
    case 'MOD': {
      const left = requireValue(evaluateInternal(expression.left, context), expression.op);
      const right = requireValue(evaluateInternal(expression.right, context), expression.op);
      if (!isFiniteNumber(left) || !isFiniteNumber(right)) {
        throw expressionFailure(`${expression.op} requires two finite numbers.`);
      }
      if ((expression.op === 'DIV' || expression.op === 'MOD') && right === 0) {
        throw expressionFailure(`${expression.op} by zero.`);
      }
      const result =
        expression.op === 'ADD' ? left + right :
        expression.op === 'SUB' ? left - right :
        expression.op === 'MUL' ? left * right :
        expression.op === 'DIV' ? left / right :
        left % right;
      if (!Number.isFinite(result)) {
        throw expressionFailure(`${expression.op} produced a non-finite result.`);
      }
      return result;
    }
    case 'CONCAT': {
      const parts = expression.values.map((v) => requireValue(evaluateInternal(v, context), 'CONCAT'));
      if (!parts.every((p): p is string => typeof p === 'string')) {
        throw expressionFailure('CONCAT requires string operands only.');
      }
      return parts.join('');
    }
    case 'IN': {
      const value = requireValue(evaluateInternal(expression.value, context), 'IN');
      const set = requireValue(evaluateInternal(expression.set, context), 'IN');
      if (!Array.isArray(set)) throw expressionFailure('IN requires its `set` operand to be an array.');
      return set.some((item) => typedEqual(value, item));
    }
    case 'COALESCE': {
      for (const child of expression.values) {
        const value = evaluateInternal(child, context);
        if (value !== MISSING && value !== null) return value;
      }
      return null;
    }
    case 'PURE_FUNCTION': {
      // Unreachable for a published model — see module doc comment. Kept explicit rather than
      // silently falling through so a future evaluator-level relaxation cannot bypass the missing
      // registry without a deliberate code change here.
      throw new WorkflowDomainError(
        'WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT',
        `PURE_FUNCTION "${expression.functionRef.key}@${expression.functionRef.version}" cannot execute — no registered pure-function registry exists in this repository.`,
        { functionRef: expression.functionRef },
      );
    }
    /* istanbul ignore next -- exhaustiveness guard */
    default: {
      const exhaustive: never = expression;
      throw expressionFailure(`Unknown CanonicalExpression op: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Evaluates a `CanonicalExpression` to a concrete `JsonValue`. Throws `WF_EXEC_EXPRESSION_FAILED` if the result is a missing path (top-level expression results, e.g. DECISION conditions, are never legitimately omittable). */
export function evaluateExpression(expression: CanonicalExpression, context: EvaluationContext): JsonValue {
  return requireValue(evaluateInternal(expression, context), 'expression');
}

function evaluateMappingValue(value: CanonicalMappingValue, context: EvaluationContext): EvalValue {
  switch (value.type) {
    case 'EXPRESSION':
      return evaluateInternal(value.expression, context);
    case 'OBJECT': {
      const result: Record<string, JsonValue> = {};
      for (const [key, field] of Object.entries(value.fields)) {
        const fieldValue = evaluateMappingValue(field, context);
        if (fieldValue !== MISSING) result[key] = fieldValue;
      }
      return result;
    }
    case 'ARRAY':
      return value.items.map((item) => requireValue(evaluateMappingValue(item, context), 'array item'));
    /* istanbul ignore next -- exhaustiveness guard */
    default: {
      const exhaustive: never = value;
      throw expressionFailure(`Unknown CanonicalMappingValue type: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Evaluates a `CanonicalMapping` (always an OBJECT) to a JSON object. A field whose expression resolves to a missing path is omitted from the result (doc 05 section 26's permitted-omission point); array items may never be missing. */
export function evaluateMapping(mapping: CanonicalMapping, context: EvaluationContext): Record<string, JsonValue> {
  const result = evaluateMappingValue(mapping, context);
  return result as Record<string, JsonValue>;
}
