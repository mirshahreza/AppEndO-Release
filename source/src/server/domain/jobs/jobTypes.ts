export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type JobType = 'edge_function' | string;

export type JobRecord = {
  id: number;
  job_type: JobType;
  status: JobStatus;
  progress: number;
  progress_message: string | null;
  payload_json: string | null;
  result_json: string | null;
  error_message: string | null;
  cancel_requested: number;
  attempt_count: number;
  max_attempts: number;
  queued_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  created_by: number | null;
  updated_at: string;
  updated_by: number | null;
};

export type JobMetadata = {
  source?: 'scheduled' | 'manual';
  scheduledTaskId?: string;
  cron?: string;
  cronSlot?: string;
  triggeredAt?: string;
  trigger?: 'cron' | 'manual' | 'catch_up';
  retriedFromJobId?: number;
};

export type ServerFunctionJobEnvelope = {
  functionId: string;
  userPayload: Record<string, unknown>;
  metadata: JobMetadata;
  title?: string;
};

export type EnqueueServerFunctionJobInput = {
  functionId: string;
  title?: string;
  payload?: Record<string, unknown>;
  metadata?: JobMetadata;
  createdBy?: number | null;
};

/**
 * V5 Phase P11 section V5-21 async/background execution — lets a chat turn run as a background job instead
 * of blocking the HTTP request. `taskId`/`attemptId` are the SAME P01/P09 identifiers
 * `AgentOrchestrator.run()` already understands — this is what makes the job resumable/
 * reconstructable from `AgentEventStore` per the phase doc's literal DoD, not a new mechanism.
 */
export type AgentTaskJobEnvelope = {
  taskId: string;
  attemptId: string;
  actorUserId: number;
  /** p-102 — originating chat session, so the result can be written back on completion. */
  sessionId?: number;
  mode: 'ask' | 'agent' | 'plan';
  messages: { role: 'user' | 'assistant' | 'tool' | 'system'; content: string; toolCallId?: string; name?: string }[];
  executionProfile: string;
  useEngineeringPipeline?: boolean;
  modelId?: string;
  pageContext?: Record<string, unknown>;
  /** p-102 — captured at enqueue time, re-resolved against current grants at execute time. */
  enabledCapabilityPackIds?: string[];
  enabledMcpServerIds?: string[];
  title?: string;
};

export type EnqueueAgentTaskJobInput = {
  taskId: string;
  attemptId: string;
  actorUserId: number;
  sessionId?: number;
  mode: AgentTaskJobEnvelope['mode'];
  messages: AgentTaskJobEnvelope['messages'];
  executionProfile: string;
  useEngineeringPipeline?: boolean;
  modelId?: string;
  pageContext?: Record<string, unknown>;
  enabledCapabilityPackIds?: string[];
  enabledMcpServerIds?: string[];
  title?: string;
  createdBy?: number | null;
};

/** DB Enricher — one job per DbEnrichmentRun row. */
export type DbEnrichmentJobEnvelope = {
  runId: number;
  dataSourceId: string;
  scope: 'FULL' | 'TABLES';
  tables?: string[];
  modelId?: string;
  title?: string;
};

export type EnqueueDbEnrichmentJobInput = Omit<DbEnrichmentJobEnvelope, 'runId'> & {
  runId: number;
  createdBy?: number | null;
};
