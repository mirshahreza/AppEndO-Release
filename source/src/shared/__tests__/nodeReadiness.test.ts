import { describe, expect, it } from 'vitest';
import { buildNodeReadinessResponse } from '../nodeReadiness';

describe('buildNodeReadinessResponse', () => {
  it('marks all active capabilities ready when database and worker queue are healthy', () => {
    const report = buildNodeReadinessResponse({
      nodeName: 'node-1',
      capabilities: ['service', 'platform', 'worker'],
      databaseReady: true,
      redisStatus: 'skipped',
      workerQueueReady: true,
    });

    expect(report).toEqual({
      status: 'ready',
      nodeName: 'node-1',
      capabilities: ['service', 'platform', 'worker'],
      checks: {
        database: 'ready',
        redis: 'skipped',
        workerQueue: 'ready',
      },
      capabilityReadiness: {
        service: 'ready',
        platform: 'ready',
        worker: 'ready',
      },
    });
  });

  it('fails worker capability when queue table is unavailable', () => {
    const report = buildNodeReadinessResponse({
      nodeName: 'worker-1',
      capabilities: ['worker'],
      databaseReady: true,
      redisStatus: 'skipped',
      workerQueueReady: false,
    });

    expect(report.status).toBe('not_ready');
    expect(report.capabilityReadiness).toEqual({ worker: 'not_ready' });
    expect(report.checks.workerQueue).toBe('not_ready');
  });

  it('skips worker queue check when worker capability is off', () => {
    const report = buildNodeReadinessResponse({
      nodeName: 'service-1',
      capabilities: ['service'],
      databaseReady: true,
      redisStatus: 'ready',
      workerQueueReady: false,
    });

    expect(report.status).toBe('ready');
    expect(report.capabilityReadiness).toEqual({ service: 'ready' });
    expect(report.checks.workerQueue).toBe('skipped');
  });

  it('fails every active capability when database is down', () => {
    const report = buildNodeReadinessResponse({
      nodeName: 'service-1',
      capabilities: ['service', 'platform'],
      databaseReady: false,
      redisStatus: 'not_ready',
      workerQueueReady: false,
    });

    expect(report.status).toBe('not_ready');
    expect(report.capabilityReadiness).toEqual({
      service: 'not_ready',
      platform: 'not_ready',
    });
    expect(report.checks.database).toBe('not_ready');
  });
});
