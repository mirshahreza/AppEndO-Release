import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition, getWorkflowDefinitionById } from '../../workflowDefinitionRepository';
import {
  publishWorkflowDefinition,
  retryBindingActivation,
  reconcileBinding,
  getWorkflowRevision,
  listWorkflowRevisions,
  disableWorkflowDefinition,
  archiveWorkflowDefinition,
  reEnableWorkflowDefinition,
} from '../workflowPublicationService';
import { baseModel, endNode } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createTestWorkflowDefinition = (input: { key: string; draftDefinitionJson: string }) =>
  createWorkflowDefinition({
    scopeKey: 'global',
    creationMode: 'NEW',
    ...input,
  });

const manualApiModel = () => baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });
const eventModel = () =>
  baseModel({ nodes: [endNode('end-1')], start: { type: 'EVENT', targetNodeKey: 'end-1', eventName: 'some.event' } });
const invalidModel = () =>
  baseModel({
    nodes: [endNode('end-1')],
    edges: [{ key: 'e1', fromNodeKey: 'ghost', toNodeKey: 'end-1', selector: { type: 'UNCONDITIONAL' } }],
    start: { type: 'MANUAL_API', targetNodeKey: 'end-1' },
  });

describe.skipIf(!dbReady)('workflowPublicationService (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  describe('Publish — MANUAL_API (NOT_REQUIRED binding, no adapter involved)', () => {
    it('publishes directly to PUBLISHED and atomically activates the definition (DRAFT -> ACTIVE)', async () => {
      const definition = await createTestWorkflowDefinition({ key: uniqueKey('pub-manual'), draftDefinitionJson: JSON.stringify(manualApiModel()) });
      const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);

      expect(revision.publicationStatus).toBe('PUBLISHED');
      expect(revision.bindingStatus).toBe('NOT_REQUIRED');
      expect(revision.revisionNumber).toBe(1);

      const reloadedDefinition = await getWorkflowDefinitionById(definition.id);
      expect(reloadedDefinition!.currentPublishedRevisionId).toBe(revision.id);
      expect(reloadedDefinition!.lifecycleStatus).toBe('ACTIVE');
    });

    it('rejects a stale expectedDraftVersion', async () => {
      const definition = await createTestWorkflowDefinition({ key: uniqueKey('pub-stale'), draftDefinitionJson: JSON.stringify(manualApiModel()) });
      await expect(publishWorkflowDefinition(definition.id, definition.draftVersion + 1)).rejects.toMatchObject({ code: 'WF_DEF_STALE_DRAFT_VERSION' });
    });

    it('rejects publishing an ARCHIVED definition', async () => {
      const definition = await createTestWorkflowDefinition({ key: uniqueKey('pub-archived'), draftDefinitionJson: JSON.stringify(manualApiModel()) });
      await archiveWorkflowDefinition(definition.id, definition.stateVersion);
      const reloaded = await getWorkflowDefinitionById(definition.id);
      await expect(publishWorkflowDefinition(definition.id, reloaded!.draftVersion)).rejects.toMatchObject({ code: 'WF_DEF_NOT_STARTABLE' });
    });

    it('rejects an invalid draft — revision is REJECTED, no definition activation side effect', async () => {
      const definition = await createTestWorkflowDefinition({ key: uniqueKey('pub-invalid'), draftDefinitionJson: JSON.stringify(invalidModel()) });
      const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
      expect(revision.publicationStatus).toBe('REJECTED');

      const reloaded = await getWorkflowDefinitionById(definition.id);
      expect(reloaded!.currentPublishedRevisionId).toBeNull();
      expect(reloaded!.lifecycleStatus).toBe('DRAFT');
    });

    it('lists and fetches revisions through the read helpers', async () => {
      const definition = await createTestWorkflowDefinition({ key: uniqueKey('pub-list'), draftDefinitionJson: JSON.stringify(manualApiModel()) });
      const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
      const fetched = await getWorkflowRevision(revision.id);
      expect(fetched?.id).toBe(revision.id);
      const list = await listWorkflowRevisions(definition.id);
      expect(list.map((r) => r.id)).toContain(revision.id);
    });
  });

  describe('Publish — EVENT (canonical subscriber list is ACTIVE EVENT-start revisions)', () => {
    it('publishes to PUBLISHED and activates the definition when eventName is authored', async () => {
      const definition = await createTestWorkflowDefinition({ key: uniqueKey('pub-event'), draftDefinitionJson: JSON.stringify(eventModel()) });
      const { revision, bindingActivation } = await publishWorkflowDefinition(definition.id, definition.draftVersion);

      expect(bindingActivation).toMatchObject({ ok: true });
      expect(revision.publicationStatus).toBe('PUBLISHED');
      expect(revision.bindingStatus).toBe('ACTIVE');

      const reloaded = await getWorkflowDefinitionById(definition.id);
      expect(reloaded!.currentPublishedRevisionId).toBe(revision.id);
      expect(reloaded!.lifecycleStatus).toBe('ACTIVE');
    });

    it('retryBindingActivation is illegal once the EVENT revision is already PUBLISHED', async () => {
      const definition = await createTestWorkflowDefinition({ key: uniqueKey('pub-event-retry'), draftDefinitionJson: JSON.stringify(eventModel()) });
      const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
      expect(revision.publicationStatus).toBe('PUBLISHED');

      await expect(retryBindingActivation(revision.id, revision.stateVersion)).rejects.toMatchObject({ code: 'WF_DEF_STALE_REVISION_VERSION' });
    });

    it('retryBindingActivation rejects a revision that is not currently ACTIVATING_BINDING', async () => {
      const definition = await createTestWorkflowDefinition({ key: uniqueKey('pub-manual-retry'), draftDefinitionJson: JSON.stringify(manualApiModel()) });
      const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion); // MANUAL_API -> straight to PUBLISHED
      await expect(retryBindingActivation(revision.id, revision.stateVersion)).rejects.toMatchObject({ code: 'WF_DEF_STALE_REVISION_VERSION' });
    });
  });

  describe('reconcileBinding', () => {
    it('rejects a revision that is not PUBLISHED/INACTIVE', async () => {
      const definition = await createTestWorkflowDefinition({ key: uniqueKey('reconcile-bad-state'), draftDefinitionJson: JSON.stringify(manualApiModel()) });
      const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion); // PUBLISHED/NOT_REQUIRED, not INACTIVE
      await expect(reconcileBinding(revision.id, revision.stateVersion)).rejects.toMatchObject({ code: 'WF_DEF_STALE_REVISION_VERSION' });
    });
  });

  describe('Disable / Archive / Re-enable (MANUAL_API — NOT_REQUIRED binding bypasses the adapter side effect entirely)', () => {
    it('disables an ACTIVE definition and re-enables it back to ACTIVE', async () => {
      const definition = await createTestWorkflowDefinition({ key: uniqueKey('lifecycle-disable'), draftDefinitionJson: JSON.stringify(manualApiModel()) });
      await publishWorkflowDefinition(definition.id, definition.draftVersion);
      const active = await getWorkflowDefinitionById(definition.id);
      expect(active!.lifecycleStatus).toBe('ACTIVE');

      const disabled = await disableWorkflowDefinition(definition.id, active!.stateVersion);
      expect(disabled.lifecycleStatus).toBe('DISABLED');

      const reEnabled = await reEnableWorkflowDefinition(definition.id, disabled.stateVersion);
      expect(reEnabled.lifecycleStatus).toBe('ACTIVE');
    });

    it('archives a DRAFT definition directly (no published revision required)', async () => {
      const definition = await createTestWorkflowDefinition({ key: uniqueKey('lifecycle-archive-draft'), draftDefinitionJson: JSON.stringify(manualApiModel()) });
      const archived = await archiveWorkflowDefinition(definition.id, definition.stateVersion);
      expect(archived.lifecycleStatus).toBe('ARCHIVED');
    });

    it('archives an ACTIVE definition, leaving its NOT_REQUIRED-bound revision publication state untouched', async () => {
      const definition = await createTestWorkflowDefinition({ key: uniqueKey('lifecycle-archive-active'), draftDefinitionJson: JSON.stringify(manualApiModel()) });
      const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
      const active = await getWorkflowDefinitionById(definition.id);

      const archived = await archiveWorkflowDefinition(definition.id, active!.stateVersion);
      expect(archived.lifecycleStatus).toBe('ARCHIVED');

      const revisionAfter = await getWorkflowRevision(revision.id);
      expect(revisionAfter?.publicationStatus).toBe('PUBLISHED');
      expect(revisionAfter?.bindingStatus).toBe('NOT_REQUIRED');
    });

    it('rejects re-enabling a definition with no published revision (cannot start)', async () => {
      const definition = await createTestWorkflowDefinition({ key: uniqueKey('lifecycle-reenable-none'), draftDefinitionJson: JSON.stringify(manualApiModel()) });
      // DRAFT has no published revision; disabling isn't legal from DRAFT either, so drive it to DISABLED via ARCHIVE would be wrong —
      // instead directly assert RE_ENABLE's precondition failure using the definition's current (DRAFT) state.
      await expect(reEnableWorkflowDefinition(definition.id, definition.stateVersion)).rejects.toMatchObject({ code: 'WF_DEF_NOT_STARTABLE' });
    });
  });
});
