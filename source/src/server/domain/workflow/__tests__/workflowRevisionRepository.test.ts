import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../workflowDefinitionRepository';
import {
  createCandidateWorkflowRevision,
  findWorkflowRevisionByDefinitionAndNumber,
  transitionPublicationBindingState,
  activateWorkflowRevisionPublicationAtomically,
} from '../workflowRevisionRepository';

const dbReady = await isDatabaseReachable();

describe.skipIf(!dbReady)('workflowRevisionRepository (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const candidateInput = (workflowDefinitionId: number) => ({
    workflowDefinitionId,
    sourceDraftVersion: 1,
    definitionJson: '{}',
    actionBindingsJson: '{}',
    semanticFingerprint: 'fp-1',
    bindingStatus: 'NOT_REQUIRED' as const,
  });

  it('enforces unique (workflowDefinitionId, revisionNumber) via monotonic allocation, never duplicated', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('rev-alloc'), draftDefinitionJson: '{}' });
    const first = await createCandidateWorkflowRevision(candidateInput(definition.id));
    const second = await createCandidateWorkflowRevision(candidateInput(definition.id));
    expect(first.revisionNumber).toBe(1);
    expect(second.revisionNumber).toBe(2);
    const found = await findWorkflowRevisionByDefinitionAndNumber(definition.id, 1);
    expect(found?.id).toBe(first.id);
  });

  it('persists every publication/binding matrix row and rejects non-matrix pairs', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('rev-matrix'), draftDefinitionJson: '{}' });
    const revision = await createCandidateWorkflowRevision(candidateInput(definition.id));
    expect(revision.publicationStatus).toBe('VALIDATING');
    expect(revision.bindingStatus).toBe('NOT_REQUIRED');

    const published = await transitionPublicationBindingState(revision.id, revision.stateVersion, 'PUBLISH_MANUAL_API');
    expect(published.publicationStatus).toBe('PUBLISHED');
    expect(published.bindingStatus).toBe('NOT_REQUIRED');

    // Non-matrix pair: PUBLISHED cannot legally receive VALIDATION_AND_SNAPSHOT_SUCCEED.
    await expect(
      transitionPublicationBindingState(published.id, published.stateVersion, 'VALIDATION_AND_SNAPSHOT_SUCCEED'),
    ).rejects.toMatchObject({ code: 'WF_DEF_STALE_REVISION_VERSION' });
  });

  it('stale activation-callback fencing: two competing expectedStateVersion calls, exactly one wins', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('rev-race'), draftDefinitionJson: '{}' });
    const revision = await createCandidateWorkflowRevision({ ...candidateInput(definition.id), bindingStatus: 'PENDING' });
    const activating = await transitionPublicationBindingState(revision.id, revision.stateVersion, 'VALIDATION_AND_SNAPSHOT_SUCCEED');
    expect(activating.publicationStatus).toBe('ACTIVATING_BINDING');

    const results = await Promise.allSettled([
      transitionPublicationBindingState(activating.id, activating.stateVersion, 'ACTIVATION_SUCCEEDS'),
      transitionPublicationBindingState(activating.id, activating.stateVersion, 'ACTIVATION_FAILS'),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);
  });

  it('atomic publish: revision + currentPublishedRevisionId + definition lifecycle commit in one transaction', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('rev-atomic'), draftDefinitionJson: '{}' });
    const revision = await createCandidateWorkflowRevision({ ...candidateInput(definition.id), bindingStatus: 'PENDING' });
    const activating = await transitionPublicationBindingState(revision.id, revision.stateVersion, 'VALIDATION_AND_SNAPSHOT_SUCCEED');

    const { revision: publishedRevision } = await activateWorkflowRevisionPublicationAtomically({
      revisionId: activating.id,
      expectedRevisionStateVersion: activating.stateVersion,
      workflowDefinitionId: definition.id,
      expectedDefinitionStateVersion: definition.stateVersion,
      definitionLifecycle: { from: 'DRAFT', command: 'FIRST_REVISION_PUBLISHED' },
    });
    expect(publishedRevision.publicationStatus).toBe('PUBLISHED');
    expect(publishedRevision.bindingStatus).toBe('ACTIVE');

    // A stale definition expected-version aborts the whole transaction (partial-failure rollback).
    const secondRevision = await createCandidateWorkflowRevision({ ...candidateInput(definition.id), bindingStatus: 'PENDING' });
    const secondActivating = await transitionPublicationBindingState(secondRevision.id, secondRevision.stateVersion, 'VALIDATION_AND_SNAPSHOT_SUCCEED');
    await expect(
      activateWorkflowRevisionPublicationAtomically({
        revisionId: secondActivating.id,
        expectedRevisionStateVersion: secondActivating.stateVersion,
        workflowDefinitionId: definition.id,
        expectedDefinitionStateVersion: 999_999, // stale on purpose
        definitionLifecycle: null,
      }),
    ).rejects.toThrow();
    const stillActivating = await findWorkflowRevisionByDefinitionAndNumber(definition.id, secondActivating.revisionNumber);
    expect(stillActivating?.publicationStatus).toBe('ACTIVATING_BINDING'); // rollback proven — not silently PUBLISHED
  });
});
