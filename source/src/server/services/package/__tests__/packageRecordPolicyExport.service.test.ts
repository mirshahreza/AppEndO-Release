import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Op } from 'sequelize';
import { compilePoliciesToWhere } from '../../record-policy/policyCompiler';
import { DENY_ALL_WHERE } from '../../record-policy/whereMerge';
import type { SessionScopeSnapshot } from '../../record-policy/sessionScope.service';
import type { RecordPolicyDocument } from '../../../../shared/api/contracts/record-policy';

const sessionFor = (orgIds: string[]): SessionScopeSnapshot => ({
  userId: 10,
  email: 'u@example.com',
  roles: ['STAFF'],
  isAdmin: false,
  serverContext: {
    'user.id': 10,
    'sys.roles': ['STAFF'],
    'scope.org': orgIds,
    'scope.geo': [],
  },
  userAttrs: {},
  scope: {
    org: { ids: orgIds, mode: 'subtree' },
    geo: { ids: [], mode: 'subtree' },
  },
  scopeHash: `o-${orgIds.join(',')}`,
});

const orgPolicy = (): RecordPolicyDocument => ({
  id: 'rp_org',
  edgeModelId: 'em_customer',
  name: 'Org isolation',
  effect: 'allow',
  principals: { roles: [], users: [] },
  predicate: {
    op: 'inSubtree',
    field: 'orgUnitId',
    value: { ref: 'scope.org' },
  },
  enabled: true,
  version: 1,
});

describe('record policy cross-org isolation', () => {
  it('compiles distinct wheres for two org memberships and deny-all when empty membership', () => {
    const policy = orgPolicy();
    const a = compilePoliciesToWhere([policy], sessionFor(['120.001']));
    const b = compilePoliciesToWhere([policy], sessionFor(['120.002']));
    const empty = compilePoliciesToWhere([policy], sessionFor([]));

    expect(a.denyAll).toBe(false);
    expect(b.denyAll).toBe(false);
    expect(a.where).toMatchObject({ orgUnitId: { [Op.in]: ['120.001'] } });
    expect(b.where).toMatchObject({ orgUnitId: { [Op.in]: ['120.002'] } });
    expect(empty.where).toEqual(DENY_ALL_WHERE);
  });
});

describe('packageRecordPolicyExport.service', () => {
  let tmpDir = '';
  let origCwd = '';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-rpe-export-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('exports bindings and policies for selected models (not memberships or dimensions)', async () => {
    const { saveRecordPolicyBinding } = await import('../../record-policy/recordPolicyBindingStore');
    const { saveRecordPolicy } = await import('../../record-policy/recordPolicyStore');
    const { buildPackageRecordPolicyExportEntries } = await import('../packageRecordPolicyExport.service');

    saveRecordPolicyBinding({
      edgeModelId: 'em_customer',
      recordScope: 'on',
      forceScopeForAdmin: false,
      bindings: [{ field: 'orgUnitId', dimensionKey: 'org' }],
      allowedUserAttrKeys: [],
    });
    saveRecordPolicy(orgPolicy());

    const result = buildPackageRecordPolicyExportEntries({ edgeModelIds: ['em_customer'] });
    expect(result.capabilities.scope_dimensions).toEqual([]);
    expect(result.capabilities.record_policy_bindings.map((item) => item.edgeModelId)).toEqual(['em_customer']);
    expect(result.capabilities.record_policies.map((item) => item.id)).toEqual(['rp_org']);
    expect(result.zipEntries.some((entry) => entry.path.includes('membership'))).toBe(false);
    expect(result.zipEntries.some((entry) => entry.path.includes('dimensions/'))).toBe(false);
  });
});
