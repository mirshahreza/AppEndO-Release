/**
 * Data API · HWY institutes · create
 *
 * Definition : ea_e742d03289342f6c
 * Operation  : op_create_pw1r4h (POST /api/hwy/institutes)
 * Model      : HwyInstitutes (em_1a1c328e8c425ae3)
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
import { applyHwyInstituteLogoPayloadFields } from '@/server/domain/hwy/hwyInstituteLogo.service';

const EDGE_MODEL_ID = "em_1a1c328e8c425ae3";
const EDGE_API_DEFINITION_ID = "ea_e742d03289342f6c";
const EDGE_API_OPERATION_ID = "op_create_pw1r4h";
const MODEL_ALIAS = "HwyInstitutes";
const READ_FIELDS = ["id","code","titleAr","isActive","allowsSelfRegistration","allowsInvite","inviteExpiresAfterDays","hideMemberPhones","hasDedicatedList","allowsListScopedEdit","showInstituteCharacterInDossier","logoUrl","note","createdBy","createdAt","updatedBy","updatedAt"] as const;
const WRITE_FIELDS = ["titleAr","isActive","allowsSelfRegistration","allowsInvite","inviteExpiresAfterDays","hideMemberPhones","hasDedicatedList","allowsListScopedEdit","showInstituteCharacterInDossier","note","createdBy","createdAt","updatedBy","updatedAt"] as const;
const REQUIRED_FIELDS = ["titleAr","isActive","allowsSelfRegistration","allowsInvite","hideMemberPhones","hasDedicatedList","allowsListScopedEdit","showInstituteCharacterInDossier","createdAt","updatedAt"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const ALLOW_FILTER = true;
const ALLOW_SORT = true;
const OPERATION = {
  "id": "op_create_pw1r4h",
  "method": "POST",
  "kind": "create",
  "pathPattern": "/api/hwy/institutes",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "code",
      "titleAr",
      "isActive",
      "allowsSelfRegistration",
      "allowsInvite",
      "inviteExpiresAfterDays",
      "hideMemberPhones",
      "hasDedicatedList",
      "allowsListScopedEdit",
      "showInstituteCharacterInDossier",
      "logoUrl",
      "note",
      "createdBy",
      "createdAt",
      "updatedBy",
      "updatedAt"
    ],
    "write": [
      "code",
      "titleAr",
      "isActive",
      "allowsSelfRegistration",
      "allowsInvite",
      "inviteExpiresAfterDays",
      "hideMemberPhones",
      "hasDedicatedList",
      "allowsListScopedEdit",
      "showInstituteCharacterInDossier",
      "logoUrl",
      "note",
      "createdBy",
      "createdAt",
      "updatedBy",
      "updatedAt"
    ],
    "required": [
      "titleAr",
      "isActive",
      "allowsSelfRegistration",
      "allowsInvite",
      "hideMemberPhones",
      "hasDedicatedList",
      "allowsListScopedEdit",
      "showInstituteCharacterInDossier",
      "createdAt",
      "updatedAt"
    ]
  }
} as const;

export default async function handler(req: any, res: any) {
  const { Model: HwyInstitutes, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
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
  const logoPayload = { ...payload };
  const created = await HwyInstitutes.create(auditedPayload);
  const createdId = Number(created.get('id'));
  if (Number.isFinite(createdId) && createdId > 0) {
    await applyHwyInstituteLogoPayloadFields(createdId, logoPayload);
  }
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
