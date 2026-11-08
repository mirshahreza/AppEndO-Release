import { describe, expect, it, beforeEach } from 'vitest';
import { buildArtifactRef } from '../../../api/contracts/appendoo/artifactRef.types';
import {
  enqueueIntelligenceIndexJob,
  getIntelligenceIndexJobKindCount,
  reindexArtifact,
  rebuildApplication,
  resetIntelligenceIndexCoordinatorForTests,
} from '../intelligenceIndexCoordinator';

describe('intelligenceIndexCoordinator', () => {
  beforeEach(() => {
    resetIntelligenceIndexCoordinatorForTests();
  });

  it('deduplicates jobs by idempotency key', () => {
    const first = enqueueIntelligenceIndexJob({
      kind: 'rebuild_application',
      applicationScopeRef: 'platform:studio',
      idempotencyKey: 'rebuild:platform:studio',
    });
    const second = enqueueIntelligenceIndexJob({
      kind: 'rebuild_application',
      applicationScopeRef: 'platform:studio',
      idempotencyKey: 'rebuild:platform:studio',
    });

    expect(second.jobId).toBe(first.jobId);
  });

  it('completes reindex artifact jobs and increments coordinator activity', () => {
    const artifactRef = buildArtifactRef({
      applicationScopeRef: 'platform:studio',
      artifactType: 'page',
      canonicalName: 'users',
    });

    const job = reindexArtifact({
      applicationScopeRef: 'platform:studio',
      artifactRef,
      idempotencyKey: 'artifact:users',
    });

    expect(job.status).toBe('completed');
    expect(getIntelligenceIndexJobKindCount('reindex_artifact')).toBe(1);
  });

  it('completes rebuild application jobs', () => {
    const job = rebuildApplication({
      applicationScopeRef: 'platform:studio',
      idempotencyKey: 'rebuild:studio',
    });

    expect(job.status).toBe('completed');
    expect(job.completedAt).toBeDefined();
  });
});
