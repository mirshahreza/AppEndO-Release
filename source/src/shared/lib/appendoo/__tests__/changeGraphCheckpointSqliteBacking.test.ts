import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createChangeGraphCheckpointBacking,
} from '../changeGraphCheckpointBackingStore';
import { buildChangeGraphCheckpoint } from '../changeGraphCheckpointStore';
import { resolveCheckpointDbPath, closeSharedCheckpointDb } from '../changeGraphCheckpointSqliteBacking';

describe('changeGraphCheckpointSqliteBacking', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendoo-cp-sqlite-'));
    process.env.APPENDOO_CHECKPOINT_DB_PATH = path.join(tmpDir, 'checkpoints.db');
    process.env.APPENDOO_CHECKPOINT_BACKING = 'sqlite';
    vi.resetModules();
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

  it('resolves sqlite mode from APPENDOO_CHECKPOINT_BACKING', async () => {
    const { resolveChangeGraphCheckpointBackingMode: resolveMode } = await import('../changeGraphCheckpointBackingStore');
    expect(resolveMode()).toBe('sqlite');
  });

  it('persists checkpoints to SQLite and reloads from a fresh backing instance', async () => {
    const { createChangeGraphCheckpointBacking: createBacking } = await import('../changeGraphCheckpointBackingStore');
    const backing = createBacking('sqlite');
    const checkpoint = buildChangeGraphCheckpoint({
      changeGraphId: 'cg:sqlite:1',
      changeSetId: 'cs:sqlite:1',
      nodes: [],
      results: [],
      summary: {
        readyCount: 0,
        builtCount: 0,
        verifiedCount: 0,
        failedCount: 0,
        retriedCount: 0,
        parallelPeakCount: 0,
      },
    });

    backing.save(checkpoint);
    expect(fs.existsSync(resolveCheckpointDbPath())).toBe(true);

    const freshBacking = createBacking('sqlite');
    const reloaded = freshBacking.read('cg:sqlite:1');
    expect(reloaded?.checkpointId).toBe(checkpoint.checkpointId);

    backing.resetForTests();
    freshBacking.resetForTests();
  });

  it('maps APPENDOO_DURABLE_GRAPH_CHECKPOINTS=db to sqlite mode', async () => {
    delete process.env.APPENDOO_CHECKPOINT_BACKING;
    process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS = 'db';
    vi.resetModules();
    const { resolveChangeGraphCheckpointBackingMode: resolveMode } = await import('../changeGraphCheckpointBackingStore');
    expect(resolveMode()).toBe('sqlite');
  });
});
