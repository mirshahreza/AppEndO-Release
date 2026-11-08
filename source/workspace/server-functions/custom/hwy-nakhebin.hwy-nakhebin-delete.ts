/**
 * Data API · HWY nakhebin · delete
 *
 * Definition : ea_08ae025536ff8bf9
 * Operation  : op_delete_4jawqh (DELETE /api/hwy/nakhebin/:pk)
 * Model      : HwyNakhebin (em_784d292c4bbcac55)
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

const EDGE_MODEL_ID = "em_784d292c4bbcac55";
const EDGE_API_DEFINITION_ID = "ea_08ae025536ff8bf9";
const EDGE_API_OPERATION_ID = "op_delete_4jawqh";
const MODEL_ALIAS = "HwyNakhebin";
const READ_FIELDS = ["id","regionId","maktabId","familyCode","firstName","fatherName","grandfatherName","familyName","birthYear","genderCode","memberId","votedOn2021","votedOn2023","votedOn2025","createdAt","updatedAt","registeredCaseCode","phone1","phone2"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const ALLOW_FILTER = true;
const ALLOW_SORT = true;
const OPERATION = {
  "id": "op_delete_4jawqh",
  "method": "DELETE",
  "kind": "delete",
  "pathPattern": "/api/hwy/nakhebin/:pk",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "regionId",
      "maktabId",
      "familyCode",
      "firstName",
      "fatherName",
      "grandfatherName",
      "familyName",
      "birthYear",
      "genderCode",
      "memberId",
      "votedOn2021",
      "votedOn2023",
      "votedOn2025",
      "createdAt",
      "updatedAt",
      "registeredCaseCode",
      "phone1",
      "phone2"
    ]
  }
} as const;

export default async function handler(req: any, res: any) {
  const { Model: HwyNakhebin, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const params = req.params ?? {};
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const deleted = await HwyNakhebin.destroy({ where: pkWhere });
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
