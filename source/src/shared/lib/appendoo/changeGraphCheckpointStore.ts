import type { ChangeGraphCheckpoint } from '../../api/contracts/appendoo/changeGraphCheckpoint.types';
import {
  createChangeGraphCheckpointBacking,
  type ChangeGraphCheckpointBacking,
} from './changeGraphCheckpointBackingStore';

/** In-memory Change Graph checkpoint store for resume/restart (Phase 14). */
export class ChangeGraphCheckpointStore {
  constructor(private readonly backing: ChangeGraphCheckpointBacking = createChangeGraphCheckpointBacking()) {}

  save(checkpoint: ChangeGraphCheckpoint): ChangeGraphCheckpoint {
    return this.backing.save(checkpoint);
  }

  read(changeGraphId: string): ChangeGraphCheckpoint | undefined {
    return this.backing.read(changeGraphId);
  }

  clear(changeGraphId: string): void {
    this.backing.clear(changeGraphId);
  }

  resetForTests(): void {
    this.backing.resetForTests();
  }
}

export const changeGraphCheckpointStore = new ChangeGraphCheckpointStore();

export const buildChangeGraphCheckpoint = (input: {
  changeGraphId: string;
  changeSetId: string;
  nodes: ChangeGraphCheckpoint['nodes'];
  results: ChangeGraphCheckpoint['results'];
  summary: ChangeGraphCheckpoint['summary'];
}): ChangeGraphCheckpoint => ({
  checkpointId: `${input.changeGraphId}:${Date.now()}`,
  changeGraphId: input.changeGraphId,
  changeSetId: input.changeSetId,
  nodes: input.nodes,
  results: input.results,
  summary: input.summary,
  savedAt: new Date().toISOString(),
});
