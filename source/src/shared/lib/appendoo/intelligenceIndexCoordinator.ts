import type {
  EnqueueIntelligenceIndexInput,
  IntelligenceIndexJob,
  IntelligenceIndexJobKind,
} from '../../api/contracts/appendoo/applicationIntelligence.types';
import { bumpSemanticGraphIndexVersion } from './semanticGraphStore';

const jobs = new Map<string, IntelligenceIndexJob>();
let jobSequence = 0;

const buildIdempotencyKey = (input: EnqueueIntelligenceIndexInput): string => (
  input.idempotencyKey?.trim()
  || [
    input.kind,
    input.applicationScopeRef ?? '',
    input.packageId ?? '',
    input.artifactRef?.artifactId ?? '',
  ].join(':')
);

export const resetIntelligenceIndexCoordinatorForTests = (): void => {
  jobs.clear();
  jobSequence = 0;
};

export const enqueueIntelligenceIndexJob = (
  input: EnqueueIntelligenceIndexInput,
): IntelligenceIndexJob => {
  const idempotencyKey = buildIdempotencyKey(input);
  const existing = [...jobs.values()].find((job) => job.idempotencyKey === idempotencyKey);
  if (existing) {
    return existing;
  }

  jobSequence += 1;
  const job: IntelligenceIndexJob = {
    jobId: `idxjob:${jobSequence}`,
    kind: input.kind,
    status: 'queued',
    idempotencyKey,
    applicationScopeRef: input.applicationScopeRef,
    artifactRef: input.artifactRef,
    packageId: input.packageId,
    createdAt: new Date().toISOString(),
  };
  jobs.set(job.jobId, job);
  return job;
};

const completeJob = (jobId: string): IntelligenceIndexJob | undefined => {
  const job = jobs.get(jobId);
  if (!job) return undefined;

  const completed: IntelligenceIndexJob = {
    ...job,
    status: 'completed',
    completedAt: new Date().toISOString(),
  };
  jobs.set(jobId, completed);
  bumpSemanticGraphIndexVersion();
  return completed;
};

export const getIntelligenceIndexJob = (jobId: string): IntelligenceIndexJob | undefined => (
  jobs.get(jobId)
);

export const listIntelligenceIndexJobs = (): IntelligenceIndexJob[] => [...jobs.values()];

export const reindexArtifact = (input: {
  applicationScopeRef: string;
  artifactRef: EnqueueIntelligenceIndexInput['artifactRef'];
  idempotencyKey?: string;
}): IntelligenceIndexJob => {
  const queued = enqueueIntelligenceIndexJob({
    kind: 'reindex_artifact',
    applicationScopeRef: input.applicationScopeRef,
    artifactRef: input.artifactRef,
    idempotencyKey: input.idempotencyKey,
  });
  return completeJob(queued.jobId) ?? queued;
};

export const reindexPackage = (input: {
  applicationScopeRef: string;
  packageId: string;
  idempotencyKey?: string;
}): IntelligenceIndexJob => {
  const queued = enqueueIntelligenceIndexJob({
    kind: 'reindex_package',
    applicationScopeRef: input.applicationScopeRef,
    packageId: input.packageId,
    idempotencyKey: input.idempotencyKey,
  });
  return completeJob(queued.jobId) ?? queued;
};

export const rebuildApplication = (input: {
  applicationScopeRef: string;
  idempotencyKey?: string;
}): IntelligenceIndexJob => {
  const queued = enqueueIntelligenceIndexJob({
    kind: 'rebuild_application',
    applicationScopeRef: input.applicationScopeRef,
    idempotencyKey: input.idempotencyKey,
  });
  return completeJob(queued.jobId) ?? queued;
};

export const getIntelligenceIndexQueueDepth = (): number => (
  [...jobs.values()].filter((job) => job.status === 'queued' || job.status === 'running').length
);

export const getIntelligenceIndexFailureCount = (): number => (
  [...jobs.values()].filter((job) => job.status === 'failed').length
);

export const getIntelligenceIndexJobKindCount = (kind: IntelligenceIndexJobKind): number => (
  [...jobs.values()].filter((job) => job.kind === kind).length
);
