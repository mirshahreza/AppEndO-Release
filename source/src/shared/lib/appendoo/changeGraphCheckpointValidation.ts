import type { ChangeGraphCheckpoint } from '../../api/contracts/appendoo/changeGraphCheckpoint.types';

/** AE-7.9 — validate checkpoint payload before resume/reload. */
export const parseChangeGraphCheckpoint = (raw: unknown): ChangeGraphCheckpoint | undefined => {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const input = raw as Partial<ChangeGraphCheckpoint>;
  if (
    typeof input.checkpointId !== 'string'
    || typeof input.changeGraphId !== 'string'
    || typeof input.changeSetId !== 'string'
    || typeof input.savedAt !== 'string'
    || !Array.isArray(input.nodes)
    || !Array.isArray(input.results)
    || !input.summary
    || typeof input.summary !== 'object'
  ) {
    return undefined;
  }

  return {
    checkpointId: input.checkpointId,
    changeGraphId: input.changeGraphId,
    changeSetId: input.changeSetId,
    nodes: input.nodes,
    results: input.results,
    summary: input.summary as ChangeGraphCheckpoint['summary'],
    savedAt: input.savedAt,
  };
};

export const validateChangeGraphCheckpoint = (
  checkpoint: ChangeGraphCheckpoint,
): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!checkpoint.checkpointId.trim()) {
    errors.push('checkpointId is required.');
  }
  if (!checkpoint.changeGraphId.trim()) {
    errors.push('changeGraphId is required.');
  }
  if (!checkpoint.changeSetId.trim()) {
    errors.push('changeSetId is required.');
  }
  if (!checkpoint.savedAt.trim()) {
    errors.push('savedAt is required.');
  }
  if (checkpoint.nodes.length === 0 && checkpoint.results.length > 0) {
    errors.push('Checkpoint has results but no nodes.');
  }

  return { ok: errors.length === 0, errors };
};
