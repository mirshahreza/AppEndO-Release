import { describe, expect, it } from 'vitest';
import {
  addWhereChild,
  createEmptyWhereTree,
  createSampleWhereTree,
  createWhereCondition,
  filterWhereContextItemsForOperator,
  formatWherePreview,
  getWhereNodeAt,
  findWherePathById,
  inferWhereContextValueShape,
  isWhereContextRefValidForOperator,
  operatorsForField,
  patchWhereCondition,
  removeWhereNodeAt,
  setWhereGroupOp,
  switchWhereNodeToManual,
  moveWhereNodeAt,
  moveWhereNodeTo,
  moveWhereNodeByDrag,
  SAMPLE_WHERE_CONTEXT_ITEMS,
  SAMPLE_WHERE_FIELDS,
  whereGroupDropId,
} from '../whereBuilderModel';

describe('whereBuilderModel', () => {
  it('builds nested, simple, and empty sample trees', () => {
    expect(createSampleWhereTree('empty').children).toEqual([]);
    expect(createSampleWhereTree('simple').children).toHaveLength(2);
    const nested = createSampleWhereTree('nested');
    expect(nested.children).toHaveLength(5);
    expect(getWhereNodeAt(nested, [3])?.kind).toBe('group');
  });

  it('changes a group combinator from any child path by updating the group', () => {
    const root = createSampleWhereTree('simple');
    const next = setWhereGroupOp(root, [], 'or');
    expect(next.op).toBe('or');
    expect(next.children).toHaveLength(2);
  });

  it('patches a condition, adds children, and refuses to remove the root', () => {
    const root = createSampleWhereTree('simple');
    const patched = patchWhereCondition(root, [0], { value: 'Ann' });
    expect(getWhereNodeAt(patched, [0])).toMatchObject({ kind: 'condition', value: 'Ann' });

    const added = addWhereChild(patched, [], createWhereCondition('age', 'gt', '30', 'where-extra'));
    expect(added.children).toHaveLength(3);

    const removed = removeWhereNodeAt(added, [2]);
    expect(removed.children).toHaveLength(2);
    expect(removeWhereNodeAt(removed, [])).toBe(removed);
  });

  it('formats a parenthesized SQL-style preview', () => {
    expect(formatWherePreview(createEmptyWhereTree())).toBe('TRUE');
    expect(formatWherePreview(createSampleWhereTree('simple'))).toBe(
      "firstName STARTS WITH 'Andre' AND lastName IN ('Davolio', 'Buchanan')",
    );
    expect(formatWherePreview(createSampleWhereTree('nested'))).toBe(
      "firstName STARTS WITH 'Andre' AND lastName IN ('Davolio', 'Buchanan') AND age > '30' AND (isDeveloper = 'true' OR primaryFramework = 'React') AND hireDate BETWEEN '2023-11-28' AND '2023-11-30'",
    );
  });

  it('leaves server-context values unquoted in the preview', () => {
    const root = createSampleWhereTree('simple');
    const withContext = patchWhereCondition(root, [0], {
      operator: 'eq',
      value: 'user.id',
      valueKind: 'context',
    });
    expect(formatWherePreview(withContext)).toBe(
      "firstName = user.id AND lastName IN ('Davolio', 'Buchanan')",
    );

    const between = patchWhereCondition(createSampleWhereTree('nested'), [4], {
      value: 'user.id,2023-11-30',
      valueKind: 'context',
      endValueKind: 'literal',
    });
    expect(formatWherePreview(between)).toContain("hireDate BETWEEN user.id AND '2023-11-30'");
  });

  it('switches a condition to a one-way manual expression and refuses to convert the root', () => {
    const root = createSampleWhereTree('simple');
    const first = getWhereNodeAt(root, [0]);
    expect(first?.kind).toBe('condition');
    const manual = switchWhereNodeToManual(root, [0]);
    expect(getWhereNodeAt(manual, [0])).toMatchObject({
      kind: 'manual',
      expression: "firstName STARTS WITH 'Andre'",
    });
    expect(switchWhereNodeToManual(manual, [0])).toBe(manual);
    expect(switchWhereNodeToManual(root, [])).toBe(root);
    expect(formatWherePreview(manual)).toBe(
      "firstName STARTS WITH 'Andre' AND lastName IN ('Davolio', 'Buchanan')",
    );
  });

  it('moves a sibling up and down and refuses out-of-range or root moves', () => {
    const root = createSampleWhereTree('simple');
    const down = moveWhereNodeAt(root, [0], 1);
    expect(getWhereNodeAt(down, [0])).toMatchObject({ kind: 'condition', field: 'lastName' });
    expect(getWhereNodeAt(down, [1])).toMatchObject({ kind: 'condition', field: 'firstName' });
    expect(moveWhereNodeAt(down, [1], 1)).toBe(down);
    expect(moveWhereNodeAt(root, [0], -1)).toBe(root);
    expect(moveWhereNodeAt(root, [], 1)).toBe(root);
  });

  it('finds a node path by id and moves across groups by drag', () => {
    const root = createSampleWhereTree('nested');
    expect(findWherePathById(root, 'where-nested')).toEqual([3]);
    expect(findWherePathById(root, 'where-isDeveloper')).toEqual([3, 0]);

    const reordered = moveWhereNodeTo(root, [0], [], 2);
    expect(getWhereNodeAt(reordered, [2])).toMatchObject({ kind: 'condition', field: 'firstName' });

    const nestedIn = moveWhereNodeTo(root, [0], [3], 0);
    expect(getWhereNodeAt(nestedIn, [2])?.kind).toBe('group');
    expect(getWhereNodeAt(nestedIn, [2, 0])).toMatchObject({ kind: 'condition', field: 'firstName' });
    expect(getWhereNodeAt(nestedIn, [2, 1])).toMatchObject({ kind: 'condition', field: 'isDeveloper' });

    expect(moveWhereNodeTo(root, [3], [3], 0)).toBe(root);
    expect(moveWhereNodeTo(root, [], [3], 0)).toBe(root);
    expect(moveWhereNodeByDrag(root, 'where-nested', 'where-isDeveloper')).toBe(root);

    const dragged = moveWhereNodeByDrag(root, 'where-firstName', 'where-lastName');
    expect(getWhereNodeAt(dragged, [0])).toMatchObject({ kind: 'condition', field: 'lastName' });

    const droppedInGroup = moveWhereNodeByDrag(root, 'where-age', whereGroupDropId('where-nested'));
    expect(getWhereNodeAt(droppedInGroup, [2])?.kind).toBe('group');
    expect(getWhereNodeAt(droppedInGroup, [2, 2])).toMatchObject({ kind: 'condition', field: 'age' });
  });

  it('filters operators by field type', () => {
    const booleanOps = operatorsForField(SAMPLE_WHERE_FIELDS.find((field) => field.id === 'isDeveloper'));
    expect(booleanOps.map((item) => item.id)).toEqual(['eq', 'neq', 'isNull', 'isNotNull']);
    const dateOps = operatorsForField(SAMPLE_WHERE_FIELDS.find((field) => field.id === 'hireDate'));
    expect(dateOps.some((item) => item.id === 'between')).toBe(true);
    expect(dateOps.some((item) => item.id === 'startsWith')).toBe(false);
  });

  it('filters context items by operator value shape', () => {
    expect(inferWhereContextValueShape('user.id')).toBe('scalar');
    expect(inferWhereContextValueShape('sys.roles')).toBe('collection');
    expect(inferWhereContextValueShape('scope.org')).toBe('collection');

    expect(filterWhereContextItemsForOperator('eq', SAMPLE_WHERE_CONTEXT_ITEMS).map((item) => item.id)).toEqual([
      'user.id',
      'user.email',
    ]);
    expect(filterWhereContextItemsForOperator('in', SAMPLE_WHERE_CONTEXT_ITEMS).map((item) => item.id)).toEqual([
      'sys.roles',
      'scope.org',
      'scope.geo',
    ]);
    expect(filterWhereContextItemsForOperator('inScopeSet', SAMPLE_WHERE_CONTEXT_ITEMS).map((item) => item.id)).toEqual([
      'scope.org',
      'scope.geo',
    ]);
    expect(isWhereContextRefValidForOperator('eq', 'sys.roles', SAMPLE_WHERE_CONTEXT_ITEMS)).toBe(false);
    expect(isWhereContextRefValidForOperator('in', 'sys.roles', SAMPLE_WHERE_CONTEXT_ITEMS)).toBe(true);
  });
});
