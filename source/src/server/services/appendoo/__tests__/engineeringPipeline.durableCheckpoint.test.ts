import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { closeSharedCheckpointDb } from '../../../../shared/lib/appendoo/changeGraphCheckpointSqliteBacking';
import { buildGeSfUi001ContextPack, GE_SF_UI_001_PROMPT } from '../../../../shared/lib/appendoo/goldenEvalServerFunctionUi';
import { serverFunctionsScope } from '../../ai/__tests__/e2eEngineeringPipeline.helpers';

describe('engineeringPipeline durable checkpoints', () => {
  let tmpDir = '';
  let origCwd = '';
  const envBackup: Record<string, string | undefined> = {};

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendoo-pipeline-cp-'));
    origCwd = process.cwd();
    envBackup.APPENDOO_DURABLE_GRAPH_CHECKPOINTS = process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS;
    envBackup.APPENDOO_CHECKPOINT_ROOT = process.env.APPENDOO_CHECKPOINT_ROOT;
    envBackup.APPENDOO_CHECKPOINT_BACKING = process.env.APPENDOO_CHECKPOINT_BACKING;
    process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS = '1';
    process.env.APPENDOO_CHECKPOINT_ROOT = path.join(tmpDir, 'checkpoints');
    delete process.env.APPENDOO_CHECKPOINT_BACKING;
    fs.mkdirSync(path.join(tmpDir, 'docs/ai'), { recursive: true });
    fs.copyFileSync(
      path.join(origCwd, 'docs/ai/feature-graph.json'),
      path.join(tmpDir, 'docs/ai/feature-graph.json'),
    );
    process.chdir(tmpDir);
    vi.resetModules();
  });

  afterEach(() => {
    closeSharedCheckpointDb();
    process.chdir(origCwd);
    process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS = envBackup.APPENDOO_DURABLE_GRAPH_CHECKPOINTS;
    process.env.APPENDOO_CHECKPOINT_ROOT = envBackup.APPENDOO_CHECKPOINT_ROOT;
    process.env.APPENDOO_CHECKPOINT_BACKING = envBackup.APPENDOO_CHECKPOINT_BACKING;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('persists checkpoints during executeApprovedBinding and reloads after process restart', async () => {
    const { probeChangeGraphCheckpointBacking } = await import('../../../../shared/lib/appendoo/changeGraphCheckpointBackingHealth');
    expect(probeChangeGraphCheckpointBacking().ok).toBe(true);

    const { engineeringPipelineService } = await import('../engineeringPipeline.service');
    const { semanticPlanApprovalService } = await import('../semanticPlanApproval.service');
    const { checkpointFilePath } = await import('../../../../shared/lib/appendoo/changeGraphCheckpointPersistence');

    engineeringPipelineService.resetForTests();

    // A generic prompt with no resolvable function target only reaches the AE-HARDEN
    // scaffold path, which is deliberately non-approvable (see semanticPlanBuilder.ts) —
    // route through the one implemented vertical slice (server-function UI planning) so
    // there is a real, approvable plan to exercise checkpoint persistence against. This
    // test only cares about checkpoint mechanics, not what kind of artifact was planned.
    const scaffold = engineeringPipelineService.runScaffold({
      applicationScope: serverFunctionsScope(),
      contextPack: buildGeSfUi001ContextPack(),
      userPrompt: GE_SF_UI_001_PROMPT,
      requiresApproval: true,
    });

    const changeGraphId = scaffold.changeGraph!.changeGraphId;
    const bindingId = scaffold.approvalBinding?.bindingId;
    expect(bindingId).toBeTruthy();

    semanticPlanApprovalService.approve(bindingId!, 'durable-checkpoint-test');
    const executed = engineeringPipelineService.executeApprovedBinding(bindingId!);

    expect(executed.checkpointId).toBeTruthy();
    expect(fs.existsSync(checkpointFilePath(changeGraphId))).toBe(true);

    const savedCheckpointId = executed.checkpointId;

    engineeringPipelineService.resetForTests();

    const { changeGraphCheckpointStore } = await import('../../../../shared/lib/appendoo/changeGraphCheckpointStore');
    const reloaded = changeGraphCheckpointStore.read(changeGraphId);
    expect(reloaded?.checkpointId).toBe(savedCheckpointId);
    expect(reloaded?.summary.verifiedCount).toBeGreaterThan(0);
  });
});
