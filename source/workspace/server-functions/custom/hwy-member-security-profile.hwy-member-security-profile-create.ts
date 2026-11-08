/**
 * Data API · HWY member security profile · create
 *
 * Definition : ea_03c7d01436955c5c
 * Operation  : op_create_k4vx4g (POST /api/hwy/member-security-profile)
 * Model      : HwyMemberSecurityProfile (em_e7882fa0d4e9bc02)
 *
 * Runtime engine: DATA_API (Sequelize DataApiExecutor).
 * Custom handlers that bypass DataApiExecutor must call emitRecordEvent.
 * Handler below mirrors the published Sequelize operation implementation.
 */

import { QueryTypes } from 'sequelize';
import {
  parsePositiveInt,
  parseFilterQuery,
  buildWhereFromFilter,
  parseSearchQuery,
  buildSearchWhere,
  resolveSearchableFields,
  parseSortQuery,
  parseIncludeAliases,
  buildIncludeOptionsFromOperation,
  buildQueryAttributes,
  resolveReadableAttributes,
  resolveLookupWhere,
} from '@/server/services/data-api/dataApiQuery';
import { applyDataApiAuditFields } from '@/server/services/data-api/dataApiAuditFields';
import { applyFieldEnrichments, resolveDataApiLang } from '@/server/services/data-api/dataApiFieldEnrichment';
import { resolvePrimaryKeyWhere } from '@/server/services/data-api/sequelize/buildDynamicModel';
import { resolvePublishedEdgeModel, resolveFieldEnrichmentDeps } from '@/server/services/data-api/dataApiPublishedRuntime';
import { executePivot } from '@/server/services/data-api/pivotExecute';

const EDGE_MODEL_ID = "em_e7882fa0d4e9bc02";
const EDGE_API_DEFINITION_ID = "ea_03c7d01436955c5c";
const EDGE_API_OPERATION_ID = "op_create_k4vx4g";
const MODEL_ALIAS = "HwyMemberSecurityProfile";
const READ_FIELDS = ["id","memberId","canGetIdentityCardCode","canGetIdentityCardNote","canGetResponsibilityCode","canGetResponsibilityNote","canJoinGeneralBodyCode","canJoinGeneralBodyNote","allowsResponsibilityCode","allowsResponsibilityNote","createdBy","createdAt"] as const;
const WRITE_FIELDS = ["memberId","canGetIdentityCardCode","canGetIdentityCardNote","canGetResponsibilityCode","canGetResponsibilityNote","canJoinGeneralBodyCode","canJoinGeneralBodyNote","allowsResponsibilityCode","allowsResponsibilityNote","createdBy","createdAt"] as const;
const REQUIRED_FIELDS = ["memberId","createdAt"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const ALLOW_FILTER = true;
const ALLOW_SORT = true;
const OPERATION = {
  "id": "op_create_k4vx4g",
  "method": "POST",
  "kind": "create",
  "pathPattern": "/api/hwy/member-security-profile",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "memberId",
      "canGetIdentityCardCode",
      "canGetIdentityCardNote",
      "canGetResponsibilityCode",
      "canGetResponsibilityNote",
      "canJoinGeneralBodyCode",
      "canJoinGeneralBodyNote",
      "allowsResponsibilityCode",
      "allowsResponsibilityNote",
      "createdBy",
      "createdAt"
    ],
    "write": [
      "memberId",
      "canGetIdentityCardCode",
      "canGetIdentityCardNote",
      "canGetResponsibilityCode",
      "canGetResponsibilityNote",
      "canJoinGeneralBodyCode",
      "canJoinGeneralBodyNote",
      "allowsResponsibilityCode",
      "allowsResponsibilityNote",
      "createdBy",
      "createdAt"
    ],
    "required": [
      "memberId",
      "createdAt"
    ]
  }
} as const;

export default async function handler(req: any, res: any) {
  const { Model: HwyMemberSecurityProfile, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};

  for (const field of REQUIRED_FIELDS) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
      return res.status(400).json({ success: false, error: `Field "${field}" is required.` });
    }
  }

  const writablePayload = Object.fromEntries(
    WRITE_FIELDS
      .filter((field) => payload[field] !== undefined)
      .map((field) => [field, payload[field]]),
  );
  if (Object.keys(writablePayload).length === 0) {
    return res.status(400).json({ success: false, error: 'Request body must include at least one writable field.' });
  }

  const auditedPayload = applyDataApiAuditFields(
    writablePayload,
    WRITE_FIELDS,
    'create',
    req.auth?.userId,
  );
  const created = await HwyMemberSecurityProfile.create(auditedPayload);
  return res.json({
    success: true,
    data: created.get({ plain: true }),
    source: {
    id: source.id,
    name: source.name,
    type: source.type,
  },
  });
}
