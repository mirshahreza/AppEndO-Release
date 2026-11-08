import crypto from 'node:crypto';
import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpError } from '../../../errors/HttpError';
import {
  CREDENTIAL_KEY_VERSION_ENV,
  CREDENTIAL_MASTER_KEY_ENV,
  resetCredentialMasterKeyCacheForTests,
} from '../../security/credentialVault/credentialCrypto';
import { collectClientContext, stripReservedClientKeys } from '../../client-context/collectClientContext';
import { assertChangeReason, parseChangeReason } from '../changeReason';
import { emitRecordEvent } from '../emitRecordEvent';
import { listRecordEvents } from '../queryRecordEvents';
import { emitSampleMockSnapshotDiff } from '../sampleMockHistory';
import { hashRecordEventRow, RECORD_EVENT_GENESIS_HASH, verifyRecordEventRowHash } from '../recordEventHash';
import { upsertRecordEventHold, hasRecordEventHold, clearHotRecordEvents } from '../recordEventJobs';
import { RECORD_EVENT_REDACT_PREFIX } from '../recordEventRedact';
import {
  configureRecordEventSequelizeForTests,
  ensureRecordEventTables,
  getRecordEventModel,
  resetRecordEventModelCacheForTests,
} from '../recordEventSequelizeModels';

const originalMaster = process.env[CREDENTIAL_MASTER_KEY_ENV];
const originalVersion = process.env[CREDENTIAL_KEY_VERSION_ENV];

let sequelize: Sequelize;

const restoreEnv = (): void => {
  if (originalMaster === undefined) delete process.env[CREDENTIAL_MASTER_KEY_ENV];
  else process.env[CREDENTIAL_MASTER_KEY_ENV] = originalMaster;
  if (originalVersion === undefined) delete process.env[CREDENTIAL_KEY_VERSION_ENV];
  else process.env[CREDENTIAL_KEY_VERSION_ENV] = originalVersion;
  resetCredentialMasterKeyCacheForTests();
};

beforeEach(async () => {
  restoreEnv();
  process.env[CREDENTIAL_MASTER_KEY_ENV] = crypto.randomBytes(32).toString('hex');
  process.env[CREDENTIAL_KEY_VERSION_ENV] = '1';
  resetCredentialMasterKeyCacheForTests();
  resetRecordEventModelCacheForTests();
  sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  configureRecordEventSequelizeForTests(sequelize);
  await ensureRecordEventTables(sequelize);
});

afterEach(async () => {
  configureRecordEventSequelizeForTests(null);
  resetRecordEventModelCacheForTests();
  await sequelize.close();
  restoreEnv();
});

describe('record event hash', () => {
  it('chains SHA-256 from a 64-zero genesis hash', () => {
    const first = hashRecordEventRow({
      subjectKind: 'base_users',
      subjectId: '1',
      subjectSeq: 1,
      occurredAt: '2026-01-01T00:00:00.000Z',
      actorUserId: 9,
      actingAsUserId: null,
      actorKind: 'user',
      outcome: 'success',
      eventKind: 'field.changed',
      field: 'email',
      fromValue: '{"value":"a"}',
      toValue: '{"value":"b"}',
      correlationId: 'corr-1',
      prevHash: RECORD_EVENT_GENESIS_HASH,
    });
    expect(first).toHaveLength(64);
    expect(verifyRecordEventRowHash({
      subjectKind: 'base_users',
      subjectId: '1',
      subjectSeq: 1,
      occurredAt: '2026-01-01T00:00:00.000Z',
      actorUserId: 9,
      actingAsUserId: null,
      actorKind: 'user',
      outcome: 'success',
      eventKind: 'field.changed',
      field: 'email',
      fromValue: '{"value":"a"}',
      toValue: '{"value":"b"}',
      correlationId: 'corr-1',
      prevHash: RECORD_EVENT_GENESIS_HASH,
    }, first)).toBe(true);
    expect(verifyRecordEventRowHash({
      subjectKind: 'base_users',
      subjectId: '1',
      subjectSeq: 1,
      occurredAt: '2026-01-01T00:00:00.000Z',
      actorUserId: 9,
      actingAsUserId: null,
      actorKind: 'user',
      outcome: 'success',
      eventKind: 'field.changed',
      field: 'email',
      fromValue: '{"value":"a"}',
      toValue: '{"value":"tampered"}',
      correlationId: 'corr-1',
      prevHash: RECORD_EVENT_GENESIS_HASH,
    }, first)).toBe(false);
  });
});

describe('emitRecordEvent', () => {
  it('assigns subject_seq and links prev_hash', async () => {
    const first = await emitRecordEvent({
      subjectKind: 'base_users',
      subjectId: '42',
      eventKind: 'created',
      source: 'patch',
      historyEnabled: true,
      inProcess: true,
    });
    const second = await emitRecordEvent({
      subjectKind: 'base_users',
      subjectId: '42',
      eventKind: 'field.changed',
      source: 'patch',
      field: 'email',
      fromValue: { value: 'a@b.com' },
      toValue: { value: 'c@d.com' },
      historyEnabled: true,
      inProcess: true,
    });
    expect(first?.subjectSeq).toBe(1);
    expect(first?.prevHash).toBe(RECORD_EVENT_GENESIS_HASH);
    expect(second?.subjectSeq).toBe(2);
    expect(second?.prevHash).toBe(first?.rowHash);
  });

  it('is idempotent on the same idempotency key', async () => {
    const first = await emitRecordEvent({
      subjectKind: 'base_users',
      subjectId: '7',
      eventKind: 'field.changed',
      source: 'workflow',
      field: 'locked',
      idempotencyKey: 'wf:retry:locked',
      historyEnabled: true,
      inProcess: true,
    });
    const second = await emitRecordEvent({
      subjectKind: 'base_users',
      subjectId: '7',
      eventKind: 'field.changed',
      source: 'workflow',
      field: 'locked',
      idempotencyKey: 'wf:retry:locked',
      historyEnabled: true,
      inProcess: true,
    });
    expect(second?.id).toBe(first?.id);
    expect(await getRecordEventModel().count()).toBe(1);
  });

  it('encrypts redacted from/to with enc:v1:', async () => {
    const row = await emitRecordEvent({
      subjectKind: 'base_users',
      subjectId: '8',
      eventKind: 'field.changed',
      source: 'patch',
      field: 'email',
      fromValue: { value: 'secret@example.com' },
      toValue: { value: 'next@example.com' },
      redact: true,
      historyEnabled: true,
      inProcess: true,
    });
    expect(row?.fromValue?.startsWith(RECORD_EVENT_REDACT_PREFIX)).toBe(true);
    expect(row?.toValue?.startsWith(RECORD_EVENT_REDACT_PREFIX)).toBe(true);
    expect(row?.fromValue).not.toContain('secret@example.com');
  });
});

describe('latest-per-field projection', () => {
  it('returns one successful row per field and skips denied', async () => {
    await emitRecordEvent({
      subjectKind: 'base_sample_mock_records',
      subjectId: '11',
      eventKind: 'created',
      source: 'patch',
      historyEnabled: true,
      inProcess: true,
    });
    await emitRecordEvent({
      subjectKind: 'base_sample_mock_records',
      subjectId: '11',
      eventKind: 'field.changed',
      source: 'patch',
      field: 'title',
      fromValue: { value: 'A' },
      toValue: { value: 'B' },
      historyEnabled: true,
      inProcess: true,
    });
    await emitRecordEvent({
      subjectKind: 'base_sample_mock_records',
      subjectId: '11',
      eventKind: 'field.changed',
      source: 'patch',
      field: 'title',
      fromValue: { value: 'B' },
      toValue: { value: 'C' },
      historyEnabled: true,
      inProcess: true,
    });
    await emitRecordEvent({
      subjectKind: 'base_sample_mock_records',
      subjectId: '11',
      eventKind: 'field.changed',
      source: 'patch',
      field: 'locked',
      fromValue: { value: false },
      toValue: { value: true },
      historyEnabled: true,
      inProcess: true,
    });
    await emitRecordEvent({
      subjectKind: 'base_sample_mock_records',
      subjectId: '11',
      eventKind: 'access.denied',
      source: 'patch',
      field: 'title',
      outcome: 'denied',
      historyEnabled: true,
      inProcess: true,
    });
    const listed = await listRecordEvents({
      subjectKind: 'base_sample_mock_records',
      subjectId: '11',
      projection: 'latest-per-field',
    });
    expect(listed.items.map((item) => `${item.field}:${item.outcome}`).sort()).toEqual([
      'locked:success',
      'title:success',
    ]);
    const title = listed.items.find((item) => item.field === 'title');
    expect((title?.toValue as { value?: unknown } | null)?.value).toBe('C');
  });
});

describe('listRecordEvents subjectKinds', () => {
  it('filters by CSV kinds and intersects with subjectKind', async () => {
    await emitRecordEvent({
      subjectKind: 'base_users',
      subjectId: '1',
      eventKind: 'created',
      source: 'patch',
      historyEnabled: true,
      inProcess: true,
    });
    await emitRecordEvent({
      subjectKind: 'base_roles',
      subjectId: '2',
      eventKind: 'created',
      source: 'patch',
      historyEnabled: true,
      inProcess: true,
    });
    const listed = await listRecordEvents({ subjectKinds: 'base_users,base_roles', limit: 50 });
    expect(listed.items.map((item) => item.subjectKind).sort()).toEqual(['base_roles', 'base_users']);
    const usersOnly = await listRecordEvents({ subjectKinds: 'base_users', limit: 50 });
    expect(usersOnly.items.every((item) => item.subjectKind === 'base_users')).toBe(true);
    const empty = await listRecordEvents({
      subjectKind: 'base_roles',
      subjectKinds: 'base_users',
      limit: 50,
    });
    expect(empty.items).toEqual([]);
    expect(empty.totalCount).toBe(0);
  });
});

describe('listRecordEvents user field aliases', () => {
  it('resolves Users form field names to stored profile fields', async () => {
    await emitRecordEvent({
      subjectKind: 'base_users',
      subjectId: '44',
      eventKind: 'field.changed',
      source: 'patch',
      field: 'profile.firstname',
      fromValue: { value: 'Ada' },
      toValue: { value: 'Ada Lovelace' },
      historyEnabled: true,
      inProcess: true,
    });
    const listed = await listRecordEvents({
      subjectKind: 'base_users',
      subjectId: '44',
      field: 'firstName',
      limit: 50,
    });
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.field).toBe('profile.firstname');
  });
});

describe('listRecordEvents party labels', () => {
  it('attaches catalog reason titles at read time', async () => {
    await emitRecordEvent({
      subjectKind: 'base_users',
      subjectId: '44',
      eventKind: 'field.changed',
      source: 'patch',
      field: 'profile.lastname',
      fromValue: { value: 'A' },
      toValue: { value: 'B' },
      reasonCode: '100.6.1',
      reasonText: 'Fixed spelling',
      historyEnabled: true,
      inProcess: true,
    });
    const listed = await listRecordEvents({
      subjectKind: 'base_users',
      subjectId: '44',
      limit: 50,
    });
    expect(listed.items[0]?.reasonCode).toBe('100.6.1');
    expect(listed.items[0]?.reasonLabel).toBe('Correction');
    expect(listed.items[0]?.reasonText).toBe('Fixed spelling');
  });

  it('attaches actor username and display name at read time', async () => {
    await sequelize.query(`
      CREATE TABLE base_users (
        id INTEGER PRIMARY KEY,
        username TEXT
      )
    `);
    await sequelize.query(`
      CREATE TABLE base_user_profiles (
        user_id INTEGER PRIMARY KEY,
        firstname TEXT,
        lastname TEXT,
        company_name TEXT,
        person_type_code TEXT
      )
    `);
    await sequelize.query(
      `INSERT INTO base_users (id, username) VALUES (100000, 'admin')`,
    );
    await sequelize.query(
      `INSERT INTO base_user_profiles (user_id, firstname, lastname)
       VALUES (100000, 'Mohsen', 'Admin')`,
    );
    await emitRecordEvent({
      subjectKind: 'base_users',
      subjectId: '44',
      eventKind: 'field.changed',
      source: 'patch',
      field: 'profile.lastname',
      fromValue: { value: 'A' },
      toValue: { value: 'B' },
      actorKind: 'user',
      actorUserId: 100000,
      historyEnabled: true,
      inProcess: true,
    });
    const listed = await listRecordEvents({
      subjectKind: 'base_users',
      subjectId: '44',
      limit: 50,
    });
    expect(listed.items[0]?.actorUserId).toBe(100000);
    expect(listed.items[0]?.actorUsername).toBe('admin');
    expect(listed.items[0]?.actorDisplayName).toBe('Mohsen Admin');
  });
});

describe('change reason', () => {
  it('returns 400 when a required reason is missing', async () => {
    await expect(assertChangeReason({
      policy: { reasonAsk: 'required', reasonCapture: 'both' },
      reason: { code: null, text: null },
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a code outside the allowed set', async () => {
    await expect(assertChangeReason({
      policy: { reasonAsk: 'optional', reasonCapture: 'both' },
      reason: { code: '999', text: 'nope' },
      allowedCodes: new Set(['100.6.1']),
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('accepts a code in the allowed set', async () => {
    await expect(assertChangeReason({
      policy: { reasonAsk: 'optional', reasonCapture: 'both' },
      reason: { code: '100.6.1', text: 'ok' },
      allowedCodes: new Set(['100.6.1']),
    })).resolves.toBeUndefined();
  });

  it('always allows Restore Reverted even when Include general is off', async () => {
    await expect(assertChangeReason({
      policy: { reasonAsk: 'optional', reasonCapture: 'both', reasonIncludeGeneral: false },
      reason: { code: '100.6.8', text: 'Restored previous value' },
      allowedCodes: new Set(['100.6.6']),
    })).resolves.toBeUndefined();
  });

  it('prefers headers over body', () => {
    const reason = parseChangeReason({
      headers: {
        'x-appendo-change-reason-code': '100.6.1',
        'x-appendo-change-reason-text': 'header',
      },
      body: {
        __changeReasonCode: '100.6.2',
        __changeReasonText: 'body',
      },
    });
    expect(reason).toEqual({ code: '100.6.1', text: 'header' });
  });
});

describe('client context collector', () => {
  it('strips reserved body keys before domain write', () => {
    expect(stripReservedClientKeys({
      email: 'a@b.com',
      __client: { channel: 'web' },
      __changeReasonCode: '100.6.1',
      __changeReasonText: 'fix',
    })).toEqual({ email: 'a@b.com' });
  });

  it('discards claimed IP and uses req.ip', () => {
    const collected = collectClientContext({
      req: {
        ip: '10.0.0.8',
        headers: {
          'x-appendo-client': JSON.stringify({ claimed: { ip: '1.2.3.4', channel: 'web', installId: 'inst-1' } }),
        },
        body: {},
        httpVersion: '1.1',
        requestId: 'req-1',
      },
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      fields: [
        { id: 'ip', mode: 'record' },
        { id: 'channel', mode: 'record' },
        { id: 'installId', mode: 'record' },
      ],
      isWrite: true,
    });
    expect(collected.claimed.ip).toBeUndefined();
    expect(collected.observed.ip).toBe('10.0.0.8');
    expect(collected.clientIp).toBe('10.0.0.8');
    expect(collected.claimed.channel).toBe('web');
    expect(collected.clientInstallId).toBe('inst-1');
  });

  it('does not require claimed fields on GET', () => {
    expect(() => collectClientContext({
      req: { ip: '10.0.0.1', headers: {}, body: {}, httpVersion: '1.1' },
      occurredAt: new Date(),
      fields: [{ id: 'installId', mode: 'require' }],
      isWrite: false,
    })).not.toThrow();
  });

  it('returns 400 when a required claimed field is missing on write', () => {
    expect(() => collectClientContext({
      req: { ip: '10.0.0.1', headers: {}, body: {}, httpVersion: '1.1' },
      occurredAt: new Date(),
      fields: [{ id: 'installId', mode: 'require' }],
      isWrite: true,
    })).toThrow(HttpError);
  });

  it('records clock skew without rejecting the write', () => {
    const collected = collectClientContext({
      req: {
        ip: '10.0.0.1',
        headers: {
          'x-appendo-client': JSON.stringify({
            claimed: { clientOccurredAt: '2026-01-01T00:20:00.000Z', channel: 'web' },
          }),
        },
        body: {},
        httpVersion: '1.1',
      },
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      fields: [
        { id: 'clientOccurredAt', mode: 'record' },
        { id: 'channel', mode: 'record' },
      ],
      isWrite: true,
    });
    expect(collected.clockSkewMinutes).toBeGreaterThan(5);
    expect(collected.observed.clockSkewMinutes).toBeGreaterThan(5);
  });
});

describe('record event holds', () => {
  it('upserts a subject hold', async () => {
    expect(await hasRecordEventHold('base_users', '9')).toBe(false);
    await upsertRecordEventHold({ subjectKind: 'base_users', subjectId: '9', reasonText: 'legal' });
    expect(await hasRecordEventHold('base_users', '9')).toBe(true);
  });
});

describe('clearHotRecordEvents', () => {
  it('deletes hot rows and skips held subjects', async () => {
    await emitRecordEvent({
      subjectKind: 'base_users',
      subjectId: '1',
      eventKind: 'created',
      source: 'patch',
      historyEnabled: true,
      inProcess: true,
    });
    await emitRecordEvent({
      subjectKind: 'base_users',
      subjectId: '2',
      eventKind: 'created',
      source: 'patch',
      historyEnabled: true,
      inProcess: true,
    });
    await upsertRecordEventHold({ subjectKind: 'base_users', subjectId: '2', reasonText: 'legal' });
    const result = await clearHotRecordEvents();
    expect(result.deleted).toBe(1);
    expect(result.skipped).toBe(1);
    const remaining = await getRecordEventModel().findAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.subjectId).toBe('2');
  });
});

describe('sample-mock history', () => {
  it('emits status, lock, and tag events from a snapshot diff', async () => {
    await emitSampleMockSnapshotDiff(
      {
        id: '11',
        code: 'ORD-001',
        title: 'New order',
        statusId: '1',
        statusLabel: 'Open',
        ownerId: null,
        parentId: null,
        locked: false,
        city: null,
        tags: [],
      },
      {
        id: '11',
        code: 'ORD-001',
        title: 'Order 1',
        statusId: '2',
        statusLabel: 'Approved',
        ownerId: null,
        parentId: null,
        locked: true,
        city: null,
        tags: [{ id: '9', label: 'Urgent' }],
      },
      { inProcess: true },
    );
    const rows = await getRecordEventModel().findAll({ order: [['id', 'ASC']] });
    expect(rows.map((row) => `${row.eventKind}:${row.field ?? ''}`)).toEqual([
      'field.changed:title',
      'status.changed:status_id',
      'field.changed:locked',
      'association.added:tags',
    ]);
  });
});
