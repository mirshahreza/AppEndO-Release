import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildChangeGraphCheckpoint } from '../changeGraphCheckpointStore';
import {
  checkpointFilePath,
  loadCheckpointFromDisk,
  persistCheckpointToDisk,
} from '../changeGraphCheckpointPersistence';

describe('changeGraphCheckpointPersistence', () => {
  let tmpDir = '';
  let origCwd = '';
  let origEnv = '';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendoo-checkpoint-disk-'));
    origCwd = process.cwd();
    origEnv = process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS ?? '';
    process.chdir(tmpDir);
    process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS = '1';
    vi.resetModules();
  });

  afterEach(() => {
    process.chdir(origCwd);
    process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS = origEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('persists and reloads checkpoints from disk when durable flag enabled', async () => {
    const { changeGraphCheckpointStore } = await import('../changeGraphCheckpointStore');

    const checkpoint = buildChangeGraphCheckpoint({
      changeGraphId: 'cg:durable:1',
      changeSetId: 'cs-durable-1',
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

    changeGraphCheckpointStore.save(checkpoint);
    expect(fs.existsSync(checkpointFilePath('cg:durable:1'))).toBe(true);

    changeGraphCheckpointStore.resetForTests();
    const reloaded = changeGraphCheckpointStore.read('cg:durable:1');
    expect(reloaded?.checkpointId).toBe(checkpoint.checkpointId);
    expect(loadCheckpointFromDisk('cg:durable:1')?.changeSetId).toBe('cs-durable-1');
  });

  it('no-ops disk persistence when durable flag disabled', () => {
    process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS = '0';
    const checkpoint = buildChangeGraphCheckpoint({
      changeGraphId: 'cg:durable:off',
      changeSetId: 'cs-durable-off',
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

    persistCheckpointToDisk(checkpoint);
    expect(fs.existsSync(checkpointFilePath('cg:durable:off'))).toBe(false);
  });
});
