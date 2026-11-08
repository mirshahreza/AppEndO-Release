import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { RecordPolicyDocument } from '../../../../shared/api/contracts/record-policy';

const storeState = vi.hoisted(() => ({
  policies: [] as RecordPolicyDocument[],
}));

vi.mock('../recordPolicyStore', () => ({
  getRecordPolicyById: vi.fn((id: string) => storeState.policies.find((policy) => policy.id === id) ?? null),
  listRecordPoliciesForModel: vi.fn(() => storeState.policies),
  listEnabledRecordPoliciesForModel: vi.fn(() => storeState.policies.filter((policy) => policy.enabled)),
}));

import { resolveRecordPoliciesForOperation } from '../recordPolicyOperationScope';

const policy = (
  id: string,
  enabled: boolean,
): RecordPolicyDocument => ({
  id,
  edgeModelId: 'em_customer',
  name: id,
  effect: 'allow',
  principals: { roles: [], users: [] },
  predicate: { op: 'isNotNull', field: 'id' },
  enabled,
  version: 1,
});

describe('resolveRecordPoliciesForOperation', () => {
  beforeEach(() => {
    storeState.policies = [
      policy('rp_active', true),
      policy('rp_draft', false),
    ];
  });

  it('returns no policies when bypass is enabled', () => {
    expect(resolveRecordPoliciesForOperation('em_customer', { bypassRecordPolicy: true })).toEqual([]);
  });

  it('returns enabled policies for the model default', () => {
    expect(resolveRecordPoliciesForOperation('em_customer', {})).toEqual([policy('rp_active', true)]);
  });

  it('returns a specific policy even when it is not the active one', () => {
    expect(resolveRecordPoliciesForOperation('em_customer', { recordPolicyId: 'rp_draft' })).toEqual([
      policy('rp_draft', false),
    ]);
  });
});
