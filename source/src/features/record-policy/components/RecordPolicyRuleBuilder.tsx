import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  RecordPolicyPredicateNode,
  RecordPolicyPredicateOp,
  RecordPolicyValueRef,
} from '../../../shared/api/contracts/record-policy';
import { isAllowedRecordPolicyContextRef } from '../../../shared/api/contracts/record-policy';
import { AppButton, UiInput, UiSelect } from '../../../shared/ui';
import { formatRecordPolicyPredicatePreview } from '../lib/formatRecordPolicyPredicatePreview';

export type RuleLeafDraft = {
  id: string;
  field: string;
  op: Exclude<RecordPolicyPredicateOp, 'and' | 'or' | 'not'>;
  valueKind: 'literal' | 'ref';
  valueText: string;
};

export type RuleBuilderDraft = {
  groupOp: 'and' | 'or';
  leaves: RuleLeafDraft[];
};

export const RECORD_POLICY_LEAF_OPS: Array<{ value: RuleLeafDraft['op']; label: string; needsValue: boolean }> = [
  { value: 'eq', label: 'Equals', needsValue: true },
  { value: 'neq', label: 'Not equals', needsValue: true },
  { value: 'in', label: 'In list', needsValue: true },
  { value: 'notIn', label: 'Not in list', needsValue: true },
  { value: 'gt', label: 'Greater than', needsValue: true },
  { value: 'gte', label: 'Greater or equal', needsValue: true },
  { value: 'lt', label: 'Less than', needsValue: true },
  { value: 'lte', label: 'Less or equal', needsValue: true },
  { value: 'isNull', label: 'Is null', needsValue: false },
  { value: 'isNotNull', label: 'Is not null', needsValue: false },
  { value: 'startswith', label: 'Starts with', needsValue: true },
  { value: 'contains', label: 'Contains', needsValue: true },
  { value: 'inScopeSet', label: 'In scope set', needsValue: true },
  { value: 'inSubtree', label: 'In subtree', needsValue: true },
];

const newLeafId = (): string => `leaf_${Math.random().toString(36).slice(2, 9)}`;

export const createEmptyRuleLeaf = (field: string): RuleLeafDraft => ({
  id: newLeafId(),
  field,
  op: 'eq',
  valueKind: 'literal',
  valueText: '',
});

export const createDefaultRuleBuilderDraft = (field: string): RuleBuilderDraft => ({
  groupOp: 'and',
  leaves: [createEmptyRuleLeaf(field)],
});

const formatLiteralForDraft = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map((item) => (item === null ? 'null' : String(item))).join(',');
  }
  if (value === null) return 'null';
  return String(value);
};

const leafDraftFromNode = (node: RecordPolicyPredicateNode): RuleLeafDraft | null => {
  if (node.op === 'and' || node.op === 'or' || node.op === 'not') {
    return null;
  }
  const value = 'value' in node ? node.value : undefined;
  const valueKind = value && 'ref' in value ? 'ref' : 'literal';
  const valueText = value && 'ref' in value
    ? value.ref
    : value && 'literal' in value
      ? formatLiteralForDraft(value.literal)
      : '';
  return {
    id: newLeafId(),
    field: node.field ?? 'id',
    op: node.op,
    valueKind,
    valueText,
  };
};

/** Flatten a stored predicate into the one-group rule builder (nested `not` unwraps). */
export const ruleDraftFromPredicate = (
  predicate: RecordPolicyPredicateNode,
  fallbackField: string,
): RuleBuilderDraft => {
  if (predicate.op === 'and' || predicate.op === 'or') {
    const leaves = predicate.args
      .map(leafDraftFromNode)
      .filter((leaf): leaf is RuleLeafDraft => Boolean(leaf));
    if (leaves.length > 0) {
      return { groupOp: predicate.op, leaves };
    }
  }
  if (predicate.op === 'not' && predicate.args[0]) {
    return ruleDraftFromPredicate(predicate.args[0], fallbackField);
  }
  const leaf = leafDraftFromNode(predicate);
  return leaf
    ? { groupOp: 'and', leaves: [leaf] }
    : createDefaultRuleBuilderDraft(fallbackField);
};

const parseLiteral = (raw: string): unknown => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.includes(',')) {
    return trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  }
  return trimmed;
};

const buildValueRef = (leaf: RuleLeafDraft): RecordPolicyValueRef => {
  if (leaf.valueKind === 'ref') {
    return { ref: leaf.valueText.trim() };
  }
  return { literal: parseLiteral(leaf.valueText) as string | number | boolean | null | Array<string | number | boolean | null> };
};

export const buildPredicateFromRuleDraft = (draft: RuleBuilderDraft): RecordPolicyPredicateNode | null => {
  const leaves = draft.leaves.filter((leaf) => leaf.field.trim());
  if (leaves.length === 0) {
    return null;
  }

  const nodes: RecordPolicyPredicateNode[] = leaves.map((leaf) => {
    if (leaf.op === 'isNull' || leaf.op === 'isNotNull') {
      return { op: leaf.op, field: leaf.field.trim() };
    }
    return {
      op: leaf.op,
      field: leaf.field.trim(),
      value: buildValueRef(leaf),
    } as RecordPolicyPredicateNode;
  });

  if (nodes.length === 1) {
    return nodes[0];
  }
  return { op: draft.groupOp, args: nodes };
};

type RecordPolicyRuleBuilderProps = {
  fields: string[];
  dimensionKeys: string[];
  /** Server-context keys available as predicate value refs. */
  contextKeys?: string[];
  draft: RuleBuilderDraft;
  onChange: (draft: RuleBuilderDraft) => void;
};

export const RecordPolicyRuleBuilder: React.FC<RecordPolicyRuleBuilderProps> = ({
  fields,
  dimensionKeys,
  contextKeys = [],
  draft,
  onChange,
}) => {
  const predicate = buildPredicateFromRuleDraft(draft);
  const preview = predicate ? formatRecordPolicyPredicatePreview(predicate) : 'Add at least one condition.';
  const scopeRefKeys = dimensionKeys.map((key) => `scope.${key}`);
  const refOptions = [...new Set(
    (contextKeys.length > 0
      ? contextKeys
      : ['user.id', 'sys.roles', ...scopeRefKeys]
    ).filter((key) => isAllowedRecordPolicyContextRef(key)),
  )];

  const updateLeaf = (id: string, patch: Partial<RuleLeafDraft>) => {
    onChange({
      ...draft,
      leaves: draft.leaves.map((leaf) => (leaf.id === id ? { ...leaf, ...patch } : leaf)),
    });
  };

  return (
    <div className="space-y-3">
      <UiSelect
        label="Combine conditions with"
        size="sm"
        value={draft.groupOp}
        onChange={(event) => {
          onChange({
            ...draft,
            groupOp: String(event.target.value) === 'or' ? 'or' : 'and',
          });
        }}
      >
        <option value="and">AND (all must match)</option>
        <option value="or">OR (any may match)</option>
      </UiSelect>

      <div className="space-y-2">
        {draft.leaves.map((leaf, index) => {
          const opMeta = RECORD_POLICY_LEAF_OPS.find((item) => item.value === leaf.op);
          const needsValue = opMeta?.needsValue ?? true;
          const isScopeOp = leaf.op === 'inScopeSet' || leaf.op === 'inSubtree';
          const scopeOptions = scopeRefKeys.length > 0 ? scopeRefKeys : ['scope.org', 'scope.geo'];
          return (
            <div
              key={leaf.id}
              className="space-y-2 rounded-md border border-slate-200 bg-white p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Condition {index + 1}
                </p>
                <AppButton
                  intent="cancel"
                  size="sm"
                  disabled={draft.leaves.length <= 1}
                  onClick={() => {
                    onChange({
                      ...draft,
                      leaves: draft.leaves.filter((item) => item.id !== leaf.id),
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </AppButton>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <UiSelect
                  label="Field"
                  size="sm"
                  value={leaf.field}
                  onChange={(event) => updateLeaf(leaf.id, { field: String(event.target.value) })}
                >
                  {fields.map((field) => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </UiSelect>
                <UiSelect
                  label="Operator"
                  size="sm"
                  value={leaf.op}
                  onChange={(event) => {
                    const op = String(event.target.value) as RuleLeafDraft['op'];
                    const next: Partial<RuleLeafDraft> = { op };
                    if (op === 'inScopeSet' || op === 'inSubtree') {
                      next.valueKind = 'ref';
                      next.valueText = scopeOptions[0] ?? 'scope.org';
                    }
                    updateLeaf(leaf.id, next);
                  }}
                >
                  {RECORD_POLICY_LEAF_OPS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </UiSelect>
              </div>
              {needsValue ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <UiSelect
                    label="Value type"
                    size="sm"
                    value={leaf.valueKind}
                    onChange={(event) => {
                      const valueKind = String(event.target.value) === 'ref' ? 'ref' : 'literal';
                      updateLeaf(leaf.id, {
                        valueKind,
                        valueText: valueKind === 'ref'
                          ? (isScopeOp
                            ? (scopeOptions[0] ?? 'scope.org')
                            : (refOptions.find((key) => key.startsWith('user.')) ?? 'user.id'))
                          : '',
                      });
                    }}
                  >
                    <option value="literal">Literal</option>
                    <option value="ref">Server context</option>
                  </UiSelect>
                  {leaf.valueKind === 'ref' ? (
                    <UiSelect
                      label={isScopeOp ? 'Scope context key' : 'Server context key'}
                      size="sm"
                      value={leaf.valueText}
                      onChange={(event) => updateLeaf(leaf.id, { valueText: String(event.target.value) })}
                    >
                      {(isScopeOp ? scopeOptions : refOptions).map((key) => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                    </UiSelect>
                  ) : (
                    <UiInput
                      label="Value"
                      size="sm"
                      value={leaf.valueText}
                      onChange={(event) => updateLeaf(leaf.id, { valueText: event.target.value })}
                      placeholder="value or a,b,c"
                      className="font-mono"
                    />
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <AppButton
        intent="neutral"
        size="sm"
        onClick={() => {
          onChange({
            ...draft,
            leaves: [...draft.leaves, createEmptyRuleLeaf(fields[0] ?? 'id')],
          });
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        Add condition
      </AppButton>

      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Preview</p>
        <p className="mt-1 font-mono text-[11px] leading-relaxed text-slate-700">{preview}</p>
      </div>
    </div>
  );
};
