import { randomUUID } from 'crypto';

/**
 * p-98 — canonical `Evidence` definitions. Real, load-bearing: feeds the hypothesis-reject-
 * without-new-evidence gate in `AgentOrchestrator.ts` (`hypothesisLedger.contradict/reject`,
 * keyed off `EvidenceStore.list().length`). The `Claim`/`ClaimStore`/claims-persistence machinery
 * that used to live here was removed — it fed only the completion-gate telemetry (never a real
 * gate), confirmed via full trace of every call site before removal.
 */
export type EvidenceType =
  | 'SOURCE'
  | 'SYMBOL_RELATION'
  | 'TEST'
  | 'BUILD'
  | 'DIAGNOSTIC'
  | 'DIFF'
  | 'RUNTIME'
  | 'USER_CONFIRMATION';

export type EvidenceResult = 'SUPPORTING' | 'CONTRADICTING' | 'NEUTRAL';

export type Evidence = {
  evidenceId: string;
  taskId: string;
  type: EvidenceType;
  subjectRefs: string[];
  result: EvidenceResult;
  artifactRef?: string;
  /**
   * Grounding — EV-2/EV-3 (p-60, echoed in this phase doc): must distinguish "evidence from a
   * real model decision" from "evidence replayed from a scripted/mock provider fixture" so a
   * mock-provider replay (see P00's `MUST-REVALIDATE-WITH-REAL-MODEL.md`) can never silently
   * pass as live-model-grounded evidence. Every `sourceRefs` entry produced by the current
   * mock-provider corpus is tagged `provider:mock` — a real live run will tag `provider:live`.
   */
  sourceRefs: string[];
  producedAt: string;
};

export class EvidenceStore {
  private readonly evidence: Evidence[] = [];

  record(params: {
    taskId: string;
    type: EvidenceType;
    subjectRefs: string[];
    result: EvidenceResult;
    artifactRef?: string;
    sourceRefs: string[];
  }): Evidence {
    const item: Evidence = {
      evidenceId: randomUUID(),
      taskId: params.taskId,
      type: params.type,
      subjectRefs: params.subjectRefs,
      result: params.result,
      artifactRef: params.artifactRef,
      sourceRefs: params.sourceRefs,
      producedAt: new Date().toISOString(),
    };
    this.evidence.push(item);
    return item;
  }

  list(): readonly Evidence[] {
    return this.evidence;
  }

  byType(type: EvidenceType): Evidence[] {
    return this.evidence.filter((item) => item.type === type);
  }
}

/**
 * Tool adapters (doc § V5-4 "Tool adapters" table) — the ONLY tool outcomes turned into Evidence
 * today are the ones with a real, unambiguous evidentiary meaning: retrieval tools → SOURCE,
 * VERIFY-class tools → TEST. `USER_CONFIRMATION`/`RUNTIME`/`BUILD`/`DIAGNOSTIC`/`DIFF` evidence
 * types are defined (canonical, per doc) but have no real producer yet — no tool in the current
 * registry captures a user's clarification answer, a build result, or a runtime diagnostic as a
 * discrete event. Returning `null` for those rather than fabricating evidence is deliberate.
 */
const RETRIEVE_TOOL_NAMES = new Set([
  'read_file', 'search_codebase', 'glob_files', 'list_dir', 'get_feature_graph',
  'get_project_standards', 'get_server_function', 'get_page_context', 'list_server_functions',
]);
export const VERIFY_TOOL_NAMES = new Set(['run_tests', 'test_server_function']);

export const deriveEvidenceFromToolResult = (params: {
  taskId: string;
  toolName: string;
  target: string;
  ok: boolean;
  providerMode: 'mock' | 'live';
}): { type: EvidenceType; subjectRefs: string[]; result: EvidenceResult; sourceRefs: string[] } | null => {
  const { taskId, toolName, target, ok, providerMode } = params;
  const sourceRefs = [`tool:${toolName}`, `provider:${providerMode}`];

  if (VERIFY_TOOL_NAMES.has(toolName)) {
    return {
      type: 'TEST',
      subjectRefs: [target],
      result: ok ? 'SUPPORTING' : 'CONTRADICTING',
      sourceRefs,
    };
  }
  if (RETRIEVE_TOOL_NAMES.has(toolName) && ok) {
    return {
      type: 'SOURCE',
      subjectRefs: [target],
      result: 'NEUTRAL',
      sourceRefs,
    };
  }
  return null;
};

