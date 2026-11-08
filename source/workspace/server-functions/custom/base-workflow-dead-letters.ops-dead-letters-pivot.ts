/**
 * Data API · Dead letters pivot · pivot
 *
 * Definition : ea_ops_dead_letters_pivot
 * Operation  : ops_dead_letters-pivot (POST /api/ops/ops_dead_letters/pivot)
 * Model      : BaseWorkflowDeadLetters (em_e6eb8be71ec07c48)
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

const EDGE_MODEL_ID = "em_e6eb8be71ec07c48";
const EDGE_API_DEFINITION_ID = "ea_ops_dead_letters_pivot";
const EDGE_API_OPERATION_ID = "ops_dead_letters-pivot";
const MODEL_ALIAS = "BaseWorkflowDeadLetters";
const READ_FIELDS = ["id","status","error_class","error_code","node_key","created_at","resolved_at"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 1000;
const DEFAULT_PAGE_SIZE = 100;
const ALLOW_FILTER = true;
const ALLOW_SORT = false;
const OPERATION = {
  "id": "ops_dead_letters-pivot",
  "method": "POST",
  "kind": "pivot",
  "pathPattern": "/api/ops/ops_dead_letters/pivot",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "status",
      "error_class",
      "error_code",
      "node_key",
      "created_at",
      "resolved_at"
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
  const { Model: BaseWorkflowDeadLetters, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const result = await executePivot({
    spec: req.body,
    dataSource: source,
    policyContextKey: String(req.auth?.userId ?? 'anon'),
    allowedFields: new Set(resolveReadableAttributes(OPERATION, model) ?? []),
    ModelCtor: BaseWorkflowDeadLetters,
    sequelize,
    dialect: source.type,
    noCache: Boolean(req.body?.noCache) || req.query?.noCache === '1',
  });
  return res.json(result);
}
