import { describe, expect, it } from 'vitest';
import { buildRecordPolicyContextItems } from '../recordPolicyContextItems';
import { filterWhereContextItemsForOperator } from '../../../../shared/ui/where-builder/whereBuilderModel';

describe('buildRecordPolicyContextItems', () => {
  it('tags scalar user keys and collection scope or role keys', () => {
    const items = buildRecordPolicyContextItems(['user.id', 'user.email', 'sys.roles'], ['org']);
    const byId = Object.fromEntries(items.map((item) => [item.id, item.valueShape]));

    expect(byId['user.id']).toBe('scalar');
    expect(byId['user.email']).toBe('scalar');
    expect(byId['sys.roles']).toBe('collection');
    expect(byId['scope.org']).toBe('collection');
  });

  it('filters context keys by operator semantics', () => {
    const items = buildRecordPolicyContextItems(['user.id', 'sys.roles'], ['org']);

    expect(filterWhereContextItemsForOperator('eq', items).map((item) => item.id)).toEqual(['user.id']);
    expect(filterWhereContextItemsForOperator('in', items).map((item) => item.id)).toEqual([
      'scope.org',
      'sys.roles',
    ]);
    expect(filterWhereContextItemsForOperator('inScopeSet', items).map((item) => item.id)).toEqual([
      'scope.org',
    ]);
  });
});
