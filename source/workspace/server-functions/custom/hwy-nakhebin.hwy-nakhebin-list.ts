/**
 * Data API · HWY nakhebin · list
 *
 * Definition : ea_08ae025536ff8bf9
 * Operation  : op_list_4jawqh (GET /api/hwy/nakhebin)
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
const EDGE_API_OPERATION_ID = "op_list_4jawqh";
const MODEL_ALIAS = "HwyNakhebin";
const READ_FIELDS = ["id","regionId","maktabId","familyCode","firstName","fatherName","grandfatherName","familyName","birthYear","genderCode","memberId","votedOn2021","votedOn2023","votedOn2025","createdAt","updatedAt","registeredCaseCode","phone1","phone2"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const ALLOW_FILTER = true;
const ALLOW_SORT = true;
const OPERATION = {
  "id": "op_list_4jawqh",
  "method": "GET",
  "kind": "list",
  "pathPattern": "/api/hwy/nakhebin",
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
  },
  "query": {
    "allowFilter": true,
    "allowSort": true,
    "maxPageSize": 100,
    "defaultPageSize": 20
  }
} as const;

export default async function handler(req: any, res: any) {
  const { Model: HwyNakhebin, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const query = req.query ?? {};
  const viewName = typeof query.view === 'string' ? query.view.trim() : undefined;
  const readableAttributes = resolveReadableAttributes(OPERATION, model, viewName);
  const allowedFilterFields = new Set(readableAttributes ?? []);
  const page = parsePositiveInt(query.page, 1);
  const pageSize = Math.min(
    parsePositiveInt(query.pageSize, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const offset = (page - 1) * pageSize;
  const filterWhere = ALLOW_FILTER
    ? buildWhereFromFilter(parseFilterQuery(query), allowedFilterFields, model.columns)
    : {};
  const searchWhere = ALLOW_FILTER
    ? buildSearchWhere(parseSearchQuery(query), resolveSearchableFields(allowedFilterFields, model.columns, []))
    : {};
  const where = {
    ...DEFAULT_WHERE,
    ...filterWhere,
    ...searchWhere,
  };
  const order = ALLOW_SORT
    ? parseSortQuery(query, allowedFilterFields, model.columns)
    : undefined;
  const include = buildIncludeOptionsFromOperation(parseIncludeAliases(query, OPERATION), OPERATION, model);
  const attributes = buildQueryAttributes(readableAttributes, OPERATION.computedFields, model, sequelize.getDialect());
  const queryLang = OPERATION.query?.allowLangParam === false ? 'en' : resolveDataApiLang(query);

  const result = await HwyNakhebin.findAndCountAll({
    where,
    limit: pageSize,
    offset,
    attributes,
    order,
    include: include.length > 0 ? include : undefined,
    distinct: include.length > 0,
  });
  const plainRows = result.rows.map((row) => row.get({ plain: true }));
  const enrichmentDeps = await resolveFieldEnrichmentDeps(EDGE_MODEL_ID, OPERATION);
  const enrichedRows = await applyFieldEnrichments(
    plainRows,
    OPERATION.enrichments,
    queryLang,
    enrichmentDeps,
  );

  return res.json({
    success: true,
    data: enrichedRows,
    count: result.count,
    meta: { page, pageSize, lang: queryLang },
    source: {
    id: source.id,
    name: source.name,
    type: source.type,
  },
  });
}
