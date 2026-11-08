import { describe, expect, it } from 'vitest';
import type { RecordPolicyDocument } from '../../../../shared/api/contracts/record-policy';
import {
  buildSingleEnabledUpdates,
  pickEnabledPolicyId,
} from '../recordPolicyEnabledState';

const policy = (
  id: string,
  enabled: boolean,
): RecordPolicyDocument => ({
  id,
  edgeModelId: 'model-1',
  name: id,
  effect: 'allow',
  principals: { roles: [], users: [] },
  predicate: { op: 'isNotNull', field: 'id' },
  enabled,
  version: 1,
});

describe('recordPolicyEnabledState', () => {
  it('picks the only enabled policy when state is already valid', () => {
    const scoped = [policy('a', true), policy('b', false)];
    expect(pickEnabledPolicyId(scoped, ['a', 'b'])).toBe('a');
    expect(buildSingleEnabledUpdates('a', scoped, ['a', 'b'])).toEqual([]);
  });

  it('enables the first ordered policy when none are enabled', () => {
    const scoped = [policy('a', false), policy('b', false)];
    expect(pickEnabledPolicyId(scoped, ['a', 'b'])).toBe('a');
    expect(buildSingleEnabledUpdates('a', scoped, ['a', 'b']).map((item) => item.id)).toEqual(['a']);
  });

  it('collapses multiple enabled policies to one ordered winner', () => {
    const scoped = [policy('a', true), policy('b', true), policy('c', false)];
    expect(pickEnabledPolicyId(scoped, ['a', 'b', 'c'])).toBe('a');
    const updates = buildSingleEnabledUpdates('a', scoped, ['a', 'b', 'c']);
    expect(updates.map((item) => item.id)).toEqual(['b']);
  });
});
