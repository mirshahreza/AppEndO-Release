/**
 * CRM Phase 2 — DATA_API operation projections (enrichments + related counts + write locks).
 * v2: customer = base_users + base_user_profiles + `crm_customers` extension.
 */

import type { EdgeApiFieldEnrichment, EdgeApiOperation } from '../../src/shared/api/contracts/data-api';

const LANG = 'fixed:en' as const;

const bi = (
  id: string,
  sourceField: string,
  outputField: string,
  extras: Array<{ sourceColumn: string; outputField: string }> = [],
): EdgeApiFieldEnrichment => ({
  id,
  sourceField,
  kind: 'base_info_title',
  joinTableSource: 'base_info',
  langSource: LANG,
  attachedFields: [
    { sourceColumn: 'title', outputField },
    ...extras,
  ],
});

const userJoin = (
  id: string,
  sourceField: string,
  usersModelId: string,
  outputField: string,
): EdgeApiFieldEnrichment => ({
  id,
  sourceField,
  kind: 'join_lookup',
  joinTableSource: 'edge_model',
  targetModelId: usersModelId,
  targetMatchColumn: 'id',
  attachedFields: [{ sourceColumn: 'username', outputField }],
});

/** Join a `*_user_id` field to `base_user_profiles` (PK = user_id, not id). */
const profileJoin = (
  id: string,
  sourceField: string,
  profilesModelId: string,
  outputPrefix: string,
): EdgeApiFieldEnrichment => ({
  id,
  sourceField,
  kind: 'join_lookup',
  joinTableSource: 'edge_model',
  targetModelId: profilesModelId,
  targetMatchColumn: 'userId',
  attachedFields: [
    { sourceColumn: 'firstname', outputField: `${outputPrefix}Firstname` },
    { sourceColumn: 'lastname', outputField: `${outputPrefix}Lastname` },
    { sourceColumn: 'nickname', outputField: `${outputPrefix}Nickname` },
    { sourceColumn: 'company_name', outputField: `${outputPrefix}CompanyName` },
  ],
});

export const CRM_OPPORTUNITIES_SUMMARY_FIELDS = [
  'id',
  'customerUserId',
  'title',
  'stageCode',
  'amount',
  'expectedCloseDate',
  'closedAt',
  'ownerId',
  'updatedAt',
] as const;

export const CRM_OPPORTUNITIES_ENRICHMENTS = (
  usersModelId: string,
  profilesModelId: string,
): EdgeApiFieldEnrichment[] => [
  bi('crm_enrich_stage', 'stageCode', 'stageCodeTitle', [
    { sourceColumn: 'ui_color', outputField: 'stageCodeUiColor' },
  ]),
  userJoin('crm_enrich_opp_owner', 'ownerId', usersModelId, 'ownerIdUsername'),
  userJoin('crm_enrich_opp_customer', 'customerUserId', usersModelId, 'customerUserIdUsername'),
  profileJoin('crm_enrich_opp_customer_profile', 'customerUserId', profilesModelId, 'customerUserId'),
  userJoin('crm_enrich_opp_created_by', 'createdBy', usersModelId, 'createdByUsername'),
  userJoin('crm_enrich_opp_updated_by', 'updatedBy', usersModelId, 'updatedByUsername'),
];

export const CRM_TICKETS_SUMMARY_FIELDS = [
  'id',
  'customerUserId',
  'subject',
  'statusCode',
  'priorityCode',
  'channelCode',
  'assignedTo',
  'openedAt',
  'closedAt',
  'updatedAt',
] as const;

export const CRM_TICKETS_ENRICHMENTS = (
  usersModelId: string,
  profilesModelId: string,
): EdgeApiFieldEnrichment[] => [
  bi('crm_enrich_ticket_status', 'statusCode', 'statusCodeTitle', [
    { sourceColumn: 'ui_color', outputField: 'statusCodeUiColor' },
  ]),
  bi('crm_enrich_ticket_priority', 'priorityCode', 'priorityCodeTitle'),
  bi('crm_enrich_ticket_channel', 'channelCode', 'channelCodeTitle'),
  userJoin('crm_enrich_ticket_assignee', 'assignedTo', usersModelId, 'assignedToUsername'),
  userJoin('crm_enrich_ticket_customer', 'customerUserId', usersModelId, 'customerUserIdUsername'),
  profileJoin('crm_enrich_ticket_customer_profile', 'customerUserId', profilesModelId, 'customerUserId'),
  userJoin('crm_enrich_ticket_created_by', 'createdBy', usersModelId, 'createdByUsername'),
  userJoin('crm_enrich_ticket_updated_by', 'updatedBy', usersModelId, 'updatedByUsername'),
];

export const CRM_ACTIVITIES_SUMMARY_FIELDS = [
  'id',
  'customerUserId',
  'opportunityId',
  'activityTypeCode',
  'subject',
  'dueAt',
  'completedAt',
  'ownerId',
  'updatedAt',
] as const;

export const CRM_ACTIVITIES_ENRICHMENTS = (
  usersModelId: string,
  profilesModelId: string,
): EdgeApiFieldEnrichment[] => [
  bi('crm_enrich_activity_type', 'activityTypeCode', 'activityTypeCodeTitle'),
  userJoin('crm_enrich_activity_owner', 'ownerId', usersModelId, 'ownerIdUsername'),
  userJoin('crm_enrich_activity_customer', 'customerUserId', usersModelId, 'customerUserIdUsername'),
  profileJoin('crm_enrich_activity_customer_profile', 'customerUserId', profilesModelId, 'customerUserId'),
];

/** Disable write ops that domain actions own; keep list/getOne (+ optional create). */
export const disableKinds = (
  operation: EdgeApiOperation,
  kinds: ReadonlyArray<EdgeApiOperation['kind']>,
): EdgeApiOperation => (
  kinds.includes(operation.kind) ? { ...operation, enabled: false } : operation
);

export const patchListEnrichments = (
  operation: EdgeApiOperation,
  input: {
    summaryFields: readonly string[];
    enrichments: EdgeApiFieldEnrichment[];
    computedFields?: EdgeApiOperation['computedFields'];
  },
): EdgeApiOperation => {
  if (operation.kind === 'list' && operation.method === 'GET') {
    return {
      ...operation,
      fields: { ...operation.fields, read: [...input.summaryFields] },
      enrichments: input.enrichments,
      computedFields: input.computedFields ?? operation.computedFields,
      query: {
        allowFilter: operation.query?.allowFilter ?? true,
        allowSort: operation.query?.allowSort ?? true,
        maxPageSize: operation.query?.maxPageSize ?? 100,
        defaultPageSize: operation.query?.defaultPageSize ?? 50,
        allowLangParam: operation.query?.allowLangParam,
        includes: operation.query?.includes,
        views: {
          ...(operation.query?.views ?? {}),
          summary: [...input.summaryFields],
          detail: operation.fields?.read,
        },
      },
    };
  }
  if (operation.kind === 'getOne' && operation.method === 'GET') {
    return {
      ...operation,
      enrichments: input.enrichments,
      computedFields: input.computedFields ?? operation.computedFields,
    };
  }
  return operation;
};

/** Opportunities patch/update must not accept stageCode — use change-stage domain action. */
export const stripStageFromWrites = (operation: EdgeApiOperation): EdgeApiOperation => {
  if (operation.kind !== 'update' && operation.kind !== 'patch' && operation.kind !== 'create') {
    return operation;
  }
  const write = (operation.fields?.write ?? []).filter((field) => field !== 'stageCode');
  if (operation.kind === 'create') {
    return {
      ...operation,
      fields: {
        ...operation.fields,
        write: [...write, 'stageCode'],
      },
    };
  }
  return {
    ...operation,
    fields: {
      ...operation.fields,
      write,
    },
  };
};
