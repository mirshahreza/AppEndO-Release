/**
 * Data API · HWY member security profile · delete
 *
 * Definition : ea_03c7d01436955c5c
 * Operation  : op_delete_k4vx4g (DELETE /api/hwy/member-security-profile/:pk)
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
const EDGE_API_OPERATION_ID = "op_delete_k4vx4g";
const MODEL_ALIAS = "HwyMemberSecurityProfile";
const READ_FIELDS = ["id","memberId","canGetIdentityCardCode","canGetIdentityCardNote","canGetResponsibilityCode","canGetResponsibilityNote","canJoinGeneralBodyCode","canJoinGeneralBodyNote","allowsResponsibilityCode","allowsResponsibilityNote","createdBy","createdAt"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const ALLOW_FILTER = true;
const ALLOW_SORT = true;
const OPERATION = {
  "id": "op_delete_k4vx4g",
  "method": "DELETE",
  "kind": "delete",
  "pathPattern": "/api/hwy/member-security-profile/:pk",
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
    ]
  }
} as const;

export default async function handler(req: any, res: any) {
  const { Model: HwyMemberSecurityProfile, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const params = req.params ?? {};
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const deleted = await HwyMemberSecurityProfile.destroy({ where: pkWhere });
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
