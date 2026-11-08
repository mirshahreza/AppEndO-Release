import type { AiPageContext } from './pageContext';
import type { AiChatContextResourceId } from './chatContextResources';
import type { AgentMessageAttachment } from './agentMessageAttachments';
import type { AiTaskProfile, AssistantRequestClass } from './appendooGateway.types';
import type {
  ArtifactAuthority,
  PlanActionPolicy,
  PlanningBlocker,
  SemanticPlanStatus,
} from '../appendoo/semanticPlanAuthority.types';

/** Interaction mode — maps to Cursor Ask / Agent / Plan. */
export type AgentMode = 'ask' | 'agent' | 'plan';

export type AgentChatRole = 'user' | 'assistant' | 'system' | 'tool';

export type AgentChatMessage = {
  role: AgentChatRole;
  content: string;
  attachments?: AgentMessageAttachment[];
  /** Populated when role is `tool` — links observation to the originating call. */
  toolCallId?: string;
  name?: string;
};

export type ToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type ArtifactRef = {
  kind: 'draft' | 'file' | 'snapshot';
  id: string;
  label?: string;
};

export type ToolResult = {
  ok: boolean;
  summary: string;
  data?: unknown;
  artifacts?: ArtifactRef[];
  error?: string;
};

export type AgentPlanActMode = 'review' | 'implement';

export type AgentRunRequest = {
  sessionId?: number;
  mode: AgentMode;
  messages: AgentChatMessage[];
  modelId?: string;
  pageContext?: AiPageContext;
  contextResources?: AiChatContextResourceId[];
  enabledMcpServerIds?: string[];
  /** Built-in capability packs enabled for this run (e.g. appendo-files, appendo-git). */
  enabledCapabilityPackIds?: string[];
  /** Plan mode — path to the session design document under plans/core/. */
  planDocumentPath?: string;
  /** Agent Plan/Act toggle — review disables draft_* tools (C.3). */
  agentPlanActMode?: AgentPlanActMode;
};

export type ProposalViolationSeverity = 'error' | 'warning';

export type ProposalViolation = {
  id: string;
  severity: ProposalViolationSeverity;
  message: string;
  ruleId?: string;
  changeSetId?: string;
};

export type AgentPlanPayload = {
  intent: string;
  targetFiles: string[];
  steps: string[];
};

/** Pre-implementation task breakdown from analyst preprocessing (Agent mode). */
export type PromptTaskDecompositionPayload = {
  summary: string;
  workUnits: string[];
  assumptions?: string[];
  openQuestions?: string[];
};

export type AgentValidationResultPayload = {
  ok: boolean;
  violations: ProposalViolation[];
  proposalId?: string;
};

export type AgentApplyRequest = {
  sessionId?: number;
  proposalId: string;
  changeSets: ChangeSet[];
  /** Allow confirm when only warnings remain (e.g. full-file rewrite). */
  confirmOverrideWarnings?: boolean;
  /** When set to plan, validates only markdown file patches under the plans directory. */
  mode?: AgentMode;
};

export type PlanDocUpdatedPayload = {
  path: string;
  revision: string;
};

export type AppliedChangeItem = {
  changeSetId: string;
  label: string;
  kind: ChangeSetKind;
  rolledBack?: boolean;
  /** Remaining revertible zones for file_patch (C.2). */
  diffZones?: FileDiffZone[];
  /** Zones already reverted on disk (informational). */
  revertedZones?: FileDiffZone[];
};

export type AgentRollbackRequest = {
  sessionId?: number;
  applyId: number;
  changeSetIds?: string[];
  /** Partial file rollback — restore specific diff zones (C.2 / D.3). */
  diffZoneRollbacks?: {
    changeSetId: string;
    zones: FileDiffZone[];
  }[];
};

export type DesignerHandoffPayload = {
  layoutId: string;
  name: string;
  /** Stable folder/name path for Designer deep links (`?path=folder/name`). */
  componentPath?: string;
};

export type PostApplyCheck = {
  id: string;
  ok: boolean;
  message: string;
  changeSetId?: string;
};

export type PostApplyVerificationResult = {
  ok: boolean;
  checks: PostApplyCheck[];
};

export type AgentApplyResult = {
  applyId: number;
  proposalId: string;
  appliedCount: number;
  summary: string;
  appliedChanges?: AppliedChangeItem[];
  planDocUpdated?: PlanDocUpdatedPayload;
  designerHandoff?: DesignerHandoffPayload[];
  verification?: PostApplyVerificationResult;
};

export type AgentRollbackResult = {
  applyId: number;
  rolledBackCount: number;
  summary: string;
  appliedChanges?: AppliedChangeItem[];
  allRolledBack?: boolean;
};

export type AgentProposalFeedbackRequest = {
  sessionId?: number;
  proposalId: string;
  changeSetCount: number;
};

export type AgentProposalFeedbackResult = {
  proposalId: string;
  outcome: 'dismissed_pre_apply';
  recordedAt: string;
};

export type AgentChatLatencyActivityKind =
  | 'user_echo'
  | 'thinking'
  | 'tool_start'
  | 'turn_profile'
  | 'request_routing';

export type AgentChatLatencyRequest = {
  sessionId?: number;
  latencyMs: number;
  activityKind: AgentChatLatencyActivityKind;
};

export type AgentChatLatencyResult = {
  latencyMs: number;
  activityKind: AgentChatLatencyActivityKind;
  recordedAt: string;
};

export type AgentLatestApplyResult = {
  applyId: number | null;
  appliedChanges?: AppliedChangeItem[];
};

export type AgentRunDonePayload = {
  text: string;
  modelId: string;
  iterationCount: number;
  sessionId?: number;
  /** Approximate tokens consumed in this run (Phase 5). */
  tokensEstimate?: number;
  tokensBudget?: number;
};

/** ChangeSet sketch — apply logic ships in Phase 4 (M2e). */
export type ChangeSetKind =
  | 'component_layout_patch'
  | 'function_source_patch'
  | 'settings_block_patch'
  | 'file_patch'
  | 'git_operation';

export type GitOperationKind = 'commit' | 'checkout' | 'branch';

export type ChangeSetBase = {
  id: string;
  kind: ChangeSetKind;
  title: string;
  summary?: string;
};

export type ComponentLayoutPatchChangeSet = ChangeSetBase & {
  kind: 'component_layout_patch';
  layoutId: string;
  patch: unknown;
};

export type FunctionSourcePatchChangeSet = ChangeSetBase & {
  kind: 'function_source_patch';
  functionId: string;
  patch: unknown;
};

export type SettingsBlockPatchChangeSet = ChangeSetBase & {
  kind: 'settings_block_patch';
  blockKey: string;
  patch: unknown;
};

export type FileDiffZone = {
  startLine: number;
  endLine: number;
};

export type FilePatchChangeSet = ChangeSetBase & {
  kind: 'file_patch';
  path: string;
  beforeHash?: string;
  /** Optional baseline text for proposal preview diff (not used during apply). */
  beforeContent?: string;
  /** Changed line ranges in the after file (D.3). */
  diffZones?: FileDiffZone[];
  content: string;
};

export type GitOperationChangeSet = ChangeSetBase & {
  kind: 'git_operation';
  operation: GitOperationKind;
  message?: string;
  stageAll?: boolean;
  paths?: string[];
  target?: string;
  branchName?: string;
  startPoint?: string;
  checkout?: boolean;
};

export type ChangeSet =
  | ComponentLayoutPatchChangeSet
  | FunctionSourcePatchChangeSet
  | SettingsBlockPatchChangeSet
  | FilePatchChangeSet
  | GitOperationChangeSet;

/**
 * SSE events for `POST /api/ai/agent/run`.
 * Ask mode keeps using `/api/ai/chat/stream` (`delta` / `done` / `error`).
 */
export type AgentStreamThinkingEvent = {
  type: 'thinking';
  status: string;
};

export type AgentStreamTurnProfileEvent = {
  type: 'turn_profile';
  profile: 'ask_lookup' | 'plan_authoring' | 'agent_lookup' | 'agent_plan_review' | 'agent_implement' | 'agent_implement_governed';
  label: string;
};

export type AgentStreamRequestRoutingEvent = {
  type: 'request_routing';
  requestClass: AssistantRequestClass;
  taskProfile: AiTaskProfile;
  routerVersion: string;
  routingReason: string;
  useEngineeringPipeline: boolean;
  applicationScopeKey?: string;
  applicationScopeKind?: ApplicationScopeKind;
  contextPackId?: string;
  contextPackTargetCount?: number;
  contextPackStandardsCount?: number;
  contextPackSelectionExplanations?: Array<{
    reasonCode: string;
    summary: string;
  }>;
};

export type EngineeringChangeGraphNodePreview = {
  nodeId: string;
  operationType: string;
  state: string;
};

export type EngineeringVerificationGraderPreview = {
  graderId: string;
  grade: 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED';
  layer: string;
};

export type AgentStreamEngineeringPipelineEvent = {
  type: 'engineering_pipeline';
  planId: string;
  planRevision: number;
  planObjective: string;
  artifactCount: number;
  capabilityGapCount: number;
  changeGraphId: string;
  changeNodeCount: number;
  changeGraphReadyCount?: number;
  changeGraphVerifiedCount?: number;
  changeGraphFailedCount?: number;
  changeGraphNodePreview?: EngineeringChangeGraphNodePreview[];
  verificationGraderSummary?: EngineeringVerificationGraderPreview[];
  changeSetId?: string;
  contextPackRevision?: number;
  approvalBindingId?: string;
  approvalStatus?: 'pending' | 'approved' | 'stale' | 'revoked';
  workspaceId?: string;
  revisionId?: string;
  executedNodeCount: number;
  failedNodeCount: number;
  reconciledNodeCount?: number;
  verificationRunId?: string;
  deployable?: boolean;
  verificationPassCount?: number;
  verificationFailCount?: number;
  promotionRunId?: string;
  promotionState?: 'PENDING' | 'PREFLIGHT' | 'CHECKPOINT' | 'STAGING' | 'PROMOTING' | 'DEPLOYED' | 'FAILED' | 'ROLLED_BACK';
  promotionPreflightOk?: boolean;
  requiresApproval: boolean;
  requiresPromotionApproval?: boolean;
  promotionApprovalRequired?: boolean;
  promotionApprovalBindingId?: string;
  planStatus?: SemanticPlanStatus;
  planAuthority?: ArtifactAuthority;
  planActionPolicy?: PlanActionPolicy;
  planningBlockers?: PlanningBlocker[];
  packageSnapshotId?: string;
  packageRoundtripValidated?: boolean;
  runtimeActivatedCount?: number;
  runtimeActivationFailedCount?: number;
  checkpointId?: string;
  revisionFingerprint?: string;
  mutationPathCount?: number;
  mutationPathPreview?: string[];
  workspaceStorageKind?: 'git_worktree' | 'git_branch' | 'isolated_path';
  verifiedNodeCount?: number;
  revisionNumber?: number;
  parentRevisionId?: string;
  workspaceState?: 'OPEN' | 'FROZEN_FOR_VERIFICATION' | 'VERIFIED' | 'FAILED' | 'DISCARDED';
  revisionState?: 'OPEN' | 'FROZEN_FOR_VERIFICATION' | 'VERIFIED' | 'FAILED';
  workspaceLineageLabel?: string;
  failedRevisionId?: string;
  repairRevisionId?: string;
  repairRevisionNumber?: number;
  repairReExecuted?: boolean;
  changeGraphDriftOk?: boolean;
  changeGraphDriftStaleCount?: number;
  builderOrchestrationErrorCount?: number;
  builderOrchestrationErrors?: string[];
  designerHandoff?: DesignerHandoffPayload[];
};

export type AgentToolConfirmReasonCode =
  | 'AUTO_ALLOWED'
  | 'HARNESS_BLOCKED';

export type AgentStreamToolStartEvent = {
  type: 'tool_start';
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  /** Human-readable activity line (V4 UX-1). */
  activityTitle?: string;
  /** Short fa/en reason for this tool call (V4 F.2). */
  intention?: string;
  /** Why the tool was allowed or blocked (V4 F.2). */
  reasonCode?: AgentToolConfirmReasonCode;
};

export type AgentStreamToolResultEvent = {
  type: 'tool_result';
  toolCallId: string;
  result: ToolResult;
};

export type AgentStreamTextDeltaEvent = {
  type: 'text_delta';
  text: string;
};

export type AgentStreamChangePlanEvent = {
  type: 'change_plan';
  plan: AgentPlanPayload;
};

export type AgentStreamTaskDecompositionEvent = {
  type: 'task_decomposition';
  decomposition: PromptTaskDecompositionPayload;
};

export type AgentStreamPlanDocUpdatedEvent = {
  type: 'plan_doc_updated';
  path: string;
  revision?: string;
};

export type AgentStreamProposalEvent = {
  type: 'proposal';
  proposalId: string;
  changeSets: ChangeSet[];
};

export type AgentStreamValidationResultEvent = {
  type: 'validation_result';
  proposalId: string;
  ok: boolean;
  violations: ProposalViolation[];
};

export type AgentStreamMcpWarningEvent = {
  type: 'mcp_warning';
  serverId: string;
  serverLabel: string;
  message: string;
};

export type AgentStreamIterationLimitEvent = {
  type: 'iteration_limit';
  message: string;
  canContinue: boolean;
  iterationCount: number;
};

export type AgentStreamClarifyingQuestionEvent = {
  type: 'clarifying_question';
  question: string;
  options?: string[];
  reason?: string;
};

export type AgentStreamActivityNoteEvent = {
  type: 'activity_note';
  noteKind: 'scaffold_seed' | 'context_compression' | 'reverse_audit';
  title: string;
  detail?: string;
};

export type AgentStreamAgentRepairEvent = {
  type: 'agent_repair';
  activityTitle: string;
  intention?: string;
  detail?: string;
  violations: ProposalViolation[];
};

export type AgentTodoListItem = {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
};

export type AgentStreamTodoUpdateEvent = {
  type: 'todo_update';
  todos: AgentTodoListItem[];
};

export type AgentStreamDoneEvent = {
  type: 'done';
  text: string;
  modelId: string;
  iterationCount: number;
  sessionId?: number;
  tokensEstimate?: number;
  tokensBudget?: number;
  retrievalOperationCount?: number;
  draftToolCount?: number;
};

export type AgentStreamErrorEvent = {
  type: 'error';
  error: string;
};

export type AgentStreamEvent =
  | AgentStreamThinkingEvent
  | AgentStreamTurnProfileEvent
  | AgentStreamRequestRoutingEvent
  | AgentStreamEngineeringPipelineEvent
  | AgentStreamToolStartEvent
  | AgentStreamToolResultEvent
  | AgentStreamTextDeltaEvent
  | AgentStreamTaskDecompositionEvent
  | AgentStreamChangePlanEvent
  | AgentStreamPlanDocUpdatedEvent
  | AgentStreamProposalEvent
  | AgentStreamValidationResultEvent
  | AgentStreamMcpWarningEvent
  | AgentStreamIterationLimitEvent
  | AgentStreamClarifyingQuestionEvent
  | AgentStreamActivityNoteEvent
  | AgentStreamAgentRepairEvent
  | AgentStreamTodoUpdateEvent
  | AgentStreamDoneEvent
  | AgentStreamErrorEvent;
