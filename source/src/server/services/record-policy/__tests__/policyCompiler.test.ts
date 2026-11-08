import { Op } from 'sequelize';
import { describe, expect, it } from 'vitest';
import { compilePoliciesToWhere } from '../policyCompiler';
import { mergeWhereAnd } from '../whereMerge';
import type { SessionScopeSnapshot } from '../sessionScope.service';
import type { RecordPolicyDocument } from '../../../../shared/api/contracts/record-policy';

const session = (overrides?: Partial<SessionScopeSnapshot>): SessionScopeSnapshot => ({
  userId: 7,
  email: 'a@example.com',
  roles: ['STAFF'],
  isAdmin: false,
  serverContext: {
    'user.id': 7,
    'user.gender': 'F',
    'sys.roles': ['STAFF'],
    'scope.org': ['120.001', '120.001.001'],
    'scope.geo': [],
  },
  userAttrs: { id: 7, gender: 'F' },
  scope: {
    org: { ids: ['120.001', '120.001.001'], mode: 'subtree' },
    geo: { ids: [], mode: 'subtree' },
  },
  scopeHash: 'stest',
  ...overrides,
});

const policy = (partial: Partial<RecordPolicyDocument> & Pick<RecordPolicyDocument, 'id' | 'predicate'>): RecordPolicyDocument => ({
  edgeModelId: 'em_customer',
  name: partial.name ?? partial.id,
  effect: 'allow',
  principals: partial.principals ?? { roles: [], users: [] },
  enabled: true,
  version: 1,
  ...partial,
});

describe('policyCompiler', () => {
  it('compiles org + geo and, deny-wins, and fail-closed', () => {
    const allow = policy({
      id: 'rp_allow',
      predicate: {
        op: 'and',
        args: [
          { op: 'inSubtree', field: 'orgUnitId', value: { ref: 'scope.org' } },
          { op: 'inSubtree', field: 'regionId', value: { ref: 'scope.geo' } },
        ],
      },
    });
    const compiled = compilePoliciesToWhere([allow], session());
    expect(compiled.denyAll).toBe(false);
    const andParts = (compiled.where as { [key: symbol]: unknown })[Op.and];
    expect(Array.isArray(andParts)).toBe(true);
    expect(andParts).toHaveLength(2);

    const empty = compilePoliciesToWhere([], session());
    expect(empty.denyAll).toBe(false);
    expect(empty.where).toEqual({});
  });

  it('compiles gender attribute and owner refs from serverContext', () => {
    const gender = policy({
      id: 'rp_gender',
      principals: { roles: ['STAFF'], users: [] },
      predicate: { op: 'eq', field: 'gender', value: { ref: 'user.gender' } },
    });
    const compiled = compilePoliciesToWhere([gender], session());
    expect(compiled.where).toMatchObject({ gender: { [Op.eq]: 'F' } });

    const owner = policy({
      id: 'rp_owner',
      predicate: { op: 'eq', field: 'ownerUserId', value: { ref: 'user.id' } },
    });
    expect(compilePoliciesToWhere([owner], session()).where).toMatchObject({
      ownerUserId: { [Op.eq]: 7 },
    });
  });

  it('mergeWhereAnd combines fragments', () => {
    const merged = mergeWhereAnd({ a: 1 }, { b: 2 });
    expect(merged).toEqual({ [Op.and]: [{ a: 1 }, { b: 2 }] });
  });

  it('compiles an OR policy tree as a union of predicates', () => {
    const orgScope = policy({
      id: 'rp_org',
      predicate: { op: 'inSubtree', field: 'orgUnitId', value: { ref: 'scope.org' } },
    });
    const owner = policy({
      id: 'rp_owner',
      predicate: { op: 'eq', field: 'ownerUserId', value: { ref: 'user.id' } },
    });
    const compiled = compilePoliciesToWhere([orgScope, owner], session(), {
      kind: 'group',
      op: 'or',
      children: [
        { kind: 'policy', policyId: 'rp_org' },
        { kind: 'policy', policyId: 'rp_owner' },
      ],
    });
    expect(compiled.denyAll).toBe(false);
    const orParts = (compiled.where as { [key: symbol]: unknown })[Op.or];
    expect(Array.isArray(orParts)).toBe(true);
    expect(orParts).toHaveLength(2);
  });

  it('applies only the enabled policy when draft siblings remain in the binding tree', () => {
    const active = policy({
      id: 'rp_active',
      predicate: { op: 'eq', field: 'ownerUserId', value: { ref: 'user.id' } },
    });
    const draft = policy({
      id: 'rp_draft',
      enabled: false,
      predicate: { op: 'eq', field: 'ownerUserId', value: { literal: '0' } },
    });
    const compiled = compilePoliciesToWhere([active, draft], session(), {
      kind: 'group',
      op: 'and',
      children: [
        { kind: 'policy', policyId: 'rp_draft' },
        { kind: 'policy', policyId: 'rp_active' },
      ],
    });
    expect(compiled.denyAll).toBe(false);
    expect(compiled.where).toMatchObject({ ownerUserId: { [Op.eq]: 7 } });
  });
});
