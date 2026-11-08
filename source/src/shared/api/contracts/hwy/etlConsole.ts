export type HwyEtlStepKind =
  | 'migrate'
  | 'repair'
  | 'backfill'
  | 'sync'
  | 'orchestrator'
  | 'diagnostic';

export type HwyEtlStepRisk = 'safe' | 'mutating' | 'destructive';

export type HwyEtlEnvOptionType = 'boolean' | 'number' | 'string';

export type HwyEtlEnvOption = {
  key: string;
  label: string;
  description: string;
  type: HwyEtlEnvOptionType;
  defaultValue?: string | number | boolean;
};

export type HwyEtlStepDefinition = {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  scriptRel: string;
  npmScript?: string;
  kind: HwyEtlStepKind;
  risk: HwyEtlStepRisk;
  cliArgs?: string[];
  envOptions?: HwyEtlEnvOption[];
};

export type HwyEtlCategoryDefinition = {
  id: string;
  title: string;
  description: string;
  order: number;
};

export type HwyEtlPresetDefinition = {
  id: string;
  title: string;
  description: string;
  stepIds: string[];
  /** When set, runs this orchestrator step instead of stepIds (stepIds ignored). */
  orchestratorStepId?: string;
  defaultRunOptions?: HwyEtlRunOptions;
  /** Per-step run options when preset runs multiple scripts (e.g. orchestrator CLI flags only). */
  stepRunOptions?: Record<string, HwyEtlRunOptions>;
};

export type HwyEtlSyncMode = 'incremental' | 'replace';

export type HwyEtlRunOptions = {
  env?: Record<string, string | number | boolean>;
  cliArgs?: string[];
  shardCount?: number;
  /** Default incremental: merge/idempotent scripts skip replace flags. */
  syncMode?: HwyEtlSyncMode;
};

export type HwyEtlRunStatus = 'idle' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type HwyEtlRunStepRecord = {
  stepId: string;
  title: string;
  status: Exclude<HwyEtlRunStatus, 'idle'>;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
};

export type HwyEtlRunRecord = {
  id: string;
  label: string;
  status: HwyEtlRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  steps: HwyEtlRunStepRecord[];
  logTail: string[];
};

export type HwyEtlLegacyProbe = {
  ok: boolean;
  configPath: string;
  server: string | null;
  database: string | null;
  message: string;
};

export type HwyEtlLocalCounts = {
  members: number;
  membersWithUser: number;
  nakhebin: number;
  changeHistoryEvents: number;
  geoMapRows: number;
};

export type HwyEtlSyncStateSummary = {
  lastSuccessfulSyncAt: string | null;
  lastLegacyMemberUpdatedOn: string | null;
  lastChangeHistoryId: number;
};

export type HwyEtlConsoleStatusPayload = {
  legacy: HwyEtlLegacyProbe;
  local: HwyEtlLocalCounts | null;
  activeRun: HwyEtlRunRecord | null;
  queueLength: number;
  syncState: HwyEtlSyncStateSummary | null;
};

export type HwyEtlStartRunRequest = {
  kind: 'step' | 'preset' | 'pipeline';
  stepId?: string;
  presetId?: string;
  pipelineStepIds?: string[];
  options?: HwyEtlRunOptions;
};

export type HwyEtlSyncPlanRequest = {
  options?: HwyEtlRunOptions;
};

export type HwyEtlSyncPlanPayload = {
  ready: boolean;
  message: string;
  statePath?: string;
  localMaxMemberId: number;
  lookbackHours: number;
  updatedSinceIso: string | null;
  lastChangeHistoryId: number;
  legacyUpdatedMemberCount: number;
  changeHistoryMemberCount: number;
  targetMemberCount: number;
  estimatedNewMembers: number;
  runDomainModules: boolean;
  steps: string[];
};

export type HwyEtlCatalogPayload = {
  categories: HwyEtlCategoryDefinition[];
  steps: HwyEtlStepDefinition[];
  presets: HwyEtlPresetDefinition[];
};
