import { Op } from 'sequelize';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';
import type { RecordPolicyBindingDocument, RecordPolicyDocument } from '../../../../shared/api/contracts/record-policy';
import type { SessionScopeSnapshot } from '../sessionScope.service';

const bindingState = vi.hoisted(() => ({
  binding: {
    edgeModelId: 'em_customer',
    recordScope: 'on' as const,
    forceScopeForAdmin: false,
    policyTree: {
      kind: 'policy' as const,
      policyId: 'rp_active',
    },
    bindings: [],
    allowedUserAttrKeys: [],
  } satisfies RecordPolicyBindingDocument,
  policies: [] as RecordPolicyDocument[],
}));

vi.mock('../recordPolicyBindingStore', () => ({
  getRecordPolicyBindingOrDefault: vi.fn(() => bindingState.binding),
}));

vi.mock('../recordPolicyStore', () => ({
  getRecordPolicyById: vi.fn((id: string) => bindingState.policies.find((policy) => policy.id === id) ?? null),
  listRecordPoliciesForModel: vi.fn(() => bindingState.policies),
  listEnabledRecordPoliciesForModel: vi.fn(() => bindingState.policies.filter((policy) => policy.enabled)),
}));

vi.mock('../recordPolicyDenyLog', () => ({
  logRecordPolicyDeny: vi.fn(),
}));

import {
  applyRecordPolicies,
  assertLoadedRecordInScope,
  isRecordScopeEnforced,
} from '../applyRecordPolicies';

const model = {
  id: 'em_customer',
  objectName: 'Customer',
} as EdgeModelDefinition;

const session = (): SessionScopeSnapshot => ({
  userId: 7,
  email: 'a@example.com',
  roles: ['STAFF'],
  isAdmin: false,
  serverContext: {
    'user.id': 7,
    'scope.tenant': ['t-1'],
  },
  userAttrs: { id: 7 },
  scope: { tenant: { ids: ['t-1'], mode: 'subtree' } },
  scopeHash: 'stest',
});

const activePolicy = (): RecordPolicyDocument => ({
  id: 'rp_active',
  edgeModelId: 'em_customer',
  name: 'Tenant scope',
  effect: 'allow',
  principals: { roles: [], users: [] },
  enabled: true,
  version: 1,
  predicate: { op: 'inScopeSet', field: 'tenantId', value: { ref: 'scope.tenant' } },
});

const draftPolicy = (): RecordPolicyDocument => ({
  ...activePolicy(),
  id: 'rp_draft',
  name: 'Draft',
  enabled: false,
  predicate: { op: 'eq', field: 'tenantId', value: { literal: 'blocked' } },
});

describe('applyRecordPolicies', () => {
  beforeEach(() => {
    bindingState.binding = {
      edgeModelId: 'em_customer',
      recordScope: 'on',
      forceScopeForAdmin: false,
      policyTree: {
        kind: 'group',
        op: 'and',
        children: [
          { kind: 'policy', policyId: 'rp_draft' },
          { kind: 'policy', policyId: 'rp_active' },
        ],
      },
      bindings: [],
      allowedUserAttrKeys: [],
    };
    bindingState.policies = [activePolicy(), draftPolicy()];
  });

  it('does not enforce when record scope is off', () => {
    bindingState.binding.recordScope = 'off';
    const result = applyRecordPolicies({
      model,
      operationKind: 'list',
      session: session(),
      baseWhere: { status: 'open' },
    });
    expect(result.enforced).toBe(false);
    expect(result.where).toEqual({ status: 'open' });
  });

  it('merges only the enabled active policy when scope is on', () => {
    const result = applyRecordPolicies({
      model,
      operationKind: 'list',
      session: session(),
      baseWhere: { status: 'open' },
    });
    expect(result.enforced).toBe(true);
    expect(result.denyAll).toBe(false);
    const andParts = (result.where as { [key: symbol]: unknown })[Op.and];
    expect(andParts).toEqual(expect.arrayContaining([
      { status: 'open' },
      { tenantId: { [Op.in]: ['t-1'] } },
    ]));
  });

  it('bypasses scope for admin unless forceScopeForAdmin is set', () => {
    const bypassed = applyRecordPolicies({
      model,
      operationKind: 'list',
      session: { ...session(), isAdmin: true },
      baseWhere: { status: 'open' },
    });
    expect(bypassed.bypassed).toBe(true);
    expect(bypassed.where).toEqual({ status: 'open' });

    bindingState.binding.forceScopeForAdmin = true;
    const enforced = applyRecordPolicies({
      model,
      operationKind: 'list',
      session: { ...session(), isAdmin: true },
      baseWhere: { status: 'open' },
    });
    expect(enforced.enforced).toBe(true);
    expect(enforced.bypassed).toBe(false);
  });

  it('denies out-of-scope records on read', () => {
    expect(() => assertLoadedRecordInScope(
      model,
      { tenantId: 't-2' },
      session(),
      'read',
    )).toThrow('Record not found.');

    expect(() => assertLoadedRecordInScope(
      model,
      { tenantId: 't-1' },
      session(),
      'read',
    )).not.toThrow();
  });

  it('treats scope as off when no enabled policies exist', () => {
    bindingState.policies = [draftPolicy()];
    expect(isRecordScopeEnforced('on', 0)).toBe(false);
    const result = applyRecordPolicies({
      model,
      operationKind: 'list',
      session: session(),
    });
    expect(result.enforced).toBe(false);
  });

  it('applies a specific policy override instead of the model default', () => {
    const result = applyRecordPolicies({
      model,
      operationKind: 'list',
      session: session(),
      recordPolicyId: 'rp_draft',
      baseWhere: { status: 'open' },
    });
    expect(result.enforced).toBe(true);
    const andParts = (result.where as { [key: symbol]: unknown })[Op.and];
    expect(andParts).toEqual(expect.arrayContaining([
      { status: 'open' },
      { tenantId: { [Op.eq]: 'blocked' } },
    ]));
  });
});
