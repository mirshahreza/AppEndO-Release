import { describe, expect, it } from 'vitest';
import { formatRecordPolicyPredicatePreview } from '../formatRecordPolicyPredicatePreview';
import {
  buildPredicateFromRuleDraft,
  createDefaultRuleBuilderDraft,
  ruleDraftFromPredicate,
} from '../../components/RecordPolicyRuleBuilder';

describe('formatRecordPolicyPredicatePreview', () => {
  it('formats and/or with scope ops', () => {
    const text = formatRecordPolicyPredicatePreview({
      op: 'and',
      args: [
        { op: 'inSubtree', field: 'orgUnitId', value: { ref: 'scope.org' } },
        { op: 'eq', field: 'ownerId', value: { ref: 'user.id' } },
      ],
    });
    expect(text).toContain('IN SUBTREE');
    expect(text).toContain('AND');
    expect(text).toContain('ownerId =');
  });
});

describe('buildPredicateFromRuleDraft', () => {
  it('builds a single leaf and a grouped tree', () => {
    const single = createDefaultRuleBuilderDraft('orgUnitId');
    single.leaves[0].op = 'inSubtree';
    single.leaves[0].valueKind = 'ref';
    single.leaves[0].valueText = 'scope.org';
    expect(buildPredicateFromRuleDraft(single)).toEqual({
      op: 'inSubtree',
      field: 'orgUnitId',
      value: { ref: 'scope.org' },
    });

    const grouped = createDefaultRuleBuilderDraft('a');
    grouped.groupOp = 'or';
    grouped.leaves = [
      { id: '1', field: 'a', op: 'eq', valueKind: 'literal', valueText: '1' },
      { id: '2', field: 'b', op: 'eq', valueKind: 'literal', valueText: '2' },
    ];
    expect(buildPredicateFromRuleDraft(grouped)?.op).toBe('or');
  });
});

describe('ruleDraftFromPredicate', () => {
  it('loads a leaf, a group, and unwraps not', () => {
    const leaf = ruleDraftFromPredicate({
      op: 'eq',
      field: 'ownerId',
      value: { ref: 'user.id' },
    }, 'id');
    expect(leaf.leaves).toHaveLength(1);
    expect(leaf.leaves[0]).toMatchObject({
      field: 'ownerId',
      op: 'eq',
      valueKind: 'ref',
      valueText: 'user.id',
    });

    const grouped = ruleDraftFromPredicate({
      op: 'or',
      args: [
        { op: 'eq', field: 'a', value: { literal: '1' } },
        { op: 'in', field: 'b', value: { literal: ['x', 'y'] } },
      ],
    }, 'id');
    expect(grouped.groupOp).toBe('or');
    expect(grouped.leaves).toHaveLength(2);
    expect(grouped.leaves[1]).toMatchObject({
      field: 'b',
      op: 'in',
      valueKind: 'literal',
      valueText: 'x,y',
    });

    const negated = ruleDraftFromPredicate({
      op: 'not',
      args: [{ op: 'isNull', field: 'deletedAt' }],
    }, 'id');
    expect(negated.leaves[0]).toMatchObject({ field: 'deletedAt', op: 'isNull' });
  });
});
