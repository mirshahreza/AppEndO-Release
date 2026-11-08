/**
 * Data API · HWY institutes · update
 *
 * Definition : ea_e742d03289342f6c
 * Operation  : op_update_pw1r4h (PUT /api/hwy/institutes/:pk)
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
const EDGE_API_OPERATION_ID = "op_update_pw1r4h";
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
  "id": "op_update_pw1r4h",
  "method": "PUT",
  "kind": "update",
  "pathPattern": "/api/hwy/institutes/:pk",
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
  const params = req.params ?? {};
  const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  // PUT updates writable fields present in the request body.
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const writablePayload = Object.fromEntries(
    WRITE_FIELDS
      .filter((field) => payload[field] !== undefined)
      .map((field) => [field, payload[field]]),
  );
  if (Object.keys(writablePayload).length === 0) {
    return res.status(400).json({ success: false, error: 'Request body must include at least one updatable field.' });
  }
  const auditedPayload = applyDataApiAuditFields(
    writablePayload,
    WRITE_FIELDS,
    "update",
    req.auth?.userId,
  );

  const row = await HwyInstitutes.findOne({ where: pkWhere });
  if (!row) {
    return res.status(404).json({ success: false, error: 'Record not found.' });
  }

  const logoPayload = { ...payload };
  await row.update(auditedPayload);
  const instituteId = Number((pkWhere as Record<string, unknown>).id ?? params.pk);
  if (Number.isFinite(instituteId) && instituteId > 0) {
    await applyHwyInstituteLogoPayloadFields(instituteId, logoPayload);
  }
  const plain = row.get({ plain: true }) as Record<string, unknown>;
  const responseData = Object.fromEntries(
    READ_FIELDS
      .filter((field) => plain[field] !== undefined)
      .map((field) => [field, plain[field]]),
  );
  return res.json({
    success: true,
    data: responseData,
    source: {
    id: source.id,
    name: source.name,
    type: source.type,
  },
  });
}
