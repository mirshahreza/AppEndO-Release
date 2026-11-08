import { z } from 'zod';
import { clientContextConfigSchema } from '../client-context';

export {
  RECORD_CHANGE_REASON_VOCAB_ROOT,
  RECORD_CHANGE_REASON_GENERAL,
  RECORD_CHANGE_REASON_USERS_LOCK,
  RECORD_CHANGE_REASON_USERS_ROLES,
  RECORD_CHANGE_REASON_USERS_LIFECYCLE,
  RECORD_CHANGE_REASON_SAMPLE_MOCK,
  RECORD_CHANGE_REASON_REVERTED,
  RECORD_CHANGE_REASON_LOCK,
  RECORD_CHANGE_REASON_UNLOCK,
  RECORD_CHANGE_REASON_ROLE_ASSIGNMENT,
  RECORD_CHANGE_REASON_FOLDER_OPTIONS,
  RECORD_CHANGE_REASON_SEED_ROWS,
  RECORD_CHANGE_REASON_LEAVES,
  resolveReasonVocabNodeId,
  hasAssignedReasonFolder,
  reasonIncludeGeneralEnabled,
  catalogLabelForReasonCode,
  catalogLeavesForReasonVocab,
  catalogAllowedReasonCodes,
  toChangeReasonSelectOptions,
  unionChangeReasonSelectOptions,
  mergeChangeReasonSelectOptions,
  withSelectedChangeReasonCode,
  RECORD_CHANGE_REASON_FAMILIES,
  familyFolderIdForRoute,
  type ChangeReasonSelectOption,
  type ChangeReasonSeedRow,
} from './changeReasonVocab';

export {
  resolveChangeReasonDialogGate,
  changeReasonAskIsOn,
  changeReasonCaptureNeedsCode,
  changeReasonCaptureNeedsText,
  changeReasonValueSatisfiesPolicy,
  type ChangeReasonDialogGate,
} from './changeReasonDialogGate';

export {
  USERS_PROFILE_CHANGE_REASON,
  USERS_LOCK_CHANGE_REASON,
  USERS_ROLES_CHANGE_REASON,
  USERS_SCOPE_CHANGE_REASON,
  ROLE_CATALOG_CHANGE_REASON,
  SAMPLE_MOCK_CHANGE_REASON,
  functionChangeReasonFallback,
  namedApiAllowsChangeReasonSettings,
  dataApiOperationAllowsChangeReason,
} from './platformApiChangeReason';

export const recordEventKindSchema = z.enum([
  'created',
  'deleted',
  'field.changed',
  'status.changed',
  'association.added',
  'association.removed',
  'access.denied',
  'config.changed',
  'history.erased',
  'history.archived',
]);
export type RecordEventKind = z.infer<typeof recordEventKindSchema>;

export const recordEventSourceSchema = z.enum(['patch', 'workflow', 'status-log']);
export type RecordEventSource = z.infer<typeof recordEventSourceSchema>;

export const recordEventActorKindSchema = z.enum([
  'user',
  'workflow',
  'agent',
  'system',
  'impersonation',
]);
export type RecordEventActorKind = z.infer<typeof recordEventActorKindSchema>;

export const recordEventOutcomeSchema = z.enum(['success', 'denied', 'failed']);
export type RecordEventOutcome = z.infer<typeof recordEventOutcomeSchema>;

export const recordEventReasonAskSchema = z.enum(['off', 'optional', 'required']);
export type RecordEventReasonAsk = z.infer<typeof recordEventReasonAskSchema>;

export const recordEventReasonCaptureSchema = z.enum(['code', 'text', 'both']);
export type RecordEventReasonCapture = z.infer<typeof recordEventReasonCaptureSchema>;

export const edgeModelHistorySchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const { retentionDays: _ignored, ...rest } = value as Record<string, unknown>;
    return rest;
  },
  z.object({
    enabled: z.boolean().default(false),
    lifecycleField: z.string().min(1).optional(),
    legalHold: z.boolean().optional(),
    trackReads: z.boolean().optional(),
    trackViews: z.boolean().optional(),
  }).strict(),
);
export type EdgeModelHistory = z.infer<typeof edgeModelHistorySchema>;

export const edgeColumnHistorySchema = z.object({
  track: z.boolean(),
  redact: z.boolean().optional(),
});
export type EdgeColumnHistory = z.infer<typeof edgeColumnHistorySchema>;

export const edgeAssociationHistorySchema = z.object({
  trackAssignRemove: z.boolean(),
});
export type EdgeAssociationHistory = z.infer<typeof edgeAssociationHistorySchema>;

/** Ask / capture / folder for one named API, not per column. Vocab node is assigned per API, not picked. */
export const changeReasonPolicySchema = z.object({
  reasonAsk: recordEventReasonAskSchema.optional(),
  reasonCapture: recordEventReasonCaptureSchema.optional(),
  reasonVocabNodeId: z.string().min(1).optional(),
  reasonIncludeGeneral: z.boolean().optional(),
});
export type ChangeReasonPolicy = z.infer<typeof changeReasonPolicySchema>;

const recordEventScalarValueSchema = z.object({
  value: z.unknown(),
}).strict();

const recordEventAssociationValueSchema = z.object({
  id: z.union([z.string(), z.number()]),
  label: z.string().optional(),
}).strict();

export const recordEventValueSchema = z.union([
  recordEventScalarValueSchema,
  recordEventAssociationValueSchema,
]);
export type RecordEventValue = z.infer<typeof recordEventValueSchema>;

export const recordEventListQuerySchema = z.object({
  subjectKind: z.string().min(1).optional(),
  subjectKinds: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  actorUserId: z.coerce.number().int().positive().optional(),
  actingAsUserId: z.coerce.number().int().positive().optional(),
  clientChannel: z.string().min(1).optional(),
  eventKind: recordEventKindSchema.optional(),
  source: recordEventSourceSchema.optional(),
  outcome: recordEventOutcomeSchema.optional(),
  field: z.string().min(1).optional(),
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
  where: z.string().min(1).optional(),
  includeAuth: z.enum(['0', '1', 'true', 'false']).optional(),
  includeArchived: z.enum(['0', '1', 'true', 'false']).optional(),
  projection: z.enum(['latest-per-field']).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
}).strict();
export type RecordEventListQuery = z.infer<typeof recordEventListQuerySchema>;

export const recordEventHoldInputSchema = z.object({
  subjectKind: z.string().min(1),
  subjectId: z.string().min(1),
  reasonText: z.string().max(4000).optional(),
}).strict();

export const recordEventEraseInputSchema = z.object({
  subjectKind: z.string().min(1),
  subjectId: z.string().min(1),
  mode: z.enum(['anonymize', 'delete']),
}).strict();

export type RecordEventPublicRow = {
  id: string;
  subjectKind: string;
  subjectId: string;
  occurredAt: string;
  actorUserId: number | null;
  actingAsUserId: number | null;
  actorKind: RecordEventActorKind;
  outcome: RecordEventOutcome;
  source: RecordEventSource;
  sourceRef: string | null;
  requestId: string | null;
  eventKind: string;
  field: string | null;
  fromValue: unknown;
  toValue: unknown;
  reasonCode: string | null;
  reasonText: string | null;
  reasonLabel?: string | null;
  actorUsername?: string | null;
  actorDisplayName?: string | null;
  actingAsUsername?: string | null;
  actingAsDisplayName?: string | null;
  correlationId: string;
  subjectSeq: number;
  clientChannel: string | null;
  clientInstallId: string | null;
  clientJson: unknown;
  payload: unknown;
  clockSkewMinutes?: number | null;
  projection?: 'record' | 'auth';
};

export { clientContextConfigSchema };
export {
  RECORD_EVENT_FILTER_ALL,
  RECORD_EVENT_DATA_API_FILTER_PREFIX,
  RECORD_EVENT_NO_MATCH_KIND,
  RECORD_EVENT_KNOWN_ENTITIES,
  commitRecordEventFilterValue,
  listRecordEventDataApiFilters,
  listRecordEventPlatformApiFilters,
  mergeRecordEventEntityOptions,
  parseDataApiFilterValue,
  parseSubjectKindsCsv,
  resolveRecordEventSubjectKinds,
  subjectKindsForRecordEventApiFilter,
  toDataApiFilterValue,
  toRecordEventListKindParams,
  type RecordEventFilterOption,
} from './filterCatalog';
