/**
 * Data API · User directory pivot · pivot
 *
 * Definition : ea_ops_user_directory_pivot
 * Operation  : ops_user_directory-pivot (POST /api/ops/ops_user_directory/pivot)
 * Model      : BaseOpsUserDirectory (em_ops_user_directory)
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

const EDGE_MODEL_ID = "em_ops_user_directory";
const EDGE_API_DEFINITION_ID = "ea_ops_user_directory_pivot";
const EDGE_API_OPERATION_ID = "ops_user_directory-pivot";
const MODEL_ALIAS = "BaseOpsUserDirectory";
const READ_FIELDS = ["id","username","locked","is_builtin","login_fail_count","last_login_at","created_at","person_type_code","role_count","has_profile","has_role","has_identity","has_scope","has_email","email_verified","never_logged_in","is_dormant","has_fail_streak"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 1000;
const DEFAULT_PAGE_SIZE = 100;
const ALLOW_FILTER = true;
const ALLOW_SORT = false;
const OPERATION = {
  "id": "ops_user_directory-pivot",
  "method": "POST",
  "kind": "pivot",
  "pathPattern": "/api/ops/ops_user_directory/pivot",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "username",
      "locked",
      "is_builtin",
      "login_fail_count",
      "last_login_at",
      "created_at",
      "person_type_code",
      "role_count",
      "has_profile",
      "has_role",
      "has_identity",
      "has_scope",
      "has_email",
      "email_verified",
      "never_logged_in",
      "is_dormant",
      "has_fail_streak"
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
  const { Model: BaseOpsUserDirectory, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const result = await executePivot({
    spec: req.body,
    dataSource: source,
    policyContextKey: String(req.auth?.userId ?? 'anon'),
    allowedFields: new Set(resolveReadableAttributes(OPERATION, model) ?? []),
    ModelCtor: BaseOpsUserDirectory,
    sequelize,
    dialect: source.type,
    noCache: Boolean(req.body?.noCache) || req.query?.noCache === '1',
  });
  return res.json(result);
}
