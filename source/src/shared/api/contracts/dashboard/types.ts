import type { CacheStatusPayload } from '../cache/types';
import type { JobRecord, JobStatus } from '../jobs/types';
import type { LogLevel } from '../logs/types';

export type DashboardSummaryHealth = 'ok' | 'unknown';
export type DashboardSummaryReady = 'ready' | 'not_ready' | 'unknown';

export type DashboardSummaryActivityLog = {
  id: number;
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
};

export type DashboardSummaryActivityJob = {
  id: number;
  status: JobStatus;
  job_type: string;
  started_at: string | null;
  queued_at: string | null;
  created_at: string;
  error_message: string | null;
  progress_message: string | null;
};

export type DashboardSummaryPayload = {
  generatedAt: string;
  health: DashboardSummaryHealth;
  ready: DashboardSummaryReady;
  users: {
    count: number;
  };
  jobs: {
    pending: number;
    running: number;
  };
  scheduler: {
    enabled: boolean;
    activeTaskCount: number;
    nextRunAt: string | null;
    nextRunTaskName: string | null;
  };
  serverFunctions: {
    count: number;
  };
  cache: CacheStatusPayload;
  dataSources: {
    total: number;
    connected: number;
  };
  plugins: {
    total: number;
    active: number;
  };
  ai: {
    enabled: boolean;
    enabledModelCount: number;
    providerCount: number;
    defaultModelId: string;
    defaultModelName: string | null;
  };
  agentStats: {
    runsLast24h: number;
    toolCallsLast24h: number;
    tokensEstimateLast24h: number;
    appliesLast24h: number;
    applyRatePercent: number | null;
  };
  activity: {
    logs: DashboardSummaryActivityLog[];
    jobs: DashboardSummaryActivityJob[];
  };
};

export type DashboardSummaryResponse = {
  success: true;
  summary: DashboardSummaryPayload;
};
