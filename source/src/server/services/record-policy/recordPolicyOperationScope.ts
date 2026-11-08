import type { RecordPolicyDocument } from '../../../shared/api/contracts/record-policy';
import {
  getRecordPolicyById,
  listEnabledRecordPoliciesForModel,
  listRecordPoliciesForModel,
} from './recordPolicyStore';

export type RecordPolicyOperationOverride = {
  bypassRecordPolicy?: boolean;
  recordPolicyId?: string;
};

export const resolveRecordPoliciesForOperation = (
  edgeModelId: string,
  override?: RecordPolicyOperationOverride,
): RecordPolicyDocument[] => {
  if (override?.bypassRecordPolicy) {
    return [];
  }
  const policyId = override?.recordPolicyId?.trim();
  if (policyId) {
    const policy = getRecordPolicyById(policyId)
      ?? listRecordPoliciesForModel(edgeModelId).find((item) => item.id === policyId);
    return policy ? [policy] : [];
  }
  return listEnabledRecordPoliciesForModel(edgeModelId);
};

export const isRecordScopeEnforcedForPolicies = (
  recordScope: 'off' | 'on',
  policies: readonly RecordPolicyDocument[],
): boolean => recordScope === 'on' && policies.length > 0;
