import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('engineeringPipeline live activation', () => {
  let tmpDir = '';
  let origCwd = '';
  const envBackup: Record<string, string | undefined> = {};

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendoo-pipeline-live-'));
    origCwd = process.cwd();
    envBackup.APPENDOO_LIVE_RUNTIME_ACTIVATION = process.env.APPENDOO_LIVE_RUNTIME_ACTIVATION;
    envBackup.APPENDOO_LIVE_DESIGNER_PUBLISH = process.env.APPENDOO_LIVE_DESIGNER_PUBLISH;
    envBackup.APPENDOO_DISABLE_LIVE_PIPELINE = process.env.APPENDOO_DISABLE_LIVE_PIPELINE;
    delete process.env.APPENDOO_LIVE_RUNTIME_ACTIVATION;
    delete process.env.APPENDOO_LIVE_DESIGNER_PUBLISH;
    delete process.env.APPENDOO_DISABLE_LIVE_PIPELINE;
    fs.mkdirSync(path.join(tmpDir, 'docs/ai'), { recursive: true });
    fs.copyFileSync(
      path.join(origCwd, 'docs/ai/feature-graph.json'),
      path.join(tmpDir, 'docs/ai/feature-graph.json'),
    );
    process.chdir(tmpDir);
    vi.resetModules();
  });

  afterEach(() => {
    process.chdir(origCwd);
    process.env.APPENDOO_LIVE_RUNTIME_ACTIVATION = envBackup.APPENDOO_LIVE_RUNTIME_ACTIVATION;
    process.env.APPENDOO_LIVE_DESIGNER_PUBLISH = envBackup.APPENDOO_LIVE_DESIGNER_PUBLISH;
    process.env.APPENDOO_DISABLE_LIVE_PIPELINE = envBackup.APPENDOO_DISABLE_LIVE_PIPELINE;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  // V5 Phase P06 § 8.2/EV-1 — re-enabled. `createServerFunctionPlanner.ts` now gives
  // `semanticPlanBuilder.buildSemanticPlan` a second authoritative path for exactly this
  // scenario (create a brand-new server function from a free-form prompt), producing
  // `authority: 'VALIDATED'` / `status: 'READY_FOR_APPROVAL'` / `validation.ok: true` instead of
  // falling through to the SCAFFOLD planner. See PHASE-EVIDENCE-REPORT-P06.md.
  it('executeApprovedBinding persists server functions when live activation default-on in test', async () => {
    const { probeLiveRuntimeActivationDepth } = await import('../../../../shared/lib/appendoo/appendooIntegrationFlags');
    expect(probeLiveRuntimeActivationDepth().ok).toBe(true);

    const { engineeringPipelineService } = await import('../engineeringPipeline.service');
    const { semanticPlanApprovalService } = await import('../semanticPlanApproval.service');
    const { listManagedFunctionsFromStore } = await import('../../../../core/functions/FunctionFileStore');

    engineeringPipelineService.resetForTests();

    const scaffold = engineeringPipelineService.runScaffold({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:server-functions',
        mountId: 'studio',
        pageKey: 'server-functions',
      },
      pageContext: {
        path: '/us/studio/server-functions',
        pageLabel: 'Server Functions',
        pageKey: 'server-functions',
        functionId: 'exportUsers',
        functionName: 'Export Users',
      },
      userPrompt: 'Add export server function for live activation',
      requiresApproval: true,
    });

    const bindingId = scaffold.approvalBinding?.bindingId;
    expect(bindingId).toBeTruthy();

    semanticPlanApprovalService.approve(bindingId!, 'live-activation-test');
    const executed = engineeringPipelineService.executeApprovedBinding(bindingId!);

    expect(executed.promotionState).toBe('DEPLOYED');
    expect(executed.runtimeActivationFailedCount).toBe(0);
    expect(executed.runtimeActivatedCount).toBeGreaterThan(0);

    const functions = listManagedFunctionsFromStore();
    expect(functions.some((item) => item.id === 'appendoo.exportusers')).toBe(true);
  });
});
