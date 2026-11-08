/**
 * Data API · CMS Content Assets · delete
 *
 * Definition : ea_e659dcd57b82a6c3
 * Operation  : op_delete_pr4zqo (DELETE /api/cms/assets/:pk)
 * Model      : CmsContentAssets (em_1cd186b841dd21d7)
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
import { resolveDataApiListIncludeCount } from '@/server/services/data-api/dataApiListCount';
import { resolvePrimaryKeyWhere } from '@/server/services/data-api/sequelize/buildDynamicModel';
import { resolvePublishedEdgeModel, resolveFieldEnrichmentDeps } from '@/server/services/data-api/dataApiPublishedRuntime';
import { executePivot } from '@/server/services/data-api/pivotExecute';

const EDGE_MODEL_ID = "em_1cd186b841dd21d7";
const EDGE_API_DEFINITION_ID = "ea_e659dcd57b82a6c3";
const EDGE_API_OPERATION_ID = "op_delete_pr4zqo";
const MODEL_ALIAS = "CmsContentAssets";
const READ_FIELDS = ["id","contentId","file","fileXs","fileSize","fileName","fileMime","sortOrder","sha256","createdBy","createdAt","updatedBy","updatedAt"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const ALLOW_FILTER = true;
const ALLOW_SORT = true;
const OPERATION = {
  "id": "op_delete_pr4zqo",
  "method": "DELETE",
  "kind": "delete",
  "pathPattern": "/api/cms/assets/:pk",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "contentId",
      "file",
      "fileXs",
      "fileSize",
      "fileName",
      "fileMime",
      "sortOrder",
      "sha256",
      "createdBy",
      "createdAt",
      "updatedBy",
      "updatedAt"
    ]
  }
} as const;

export default async function handler(req: any, res: any) {
  const { Model: CmsContentAssets, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const params = req.params ?? {};
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const deleted = await CmsContentAssets.destroy({ where: pkWhere });
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
