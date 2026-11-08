import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  getChangeGraphCheckpointBackingHealth,
  probeChangeGraphCheckpointBacking,
} from '../changeGraphCheckpointBackingHealth';
import { closeSharedCheckpointDb } from '../changeGraphCheckpointSqliteBacking';

describe('changeGraphCheckpointBackingHealth', () => {
  const originalEnv = { ...process.env };
  let tmpDir = '';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendoo-cp-health-'));
    process.env.APPENDOO_CHECKPOINT_ROOT = path.join(tmpDir, 'checkpoints');
  });

  afterEach(() => {
    closeSharedCheckpointDb();
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('reports memory backing by default', () => {
    delete process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS;
    delete process.env.APPENDOO_CHECKPOINT_BACKING;
    const health = getChangeGraphCheckpointBackingHealth();
    expect(health.mode).toBe('memory');
    expect(health.durable).toBe(false);
  });

  it('reports disk backing when durable flag is on', () => {
    process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS = '1';
    const health = getChangeGraphCheckpointBackingHealth();
    expect(health.mode).toBe('disk');
    expect(health.durable).toBe(true);
    expect(health.fileRootExample).toBeTruthy();
  });

  it('probes memory backing save/read/clear cycle', () => {
    delete process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS;
    const probe = probeChangeGraphCheckpointBacking();
    expect(probe.ok).toBe(true);
  });

  it('probes disk backing save/read/clear cycle when durable flag enabled', async () => {
    process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS = '1';
    vi.resetModules();
    const { probeChangeGraphCheckpointBacking: probeDisk } = await import('../changeGraphCheckpointBackingHealth');
    const probe = probeDisk();
    expect(probe.ok).toBe(true);
  });
});
