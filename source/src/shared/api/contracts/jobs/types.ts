export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type JobRecord = {
  id: number;
  job_type: string;
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

export type JobStats = {
  pending: number;
  running: number;
};

export type JobListResponse = {
  success: boolean;
  items: JobRecord[];
  stats: JobStats;
};

export type JobStreamSnapshot = {
  type: 'snapshot';
  items: JobRecord[];
  stats: JobStats;
};

export type EnqueueJobPayload = {
  functionId: string;
  title?: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type JobGridRow = JobRecord & {
  title: string;
  functionId: string;
  sourceLabel: string;
};
