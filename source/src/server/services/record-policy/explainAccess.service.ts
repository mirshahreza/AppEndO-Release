import type { SessionScopeSnapshot } from './sessionScope.service';
import { getRecordPolicyBindingOrDefault } from './recordPolicyBindingStore';
import { listEnabledRecordPoliciesForModel } from './recordPolicyStore';
import { compilePoliciesToWhere, selectApplicablePolicies } from './policyCompiler';
import type { RecordPolicyAction } from '../../../shared/api/contracts/record-policy';
import { isRecordScopeEnforced, mapOperationKindToRecordPolicyAction } from './applyRecordPolicies';

export type ExplainAccessInput = {
  edgeModelId: string;
  action: RecordPolicyAction;
  session: SessionScopeSnapshot;
};

export type ExplainAccessResult = {
  edgeModelId: string;
  action: RecordPolicyAction;
  recordScope: 'off' | 'on';
  forceScopeForAdmin: boolean;
  adminBypassed: boolean;
  applicablePolicyIds: string[];
  denyAll: boolean;
  scopeHash: string;
  memberships: Record<string, { ids: string[]; mode: string }>;
  compiledWhereSummary: string;
};

const summarizeWhere = (where: unknown): string => {
  try {
    return JSON.stringify(where, (_key, value) => {
      if (typeof value === 'symbol') {
        return value.toString();
      }
      return value;
    });
  } catch {
    return '[unserializable where]';
  }
};

export const explainRecordAccess = (input: ExplainAccessInput): ExplainAccessResult => {
  const binding = getRecordPolicyBindingOrDefault(input.edgeModelId);
  const policies = listEnabledRecordPoliciesForModel(input.edgeModelId);
  const adminBypassed = input.session.isAdmin && !binding.forceScopeForAdmin;
  const enforced = isRecordScopeEnforced(binding.recordScope, policies.length);

  if (adminBypassed || !enforced) {
    return {
      edgeModelId: input.edgeModelId,
      action: input.action,
      recordScope: binding.recordScope,
      forceScopeForAdmin: binding.forceScopeForAdmin,
      adminBypassed,
      applicablePolicyIds: [],
      denyAll: false,
      scopeHash: input.session.scopeHash,
      memberships: input.session.scope,
      compiledWhereSummary: '{}',
    };
  }

  const applicable = selectApplicablePolicies(policies, input.session);
  const compiled = compilePoliciesToWhere(policies, input.session, binding.policyTree);

  return {
    edgeModelId: input.edgeModelId,
    action: input.action,
    recordScope: binding.recordScope,
    forceScopeForAdmin: binding.forceScopeForAdmin,
    adminBypassed: false,
    applicablePolicyIds: applicable.map((policy) => policy.id),
    denyAll: compiled.denyAll,
    scopeHash: input.session.scopeHash,
    memberships: input.session.scope,
    compiledWhereSummary: summarizeWhere(compiled.where),
  };
};

export const explainRecordAccessForOperationKind = (
  edgeModelId: string,
  operationKind: string,
  session: SessionScopeSnapshot,
): ExplainAccessResult | null => {
  const action = mapOperationKindToRecordPolicyAction(operationKind);
  if (!action) {
    return null;
  }
  return explainRecordAccess({ edgeModelId, action, session });
};
