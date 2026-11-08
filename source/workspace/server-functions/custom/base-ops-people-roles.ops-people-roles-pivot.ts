/**
 * Data API · People roles pivot · pivot
 *
 * Definition : ea_ops_people_roles_pivot
 * Operation  : ops_people_roles-pivot (POST /api/ops/ops_people_roles/pivot)
 * Model      : BaseOpsPeopleRoles (em_ops_people_roles)
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

const EDGE_MODEL_ID = "em_ops_people_roles";
const EDGE_API_DEFINITION_ID = "ea_ops_people_roles_pivot";
const EDGE_API_OPERATION_ID = "ops_people_roles-pivot";
const MODEL_ALIAS = "BaseOpsPeopleRoles";
const READ_FIELDS = ["user_id","username","role_name","locked","is_builtin","person_type_code","never_logged_in","created_at"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 1000;
const DEFAULT_PAGE_SIZE = 100;
const ALLOW_FILTER = true;
const ALLOW_SORT = false;
const OPERATION = {
  "id": "ops_people_roles-pivot",
  "method": "POST",
  "kind": "pivot",
  "pathPattern": "/api/ops/ops_people_roles/pivot",
  "enabled": true,
  "fields": {
    "read": [
      "user_id",
      "username",
      "role_name",
      "locked",
      "is_builtin",
      "person_type_code",
      "never_logged_in",
      "created_at"
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
  const { Model: BaseOpsPeopleRoles, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const result = await executePivot({
    spec: req.body,
    dataSource: source,
    policyContextKey: String(req.auth?.userId ?? 'anon'),
    allowedFields: new Set(resolveReadableAttributes(OPERATION, model) ?? []),
    ModelCtor: BaseOpsPeopleRoles,
    sequelize,
    dialect: source.type,
    noCache: Boolean(req.body?.noCache) || req.query?.noCache === '1',
  });
  return res.json(result);
}
