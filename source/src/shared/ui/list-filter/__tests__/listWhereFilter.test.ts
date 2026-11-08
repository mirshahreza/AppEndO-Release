/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  createEmptyWhereTree,
  createWhereCondition,
  createWhereGroup,
  DEFAULT_WHERE_OPERATORS,
  SAMPLE_WHERE_FIELDS,
} from '../../where-builder/whereBuilderModel';
import {
  countListWhereConditions,
  evaluateListWhereIrOnRecord,
  filterRecordsByListWhereTree,
  formatListWhereSummary,
  isListWhereTreeActive,
  listWhereTreeToIr,
  mergeWhereCondition,
  sanitizeListWhereTree,
} from '../listWhereFilter';
import { listWhereIrToPrisma, listWhereIrToSequelize } from '../listWhereQuery';

describe('listWhereFilter', () => {
  it('treats an empty tree as inactive', () => {
    const empty = createEmptyWhereTree();
    expect(isListWhereTreeActive(empty)).toBe(false);
    expect(formatListWhereSummary(empty, SAMPLE_WHERE_FIELDS)).toBe('');
    expect(countListWhereConditions(empty)).toBe(0);
  });

  it('filters in-memory rows with the same IR as server queries', () => {
    const tree = createWhereGroup('and', [
      createWhereCondition('name', 'contains', 'ali'),
    ]);
    const rows = [
      { name: 'Alice' },
      { name: 'Bob' },
    ];
    expect(filterRecordsByListWhereTree(rows, tree, DEFAULT_WHERE_OPERATORS)).toEqual([{ name: 'Alice' }]);
    const ir = listWhereTreeToIr(tree, DEFAULT_WHERE_OPERATORS);
    expect(evaluateListWhereIrOnRecord({ name: 'Alice' }, ir)).toBe(true);
    expect(evaluateListWhereIrOnRecord({ name: 'Bob' }, ir)).toBe(false);
  });

  it('summarizes complete conditions with field labels', () => {
    const tree = createWhereGroup('and', [
      createWhereCondition('firstName', 'startsWith', 'Andre'),
    ]);
    expect(isListWhereTreeActive(tree)).toBe(true);
    expect(formatListWhereSummary(tree, SAMPLE_WHERE_FIELDS)).toBe(
      "First Name STARTS WITH 'Andre'",
    );
    expect(countListWhereConditions(tree)).toBe(1);
  });

  it('drops incomplete conditions from the IR', () => {
    const tree = createWhereGroup('and', [
      createWhereCondition('firstName', 'eq', ''),
      createWhereCondition('age', 'gt', '30'),
    ]);
    const ir = listWhereTreeToIr(tree, DEFAULT_WHERE_OPERATORS);
    expect(ir).toMatchObject({ kind: 'condition', field: 'age', operator: 'gt', value: '30' });
  });

  it('sanitizes unknown fields and keeps a group root', () => {
    const raw = createWhereGroup('or', [
      createWhereCondition('firstName', 'eq', 'Ada'),
      createWhereCondition('notAField', 'eq', 'x'),
    ]);
    const next = sanitizeListWhereTree(raw, SAMPLE_WHERE_FIELDS, DEFAULT_WHERE_OPERATORS);
    expect(next.op).toBe('or');
    expect(next.children).toHaveLength(1);
    expect(next.children[0]).toMatchObject({ field: 'firstName', value: 'Ada' });
  });

  it('serializes and parses a tree without dropping complete conditions', () => {
    const tree = createWhereGroup('and', [
      createWhereCondition('firstName', 'eq', 'Ada'),
    ]);
    const parsed = sanitizeListWhereTree(
      JSON.parse(JSON.stringify(tree)),
      SAMPLE_WHERE_FIELDS,
      DEFAULT_WHERE_OPERATORS,
    );
    expect(listWhereTreeToIr(parsed, DEFAULT_WHERE_OPERATORS)).toMatchObject({
      kind: 'condition',
      field: 'firstName',
      value: 'Ada',
    });
  });

  it('merges a seed condition once', () => {
    const empty = createEmptyWhereTree();
    const seeded = mergeWhereCondition(empty, 'requestId', 'eq', 'req-1');
    expect(seeded.children).toHaveLength(1);
    expect(mergeWhereCondition(seeded, 'requestId', 'eq', 'req-1').children).toHaveLength(1);
  });
});

describe('listWhereQuery', () => {
  const columns = {
    firstName: { path: 'firstName', type: 'string' as const },
    age: { path: 'age', type: 'number' as const },
  };
  const Op = {
    and: Symbol('and'),
    or: Symbol('or'),
    ne: Symbol('ne'),
    in: Symbol('in'),
    notIn: Symbol('notIn'),
    gt: Symbol('gt'),
    gte: Symbol('gte'),
    lt: Symbol('lt'),
    lte: Symbol('lte'),
    like: Symbol('like'),
    is: Symbol('is'),
  };

  it('compiles AND/OR trees for Prisma and Sequelize', () => {
    const tree = createWhereGroup('or', [
      createWhereCondition('firstName', 'startsWith', 'A'),
      createWhereCondition('age', 'gt', '30'),
    ]);
    const ir = listWhereTreeToIr(tree, DEFAULT_WHERE_OPERATORS);
    const prisma = listWhereIrToPrisma(ir, columns, (value) => ({ contains: value }));
    expect(prisma).toMatchObject({
      OR: [
        { firstName: { startsWith: 'A' } },
        { age: { gt: 30 } },
      ],
    });
    const sequelize = listWhereIrToSequelize(ir, columns, Op);
    expect(sequelize?.[Op.or]).toHaveLength(2);
  });
});
