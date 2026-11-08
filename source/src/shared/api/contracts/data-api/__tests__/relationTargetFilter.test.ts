import { describe, expect, it } from 'vitest';
import {
  formatRelationTargetFilterCondition,
  normalizeRelationTargetFilter,
} from '../relationTargetFilter';
import { upsertEdgeModelStudioMetaInputSchema } from '../studioMeta';

describe('relationTargetFilter', () => {
  it('keeps complete AND conditions and drops incomplete rows', () => {
    expect(normalizeRelationTargetFilter([
      { column: 'active', op: 'eq', value: 'true' },
      { column: 'parent_id', op: 'isNull' },
      { column: 'type', op: 'in', value: ' city , region ' },
      { column: '', op: 'eq', value: 'x' },
      { column: 'name', op: 'eq', value: '' },
      { column: 'code', op: 'neq', value: 'legacy' },
    ])).toEqual([
      { column: 'active', op: 'eq', value: 'true' },
      { column: 'parent_id', op: 'isNull' },
      { column: 'type', op: 'in', value: 'city , region' },
      { column: 'code', op: 'neq', value: 'legacy' },
    ]);
  });

  it('formats conditions for summary display', () => {
    expect(formatRelationTargetFilterCondition({
      column: 'active',
      op: 'eq',
      value: 'true',
    })).toBe('active = true');
    expect(formatRelationTargetFilterCondition({
      column: 'parent_id',
      op: 'isNull',
    })).toBe('parent_id is null');
  });

  it('accepts associationMeta.targetFilter in studio-meta upsert', () => {
    const parsed = upsertEdgeModelStudioMetaInputSchema.parse({
      associationMeta: [
        {
          relationKey: 'assoc_1',
          targetFilter: [
            { column: 'active', op: 'eq', value: 'true' },
            { column: 'parent_id', op: 'isNull' },
          ],
        },
      ],
    });
    expect(parsed.associationMeta?.[0]?.targetFilter).toEqual([
      { column: 'active', op: 'eq', value: 'true' },
      { column: 'parent_id', op: 'isNull' },
    ]);
  });
});
