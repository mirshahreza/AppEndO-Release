/** AE-22.3 — registry of v1 engineering paths removed or guarded under V3 cutover. */
export const APPENDOO_V1_DEAD_CODE_REGISTRY_VERSION = '1.1.0';

export type AppendooV1DeadCodeEntry = {
  id: string;
  symbol: string;
  status: 'GUARDED' | 'REMOVED' | 'DEPRECATED';
  replacement: string;
};

export const APPENDOO_V1_DEAD_CODE_REGISTRY: AppendooV1DeadCodeEntry[] = [
  {
    id: 'V1D-01',
    symbol: 'ChangeSetService.apply (production)',
    status: 'GUARDED',
    replacement: 'engineeringPipelineService.runScaffold / executeApprovedBinding',
  },
  {
    id: 'V1D-02',
    symbol: 'AgentOrchestrator engineering proposal finalize',
    status: 'GUARDED',
    replacement: 'semanticPlanApprovalService + Change Graph execution',
  },
  {
    id: 'V1D-03',
    symbol: 'Panel auto-apply for ENGINEERING_CHANGE',
    status: 'GUARDED',
    replacement: 'Engineering pipeline approval binding + workspace execution',
  },
  {
    id: 'V1D-04',
    symbol: 'VibeHarness retrieve→draft→finalize loop',
    status: 'REMOVED',
    replacement: 'AgentImplementGate + V3 Context Pack → ASP → Change Graph pipeline',
  },
  {
    id: 'V1D-05',
    symbol: 'VibeHarness engineering finalize',
    status: 'GUARDED',
    replacement: 'shouldBlockV1ProposalForEngineering → v3_pipeline',
  },
  {
    id: 'V1D-06',
    symbol: 'Legacy e2e suites (e2eVibe*, e2e41*)',
    status: 'DEPRECATED',
    replacement: 'e2eEngineeringPipelineWf* (MIGRATED — not in test:critical)',
  },
];

export const summarizeAppendooV1DeadCodeRegistry = () => ({
  version: APPENDOO_V1_DEAD_CODE_REGISTRY_VERSION,
  entryCount: APPENDOO_V1_DEAD_CODE_REGISTRY.length,
  guardedCount: APPENDOO_V1_DEAD_CODE_REGISTRY.filter((entry) => entry.status === 'GUARDED').length,
  removedCount: APPENDOO_V1_DEAD_CODE_REGISTRY.filter((entry) => entry.status === 'REMOVED').length,
});

export const probeAppendooV1DeadCodeRegistry = (): { ok: boolean; reason?: string } => {
  const summary = summarizeAppendooV1DeadCodeRegistry();
  if (summary.entryCount < 6) {
    return { ok: false, reason: 'V1 dead code registry incomplete.' };
  }
  if (summary.guardedCount < 3) {
    return { ok: false, reason: 'Expected at least three guarded v1 paths.' };
  }
  if (summary.removedCount < 1) {
    return { ok: false, reason: 'Expected at least one REMOVED v1 path (VibeHarness).' };
  }
  const vibeHarness = APPENDOO_V1_DEAD_CODE_REGISTRY.find((entry) => entry.id === 'V1D-04');
  if (vibeHarness?.status !== 'REMOVED') {
    return { ok: false, reason: 'V1D-04 VibeHarness must be REMOVED after e2e migration.' };
  }
  return { ok: true };
};
