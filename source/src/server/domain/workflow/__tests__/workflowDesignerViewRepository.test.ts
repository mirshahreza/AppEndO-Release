import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { prisma } from '../prismaHelpers';
import { createCandidateWorkflowRevision } from '../workflowRevisionRepository';
import { upsertDraftView, createRevisionSnapshotView, getViewByDraftIdentity, getViewByRevisionIdentity } from '../workflowDesignerViewRepository';

const dbReady = await isDatabaseReachable();

describe.skipIf(!dbReady)('workflowDesignerViewRepository (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  it('repository-level XOR rejection: both-bound and neither-bound inputs throw before any Prisma call', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('view-xor'), draftDefinitionJson: '{}' });
    await expect(
      upsertDraftView({ workflowDefinitionId: definition.id, workflowRevisionId: 1, draftVersion: 1, viewJson: '{}' } as never),
    ).rejects.toMatchObject({ code: 'WF_DEF_INVALID_REFERENCE' });
  });

  it('draft view identity is (workflowDefinitionId, draftVersion) — upsert replaces the single draft-bound row', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('view-draft'), draftDefinitionJson: '{}' });
    const first = await upsertDraftView({ workflowDefinitionId: definition.id, draftVersion: 1, viewSchemaVersion: 1, viewJson: '{"nodes":[]}' });
    const second = await upsertDraftView({ workflowDefinitionId: definition.id, draftVersion: 1, viewSchemaVersion: 1, viewJson: '{"nodes":["a"]}' });
    expect(second.id).toBe(first.id);
    const found = await getViewByDraftIdentity(definition.id, 1);
    expect(found?.viewJson).toBe('{"nodes":["a"]}');
  });

  it('a published revision-snapshot view is bound to exactly one workflowRevisionId and is read-only (no draft mutation authority exposed)', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('view-revision'), draftDefinitionJson: '{}' });
    const revision = await createCandidateWorkflowRevision({
      workflowDefinitionId: definition.id,
      sourceDraftVersion: 1,
      definitionJson: '{}',
      actionBindingsJson: '{}',
      semanticFingerprint: 'fp',
      bindingStatus: 'NOT_REQUIRED',
    });
    const view = await createRevisionSnapshotView({
      workflowDefinitionId: definition.id,
      workflowRevisionId: revision.id,
      viewSchemaVersion: 1,
      viewJson: '{}',
    });
    expect(view.workflowRevisionId).toBe(revision.id);
    const found = await getViewByRevisionIdentity(revision.id);
    expect(found?.id).toBe(view.id);
  });

  it('a direct-Prisma bypass with a duplicate sentinel identity key still fails on the DB unique index (belt-and-suspenders)', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('view-bypass'), draftDefinitionJson: '{}' });
    const sharedKey = `bypass-${Date.now()}`;
    await prisma().workflowDesignerView.create({
      data: {
        workflowDefinitionId: BigInt(definition.id),
        draftVersion: 1,
        viewJson: '{}',
        draftIdentityKey: sharedKey,
        revisionIdentityKey: `revision-bound:${sharedKey}-a`,
      },
    });
    await expect(
      prisma().workflowDesignerView.create({
        data: {
          workflowDefinitionId: BigInt(definition.id),
          draftVersion: 2,
          viewJson: '{}',
          draftIdentityKey: sharedKey,
          revisionIdentityKey: `revision-bound:${sharedKey}-b`,
        },
      }),
    ).rejects.toThrow();
  });
});
