import { Op } from 'sequelize';
import { describe, expect, it } from 'vitest';
import type { RecordPolicyDocument, RecordPolicyPredicateNode } from '../../../../shared/api/contracts/record-policy';
import { validateRecordPolicyPredicate } from '../../../../shared/api/contracts/record-policy';
import { compilePoliciesToWhere } from '../policyCompiler';
import type { SessionScopeSnapshot } from '../sessionScope.service';

const sessionBase: SessionScopeSnapshot = {
  userId: 3,
  email: 'fuzz@example.com',
  roles: ['STAFF'],
  isAdmin: false,
  serverContext: {
    'user.id': 3,
    'user.gender': 'F',
    'sys.roles': ['STAFF'],
    'scope.org': ['o1', 'o2'],
    'scope.geo': [],
  },
  userAttrs: { gender: 'F' },
  scope: {
    org: { ids: ['o1', 'o2'], mode: 'subtree' },
    geo: { ids: [], mode: 'subtree' },
  },
  scopeHash: 'fuzz',
};

const fields = ['orgUnitId', 'regionId', 'gender', 'ownerUserId'] as const;

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = <T,>(rand: () => number, items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;

const randomLeaf = (rand: () => number): RecordPolicyPredicateNode => {
  const kind = Math.floor(rand() * 5);
  switch (kind) {
    case 0:
      return { op: 'eq', field: 'gender', value: { ref: 'user.gender' } };
    case 1:
      return { op: 'eq', field: 'ownerUserId', value: { ref: 'user.id' } };
    case 2:
      return { op: 'inSubtree', field: 'orgUnitId', value: { ref: 'scope.org' } };
    case 3:
      return { op: 'inSubtree', field: 'regionId', value: { ref: 'scope.geo' } };
    default:
      return { op: 'eq', field: pick(rand, fields), value: { literal: pick(rand, ['a', 'b', 1, true] as const) } };
  }
};

const randomPredicate = (rand: () => number, depth = 0): RecordPolicyPredicateNode => {
  if (depth >= 2 || rand() < 0.55) {
    return randomLeaf(rand);
  }
  const count = 1 + Math.floor(rand() * 3);
  const args = Array.from({ length: count }, () => randomPredicate(rand, depth + 1));
  return { op: rand() < 0.5 ? 'and' : 'or', args };
};

describe('policyCompiler property fuzz (RPE-11-5)', () => {
  it('valid random predicates compile without throw and stay objects', () => {
    const rand = mulberry32(20260812);
    for (let i = 0; i < 80; i += 1) {
      const predicate = randomPredicate(rand);
      const validated = validateRecordPolicyPredicate({
        predicate,
        allowedFields: fields,
        allowedUserAttrKeys: ['gender', 'id'],
      });
      expect(validated.ok).toBe(true);
      if (!validated.ok) {
        continue;
      }

      const policy: RecordPolicyDocument = {
        id: `rp_fuzz_${i}`,
        edgeModelId: 'em_fuzz',
        name: `fuzz ${i}`,
        effect: 'allow',
        principals: { roles: [], users: [] },
        predicate: validated.predicate,
        enabled: true,
        version: 1,
      };

      const compiled = compilePoliciesToWhere([policy], sessionBase);
      expect(compiled.denyAll).toBe(false);
      expect(compiled.where).toBeTruthy();
      expect(typeof compiled.where).toBe('object');
      const asRecord = compiled.where as Record<string | symbol, unknown>;
      expect(Op.and in asRecord || Object.keys(asRecord).length > 0 || Object.getOwnPropertySymbols(asRecord).length > 0).toBe(true);
    }
  });
});
