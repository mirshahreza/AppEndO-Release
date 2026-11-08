import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  isDatabaseReachable,
  bootstrapWorkflowE2eEnvironment,
  shutdownWorkflowE2eEnvironment,
  createTestWorkflowDefinition,
} from '../../../test/workflowE2eTestHarness';
import {
  findWorkflowDefinitionByScopeAndKey,
  updateWorkflowDefinitionDraft,
  transitionWorkflowDefinitionLifecycle,
} from '../workflowDefinitionRepository';

const dbReady = await isDatabaseReachable();

describe.skipIf(!dbReady)('workflowDefinitionRepository (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  it('rejects a duplicate (scopeKey, key) — unique constraint', async () => {
    const key = uniqueKey('dup');
    await createTestWorkflowDefinition({ key, draftDefinitionJson: '{}' });
    await expect(createTestWorkflowDefinition({ key, draftDefinitionJson: '{}' })).rejects.toThrow();
    const found = await findWorkflowDefinitionByScopeAndKey('global', key);
    expect(found).toBeDefined();
  });

  it('rejects a stale draftVersion update and accepts the correct one, incrementing exactly once', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('draft'), draftDefinitionJson: '{"v":1}' });
    await expect(
      updateWorkflowDefinitionDraft(definition.id, definition.draftVersion + 1, { draftDefinitionJson: '{"v":2}' }),
    ).rejects.toMatchObject({ code: 'WF_DEF_STALE_DRAFT_VERSION' });

    const updated = await updateWorkflowDefinitionDraft(definition.id, definition.draftVersion, { draftDefinitionJson: '{"v":2}' });
    expect(updated.draftVersion).toBe(definition.draftVersion + 1);
    expect(updated.draftDefinitionJson).toBe('{"v":2}');
  });

  it('persists every lifecycle row from doc 03 section 2, and ARCHIVED is terminal', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('lifecycle'), draftDefinitionJson: '{}' });
    expect(definition.lifecycleStatus).toBe('DRAFT');

    const active = await transitionWorkflowDefinitionLifecycle(definition.id, definition.stateVersion, 'FIRST_REVISION_PUBLISHED');
    expect(active.lifecycleStatus).toBe('ACTIVE');

    const disabled = await transitionWorkflowDefinitionLifecycle(active.id, active.stateVersion, 'DISABLE');
    expect(disabled.lifecycleStatus).toBe('DISABLED');

    const reenabled = await transitionWorkflowDefinitionLifecycle(disabled.id, disabled.stateVersion, 'RE_ENABLE');
    expect(reenabled.lifecycleStatus).toBe('ACTIVE');

    const archived = await transitionWorkflowDefinitionLifecycle(reenabled.id, reenabled.stateVersion, 'ARCHIVE');
    expect(archived.lifecycleStatus).toBe('ARCHIVED');

    await expect(
      transitionWorkflowDefinitionLifecycle(archived.id, archived.stateVersion, 'RE_ENABLE'),
    ).rejects.toMatchObject({ code: 'WF_DEF_NOT_STARTABLE' });
  });

  it('publish-while-DISABLED does not silently re-enable (no command models this — DISABLED only accepts RE_ENABLE/ARCHIVE)', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('disabled-publish'), draftDefinitionJson: '{}' });
    const active = await transitionWorkflowDefinitionLifecycle(definition.id, definition.stateVersion, 'FIRST_REVISION_PUBLISHED');
    const disabled = await transitionWorkflowDefinitionLifecycle(active.id, active.stateVersion, 'DISABLE');
    await expect(
      transitionWorkflowDefinitionLifecycle(disabled.id, disabled.stateVersion, 'FIRST_REVISION_PUBLISHED'),
    ).rejects.toMatchObject({ code: 'WF_DEF_NOT_STARTABLE' });
  });
});
