import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createChangeGraphCheckpointBacking,
  MemoryChangeGraphCheckpointBacking,
  resolveChangeGraphCheckpointBackingMode,
} from '../changeGraphCheckpointBackingStore';
import { buildChangeGraphCheckpoint } from '../changeGraphCheckpointStore';
import { checkpointFilePath } from '../changeGraphCheckpointPersistence';

describe('changeGraphCheckpointBackingStore', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendoo-cp-back-'));
    process.env.APPENDOO_CHECKPOINT_ROOT = path.join(tmpDir, 'checkpoints');
  });

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('defaults to memory backing when durable flag is off', () => {
    delete process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS;
    expect(resolveChangeGraphCheckpointBackingMode()).toBe('memory');
  });

  it('uses disk backing when durable flag is on', () => {
    process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS = '1';
    expect(resolveChangeGraphCheckpointBackingMode()).toBe('disk');
  });

  it('memory backing persists checkpoints in-process only', () => {
    const backing = new MemoryChangeGraphCheckpointBacking();
    const checkpoint = buildChangeGraphCheckpoint({
      changeGraphId: 'cg:backing:memory',
      changeSetId: 'cs:backing:1',
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
    expect(backing.read('cg:backing:memory')?.checkpointId).toBe(checkpoint.checkpointId);
    backing.clear('cg:backing:memory');
    expect(backing.read('cg:backing:memory')).toBeUndefined();
  });

  it('disk backing writes JSON checkpoint files when durable flag is on', () => {
    process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS = '1';
    const backing = createChangeGraphCheckpointBacking('disk');
    const checkpoint = buildChangeGraphCheckpoint({
      changeGraphId: 'cg:backing:disk',
      changeSetId: 'cs:backing:2',
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
    expect(fs.existsSync(checkpointFilePath('cg:backing:disk'))).toBe(true);
    expect(backing.read('cg:backing:disk')?.checkpointId).toBe(checkpoint.checkpointId);
  });
});
