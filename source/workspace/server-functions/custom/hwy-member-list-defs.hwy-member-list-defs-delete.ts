/**
 * Data API · HWY member list defs · delete
 *
 * Definition : ea_4ff541961790ea23
 * Operation  : op_delete_p0jfzl (DELETE /api/hwy/member-list-defs/:pk)
 * Model      : HwyMemberListDefs (em_d13ee973a8993e0b)
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

const EDGE_MODEL_ID = "em_d13ee973a8993e0b";
const EDGE_API_DEFINITION_ID = "ea_4ff541961790ea23";
const EDGE_API_OPERATION_ID = "op_delete_p0jfzl";
const MODEL_ALIAS = "HwyMemberListDefs";
const READ_FIELDS = ["id","code","titleAr","listLogicCode","instituteId","predicateRef","isActive","sortOrder","note","createdBy","createdAt","updatedBy","updatedAt"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const ALLOW_FILTER = true;
const ALLOW_SORT = true;
const OPERATION = {
  "id": "op_delete_p0jfzl",
  "method": "DELETE",
  "kind": "delete",
  "pathPattern": "/api/hwy/member-list-defs/:pk",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "code",
      "titleAr",
      "listLogicCode",
      "instituteId",
      "predicateRef",
      "isActive",
      "sortOrder",
      "note",
      "createdBy",
      "createdAt",
      "updatedBy",
      "updatedAt"
    ]
  }
} as const;

export default async function handler(req: any, res: any) {
  const { Model: HwyMemberListDefs, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const params = req.params ?? {};
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const deleted = await HwyMemberListDefs.destroy({ where: pkWhere });
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
