/**
 * Data API · HWY member security profile · getOne
 *
 * Definition : ea_03c7d01436955c5c
 * Operation  : op_get_k4vx4g (GET /api/hwy/member-security-profile/:pk)
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
const EDGE_API_OPERATION_ID = "op_get_k4vx4g";
const MODEL_ALIAS = "HwyMemberSecurityProfile";
const READ_FIELDS = ["id","memberId","canGetIdentityCardCode","canGetIdentityCardNote","canGetResponsibilityCode","canGetResponsibilityNote","canJoinGeneralBodyCode","canJoinGeneralBodyNote","allowsResponsibilityCode","allowsResponsibilityNote","createdBy","createdAt"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 1;
const DEFAULT_PAGE_SIZE = 1;
const ALLOW_FILTER = false;
const ALLOW_SORT = false;
const OPERATION = {
  "id": "op_get_k4vx4g",
  "method": "GET",
  "kind": "getOne",
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
  },
  "query": {
    "allowFilter": false,
    "allowSort": false,
    "maxPageSize": 1,
    "defaultPageSize": 1
  }
} as const;

export default async function handler(req: any, res: any) {
  const { Model: HwyMemberSecurityProfile, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const query = req.query ?? {};
  const params = req.params ?? {};
  const viewName = typeof query.view === 'string' ? query.view.trim() : undefined;
  const readableAttributes = resolveReadableAttributes(OPERATION, model, viewName);
  const include = buildIncludeOptionsFromOperation(parseIncludeAliases(query, OPERATION), OPERATION, model);
  const attributes = buildQueryAttributes(readableAttributes, OPERATION.computedFields, model, sequelize.getDialect());
  const queryLang = OPERATION.query?.allowLangParam === false ? 'en' : resolveDataApiLang(query);
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const row = await HwyMemberSecurityProfile.findOne({
    where: pkWhere,
    attributes,
    include: include.length > 0 ? include : undefined,
  });
  const plainRow = row ? row.get({ plain: true }) : null;
  const enrichmentDeps = await resolveFieldEnrichmentDeps(EDGE_MODEL_ID, OPERATION);
  const enrichedRow = plainRow
    ? (await applyFieldEnrichments([plainRow], OPERATION.enrichments, queryLang, enrichmentDeps))[0]
    : null;

  return res.json({
    success: true,
    data: enrichedRow,
    meta: { lang: queryLang },
    source: {
    id: source.id,
    name: source.name,
    type: source.type,
  },
  });
}
