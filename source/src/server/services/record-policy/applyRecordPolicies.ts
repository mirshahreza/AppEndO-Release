import type { WhereOptions } from 'sequelize';
import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import type { RecordPolicyAction } from '../../../shared/api/contracts/record-policy';
import { getRecordPolicyBindingOrDefault } from './recordPolicyBindingStore';
import {
  isRecordScopeEnforcedForPolicies,
  resolveRecordPoliciesForOperation,
  type RecordPolicyOperationOverride,
} from './recordPolicyOperationScope';
import {
  compilePoliciesToWhere,
  compileSinglePolicyToWhere,
  recordMatchesSimpleWhere,
} from './policyCompiler';
import { mergeWhereAnd } from './whereMerge';
import { logRecordPolicyDeny } from './recordPolicyDenyLog';
import type { SessionScopeSnapshot } from './sessionScope.service';

const KIND_TO_ACTION: Record<string, RecordPolicyAction | null> = {
  list: 'list',
  getOne: 'read',
  lookup: 'read',
  create: 'create',
  update: 'update',
  patch: 'update',
  delete: 'delete',
  routine: null,
  pivot: 'list',
};

export const mapOperationKindToRecordPolicyAction = (
  kind: EdgeApiOperation['kind'] | string,
): RecordPolicyAction | null => KIND_TO_ACTION[kind] ?? null;

const emptyCompileSession = (): SessionScopeSnapshot => ({
  userId: 0,
  roles: [],
  isAdmin: false,
  serverContext: {},
  userAttrs: {},
  scope: {},
  scopeHash: 'anon',
});

export const isRecordScopeEnforced = (
  recordScope: 'off' | 'on',
  policyCount: number,
): boolean => recordScope === 'on' && policyCount > 0;

const compilePoliciesForOperation = (
  edgeModelId: string,
  session: SessionScopeSnapshot,
  binding: ReturnType<typeof getRecordPolicyBindingOrDefault>,
  override: RecordPolicyOperationOverride,
) => {
  const policies = resolveRecordPoliciesForOperation(edgeModelId, override);
  if (policies.length === 0) {
    return compilePoliciesToWhere([], session, binding.policyTree);
  }
  if (override.recordPolicyId?.trim()) {
    return compileSinglePolicyToWhere(policies[0], session);
  }
  return compilePoliciesToWhere(policies, session, binding.policyTree);
};

export type ApplyRecordPoliciesInput = {
  model: EdgeModelDefinition;
  operationKind: string;
  session: SessionScopeSnapshot | null;
  /** Existing where (defaultWhere + user filters). */
  baseWhere?: WhereOptions;
} & RecordPolicyOperationOverride;

export type ApplyRecordPoliciesResult = {
  where: WhereOptions;
  bypassed: boolean;
  enforced: boolean;
  scopeHash: string | null;
  denyAll: boolean;
};

const passthrough = (
  baseWhere: WhereOptions | undefined,
  extras?: Partial<ApplyRecordPoliciesResult>,
): ApplyRecordPoliciesResult => ({
  where: baseWhere ?? {},
  bypassed: false,
  enforced: false,
  scopeHash: null,
  denyAll: false,
  ...extras,
});

/**
 * Merge policy WHERE for Data API.
 * Off, or On with no policies, or Skip record scope on the operation → no-op.
 * On with policies applies the model tree unless recordPolicyId overrides to one policy.
 */
export const applyRecordPolicies = (
  input: ApplyRecordPoliciesInput,
): ApplyRecordPoliciesResult => {
  const override: RecordPolicyOperationOverride = {
    bypassRecordPolicy: input.bypassRecordPolicy,
    recordPolicyId: input.recordPolicyId,
  };

  if (override.bypassRecordPolicy) {
    return passthrough(input.baseWhere, { bypassed: true });
  }

  const action = mapOperationKindToRecordPolicyAction(input.operationKind);
  if (!action) {
    return passthrough(input.baseWhere);
  }

  const binding = getRecordPolicyBindingOrDefault(input.model.id);
  const policies = resolveRecordPoliciesForOperation(input.model.id, override);
  if (!isRecordScopeEnforcedForPolicies(binding.recordScope, policies)) {
    return passthrough(input.baseWhere);
  }

  const session = input.session;
  if (!session) {
    const compiled = compilePoliciesForOperation(input.model.id, emptyCompileSession(), binding, override);
    return {
      where: mergeWhereAnd(input.baseWhere, compiled.where),
      bypassed: false,
      enforced: true,
      scopeHash: 'anon',
      denyAll: compiled.denyAll,
    };
  }

  if (session.isAdmin && !binding.forceScopeForAdmin) {
    return passthrough(input.baseWhere, {
      bypassed: true,
      scopeHash: session.scopeHash,
    });
  }

  const compiled = compilePoliciesForOperation(input.model.id, session, binding, override);
  return {
    where: mergeWhereAnd(input.baseWhere, compiled.where),
    bypassed: false,
    enforced: true,
    scopeHash: session.scopeHash,
    denyAll: compiled.denyAll,
  };
};

export const assertCreatePayloadInScope = (
  model: EdgeModelDefinition,
  payload: Record<string, unknown>,
  session: SessionScopeSnapshot,
  override: RecordPolicyOperationOverride = {},
): void => {
  const binding = getRecordPolicyBindingOrDefault(model.id);
  const policies = resolveRecordPoliciesForOperation(model.id, override);
  if (!isRecordScopeEnforcedForPolicies(binding.recordScope, policies)) {
    return;
  }
  if (session.isAdmin && !binding.forceScopeForAdmin) {
    return;
  }
  const compiled = compilePoliciesForOperation(model.id, session, binding, override);
  if (compiled.denyAll || !recordMatchesSimpleWhere(payload, compiled.where)) {
    logRecordPolicyDeny({
      reason: compiled.denyAll ? 'deny_all' : 'out_of_scope',
      edgeModelId: model.id,
      action: 'create',
      userId: session.userId,
      scopeHash: session.scopeHash,
    });
    throw new Error('Record not found.');
  }
};

export const assertLoadedRecordInScope = (
  model: EdgeModelDefinition,
  record: Record<string, unknown> | null,
  session: SessionScopeSnapshot | null,
  action: RecordPolicyAction = 'read',
  override: RecordPolicyOperationOverride = {},
): void => {
  if (!record) {
    throw new Error('Record not found.');
  }
  const binding = getRecordPolicyBindingOrDefault(model.id);
  const policies = resolveRecordPoliciesForOperation(model.id, override);
  if (!isRecordScopeEnforcedForPolicies(binding.recordScope, policies)) {
    return;
  }
  if (!session) {
    logRecordPolicyDeny({
      reason: 'unauthenticated',
      edgeModelId: model.id,
      action,
    });
    throw new Error('Record not found.');
  }
  if (session.isAdmin && !binding.forceScopeForAdmin) {
    return;
  }
  const compiled = compilePoliciesForOperation(model.id, session, binding, override);
  if (compiled.denyAll || !recordMatchesSimpleWhere(record, compiled.where)) {
    logRecordPolicyDeny({
      reason: compiled.denyAll ? 'deny_all' : 'out_of_scope',
      edgeModelId: model.id,
      action,
      userId: session.userId,
      scopeHash: session.scopeHash,
    });
    throw new Error('Record not found.');
  }
};
