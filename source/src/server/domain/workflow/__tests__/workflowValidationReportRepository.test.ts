import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../workflowDefinitionRepository';
import { createCandidateWorkflowRevision } from '../workflowRevisionRepository';
import * as workflowValidationReportRepository from '../workflowValidationReportRepository';
import { createValidationReport, findValidationReportsByDefinitionDraftVersion, findValidationReportsByRevisionId } from '../workflowValidationReportRepository';

const dbReady = await isDatabaseReachable();

describe('workflowValidationReportRepository — immutability by construction', () => {
  it('exports no update/patch function (module reflection)', () => {
    const exportedNames = Object.keys(workflowValidationReportRepository);
    const mutators = exportedNames.filter((name) => /^(update|patch|set|transition)/i.test(name));
    expect(mutators).toEqual([]);
  });
});

describe.skipIf(!dbReady)('workflowValidationReportRepository (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  it('source/version binding lookup returns the exact report for (definitionId, draftVersion) and revisionId', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('validation'), draftDefinitionJson: '{}' });
    const draftReport = await createValidationReport({
      workflowDefinitionId: definition.id,
      draftVersion: definition.draftVersion,
      status: 'PASSED',
      validatorVersion: 'workflow.validator/v1',
      issuesJson: '[]',
    });
    const byDraft = await findValidationReportsByDefinitionDraftVersion(definition.id, definition.draftVersion);
    expect(byDraft.map((r) => r.id)).toContain(draftReport.id);

    const revision = await createCandidateWorkflowRevision({
      workflowDefinitionId: definition.id,
      sourceDraftVersion: definition.draftVersion,
      definitionJson: '{}',
      actionBindingsJson: '{}',
      semanticFingerprint: 'fp',
      bindingStatus: 'NOT_REQUIRED',
    });
    const revisionReport = await createValidationReport({
      workflowDefinitionId: definition.id,
      revisionId: revision.id,
      draftVersion: definition.draftVersion,
      status: 'PASSED',
      validatorVersion: 'workflow.validator/v1',
      issuesJson: '[]',
    });
    const byRevision = await findValidationReportsByRevisionId(revision.id);
    expect(byRevision.map((r) => r.id)).toEqual([revisionReport.id]);
  });
});
