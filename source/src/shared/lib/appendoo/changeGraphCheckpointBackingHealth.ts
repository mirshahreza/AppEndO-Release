import {
  createChangeGraphCheckpointBacking,
  resolveChangeGraphCheckpointBackingMode,
  type ChangeGraphCheckpointBackingMode,
} from './changeGraphCheckpointBackingStore';
import { resolveCheckpointDbPath } from './changeGraphCheckpointSqliteBacking';
import { checkpointFilePath } from './changeGraphCheckpointPersistence';

export type ChangeGraphCheckpointBackingHealth = {
  mode: ChangeGraphCheckpointBackingMode;
  durable: boolean;
  dbPath?: string;
  fileRootExample?: string;
};

/** AE-7.9 — report active checkpoint backing configuration. */
export const getChangeGraphCheckpointBackingHealth = (): ChangeGraphCheckpointBackingHealth => {
  const mode = resolveChangeGraphCheckpointBackingMode();

  return {
    mode,
    durable: mode !== 'memory',
    dbPath: mode === 'sqlite' ? resolveCheckpointDbPath() : undefined,
    fileRootExample: mode === 'disk' ? checkpointFilePath('cg:example') : undefined,
  };
};

/** Smoke-check that the configured backing can save/read/clear. */
export const probeChangeGraphCheckpointBacking = (): { ok: boolean; error?: string } => {
  try {
    const backing = createChangeGraphCheckpointBacking();
    const probeId = `cg:probe:${Date.now()}`;
    const checkpoint = {
      checkpointId: `${probeId}:probe`,
      changeGraphId: probeId,
      changeSetId: 'cs:probe',
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
      savedAt: new Date().toISOString(),
    };

    backing.save(checkpoint);
    const read = backing.read(probeId);
    backing.clear(probeId);

    if (!read || read.checkpointId !== checkpoint.checkpointId) {
      return { ok: false, error: 'Probe checkpoint read mismatch.' };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Checkpoint backing probe failed.',
    };
  }
};
