import type { JsonValue, JsonSchemaRefOrInline, ExactActionRef } from '../awm/types';
import type { WorkflowActorType } from '../types';

/**
 * Action contract — sole authority per
 * docs/standards/workflow-engine-testing.md (doc 04)
 * sections 1, 2, 6, 11.
 */

export type ActionContributorType = 'CORE' | 'PLATFORM' | 'PACKAGE';

/**
 * Slice 11 item 11h Repository Reality Audit (doc 02 section 10, doc 11 section 1 item 11h —
 * "optional AGENTIC metadata only after AI runtime Reality Audit"): AGENTIC is NOT buildable from
 * existing primitives today. `src/core/ai/agent/AgentOrchestrator.ts` provides a real, runtime-
 * enforced max-iterations/max-tool-calls-per-turn budget (satisfying `maximumTurns`/
 * `maximumToolCalls`) and a coarse tool-group/mode allowlist (`ToolRegistry.isToolAllowed`), but
 * two required contracts are genuinely absent: (1) no code re-validates caller authorization
 * per tool call mid-run — `resolveEffectiveMcpAccessForUser`/`assertAgentRunWithinMcpAccess`
 * (`src/server/services/ai/mcpAccess.service.ts`) resolve once at run start only; (2) no
 * `memoryPolicy: 'NONE' | 'GOVERNED_EXTERNAL_RESOURCE'` concept exists anywhere in
 * `src/core/ai/**`/`src/server/services/ai/**` — the only memory-adjacent primitive is the
 * opt-in `appendo-memory` MCP capability pack (a callable tool, not a runtime-enforced mode).
 * Per doc 02 section 10 ("Workflow does not build a second agent runtime"), Workflow does not
 * invent its own authorization-revalidation or memory-governance layer to close this gap — no
 * registered Action uses `executionMode: 'AGENTIC'` (every corePack Action is `DETERMINISTIC`),
 * and none should until a real platform primitive closes both findings above. This mirrors Slice
 * 3's `text.regex-match`/`communication.notification-send`/`ai.embedding` findings exactly: an
 * honest carried-forward gap, not a silently-faked capability.
 */
export type ActionExecutionMode = 'DETERMINISTIC' | 'AGENTIC';

export type AgenticActionConstraints = {
  allowedToolActionRefs: ExactActionRef[];
  allowedOutcomeKeys?: string[];
  maximumTurns: number;
  maximumToolCalls: number;
  memoryPolicy: 'NONE' | 'GOVERNED_EXTERNAL_RESOURCE';
};

export type ActionIdempotencyGuarantee = 'DEDUPLICATED' | 'SUPPORTED' | 'BEST_EFFORT' | 'NONE';

/** Doc 04 section 11 — the governed public contract for one Action key/version. */
export type ActionDefinition = {
  key: string;
  version: string;
  contributor: { type: ActionContributorType; id: string };
  configSchema: JsonSchemaRefOrInline;
  inputSchema: JsonSchemaRefOrInline;
  outputSchema: JsonSchemaRefOrInline;
  uiSchema?: JsonValue;
  executionTimeoutMs: number;
  idempotency: { guarantee: ActionIdempotencyGuarantee; deduplicationWindowMs?: number };
  cancellationSupport: 'SUPPORTED' | 'NONE';
  sideEffectClass: 'PURE' | 'READ_EXTERNAL' | 'WRITE_EXTERNAL';
  riskClass: 'LOW' | 'MEDIUM' | 'HIGH';
  requiredCapabilities: string[];
  requiredPermissions: string[];
  secretReferenceFields: string[];
  availability: 'AVAILABLE' | 'UNAVAILABLE';
  executionMode: ActionExecutionMode;
  agenticConstraints?: AgenticActionConstraints;
  registryPriority?: number;
  tags: string[];
};

/** Doc 04 section 8 — closed executor result union. Executor exceptions are never branching authority. */
export type ActionExecutionResult =
  | { status: 'SUCCEEDED'; output: JsonValue }
  | { status: 'FAILED'; errorCode: string; errorClass: string; safeMessage: string; classifiedDetails?: JsonValue };

/**
 * Doc 04 section 2 — the executor invocation boundary. An executor never receives Prisma, direct
 * Workflow repositories or lease-heartbeat control, and cannot decide graph continuation. Full
 * wiring of a real context (governed secret resolver, correlated logger, service adapters) is a
 * Slice 5 (durable execution engine) concern; this is the contract shape Slice 3's registry and
 * built-in Actions are written against.
 */
export type ActionExecutorContext = {
  workflowInstanceId: string;
  nodeInstanceId: string;
  logicalInvocationId: string;
  idempotencyKey: string;
  effectiveIdentity: { type: WorkflowActorType; id: string | null };
  cancellationSignal: AbortSignal;
  resolveSecret: (secretRef: string) => Promise<string>;
  logger: { info: (message: string, meta?: Record<string, unknown>) => void; warn: (message: string, meta?: Record<string, unknown>) => void; error: (message: string, meta?: Record<string, unknown>) => void };
  writeTraceMetadata: (event: { type: string; payload: JsonValue }) => void;
};

export type ActionExecutor = {
  execute: (context: ActionExecutorContext, config: JsonValue, input: JsonValue) => Promise<ActionExecutionResult>;
};

/** One registered implementation of an ActionDefinition (doc 04 section 7 — "provider"). */
export type ActionProviderRegistration = {
  actionKey: string;
  actionVersion: string;
  providerId: string;
  providerVersion: string;
  contributorType: ActionContributorType;
  providesCapabilities: string[];
  registryPriority: number;
  executor: ActionExecutor;
};
