import { describe, expect, it } from 'vitest';
import {
  buildPredicateFromRuleDraft,
  ruleDraftFromPredicate,
} from '../../components/RecordPolicyRuleBuilder';
import {
  predicateToWhereGroup,
  whereGroupToPredicate,
} from '../recordPolicyWhereAdapter';

describe('recordPolicyWhereAdapter vs RuleBuilderDraft', () => {
  it('round-trips predicates produced by the legacy rule draft builder', () => {
    const predicates = [
      {
        op: 'inSubtree' as const,
        field: 'orgUnitId',
        value: { ref: 'scope.org' },
      },
      {
        op: 'and' as const,
        args: [
          { op: 'eq' as const, field: 'ownerId', value: { ref: 'user.id' } },
          { op: 'contains' as const, field: 'name', value: { literal: 'Acme' } },
        ],
      },
      {
        op: 'or' as const,
        args: [
          { op: 'isNull' as const, field: 'deletedAt' },
          { op: 'startswith' as const, field: 'code', value: { literal: 'X' } },
        ],
      },
    ];

    for (const predicate of predicates) {
      const draft = ruleDraftFromPredicate(predicate, 'id');
      const fromDraft = buildPredicateFromRuleDraft(draft);
      expect(fromDraft).toBeTruthy();
      const viaWhere = whereGroupToPredicate(predicateToWhereGroup(fromDraft!));
      expect(viaWhere).toEqual(fromDraft);
    }
  });
});
