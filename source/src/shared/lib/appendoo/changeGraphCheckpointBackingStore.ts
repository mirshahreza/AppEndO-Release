import type { ChangeGraphCheckpoint } from '../../api/contracts/appendoo/changeGraphCheckpoint.types';
import {
  clearCheckpointFromDisk,
  isDurableGraphCheckpointEnabled,
  loadCheckpointFromDisk,
  persistCheckpointToDisk,
} from './changeGraphCheckpointPersistence';
import { SqliteChangeGraphCheckpointBacking } from './changeGraphCheckpointSqliteBacking';

/** AE-7.7/7.8 — checkpoint persistence backing modes. */
export type ChangeGraphCheckpointBackingMode = 'memory' | 'disk' | 'sqlite';

export interface ChangeGraphCheckpointBacking {
  save(checkpoint: ChangeGraphCheckpoint): ChangeGraphCheckpoint;
  read(changeGraphId: string): ChangeGraphCheckpoint | undefined;
  clear(changeGraphId: string): void;
  resetForTests(): void;
}

export class MemoryChangeGraphCheckpointBacking implements ChangeGraphCheckpointBacking {
  private checkpoints = new Map<string, ChangeGraphCheckpoint>();

  save(checkpoint: ChangeGraphCheckpoint): ChangeGraphCheckpoint {
    this.checkpoints.set(checkpoint.changeGraphId, checkpoint);
    return checkpoint;
  }

  read(changeGraphId: string): ChangeGraphCheckpoint | undefined {
    return this.checkpoints.get(changeGraphId);
  }

  clear(changeGraphId: string): void {
    this.checkpoints.delete(changeGraphId);
  }

  resetForTests(): void {
    this.checkpoints.clear();
  }
}

/** Disk-backed store with in-memory L1 cache (APPENDOO_DURABLE_GRAPH_CHECKPOINTS=1). */
export class DiskChangeGraphCheckpointBacking implements ChangeGraphCheckpointBacking {
  private memory = new MemoryChangeGraphCheckpointBacking();

  save(checkpoint: ChangeGraphCheckpoint): ChangeGraphCheckpoint {
    this.memory.save(checkpoint);
    persistCheckpointToDisk(checkpoint);
    return checkpoint;
  }

  read(changeGraphId: string): ChangeGraphCheckpoint | undefined {
    return this.memory.read(changeGraphId) ?? loadCheckpointFromDisk(changeGraphId);
  }

  clear(changeGraphId: string): void {
    this.memory.clear(changeGraphId);
    clearCheckpointFromDisk(changeGraphId);
  }

  resetForTests(): void {
    this.memory.resetForTests();
  }
}

export const resolveChangeGraphCheckpointBackingMode = (): ChangeGraphCheckpointBackingMode => {
  const explicit = process.env.APPENDOO_CHECKPOINT_BACKING?.trim().toLowerCase();
  if (explicit === 'sqlite' || explicit === 'db') {
    return 'sqlite';
  }
  if (explicit === 'disk' || explicit === 'file') {
    return 'disk';
  }
  if (explicit === 'memory') {
    return 'memory';
  }
  if (process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS === 'db') {
    return 'sqlite';
  }
  return isDurableGraphCheckpointEnabled() ? 'disk' : 'memory';
};

export const createChangeGraphCheckpointBacking = (
  mode: ChangeGraphCheckpointBackingMode = resolveChangeGraphCheckpointBackingMode(),
): ChangeGraphCheckpointBacking => {
  switch (mode) {
    case 'sqlite':
      return new SqliteChangeGraphCheckpointBacking();
    case 'disk':
      return new DiskChangeGraphCheckpointBacking();
    default:
      return new MemoryChangeGraphCheckpointBacking();
  }
};
