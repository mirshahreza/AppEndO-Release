/**
 * Data API · CMS Content Relations · list
 *
 * Definition : ea_f3ffdfb8d9ecbb33
 * Operation  : op_list_kxqtj3 (GET /api/cms/relations)
 * Model      : CmsContentRelations (em_95213b3d9a76be40)
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

const EDGE_MODEL_ID = "em_95213b3d9a76be40";
const EDGE_API_DEFINITION_ID = "ea_f3ffdfb8d9ecbb33";
const EDGE_API_OPERATION_ID = "op_list_kxqtj3";
const MODEL_ALIAS = "CmsContentRelations";
const READ_FIELDS = ["id","contentIdA","contentIdB","note"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const ALLOW_FILTER = true;
const ALLOW_SORT = true;
const OPERATION = {
  "id": "op_list_kxqtj3",
  "method": "GET",
  "kind": "list",
  "pathPattern": "/api/cms/relations",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "contentIdA",
      "contentIdB",
      "note"
    ]
  },
  "query": {
    "allowFilter": true,
    "allowSort": true,
    "maxPageSize": 100,
    "defaultPageSize": 20
  },
  "enrichments": [
    {
      "id": "cms_enrich_relation_content_a",
      "sourceField": "contentIdA",
      "kind": "join_lookup",
      "joinTableSource": "edge_model",
      "targetModelId": "em_de1dc90b9e9d7626",
      "targetMatchColumn": "id",
      "attachedFields": [
        {
          "sourceColumn": "title",
          "outputField": "contentIdATitle"
        },
        {
          "sourceColumn": "slug",
          "outputField": "contentIdASlug"
        }
      ]
    },
    {
      "id": "cms_enrich_relation_content_b",
      "sourceField": "contentIdB",
      "kind": "join_lookup",
      "joinTableSource": "edge_model",
      "targetModelId": "em_de1dc90b9e9d7626",
      "targetMatchColumn": "id",
      "attachedFields": [
        {
          "sourceColumn": "title",
          "outputField": "contentIdBTitle"
        },
        {
          "sourceColumn": "slug",
          "outputField": "contentIdBSlug"
        }
      ]
    }
  ]
} as const;

export default async function handler(req: any, res: any) {
  const { Model: CmsContentRelations, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
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

  const listCount = resolveDataApiListIncludeCount(query, OPERATION);
  const findOptions = {
    where,
    limit: pageSize,
    offset,
    attributes,
    order,
    include: include.length > 0 ? include : undefined,
    distinct: include.length > 0,
  };
  let plainRows;
  let totalCount;
  if (listCount.includeCount) {
    const result = await CmsContentRelations.findAndCountAll(findOptions);
    plainRows = result.rows.map((row) => row.get({ plain: true }));
    totalCount = result.count;
  } else {
    plainRows = (await CmsContentRelations.findAll(findOptions)).map((row) => row.get({ plain: true }));
  }
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
    ...(totalCount !== undefined ? { count: totalCount } : {}),
    meta: { page, pageSize, lang: queryLang, countMode: listCount.countMode },
    source: {
    id: source.id,
    name: source.name,
    type: source.type,
  },
  });
}
