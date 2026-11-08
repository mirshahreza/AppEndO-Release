/**
 * Data API · CMS Contents · getOne
 *
 * Definition : ea_41c8bcea5934c03c
 * Operation  : op_get_wcezaa (GET /api/cms/contents/:pk)
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
const EDGE_API_OPERATION_ID = "op_get_wcezaa";
const MODEL_ALIAS = "CmsContents";
const READ_FIELDS = ["id","contentTypeCode","languageCode","slug","statusCode","statusCodeUpdatedAt","statusCodeUpdatedBy","title","summary","body","bodyFormatCode","seoTitle","seoNote","publishedAt","operatorNote","commentsEnabled","commentsPolicyCode","commentsBodyFormatCode","createdBy","createdAt","updatedBy","updatedAt","parentContentId","authorDisplayName","authorEmail","moderatedBy","moderatedAt"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 1;
const DEFAULT_PAGE_SIZE = 1;
const ALLOW_FILTER = false;
const ALLOW_SORT = false;
const OPERATION = {
  "id": "op_get_wcezaa",
  "method": "GET",
  "kind": "getOne",
  "pathPattern": "/api/cms/contents/:pk",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "contentTypeCode",
      "languageCode",
      "slug",
      "statusCode",
      "statusCodeUpdatedAt",
      "statusCodeUpdatedBy",
      "title",
      "summary",
      "body",
      "bodyFormatCode",
      "seoTitle",
      "seoNote",
      "publishedAt",
      "operatorNote",
      "commentsEnabled",
      "commentsPolicyCode",
      "commentsBodyFormatCode",
      "createdBy",
      "createdAt",
      "updatedBy",
      "updatedAt",
      "parentContentId",
      "authorDisplayName",
      "authorEmail",
      "moderatedBy",
      "moderatedAt"
    ]
  },
  "query": {
    "allowFilter": false,
    "allowSort": false,
    "maxPageSize": 1,
    "defaultPageSize": 1
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
    },
    {
      "id": "cms_enrich_body_format",
      "sourceField": "bodyFormatCode",
      "kind": "base_info_title",
      "joinTableSource": "base_info",
      "attachedFields": [
        {
          "sourceColumn": "title",
          "outputField": "bodyFormatCodeTitle"
        }
      ],
      "langSource": "fixed:en"
    },
    {
      "id": "cms_enrich_status_updated_by",
      "sourceField": "statusCodeUpdatedBy",
      "kind": "join_lookup",
      "joinTableSource": "edge_model",
      "targetModelId": "em_0aea59a2c83642ce",
      "targetMatchColumn": "id",
      "attachedFields": [
        {
          "sourceColumn": "username",
          "outputField": "statusCodeUpdatedByUsername"
        }
      ]
    },
    {
      "id": "cms_enrich_created_by",
      "sourceField": "createdBy",
      "kind": "join_lookup",
      "joinTableSource": "edge_model",
      "targetModelId": "em_0aea59a2c83642ce",
      "targetMatchColumn": "id",
      "attachedFields": [
        {
          "sourceColumn": "username",
          "outputField": "createdByUsername"
        }
      ]
    },
    {
      "id": "cms_enrich_updated_by",
      "sourceField": "updatedBy",
      "kind": "join_lookup",
      "joinTableSource": "edge_model",
      "targetModelId": "em_0aea59a2c83642ce",
      "targetMatchColumn": "id",
      "attachedFields": [
        {
          "sourceColumn": "username",
          "outputField": "updatedByUsername"
        }
      ]
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
    },
    {
      "id": "cms_content_revision_count",
      "outputField": "revisionCount",
      "kind": "scalar_subquery",
      "expression": "(SELECT COUNT(*)::int FROM cms_content_revisions AS revision WHERE revision.content_id = \"{{parent}}\".\"{{pk}}\")"
    }
  ]
} as const;

export default async function handler(req: any, res: any) {
  const { Model: CmsContents, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const query = req.query ?? {};
  const params = req.params ?? {};
  const viewName = typeof query.view === 'string' ? query.view.trim() : undefined;
  const readableAttributes = resolveReadableAttributes(OPERATION, model, viewName);
  const include = buildIncludeOptionsFromOperation(parseIncludeAliases(query, OPERATION), OPERATION, model);
  const attributes = buildQueryAttributes(readableAttributes, OPERATION.computedFields, model, sequelize.getDialect());
  const queryLang = OPERATION.query?.allowLangParam === false ? 'en' : resolveDataApiLang(query);
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const row = await CmsContents.findOne({
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
