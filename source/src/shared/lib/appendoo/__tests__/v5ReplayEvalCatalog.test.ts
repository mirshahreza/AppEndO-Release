import { describe, expect, it } from 'vitest';
import { buildV5ReplayEvalRolledUpReport, getV5ReplayEvalCatalogHealth, validateV5ReplayEvalCatalog } from '../v5ReplayEvalCatalog';
import { V5_REPLAY_EVAL_SCENARIOS } from '../../../api/contracts/appendoo/v5ReplayEvalScenarios';

describe('V5 P10 § V5-15 — v5ReplayEvalCatalog', () => {
  it('validates catalog integrity — every FIXTURE_EXISTS entry points to a real file on disk', () => {
    const result = validateV5ReplayEvalCatalog();
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('covers all 10 named V5-GE-* scenarios from the phase doc', () => {
    const health = getV5ReplayEvalCatalogHealth();
    expect(health.scenarioCount).toBe(10);
    expect(V5_REPLAY_EVAL_SCENARIOS.map((scenario) => scenario.scenarioId)).toEqual([
      'V5-GE-001', 'V5-GE-002', 'V5-GE-003', 'V5-GE-004', 'V5-GE-005',
      'V5-GE-006', 'V5-GE-007', 'V5-GE-008', 'V5-GE-009', 'V5-GE-010',
    ]);
  });

  // p-98 (2026-09) — governance-layer trim removed 3 modules (completionGate.ts,
  // contextCompactionInvariants.ts, ClaimStore/evidence.ts) that V5-GE-002/004/010 pointed to as
  // their fixture; each was confirmed pure telemetry (full call-site trace, no downstream reader)
  // before removal, and the catalog was updated to document these as honest gaps rather than
  // silently pointing at deleted files. 4 gaps total now, not 1.
  it('reports exactly the honestly-documented gaps (V5-GE-002/004/005/010), not zero and not silently more', () => {
    const health = getV5ReplayEvalCatalogHealth();
    expect(health.fixtureExistsCount).toBe(6);
    expect(health.gapDocumentedCount).toBe(4);
    const gapIds = V5_REPLAY_EVAL_SCENARIOS
      .filter((scenario) => scenario.fixtureStatus === 'GAP_DOCUMENTED')
      .map((scenario) => scenario.scenarioId);
    expect(gapIds.sort()).toEqual(['V5-GE-002', 'V5-GE-004', 'V5-GE-005', 'V5-GE-010']);
    for (const scenario of V5_REPLAY_EVAL_SCENARIOS) {
      if (scenario.fixtureStatus === 'GAP_DOCUMENTED') {
        expect(scenario.gapNote?.length).toBeGreaterThan(0);
      }
    }
  });

  it('V5 P11 (P10 § 33 follow-up) — buildV5ReplayEvalRolledUpReport aggregates real coverage per eval layer', () => {
    const report = buildV5ReplayEvalRolledUpReport();

    expect(report.scenarioCount).toBe(10);
    expect(report.fixtureExistsCount).toBe(6);
    expect(report.coveragePercent).toBe(60);

    const trajectoryLayer = report.byLayer.find((layer) => layer.evalLayer === 'TRAJECTORY');
    expect(trajectoryLayer).toBeDefined();
    expect(trajectoryLayer!.scenarioIds).toContain('V5-GE-003');
    expect(trajectoryLayer!.scenarioIds).toContain('V5-GE-008');

    const totalLayerReferences = report.byLayer.reduce((sum, layer) => sum + layer.scenarioIds.length, 0);
    const expectedReferences = V5_REPLAY_EVAL_SCENARIOS.reduce((sum, scenario) => sum + scenario.evalLayers.length, 0);
    expect(totalLayerReferences).toBe(expectedReferences);
  });

  it('catches a genuinely broken fixture reference (regression guard for the validator itself)', () => {
    const result = validateV5ReplayEvalCatalog([
      {
        scenarioId: 'V5-GE-FAKE',
        title: 'fake',
        descriptionEn: 'fake',
        evalLayers: ['SECURITY'],
        expectedProperties: ['x'],
        fixtureStatus: 'FIXTURE_EXISTS',
        fixtureFile: 'src/this/file/does/not/exist.test.ts',
        fixtureTestName: 'n/a',
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('does not exist on disk');
  });
});
