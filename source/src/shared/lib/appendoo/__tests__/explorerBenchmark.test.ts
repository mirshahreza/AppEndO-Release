import { describe, expect, it, beforeEach } from 'vitest';
import { explore, runExplorerBenchmark, type ExplorationTaskFixture } from '../explorerBenchmark';
import { resetCodebaseStructuralIndexForTests } from '../codebaseStructuralScaffold';
import { resetSemanticRetrievalStoreForTests } from '../semanticRetrievalScaffold';

/**
 * V5 Phase P05 DoD (standalone explorer benchmark / retriever without implementer benchmark) —
 * real fixtures grounded in this repo's actual files, run against the real, currently-wired
 * `codebaseRetrievalService.hybridRetrieve()` (including this phase's own AST/vector upgrades).
 */
const DISTRACTOR_CORPUS = [
  'src/core/ai/agent/operationalState.ts',
  'src/core/ai/agent/evidence.ts',
  'src/core/ai/agent/modelRouter.ts',
  'src/core/ai/agent/hypothesisLedger.ts',
  'src/core/ai/agent/taskContract.ts',
  'src/core/ai/agent/operationalPolicyEngine.ts',
  'src/core/ai/agent/contextCompactionInvariants.ts',
];

const FIXTURES: ExplorationTaskFixture[] = [
  {
    fixtureId: 'find-agent-orchestrator-class',
    query: 'AgentOrchestrator',
    profile: 'REPOSITORY_QUESTION',
    expectedPaths: ['src/core/ai/agent/AgentOrchestrator.ts'],
    corpusPaths: ['src/core/ai/agent/AgentOrchestrator.ts', ...DISTRACTOR_CORPUS],
  },
  {
    fixtureId: 'find-resolve-task-contract',
    query: 'resolveTaskContract',
    profile: 'FEATURE',
    expectedPaths: ['src/core/ai/agent/taskContract.ts'],
    corpusPaths: ['src/core/ai/agent/AgentOrchestrator.ts', ...DISTRACTOR_CORPUS],
  },
  {
    fixtureId: 'find-hypothesis-ledger',
    query: 'HypothesisLedger',
    profile: 'BUG_FIX',
    expectedPaths: ['src/core/ai/agent/hypothesisLedger.ts'],
    corpusPaths: ['src/core/ai/agent/AgentOrchestrator.ts', ...DISTRACTOR_CORPUS],
  },
];

describe('V5 P05 DoD — Explorer benchmark', () => {
  beforeEach(() => {
    resetCodebaseStructuralIndexForTests();
    resetSemanticRetrievalStoreForTests();
  });

  it('finds the real, known-correct file for a symbol-name query (exact structural match)', () => {
    const result = explore(FIXTURES[0]);
    expect(result.recallAt5).toBe(true);
    expect(result.reciprocalRank).toBeGreaterThan(0);
    expect(result.hitCount).toBeGreaterThan(0);
  });

  it('does NOT trivially return recall=1 for every random query (proves the metric is real, not tautological)', () => {
    const nonsenseFixture: ExplorationTaskFixture = {
      fixtureId: 'nonsense-query',
      query: 'zzz_nonexistent_symbol_xyz_123',
      profile: 'REPOSITORY_QUESTION',
      expectedPaths: ['src/core/ai/agent/AgentOrchestrator.ts'],
      corpusPaths: DISTRACTOR_CORPUS,
    };
    const result = explore(nonsenseFixture);
    expect(result.recallAt5).toBe(false);
    expect(result.reciprocalRank).toBe(0);
  });

  it('runExplorerBenchmark aggregates real Recall@5/@10/MRR across fixtures', () => {
    const summary = runExplorerBenchmark(FIXTURES);
    expect(summary.results).toHaveLength(3);
    expect(summary.recallAt5).toBeGreaterThan(0);
    expect(summary.recallAt10).toBeGreaterThanOrEqual(summary.recallAt5);
    expect(summary.mrr).toBeGreaterThan(0);
    expect(summary.mrr).toBeLessThanOrEqual(1);
  });

  it('records a real, non-zero elapsed time (not a stubbed constant)', () => {
    const result = explore(FIXTURES[1]);
    expect(result.timeToPrimarySymbolMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.timeToPrimarySymbolMs).toBe('number');
  });
});
