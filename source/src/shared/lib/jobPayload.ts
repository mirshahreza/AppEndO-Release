export type JobMetadata = {
  source?: 'scheduled' | 'manual';
  scheduledTaskId?: string;
  cron?: string;
  cronSlot?: string;
  triggeredAt?: string;
  trigger?: 'cron' | 'manual' | 'catch_up';
  retriedFromJobId?: number;
};

export type ParsedJobPayload = {
  functionId: string;
  title: string;
  userPayload: Record<string, unknown>;
  metadata: JobMetadata;
};

export const parseJobPayload = (raw: string | null): ParsedJobPayload | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<{
      functionId: string;
      title: string;
      userPayload: Record<string, unknown>;
      metadata: JobMetadata;
    }>;

    if (!parsed || typeof parsed !== 'object' || !parsed.functionId) {
      return null;
    }

    return {
      functionId: String(parsed.functionId),
      title: parsed.title ? String(parsed.title) : String(parsed.functionId),
      userPayload: parsed.userPayload && typeof parsed.userPayload === 'object' && !Array.isArray(parsed.userPayload)
        ? parsed.userPayload
        : {},
      metadata: parsed.metadata && typeof parsed.metadata === 'object' && !Array.isArray(parsed.metadata)
        ? parsed.metadata
        : {},
    };
  } catch {
    return null;
  }
};

export const toJobGridRow = <T extends { payload_json: string | null }>(job: T) => {
  const envelope = parseJobPayload(job.payload_json);
  const source = envelope?.metadata.source;
  const sourceLabel = source === 'scheduled'
    ? 'Scheduled'
    : source === 'manual'
      ? 'Manual'
      : envelope?.metadata.scheduledTaskId
        ? 'Scheduled'
        : 'Manual';

  return {
    ...job,
    title: envelope?.title ?? envelope?.functionId ?? `#${(job as { id?: number }).id ?? ''}`,
    functionId: envelope?.functionId ?? '-',
    sourceLabel,
  };
};

export const formatJobDate = (value: string | null) => {
  if (!value) return '-';
  return value.slice(0, 10);
};

export const isJobActive = (status: string) => status === 'pending' || status === 'running';

export const canCancelJob = (status: string) => isJobActive(status);

export const canRetryJob = (status: string) => status === 'failed' || status === 'cancelled';
