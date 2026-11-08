import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../../errors/HttpError';
import {
  AUTH_AUDIT_DISCARD_MESSAGE,
  DEFAULT_LOG_RETENTION,
  parseLogRetentionSettings,
  type LogRetentionSettings,
} from '../../../../shared/api/contracts/settings/retention';
import { emitRecordEvent } from '../../record-events/emitRecordEvent';
import { upsertRecordEventHold } from '../../record-events/recordEventJobs';
import {
  configureRecordEventSequelizeForTests,
  ensureRecordEventTables,
  getRecordEventModel,
  resetRecordEventModelCacheForTests,
} from '../../record-events/recordEventSequelizeModels';
import {
  configureUserMessageDispatchSequelizeForTests,
  ensureUserMessageDispatchTables,
  getUserMessageDispatchModel,
  resetUserMessageDispatchModelCacheForTests,
} from '../../user-message-dispatches/userMessageDispatchSequelizeModels';
import { createUserMessageDispatch } from '../../../services/notifications/userMessageDispatch.service';
import {
  ensureArchiveTables,
  ensureHotLogTablesForTests,
  getArchiveAppLogModel,
  getHotAppLogModel,
  getHotAuthAuditModel,
} from '../archiveSequelizeModels';
import { executeRetention } from '../retentionExecutor';

vi.mock('../../../services/data-api/edgeModelStore', () => ({
  listEdgeModels: () => [],
}));
vi.mock('../../../services/data-api/edgeModelStudioMetaStore', () => ({
  getEdgeModelStudioMeta: () => ({}),
}));

const offloadDb = (overrides: Partial<LogRetentionSettings> = {}): LogRetentionSettings => ({
  appLogs: {
    action: 'offload',
    olderThanDays: 1,
    offload: { mode: 'same-type-db' },
  },
  authAudit: {
    action: 'offload',
    followAppLogsAge: true,
    offload: { mode: 'same-type-db' },
  },
  recordEvents: {
    action: 'offload',
    olderThanDays: 1,
    offload: { mode: 'same-type-db' },
  },
  userMessageDispatches: {
    action: 'offload',
    olderThanDays: 1,
    offload: { mode: 'same-type-db' },
  },
  ...overrides,
});

let hot: Sequelize;
let dest: Sequelize;

beforeEach(async () => {
  resetRecordEventModelCacheForTests();
  resetUserMessageDispatchModelCacheForTests();
  hot = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  dest = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  configureRecordEventSequelizeForTests(hot);
  configureUserMessageDispatchSequelizeForTests(hot);
  await ensureRecordEventTables(hot);
  await ensureUserMessageDispatchTables(hot);
  await ensureHotLogTablesForTests(hot);
  await ensureArchiveTables(dest);
});

afterEach(async () => {
  configureRecordEventSequelizeForTests(null);
  configureUserMessageDispatchSequelizeForTests(null);
  resetRecordEventModelCacheForTests();
  resetUserMessageDispatchModelCacheForTests();
  await hot.close();
  await dest.close();
});

describe('parseLogRetentionSettings', () => {
  it('defaults File destination and 30 days', () => {
    const parsed = parseLogRetentionSettings(undefined, 30);
    expect(parsed.appLogs.action).toBe('offload');
    expect(parsed.appLogs.olderThanDays).toBe(30);
    expect(parsed.appLogs.offload?.mode).toBe('json-files');
    expect(parsed.authAudit.action).toBe('offload');
    expect(parsed.authAudit.followAppLogsAge).toBe(true);
    expect(parsed.recordEvents.olderThanDays).toBe(30);
    expect('ageSource' in parsed.recordEvents).toBe(false);
  });

  it('uses Settings days for record events and ignores stored follow-model', () => {
    const parsed = parseLogRetentionSettings({
      recordEvents: { action: 'offload', ageSource: 'follow-model' },
    });
    expect(parsed.recordEvents.olderThanDays).toBe(30);
    expect('ageSource' in parsed.recordEvents).toBe(false);
  });

  it('uses one shared age for every family', () => {
    const parsed = parseLogRetentionSettings({
      appLogs: { action: 'offload', olderThanDays: 90 },
      recordEvents: { action: 'offload', olderThanDays: 7 },
    });
    expect(parsed.appLogs.olderThanDays).toBe(90);
    expect(parsed.authAudit.olderThanDays).toBe(90);
    expect(parsed.recordEvents.olderThanDays).toBe(90);
    expect(parsed.userMessageDispatches.olderThanDays).toBe(90);
  });

  it('keeps auth audit on the same age as app logs', () => {
    const parsed = parseLogRetentionSettings({
      appLogs: { action: 'offload', olderThanDays: 90, offload: { mode: 'json-files' } },
      authAudit: { action: 'offload', followAppLogsAge: false, olderThanDays: 7 },
    });
    expect(parsed.authAudit.followAppLogsAge).toBe(true);
    expect(parsed.authAudit.olderThanDays).toBe(90);
  });

  it('coerces same-type-db without a connection to File', () => {
    const parsed = parseLogRetentionSettings({
      appLogs: { action: 'offload', offload: { mode: 'same-type-db' } },
    });
    expect(parsed.appLogs.offload?.mode).toBe('json-files');
    expect(parsed.appLogs.offload?.connectionId).toBeUndefined();
  });

  it('keeps a same-type-db destination when a connection is selected', () => {
    const parsed = parseLogRetentionSettings({
      appLogs: { action: 'offload', offload: { mode: 'same-type-db', connectionId: 'conn-1' } },
    });
    expect(parsed.appLogs.offload).toEqual({ mode: 'same-type-db', connectionId: 'conn-1' });
    expect(parsed.authAudit.offload).toEqual({ mode: 'same-type-db', connectionId: 'conn-1' });
    expect(parsed.recordEvents.offload).toEqual({ mode: 'same-type-db', connectionId: 'conn-1' });
    expect(parsed.userMessageDispatches.offload).toEqual({ mode: 'same-type-db', connectionId: 'conn-1' });
  });

  it('uses one shared destination for every family', () => {
    const parsed = parseLogRetentionSettings({
      appLogs: { action: 'offload', offload: { mode: 'json-files' } },
      authAudit: { action: 'offload', offload: { mode: 'same-type-db', connectionId: 'conn-1' } },
      recordEvents: { action: 'offload', offload: { mode: 'json-files' } },
    });
    expect(parsed.appLogs.offload).toEqual({ mode: 'same-type-db', connectionId: 'conn-1' });
    expect(parsed.authAudit.offload).toEqual({ mode: 'same-type-db', connectionId: 'conn-1' });
    expect(parsed.recordEvents.offload).toEqual({ mode: 'same-type-db', connectionId: 'conn-1' });
    expect(parsed.userMessageDispatches.offload).toEqual({ mode: 'same-type-db', connectionId: 'conn-1' });
  });

  it('coerces stored discard so retention always copies then deletes', () => {
    const parsed = parseLogRetentionSettings({
      appLogs: { action: 'discard' },
      authAudit: { action: 'discard' },
      recordEvents: { action: 'discard' },
    });
    expect(parsed.appLogs.action).toBe('offload');
    expect(parsed.authAudit.action).toBe('offload');
    expect(parsed.recordEvents.action).toBe('offload');
    expect(parsed.userMessageDispatches.action).toBe('offload');
  });
});

describe('retention executor', () => {
  it('offloads aged user message dispatches from hot', async () => {
    await createUserMessageDispatch({
      userId: 42,
      correlationId: 'corr-retention-1',
      eventType: 'agent_task',
      channel: 'IN_APP',
      deliveryStatus: 'sent',
      title: 'Hello',
      body: 'Body',
    });
    await getUserMessageDispatchModel(hot).update(
      { createdAt: new Date('2020-01-01T00:00:00.000Z') },
      { where: { userId: 42 } },
    );
    const result = await executeRetention({
      scope: 'recordEvents',
      dryRun: false,
      jobId: 11,
      deps: {
        hotSequelize: hot,
        archiveSequelize: dest,
        now: new Date('2026-01-01T00:00:00.000Z'),
        settings: offloadDb(),
      },
    });
    expect(result.families.userMessageDispatches?.deleted).toBe(1);
    expect(await getUserMessageDispatchModel(hot).count()).toBe(0);
  });

  it('skips held record events and leaves them in hot', async () => {
    await emitRecordEvent({
      subjectKind: 'orders',
      subjectId: '1',
      eventKind: 'created',
      source: 'patch',
      historyEnabled: true,
    });
    await getRecordEventModel(hot).update(
      { occurredAt: new Date('2020-01-01T00:00:00.000Z') },
      { where: { subjectId: '1' } },
    );
    await upsertRecordEventHold({ subjectKind: 'orders', subjectId: '1' });
    const result = await executeRetention({
      scope: 'recordEvents',
      dryRun: false,
      jobId: 9,
      deps: {
        hotSequelize: hot,
        archiveSequelize: dest,
        now: new Date('2026-01-01T00:00:00.000Z'),
        settings: offloadDb(),
      },
    });
    expect(result.families.recordEvents?.skippedHold).toBeGreaterThan(0);
    expect(result.families.recordEvents?.deleted).toBe(0);
    expect(await getRecordEventModel(hot).count()).toBe(1);
  });

  it('leaves hot logs untouched when copy fails', async () => {
    await getHotAppLogModel(hot).create({
      actor: 'SYSTEM',
      level: 'INFO',
      context: 'Test',
      message: 'old',
      messageSize: 3,
      hasMeta: 0,
      metaSize: 0,
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await expect(executeRetention({
      scope: 'logs',
      dryRun: false,
      jobId: 3,
      deps: {
        hotSequelize: hot,
        archiveSequelize: dest,
        now: new Date('2026-01-01T00:00:00.000Z'),
        settings: offloadDb(),
        failCopy: true,
      },
    })).rejects.toThrow(/Archive copy failed/);
    expect(await getHotAppLogModel(hot).count()).toBe(1);
    expect(await getArchiveAppLogModel(dest).count()).toBe(0);
  });

  it('does not delete hot app logs when the policy is not offload', async () => {
    await getHotAppLogModel(hot).create({
      actor: 'SYSTEM',
      level: 'INFO',
      context: 'Test',
      message: 'old',
      messageSize: 3,
      hasMeta: 0,
      metaSize: 0,
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await expect(executeRetention({
      scope: 'logs',
      dryRun: false,
      jobId: 4,
      deps: {
        hotSequelize: hot,
        archiveSequelize: dest,
        now: new Date('2026-01-01T00:00:00.000Z'),
        settings: offloadDb({
          appLogs: { action: 'discard', olderThanDays: 1 },
        }),
      },
    })).rejects.toThrow(/copy to the destination before deleting/);
    expect(await getHotAppLogModel(hot).count()).toBe(1);
    expect(await getArchiveAppLogModel(dest).count()).toBe(0);
  });

  it('rejects auth audit discard', async () => {
    await expect(executeRetention({
      scope: 'logs',
      dryRun: false,
      jobId: 1,
      deps: {
        hotSequelize: hot,
        archiveSequelize: dest,
        settings: offloadDb({
          authAudit: { action: 'discard', olderThanDays: 1 },
        }),
      },
    })).rejects.toBeInstanceOf(HttpError);
    try {
      await executeRetention({
        scope: 'logs',
        dryRun: true,
        jobId: 1,
        deps: {
          hotSequelize: hot,
          settings: offloadDb({
            authAudit: { action: 'discard', followAppLogsAge: true },
          }),
        },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).message).toBe(AUTH_AUDIT_DISCARD_MESSAGE);
    }
  });

  it('emits history.archived after event offload', async () => {
    await emitRecordEvent({
      subjectKind: 'orders',
      subjectId: '7',
      eventKind: 'created',
      source: 'patch',
      historyEnabled: true,
    });
    await getRecordEventModel(hot).update(
      { occurredAt: new Date('2020-01-01T00:00:00.000Z') },
      { where: { subjectId: '7' } },
    );
    await executeRetention({
      scope: 'recordEvents',
      dryRun: false,
      jobId: 4,
      deps: {
        hotSequelize: hot,
        archiveSequelize: dest,
        now: new Date('2026-01-01T00:00:00.000Z'),
        settings: offloadDb(),
      },
    });
    const remaining = await getRecordEventModel(hot).findAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].eventKind).toBe('history.archived');
    const payload = JSON.parse(String(remaining[0].payload));
    expect(payload.offloadMode).toBe('same-type-db');
    expect(payload.fromSeq).toBe(1);
  });

  it('copies app logs to the destination database', async () => {
    await getHotAppLogModel(hot).create({
      actor: 'SYSTEM',
      level: 'INFO',
      context: 'Test',
      message: 'old',
      messageSize: 3,
      hasMeta: 1,
      metaJson: '{"requestId":"req-archived-1"}',
      metaSize: 10,
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await executeRetention({
      scope: 'logs',
      dryRun: false,
      jobId: 8,
      deps: {
        hotSequelize: hot,
        archiveSequelize: dest,
        now: new Date('2026-01-01T00:00:00.000Z'),
        settings: offloadDb(),
      },
    });
    expect(await getHotAppLogModel(hot).count()).toBe(0);
    const archived = await getArchiveAppLogModel(dest).findAll();
    expect(archived).toHaveLength(1);
    expect(archived[0].metaJson).toContain('req-archived-1');
  });

  it('writes gzip JSONL and clears hot app logs', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'retention-json-'));
    mkdirSync(dir, { recursive: true });
    await getHotAppLogModel(hot).create({
      actor: 'SYSTEM',
      level: 'INFO',
      context: 'Test',
      message: 'old',
      messageSize: 3,
      hasMeta: 0,
      metaSize: 0,
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await getHotAuthAuditModel(hot).create({
      eventType: 'login',
      success: 1,
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    try {
      await executeRetention({
        scope: 'logs',
        dryRun: false,
        jobId: 11,
        deps: {
          hotSequelize: hot,
          jsonDirectory: dir,
          now: new Date('2026-01-01T00:00:00.000Z'),
          settings: {
            appLogs: { action: 'offload', olderThanDays: 1, offload: { mode: 'json-files' } },
            authAudit: { action: 'offload', followAppLogsAge: true, offload: { mode: 'json-files' } },
            recordEvents: DEFAULT_LOG_RETENTION.recordEvents,
          },
        },
      });
      expect(await getHotAppLogModel(hot).count()).toBe(0);
      const gz = readFileSync(path.join(dir, 'appLogs-11.jsonl.gz'));
      const body = gunzipSync(gz).toString('utf8');
      expect(body).toContain('"message":"old"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
