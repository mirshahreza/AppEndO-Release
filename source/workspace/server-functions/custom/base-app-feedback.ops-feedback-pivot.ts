/**
 * Data API · Feedback pivot · pivot
 *
 * Definition : ea_ops_feedback_pivot
 * Operation  : ops_feedback-pivot (POST /api/ops/ops_feedback/pivot)
 * Model      : BaseAppFeedback (em_f186ade9fbfe1ad0)
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

const EDGE_MODEL_ID = "em_f186ade9fbfe1ad0";
const EDGE_API_DEFINITION_ID = "ea_ops_feedback_pivot";
const EDGE_API_OPERATION_ID = "ops_feedback-pivot";
const MODEL_ALIAS = "BaseAppFeedback";
const READ_FIELDS = ["id","type","status","priority","submitted_at","page_key","portal_slug","assignee_role_name","message_count"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 1000;
const DEFAULT_PAGE_SIZE = 100;
const ALLOW_FILTER = true;
const ALLOW_SORT = false;
const OPERATION = {
  "id": "ops_feedback-pivot",
  "method": "POST",
  "kind": "pivot",
  "pathPattern": "/api/ops/ops_feedback/pivot",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "type",
      "status",
      "priority",
      "submitted_at",
      "page_key",
      "portal_slug",
      "assignee_role_name",
      "message_count"
    ]
  },
  "query": {
    "allowFilter": true,
    "allowSort": false,
    "maxPageSize": 1000,
    "defaultPageSize": 100
  }
} as const;

export default async function handler(req: any, res: any) {
  const { Model: BaseAppFeedback, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const result = await executePivot({
    spec: req.body,
    dataSource: source,
    policyContextKey: String(req.auth?.userId ?? 'anon'),
    allowedFields: new Set(resolveReadableAttributes(OPERATION, model) ?? []),
    ModelCtor: BaseAppFeedback,
    sequelize,
    dialect: source.type,
    noCache: Boolean(req.body?.noCache) || req.query?.noCache === '1',
  });
  return res.json(result);
}
