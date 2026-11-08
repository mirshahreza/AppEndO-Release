import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { allocateNextAttemptNumber, allocateNextRevisionNumber } from '../monotonicAllocation';
import { createWorkflowDefinition } from '../workflowDefinitionRepository';
import { createWorkflowInstance } from '../workflowInstanceRepository';
import { createCandidateWorkflowRevision } from '../workflowRevisionRepository';
import { materializeNodeInstances } from '../workflowNodeInstanceRepository';

describe('monotonicAllocation — static source check (doc 03 section 13 forbids MAX()+1)', () => {
  it('no repository/allocation file computes a counter via MAX(...)/aggregate max', () => {
    const dir = path.join(__dirname, '..');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.includes('__tests__'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(content, `${file} must not use MAX(...) for allocation`).not.toMatch(/\bMAX\s*\(/i);
      expect(content, `${file} must not use Prisma aggregate _max for allocation`).not.toMatch(/_max\s*:/);
    }
  });
});

const dbReady = await isDatabaseReachable();

describe.skipIf(!dbReady)('monotonicAllocation — concurrency (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('allocateNextRevisionNumber yields N distinct, contiguous, gap-free integers under concurrent callers', async () => {
    const definition = await createTestWorkflowDefinition({
      key: `alloc-rev-${Date.now()}`,
      draftDefinitionJson: '{}',
    });
    const concurrency = 10;
    const results = await Promise.all(
      Array.from({ length: concurrency }, () => allocateNextRevisionNumber(definition.id)),
    );
    const sorted = [...results].sort((a, b) => a - b);
    expect(new Set(results).size).toBe(concurrency);
    expect(sorted).toEqual(Array.from({ length: concurrency }, (_, i) => i + 1));
  });

  it('allocateNextAttemptNumber yields N distinct, contiguous, gap-free integers under concurrent callers', async () => {
    const definition = await createTestWorkflowDefinition({ key: `alloc-attempt-${Date.now()}`, draftDefinitionJson: '{}' });
    const revision = await createCandidateWorkflowRevision({
      workflowDefinitionId: definition.id,
      sourceDraftVersion: 1,
      definitionJson: '{}',
      actionBindingsJson: '{}',
      semanticFingerprint: 'fp',
      bindingStatus: 'NOT_REQUIRED',
    });
    const instance = await createWorkflowInstance({ workflowRevisionId: revision.id, startedByType: 'SYSTEM' });
    const [node] = await materializeNodeInstances(instance.id, ['start']);

    const concurrency = 10;
    const results = await Promise.all(Array.from({ length: concurrency }, () => allocateNextAttemptNumber(node.id)));
    const sorted = [...results].sort((a, b) => a - b);
    expect(new Set(results).size).toBe(concurrency);
    expect(sorted).toEqual(Array.from({ length: concurrency }, (_, i) => i + 1));
  });
});
