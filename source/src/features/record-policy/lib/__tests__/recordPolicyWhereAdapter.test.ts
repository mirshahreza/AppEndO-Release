import { describe, expect, it } from 'vitest';
import { validateRecordPolicyPredicate } from '../../../../shared/api/contracts/record-policy';
import {
  predicateToWhereGroup,
  validatePredicateFromWhereGroup,
  whereGroupToPredicate,
} from '../recordPolicyWhereAdapter';
import {
  recordPolicyOpToWhereOperator,
  whereOperatorToRecordPolicyOp,
} from '../recordPolicyWhereOperators';
import {
  createWhereCondition,
  createWhereGroup,
} from '../../../../shared/ui/where-builder/whereBuilderModel';

describe('recordPolicyWhereOperators', () => {
  it('maps startsWith casing between where-builder and record policy', () => {
    expect(whereOperatorToRecordPolicyOp('startsWith')).toBe('startswith');
    expect(recordPolicyOpToWhereOperator('startswith')).toBe('startsWith');
    expect(whereOperatorToRecordPolicyOp('eq')).toBe('eq');
  });
});

describe('recordPolicyWhereAdapter', () => {
  it('round-trips a single leaf with literal and context refs', () => {
    const literal = { op: 'eq' as const, field: 'status', value: { literal: 'open' } };
    expect(whereGroupToPredicate(predicateToWhereGroup(literal))).toEqual(literal);

    const context = { op: 'eq' as const, field: 'ownerId', value: { ref: 'user.id' } };
    expect(whereGroupToPredicate(predicateToWhereGroup(context))).toEqual(context);
  });

  it('round-trips grouped predicates and nested groups', () => {
    const grouped = {
      op: 'or' as const,
      args: [
        { op: 'eq' as const, field: 'a', value: { literal: 'alpha' } },
        { op: 'eq' as const, field: 'b', value: { literal: 'beta' } },
      ],
    };
    expect(whereGroupToPredicate(predicateToWhereGroup(grouped))).toEqual(grouped);

    const nested = {
      op: 'and' as const,
      args: [
        { op: 'inSubtree' as const, field: 'orgUnitId', value: { ref: 'scope.org' } },
        {
          op: 'or' as const,
          args: [
            { op: 'isNull' as const, field: 'deletedAt' },
            { op: 'eq' as const, field: 'ownerId', value: { ref: 'user.id' } },
          ],
        },
      ],
    };
    expect(whereGroupToPredicate(predicateToWhereGroup(nested))).toEqual(nested);
  });

  it('maps scope operators and startswith casing', () => {
    const scope = {
      op: 'inSubtree' as const,
      field: 'orgUnitId',
      value: { ref: 'scope.org' },
    };
    const group = predicateToWhereGroup(scope);
    expect(group.children[0]).toMatchObject({
      kind: 'condition',
      operator: 'inSubtree',
      value: 'scope.org',
      valueKind: 'context',
    });
    expect(whereGroupToPredicate(group)).toEqual(scope);

    const starts = {
      op: 'startswith' as const,
      field: 'code',
      value: { literal: 'AC' },
    };
    const startsGroup = predicateToWhereGroup(starts);
    expect(startsGroup.children[0]).toMatchObject({ operator: 'startsWith' });
    expect(whereGroupToPredicate(startsGroup)).toEqual(starts);
  });

  it('serializes list literals as comma-separated values', () => {
    const list = {
      op: 'in' as const,
      field: 'status',
      value: { literal: ['open', 'pending'] },
    };
    const group = predicateToWhereGroup(list);
    expect(group.children[0]).toMatchObject({ value: 'open,pending', valueKind: 'literal' });
    expect(whereGroupToPredicate(group)).toEqual(list);
  });

  it('unwraps not when loading and preserves nullary operators', () => {
    const negated = {
      op: 'not' as const,
      args: [{ op: 'isNull' as const, field: 'deletedAt' }],
    };
    const group = predicateToWhereGroup(negated);
    expect(whereGroupToPredicate(group)).toEqual({ op: 'isNull', field: 'deletedAt' });

    const nullary = { op: 'isNotNull' as const, field: 'ownerId' };
    expect(whereGroupToPredicate(predicateToWhereGroup(nullary))).toEqual(nullary);
  });

  it('rejects manual nodes and empty trees', () => {
    const empty = createWhereGroup('and', []);
    expect(whereGroupToPredicate(empty)).toBeNull();

    const manual = createWhereGroup('and', [
      { kind: 'manual', id: 'm1', expression: 'field = 1' },
    ]);
    expect(whereGroupToPredicate(manual)).toBeNull();
  });

  it('validates converted predicates against model fields', () => {
    const group = createWhereGroup('and', [
      createWhereCondition('orgUnitId', 'inSubtree', 'scope.org', 'c1', 'context'),
    ]);
    const validated = validatePredicateFromWhereGroup({
      group,
      allowedFields: ['orgUnitId', 'ownerId'],
    });
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validateRecordPolicyPredicate({
        predicate: validated.predicate,
        allowedFields: ['orgUnitId'],
      }).ok).toBe(true);
    }

    const invalidField = createWhereGroup('and', [
      createWhereCondition('missing', 'eq', 'x'),
    ]);
    const rejected = validatePredicateFromWhereGroup({
      group: invalidField,
      allowedFields: ['orgUnitId'],
    });
    expect(rejected.ok).toBe(false);
  });

  it('preserves inSubtree operator with scope ref', () => {
    const subtree = {
      op: 'inSubtree' as const,
      field: 'orgId',
      value: { ref: 'scope.org' },
    };
    expect(whereGroupToPredicate(predicateToWhereGroup(subtree))).toEqual(subtree);
  });

  it('collapses single-child AND wrappers on save', () => {
    const wrapped = createWhereGroup('and', [
      createWhereCondition('id', 'eq', 'open'),
    ], 'root');
    expect(whereGroupToPredicate(wrapped)).toEqual({
      op: 'eq',
      field: 'id',
      value: { literal: 'open' },
    });
  });

  it('preserves single-child OR groups when saving nested predicates', () => {
    const nested = createWhereGroup('and', [
      createWhereCondition('status', 'eq', 'open', 'c1'),
      createWhereGroup('or', [
        createWhereCondition('ownerId', 'eq', 'user-1', 'c2'),
      ], 'g1'),
    ], 'root');
    expect(whereGroupToPredicate(nested)).toEqual({
      op: 'and',
      args: [
        { op: 'eq', field: 'status', value: { literal: 'open' } },
        { op: 'or', args: [{ op: 'eq', field: 'ownerId', value: { literal: 'user-1' } }] },
      ],
    });
    expect(whereGroupToPredicate(predicateToWhereGroup({
      op: 'and',
      args: [
        { op: 'eq', field: 'status', value: { literal: 'open' } },
        { op: 'or', args: [{ op: 'eq', field: 'ownerId', value: { literal: 'user-1' } }] },
      ],
    }))).toEqual({
      op: 'and',
      args: [
        { op: 'eq', field: 'status', value: { literal: 'open' } },
        { op: 'or', args: [{ op: 'eq', field: 'ownerId', value: { literal: 'user-1' } }] },
      ],
    });
  });

  it('preserves nested single-child AND groups created by Add group', () => {
    const nested = createWhereGroup('or', [
      createWhereCondition('status', 'eq', 'open', 'c1'),
      createWhereGroup('and', [
        createWhereCondition('ownerId', 'eq', 'user-1', 'c2'),
      ], 'g1'),
    ], 'root');
    expect(whereGroupToPredicate(nested)).toEqual({
      op: 'or',
      args: [
        { op: 'eq', field: 'status', value: { literal: 'open' } },
        { op: 'and', args: [{ op: 'eq', field: 'ownerId', value: { literal: 'user-1' } }] },
      ],
    });
    expect(whereGroupToPredicate(predicateToWhereGroup({
      op: 'or',
      args: [
        { op: 'eq', field: 'status', value: { literal: 'open' } },
        { op: 'and', args: [{ op: 'eq', field: 'ownerId', value: { literal: 'user-1' } }] },
      ],
    }))).toEqual({
      op: 'or',
      args: [
        { op: 'eq', field: 'status', value: { literal: 'open' } },
        { op: 'and', args: [{ op: 'eq', field: 'ownerId', value: { literal: 'user-1' } }] },
      ],
    });
  });
});
