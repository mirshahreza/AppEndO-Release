/**
 * Data API · CMS Contents · list
 *
 * Definition : ea_41c8bcea5934c03c
 * Operation  : op_list_wcezaa (GET /api/cms/contents)
 * Model      : CmsContents (em_de1dc90b9e9d7626)
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

const EDGE_MODEL_ID = "em_de1dc90b9e9d7626";
const EDGE_API_DEFINITION_ID = "ea_41c8bcea5934c03c";
const EDGE_API_OPERATION_ID = "op_list_wcezaa";
const MODEL_ALIAS = "CmsContents";
const READ_FIELDS = ["id","title","slug","contentTypeCode","languageCode","statusCode","publishedAt","updatedAt","parentContentId","body","authorDisplayName","createdAt"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const ALLOW_FILTER = true;
const ALLOW_SORT = true;
const OPERATION = {
  "id": "op_list_wcezaa",
  "method": "GET",
  "kind": "list",
  "pathPattern": "/api/cms/contents",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "title",
      "slug",
      "contentTypeCode",
      "languageCode",
      "statusCode",
      "publishedAt",
      "updatedAt",
      "parentContentId",
      "body",
      "authorDisplayName",
      "createdAt"
    ]
  },
  "query": {
    "allowFilter": true,
    "allowSort": true,
    "maxPageSize": 100,
    "defaultPageSize": 20,
    "views": {
      "summary": [
        "id",
        "title",
        "slug",
        "contentTypeCode",
        "languageCode",
        "statusCode",
        "publishedAt",
        "updatedAt",
        "parentContentId",
        "body",
        "authorDisplayName",
        "createdAt"
      ],
      "detail": [
        "id",
        "title",
        "slug",
        "contentTypeCode",
        "languageCode",
        "statusCode",
        "publishedAt",
        "updatedAt",
        "parentContentId",
        "body",
        "authorDisplayName",
        "createdAt"
      ]
    }
  },
  "enrichments": [
    {
      "id": "cms_enrich_content_type",
      "sourceField": "contentTypeCode",
      "kind": "base_info_title",
      "joinTableSource": "base_info",
      "attachedFields": [
        {
          "sourceColumn": "title",
          "outputField": "contentTypeCodeTitle"
        },
        {
          "sourceColumn": "ui_html",
          "outputField": "contentTypeCodeUiHtml"
        }
      ],
      "langSource": "fixed:en"
    },
    {
      "id": "cms_enrich_language",
      "sourceField": "languageCode",
      "kind": "base_info_title",
      "joinTableSource": "base_info",
      "attachedFields": [
        {
          "sourceColumn": "title",
          "outputField": "languageCodeTitle"
        }
      ],
      "langSource": "fixed:en"
    },
    {
      "id": "cms_enrich_status",
      "sourceField": "statusCode",
      "kind": "base_info_title",
      "joinTableSource": "base_info",
      "attachedFields": [
        {
          "sourceColumn": "title",
          "outputField": "statusCodeTitle"
        },
        {
          "sourceColumn": "ui_html",
          "outputField": "statusCodeUiHtml"
        },
        {
          "sourceColumn": "ui_color",
          "outputField": "statusCodeUiColor"
        }
      ],
      "langSource": "fixed:en"
    }
  ],
  "computedFields": [
    {
      "id": "cms_content_comment_count",
      "outputField": "commentCount",
      "kind": "scalar_subquery",
      "expression": "(SELECT COUNT(*)::int FROM cms_contents AS child WHERE child.parent_content_id = \"{{parent}}\".\"{{pk}}\")"
    },
    {
      "id": "cms_content_tag_summary",
      "outputField": "tagSummary",
      "kind": "scalar_subquery",
      "expression": "(\n    SELECT COALESCE(\n      STRING_AGG(tag.title_en, ', ' ORDER BY tag.view_order, tag.title_en),\n      ''\n    )\n    FROM cms_content_tags AS content_tag\n    INNER JOIN base_info AS tag ON tag.id = content_tag.tag_code\n    WHERE content_tag.content_id = \"{{parent}}\".\"{{pk}}\"\n  )"
    }
  ]
} as const;

export default async function handler(req: any, res: any) {
  const { Model: CmsContents, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
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
    const result = await CmsContents.findAndCountAll(findOptions);
    plainRows = result.rows.map((row) => row.get({ plain: true }));
    totalCount = result.count;
  } else {
    plainRows = (await CmsContents.findAll(findOptions)).map((row) => row.get({ plain: true }));
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
