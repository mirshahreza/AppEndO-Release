import type { RecordPolicyDocument } from '../../../shared/api/contracts/record-policy';

export const policiesInTree = (
  policies: readonly RecordPolicyDocument[],
  policyIds: readonly string[],
): RecordPolicyDocument[] => (
  policies.filter((policy) => policyIds.includes(policy.id))
);

/** Pick the policy that should be the sole enabled policy for this model. */
export const pickEnabledPolicyId = (
  scopedPolicies: readonly RecordPolicyDocument[],
  orderedIds: readonly string[],
): string | null => {
  if (orderedIds.length === 0) {
    return null;
  }
  const enabled = scopedPolicies.filter((policy) => policy.enabled);
  if (enabled.length === 1) {
    return enabled[0]!.id;
  }
  if (enabled.length > 1) {
    return orderedIds.find((id) => enabled.some((policy) => policy.id === id)) ?? orderedIds[0]!;
  }
  return orderedIds[0]!;
};

export const buildSingleEnabledUpdates = (
  enabledPolicyId: string,
  scopedPolicies: readonly RecordPolicyDocument[],
  scopeIds: readonly string[],
): RecordPolicyDocument[] => (
  scopedPolicies.filter(
    (policy) => scopeIds.includes(policy.id) && policy.enabled !== (policy.id === enabledPolicyId),
  )
);

export const countEnabledPolicies = (
  scopedPolicies: readonly RecordPolicyDocument[],
): number => scopedPolicies.filter((policy) => policy.enabled).length;
