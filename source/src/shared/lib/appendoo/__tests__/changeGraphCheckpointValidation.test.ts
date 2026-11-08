import { describe, expect, it } from 'vitest';
import { buildChangeGraphCheckpoint } from '../changeGraphCheckpointStore';
import {
  parseChangeGraphCheckpoint,
  validateChangeGraphCheckpoint,
} from '../changeGraphCheckpointValidation';

describe('changeGraphCheckpointValidation', () => {
  it('parses and validates checkpoint payloads', () => {
    const checkpoint = buildChangeGraphCheckpoint({
      changeGraphId: 'cg:validate:1',
      changeSetId: 'cs:validate:1',
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

    const parsed = parseChangeGraphCheckpoint(JSON.parse(JSON.stringify(checkpoint)));
    expect(parsed?.checkpointId).toBe(checkpoint.checkpointId);
    expect(validateChangeGraphCheckpoint(checkpoint).ok).toBe(true);
  });

  it('rejects malformed checkpoint payloads', () => {
    expect(parseChangeGraphCheckpoint({ checkpointId: 'x' })).toBeUndefined();
  });
});
