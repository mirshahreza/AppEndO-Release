/**
 * Data API · HWY institutes · delete
 *
 * Definition : ea_e742d03289342f6c
 * Operation  : op_delete_pw1r4h (DELETE /api/hwy/institutes/:pk)
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

const EDGE_MODEL_ID = "em_1a1c328e8c425ae3";
const EDGE_API_DEFINITION_ID = "ea_e742d03289342f6c";
const EDGE_API_OPERATION_ID = "op_delete_pw1r4h";
const MODEL_ALIAS = "HwyInstitutes";
const READ_FIELDS = ["id","code","titleAr","isActive","allowsSelfRegistration","allowsInvite","inviteExpiresAfterDays","hideMemberPhones","hasDedicatedList","allowsListScopedEdit","showInstituteCharacterInDossier","logoUrl","note","createdBy","createdAt","updatedBy","updatedAt"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const ALLOW_FILTER = true;
const ALLOW_SORT = true;
const OPERATION = {
  "id": "op_delete_pw1r4h",
  "method": "DELETE",
  "kind": "delete",
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
    ]
  }
} as const;

export default async function handler(req: any, res: any) {
  const { Model: HwyInstitutes, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const params = req.params ?? {};
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const deleted = await HwyInstitutes.destroy({ where: pkWhere });
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Record not found.' });
  }

  return res.json({
    success: true,
    data: { deleted },
    source: {
    id: source.id,
    name: source.name,
    type: source.type,
  },
  });
}
