import type { AgentIterationTrace } from '../../../core/ai/agent/types';
import type { AgentMode } from '../../../shared/api/contracts/ai/agentTypes';
import { fromUserId, prisma, toUserId } from '../users/prismaHelpers';

export type AgentTraceRow = {
  id: number;
  session_id: number | null;
  user_id: number;
  iteration: number;
  model_id: string | null;
  mode: string;
  policy_action: string | null;
  tool_name: string | null;
  args_hash: string | null;
  duration_ms: number | null;
  tokens_estimate: number | null;
  ok: boolean | null;
  error: string | null;
  summary: string | null;
  created_at: string;
};

export type AgentTraceRecord = {
  id: number;
  sessionId: number | null;
  userId: number;
  iteration: number;
  modelId: string | null;
  mode: AgentMode;
  policyAction: string | null;
  toolName: string | null;
  argsHash: string | null;
  durationMs: number | null;
  tokensEstimate: number | null;
  ok: boolean | null;
  error: string | null;
  summary: string | null;
  createdAt: string;
};

const toIsoString = (value: Date | null | undefined): string =>
  value instanceof Date ? value.toISOString() : String(value ?? '');

const mapTraceRow = (row: {
  id: bigint;
  sessionId: bigint | null;
  userId: bigint;
  iteration: number;
  modelId: string | null;
  mode: string;
  policyAction: string | null;
  toolName: string | null;
  argsHash: string | null;
  durationMs: number | null;
  tokensEstimate: number | null;
  ok: boolean | null;
  error: string | null;
  summary: string | null;
  createdAt: Date | null;
}): AgentTraceRow => ({
  id: fromUserId(row.id),
  session_id: row.sessionId !== null ? fromUserId(row.sessionId) : null,
  user_id: fromUserId(row.userId),
  iteration: row.iteration,
  model_id: row.modelId,
  mode: row.mode,
  policy_action: row.policyAction,
  tool_name: row.toolName,
  args_hash: row.argsHash,
  duration_ms: row.durationMs,
  tokens_estimate: row.tokensEstimate,
  ok: row.ok,
  error: row.error,
  summary: row.summary,
  created_at: toIsoString(row.createdAt),
});

const toRecord = (row: AgentTraceRow): AgentTraceRecord => ({
  id: Number(row.id),
  sessionId: row.session_id !== null ? Number(row.session_id) : null,
  userId: Number(row.user_id),
  iteration: Number(row.iteration),
  modelId: row.model_id,
  mode: row.mode as AgentMode,
  policyAction: row.policy_action,
  toolName: row.tool_name,
  argsHash: row.args_hash,
  durationMs: row.duration_ms !== null ? Number(row.duration_ms) : null,
  tokensEstimate: row.tokens_estimate !== null ? Number(row.tokens_estimate) : null,
  ok: row.ok,
  error: row.error,
  summary: row.summary,
  createdAt: row.created_at,
});

const traceSelect = {
  id: true,
  sessionId: true,
  userId: true,
  iteration: true,
  modelId: true,
  mode: true,
  policyAction: true,
  toolName: true,
  argsHash: true,
  durationMs: true,
  tokensEstimate: true,
  ok: true,
  error: true,
  summary: true,
  createdAt: true,
} as const;

export const insertAgentTraces = async (input: {
  sessionId?: number;
  userId: number;
  mode: AgentMode;
  traces: AgentIterationTrace[];
}): Promise<void> => {
  if (!input.traces.length) return;

  await prisma().baseAiAgentTrace.createMany({
    data: input.traces.map((trace) => ({
      sessionId: input.sessionId !== undefined ? toUserId(input.sessionId) : null,
      userId: toUserId(input.userId),
      iteration: trace.iteration,
      modelId: trace.modelId,
      mode: input.mode,
      policyAction: trace.policyAction,
      toolName: trace.toolName ?? null,
      argsHash: trace.argsHash ?? null,
      durationMs: trace.durationMs ?? null,
      tokensEstimate: trace.tokensEstimate ?? null,
      ok: trace.ok ?? null,
      error: trace.error ?? null,
      summary: trace.summary ?? null,
    })),
  });
};

export const listAgentTracesForSession = async (
  sessionId: number,
  userId: number,
): Promise<AgentTraceRecord[]> => {
  const rows = await prisma().baseAiAgentTrace.findMany({
    where: {
      sessionId: toUserId(sessionId),
      userId: toUserId(userId),
    },
    select: traceSelect,
    orderBy: [{ iteration: 'asc' }, { id: 'asc' }],
  });

  return rows.map((row) => toRecord(mapTraceRow(row)));
};

export const findLatestAgentTraceSession = async (
  sessionId: number,
  userId: number,
): Promise<AgentTraceRecord | undefined> => {
  const row = await prisma().baseAiAgentTrace.findFirst({
    where: {
      sessionId: toUserId(sessionId),
      userId: toUserId(userId),
    },
    select: traceSelect,
    orderBy: { id: 'desc' },
  });

  return row ? toRecord(mapTraceRow(row)) : undefined;
};

export type AgentStatsSummary = {
  runsLast24h: number;
  toolCallsLast24h: number;
  tokensEstimateLast24h: number;
  appliesLast24h: number;
  applyRatePercent: number | null;
};

const last24Hours = (): Date => new Date(Date.now() - 24 * 60 * 60 * 1000);

export const getAgentStatsSummary = async (): Promise<AgentStatsSummary> => {
  const since = last24Hours();

  const [sessionRunCountRows, orphanRunCount, toolCallsLast24h, tokenAggregate, appliesLast24h] = await Promise.all([
    prisma().$queryRaw<Array<{ c: bigint | number | string | null }>>`
      SELECT COUNT(DISTINCT session_id) AS c
      FROM base_ai_agent_traces
      WHERE created_at >= ${since}
        AND session_id IS NOT NULL
    `,
    prisma().baseAiAgentTrace.count({
      where: {
        createdAt: { gte: since },
        sessionId: null,
      },
    }),
    prisma().baseAiAgentTrace.count({
      where: {
        createdAt: { gte: since },
        toolName: { not: null },
      },
    }),
    prisma().baseAiAgentTrace.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { tokensEstimate: true },
    }),
    prisma().baseAiAgentApplySnapshot.count({
      where: {
        appliedAt: { gte: since },
        rolledBackAt: null,
      },
    }),
  ]);

  const runsLast24h = Number(sessionRunCountRows[0]?.c ?? 0) + orphanRunCount;
  const tokensEstimateLast24h = tokenAggregate._sum.tokensEstimate ?? 0;

  return {
    runsLast24h,
    toolCallsLast24h,
    tokensEstimateLast24h,
    appliesLast24h,
    applyRatePercent: runsLast24h > 0
      ? Math.round((appliesLast24h / runsLast24h) * 100)
      : null,
  };
};
