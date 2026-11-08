/**
 * Data API · CMS Content Revisions · delete
 *
 * Definition : ea_579348c45cab4d2b
 * Operation  : op_delete_rl004l (DELETE /api/cms/revisions/:pk)
 * Model      : CmsContentRevisions (em_0033c2db1f0bdc7f)
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

const EDGE_MODEL_ID = "em_0033c2db1f0bdc7f";
const EDGE_API_DEFINITION_ID = "ea_579348c45cab4d2b";
const EDGE_API_OPERATION_ID = "op_delete_rl004l";
const MODEL_ALIAS = "CmsContentRevisions";
const READ_FIELDS = ["id","contentId","revisionNo","title","summary","body","createdBy","createdAt"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const ALLOW_FILTER = true;
const ALLOW_SORT = true;
const OPERATION = {
  "id": "op_delete_rl004l",
  "method": "DELETE",
  "kind": "delete",
  "pathPattern": "/api/cms/revisions/:pk",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "contentId",
      "revisionNo",
      "title",
      "summary",
      "body",
      "createdBy",
      "createdAt"
    ]
  }
} as const;

export default async function handler(req: any, res: any) {
  const { Model: CmsContentRevisions, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const params = req.params ?? {};
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const deleted = await CmsContentRevisions.destroy({ where: pkWhere });
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
