import { describe, expect, it } from 'vitest';
import {
  normalizeRecordPolicyBindingDocument,
  normalizeRecordPolicyDocument,
  normalizeScopeDimensionDef,
  validateRecordPolicyPredicate,
} from '../index';

describe('record-policy predicate DSL', () => {
  it('accepts gender literal and server-context attribute policies', () => {
    const genderLiteral = validateRecordPolicyPredicate({
      predicate: { op: 'eq', field: 'gender', value: { literal: 'F' } },
      allowedFields: ['gender'],
    });
    expect(genderLiteral.ok).toBe(true);

    const genderSession = validateRecordPolicyPredicate({
      predicate: { op: 'eq', field: 'gender', value: { ref: 'user.gender' } },
      allowedFields: ['gender'],
      allowedUserAttrKeys: ['gender'],
    });
    expect(genderSession.ok).toBe(true);
  });

  it('accepts inScopeSet and inSubtree with org/geo scope refs', () => {
    const orgScope = validateRecordPolicyPredicate({
      predicate: {
        op: 'inScopeSet',
        field: 'orgUnitId',
        value: { ref: 'scope.org' },
      },
      allowedFields: ['orgUnitId'],
    });
    expect(orgScope.ok).toBe(true);

    const geo = validateRecordPolicyPredicate({
      predicate: {
        op: 'inSubtree',
        field: 'regionId',
        value: { ref: 'scope.geo' },
      },
      allowedFields: ['regionId'],
    });
    expect(geo.ok).toBe(true);
  });

  it('accepts and/or combinations and owner-only', () => {
    const combined = validateRecordPolicyPredicate({
      predicate: {
        op: 'and',
        args: [
          { op: 'inSubtree', field: 'orgUnitId', value: { ref: 'scope.org' } },
          { op: 'inSubtree', field: 'regionId', value: { ref: 'scope.geo' } },
        ],
      },
      allowedFields: ['orgUnitId', 'regionId'],
    });
    expect(combined.ok).toBe(true);

    const owner = validateRecordPolicyPredicate({
      predicate: {
        op: 'eq',
        field: 'ownerUserId',
        value: { ref: 'user.id' },
      },
      allowedFields: ['ownerUserId'],
    });
    expect(owner.ok).toBe(true);
  });

  it('rejects bad fields, attrs, scope literals, and client refs', () => {
    expect(validateRecordPolicyPredicate({
      predicate: { op: 'eq', field: 'gender', value: { ref: 'user.hack' } },
      allowedFields: ['gender'],
      allowedUserAttrKeys: ['gender'],
    }).ok).toBe(false);

    expect(validateRecordPolicyPredicate({
      predicate: { op: 'eq', field: 'secret', value: { literal: 1 } },
      allowedFields: ['gender'],
    }).ok).toBe(false);

    expect(validateRecordPolicyPredicate({
      predicate: {
        op: 'inSubtree',
        field: 'orgUnitId',
        value: { literal: '100.4' },
      },
      allowedFields: ['orgUnitId'],
    }).ok).toBe(false);

    expect(validateRecordPolicyPredicate({
      predicate: { op: 'eq', field: 'a', value: { ref: 'client.foo' } },
    }).ok).toBe(false);

    const staleSessionRef = validateRecordPolicyPredicate({
      predicate: { op: 'eq', field: 'a', value: { ref: 'session.userId' } },
    });
    expect(staleSessionRef.ok).toBe(false);
    if (!staleSessionRef.ok) {
      expect(staleSessionRef.issues[0]?.message).toContain('session.userId');
    }
  });
});

describe('normalizeRecordPolicyDocument', () => {
  it('normalizes principal casing', () => {
    const result = normalizeRecordPolicyDocument({
      id: ' rp_1 ',
      edgeModelId: 'em_customer',
      name: ' Org isolation ',
      effect: 'allow',
      principals: { roles: ['staff', 'STAFF'], users: [] },
      predicate: {
        op: 'inSubtree',
        field: 'orgUnitId',
        value: { ref: 'scope.org' },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.policy.id).toBe('rp_1');
    expect(result.policy.principals.roles).toEqual(['STAFF']);
  });
});

describe('bindings and dimensions', () => {
  it('normalizes binding sidecar with default recordScope off', () => {
    const result = normalizeRecordPolicyBindingDocument({
      edgeModelId: 'em_customer',
      bindings: [
        { field: 'orgUnitId', dimensionKey: 'org' },
        { field: 'orgUnitId', dimensionKey: 'org' },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.binding.recordScope).toBe('off');
    expect(result.binding.forceScopeForAdmin).toBe(false);
    expect(result.binding.bindings).toEqual([{ field: 'orgUnitId', dimensionKey: 'org' }]);
  });

  it('accepts on scope and a policy tree', () => {
    const result = normalizeRecordPolicyBindingDocument({
      edgeModelId: 'em_customer',
      recordScope: 'on',
      policyTree: {
        kind: 'group',
        op: 'or',
        children: [
          { kind: 'policy', policyId: 'rp_a' },
          { kind: 'policy', policyId: 'rp_b' },
        ],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.binding.recordScope).toBe('on');
    expect(result.binding.policyTree?.kind).toBe('group');
  });

  it('normalizes org dimension preset', () => {
    const result = normalizeScopeDimensionDef({
      key: 'org',
      label: 'Organization',
      topology: 'tree',
      baseInfoRootId: '100.4',
      preset: 'org',
    });
    expect(result.ok).toBe(true);
  });
});
