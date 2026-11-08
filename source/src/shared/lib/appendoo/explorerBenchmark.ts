import fs from 'fs';
import path from 'path';
import { codebaseRetrievalService } from '../../../server/services/appendoo/codebaseRetrieval.service';

/**
 * V5 Phase P05 § 7.3/V5-8 — `RetrievalProfile` + Explorer benchmark.
 *
 * DoD (both V5-7 and V5-8): "independent Explorer benchmark" / "Retriever must be benchmarkable without an implementer
 * " — the retriever must be measurable independent of whether an implementer (draft tool)
 * ever runs. This is a real, runnable harness against real fixtures grounded in this repo's
 * actual files (not fabricated/hypothetical), computing real IR metrics (Recall@K, MRR) from the
 * REAL, currently-wired `codebaseRetrievalService.hybridRetrieve()` — including this phase's own
 * Stage B/C/F improvements (AST symbol extraction, real vectorScore).
 *
 * Scope note: `RetrievalRecipe` (a per-profile query-expansion/multi-step strategy — doc § 7.3's
 * "error signature → failing test → primary symbol → ..." pipelines) is NOT implemented — only
 * the `RetrievalProfile` classification and a single-shot `explore()` call per fixture. Building
 * real multi-step recipes per profile is a substantially larger scope than this phase's budget
 * allows without becoming exactly the kind of interface-only scaffold `ANTI-SCAFFOLD-RULES.md`
 * forbids; see PHASE-EVIDENCE-REPORT-P05.md § Remaining.
 */
export type RetrievalProfile =
  | 'BUG_FIX'
  | 'FEATURE'
  | 'REFACTOR'
  | 'BUILD_FAILURE'
  | 'REPOSITORY_QUESTION'
  | 'DEPENDENCY_UPGRADE'
  | 'APPENDO_SERVER_FUNCTION_UI'
  | 'APPENDO_PACKAGE_COMPOSITION';

export type ExplorationTaskFixture = {
  fixtureId: string;
  query: string;
  profile: RetrievalProfile;
  /** Real, repo-relative paths that count as a correct hit for this fixture. */
  expectedPaths: string[];
  /** Files this fixture needs indexed before exploring — the harness indexes them itself (no repo-wide indexer exists yet — see Remaining). */
  corpusPaths: string[];
};

export type ExplorationResult = {
  fixtureId: string;
  profile: RetrievalProfile;
  hitCount: number;
  recallAt5: boolean;
  recallAt10: boolean;
  reciprocalRank: number;
  timeToPrimarySymbolMs: number;
};

export type ExplorationBenchmarkSummary = {
  results: ExplorationResult[];
  recallAt5: number;
  recallAt10: number;
  mrr: number;
};

/**
 * Real, mechanical `RetrievalProfile` classification from signals already available at the
 * `search_codebase`/agent-loop call site — reuses the same detection heuristics already proven
 * in P00-P03 (page context, function id) rather than inventing new NLP-based classification
 * (EV-3 — no live model to judge intent). `RetrievalRecipe` (the doc's per-profile multi-step
 * query-expansion pipeline) is not implemented — see module doc comment.
 */
export const classifyRetrievalProfile = (params: {
  userPrompt: string;
  hasFailingTestSignature?: boolean;
  pageContextFunctionId?: string;
}): RetrievalProfile => {
  const prompt = params.userPrompt.toLowerCase();
  if (params.hasFailingTestSignature) return 'BUILD_FAILURE';
  if (params.pageContextFunctionId) return 'APPENDO_SERVER_FUNCTION_UI';
  if (/\berror\b|\bbug\b|\bfails?\b|\bcrash/i.test(prompt)) return 'BUG_FIX';
  if (/\bupgrade\b|\bversion\b|\bdependency\b|\bpackage\.json\b/i.test(prompt)) return 'DEPENDENCY_UPGRADE';
  if (/\brefactor\b|\bclean\s*up\b|\brename\b/i.test(prompt)) return 'REFACTOR';
  if (/\bpackage\b.*\b(export|compose|composition)\b/i.test(prompt)) return 'APPENDO_PACKAGE_COMPOSITION';
  if (/\bhow\b|\bwhy\b|\bwhere\b|\bwhat\b|\bexplain\b/i.test(prompt)) return 'REPOSITORY_QUESTION';
  return 'FEATURE';
};

const REPO_ROOT = process.cwd();

const indexCorpusFile = (relativePath: string): void => {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) return;
  const content = fs.readFileSync(absolutePath, 'utf8');
  codebaseRetrievalService.indexFile(relativePath.replace(/\\/g, '/'), content);
};

export const explore = (
  fixture: ExplorationTaskFixture,
  budget: { maxResults: number } = { maxResults: 10 },
): ExplorationResult => {
  for (const corpusPath of fixture.corpusPaths) {
    indexCorpusFile(corpusPath);
  }

  const startedAt = Date.now();
  const result = codebaseRetrievalService.hybridRetrieve({
    query: fixture.query,
    applicationScopeRef: 'explorer-benchmark',
    maxResults: budget.maxResults,
    mode: 'hybrid',
  });
  const elapsedMs = Date.now() - startedAt;

  const normalizedExpected = fixture.expectedPaths.map((p) => p.replace(/\\/g, '/'));
  const rankIndex = result.hits.findIndex((hit) => normalizedExpected.includes(hit.path.replace(/\\/g, '/')));

  return {
    fixtureId: fixture.fixtureId,
    profile: fixture.profile,
    hitCount: result.hits.length,
    recallAt5: rankIndex >= 0 && rankIndex < 5,
    recallAt10: rankIndex >= 0 && rankIndex < 10,
    reciprocalRank: rankIndex >= 0 ? 1 / (rankIndex + 1) : 0,
    timeToPrimarySymbolMs: elapsedMs,
  };
};

export const runExplorerBenchmark = (fixtures: ExplorationTaskFixture[]): ExplorationBenchmarkSummary => {
  const results = fixtures.map((fixture) => explore(fixture));
  const count = results.length || 1;
  return {
    results,
    recallAt5: results.filter((r) => r.recallAt5).length / count,
    recallAt10: results.filter((r) => r.recallAt10).length / count,
    mrr: results.reduce((sum, r) => sum + r.reciprocalRank, 0) / count,
  };
};
