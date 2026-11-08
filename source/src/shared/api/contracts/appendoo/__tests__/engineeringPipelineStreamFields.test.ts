import { describe, expect, it } from 'vitest';
import {
  mapChangeGraphDriftToStreamFields,
  mapBuilderOrchestrationErrorsToStreamFields,
} from '../engineeringPipeline.types';

describe('engineeringPipeline stream field mappers', () => {
  it('maps change graph drift to stream fields', () => {
    const fields = mapChangeGraphDriftToStreamFields({
      ok: false,
      staleNodeIds: ['node:1', 'node:2'],
      failures: ['Capability snapshot drift detected for 2 node(s).'],
    });

    expect(fields.changeGraphDriftOk).toBe(false);
    expect(fields.changeGraphDriftStaleCount).toBe(2);
    expect(fields.builderOrchestrationErrorCount).toBe(1);
  });

  it('maps builder orchestration errors to stream fields', () => {
    const fields = mapBuilderOrchestrationErrorsToStreamFields([
      'node:fn: Preview phase failed.',
    ]);

    expect(fields.builderOrchestrationErrorCount).toBe(1);
    expect(fields.builderOrchestrationErrors?.[0]).toContain('Preview');
  });
});
