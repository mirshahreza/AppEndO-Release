import fs from 'fs';
import path from 'path';
import type { EvalLayer, V5ReplayEvalScenario } from '../../api/contracts/appendoo/v5ReplayEval.types';
import { V5_REPLAY_EVAL_SCENARIOS } from '../../api/contracts/appendoo/v5ReplayEvalScenarios';

export type V5ReplayEvalCatalogHealth = {
  catalogVersion: string;
  scenarioCount: number;
  fixtureExistsCount: number;
  gapDocumentedCount: number;
};

/**
 * Mechanical integrity check — mirrors `goldenEvalCatalog.ts`'s established pattern. For every
 * `FIXTURE_EXISTS` scenario, the referenced file must actually exist on disk; every
 * `GAP_DOCUMENTED` scenario must carry a non-empty `gapNote` (a documented gap is not allowed to
 * be silent).
 */
export const validateV5ReplayEvalCatalog = (
  scenarios: V5ReplayEvalScenario[] = V5_REPLAY_EVAL_SCENARIOS,
): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const scenario of scenarios) {
    if (ids.has(scenario.scenarioId)) {
      errors.push(`Duplicate scenarioId: ${scenario.scenarioId}`);
    }
    ids.add(scenario.scenarioId);

    if (scenario.evalLayers.length === 0) {
      errors.push(`${scenario.scenarioId}: at least one evalLayer is required.`);
    }

    if (scenario.expectedProperties.length === 0) {
      errors.push(`${scenario.scenarioId}: at least one expectedProperty is required.`);
    }

    if (scenario.fixtureStatus === 'FIXTURE_EXISTS') {
      const absolutePath = path.join(process.cwd(), scenario.fixtureFile);
      if (!fs.existsSync(absolutePath)) {
        errors.push(`${scenario.scenarioId}: fixtureFile "${scenario.fixtureFile}" does not exist on disk.`);
      }
    } else if (scenario.fixtureStatus === 'GAP_DOCUMENTED') {
      if (!scenario.gapNote?.trim()) {
        errors.push(`${scenario.scenarioId}: GAP_DOCUMENTED requires a non-empty gapNote.`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
};

export const getV5ReplayEvalCatalogHealth = (): V5ReplayEvalCatalogHealth => ({
  catalogVersion: 'p10-v1',
  scenarioCount: V5_REPLAY_EVAL_SCENARIOS.length,
  fixtureExistsCount: V5_REPLAY_EVAL_SCENARIOS.filter((scenario) => scenario.fixtureStatus === 'FIXTURE_EXISTS').length,
  gapDocumentedCount: V5_REPLAY_EVAL_SCENARIOS.filter((scenario) => scenario.fixtureStatus === 'GAP_DOCUMENTED').length,
});

export type V5ReplayEvalLayerCoverage = {
  evalLayer: EvalLayer;
  scenarioIds: string[];
  fixtureExistsCount: number;
  gapDocumentedCount: number;
};

export type V5ReplayEvalRolledUpReport = {
  catalogVersion: string;
  scenarioCount: number;
  fixtureExistsCount: number;
  gapDocumentedCount: number;
  coveragePercent: number;
  byLayer: V5ReplayEvalLayerCoverage[];
};

/**
 * V5 Phase P11 (P10 § 33 follow-up) — the "rolled-up multi-scenario eval report" P10's own
 * evidence report named as missing. Bounded, honest scope: this aggregates the CATALOG's own
 * structure (which scenarios exist, which eval layers they cover, which are real vs. documented
 * gaps) — it does not re-execute the other test files' assertions from within this function
 * (vitest test files are not designed to be invoked as library calls from other test files); the
 * actual pass/fail evidence for each scenario lives in its own referenced test file, run by
 * `test:critical`/`test:appendoo-golden` the normal way. What this adds is the missing rollup
 * VIEW across all 10 scenarios and their `evalLayers`, computed for real from the catalog data,
 * not asserted.
 */
export const buildV5ReplayEvalRolledUpReport = (
  scenarios: V5ReplayEvalScenario[] = V5_REPLAY_EVAL_SCENARIOS,
): V5ReplayEvalRolledUpReport => {
  const layerMap = new Map<EvalLayer, V5ReplayEvalLayerCoverage>();

  for (const scenario of scenarios) {
    for (const layer of scenario.evalLayers) {
      const existing = layerMap.get(layer) ?? {
        evalLayer: layer,
        scenarioIds: [],
        fixtureExistsCount: 0,
        gapDocumentedCount: 0,
      };
      existing.scenarioIds.push(scenario.scenarioId);
      if (scenario.fixtureStatus === 'FIXTURE_EXISTS') {
        existing.fixtureExistsCount += 1;
      } else {
        existing.gapDocumentedCount += 1;
      }
      layerMap.set(layer, existing);
    }
  }

  const fixtureExistsCount = scenarios.filter((s) => s.fixtureStatus === 'FIXTURE_EXISTS').length;

  return {
    catalogVersion: 'p10-v1',
    scenarioCount: scenarios.length,
    fixtureExistsCount,
    gapDocumentedCount: scenarios.length - fixtureExistsCount,
    coveragePercent: scenarios.length > 0 ? Math.round((fixtureExistsCount / scenarios.length) * 100) : 0,
    byLayer: [...layerMap.values()].sort((a, b) => a.evalLayer.localeCompare(b.evalLayer)),
  };
};
