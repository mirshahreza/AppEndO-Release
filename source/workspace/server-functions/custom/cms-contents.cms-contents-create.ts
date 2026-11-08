/**
 * Data API · CMS Contents · create
 *
 * Definition : ea_41c8bcea5934c03c
 * Operation  : op_create_wcezaa (POST /api/cms/contents)
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
const EDGE_API_OPERATION_ID = "op_create_wcezaa";
const MODEL_ALIAS = "CmsContents";
const READ_FIELDS = ["id","contentTypeCode","languageCode","slug","statusCode","statusCodeUpdatedAt","statusCodeUpdatedBy","title","summary","body","bodyFormatCode","seoTitle","seoNote","publishedAt","operatorNote","commentsEnabled","commentsPolicyCode","commentsBodyFormatCode","createdBy","createdAt","updatedBy","updatedAt","parentContentId","authorDisplayName","authorEmail","moderatedBy","moderatedAt"] as const;
const WRITE_FIELDS = ["contentTypeCode","languageCode","slug","statusCode","statusCodeUpdatedAt","statusCodeUpdatedBy","title","summary","body","bodyFormatCode","seoTitle","seoNote","publishedAt","operatorNote","commentsEnabled","commentsPolicyCode","commentsBodyFormatCode","createdBy","createdAt","updatedBy","updatedAt","parentContentId","authorDisplayName","authorEmail","moderatedBy","moderatedAt"] as const;
const REQUIRED_FIELDS = [] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const ALLOW_FILTER = true;
const ALLOW_SORT = true;
const OPERATION = {
  "id": "op_create_wcezaa",
  "method": "POST",
  "kind": "create",
  "pathPattern": "/api/cms/contents",
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
    ],
    "write": [
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
    ],
    "required": []
  }
} as const;

export default async function handler(req: any, res: any) {
  const { Model: CmsContents, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};

  for (const field of REQUIRED_FIELDS) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
      return res.status(400).json({ success: false, error: `Field "${field}" is required.` });
    }
  }

  const writablePayload = Object.fromEntries(
    WRITE_FIELDS
      .filter((field) => payload[field] !== undefined)
      .map((field) => [field, payload[field]]),
  );
  if (Object.keys(writablePayload).length === 0) {
    return res.status(400).json({ success: false, error: 'Request body must include at least one writable field.' });
  }

  const auditedPayload = applyDataApiAuditFields(
    writablePayload,
    WRITE_FIELDS,
    'create',
    req.auth?.userId,
  );
  const created = await CmsContents.create(auditedPayload);
  return res.json({
    success: true,
    data: created.get({ plain: true }),
    source: {
    id: source.id,
    name: source.name,
    type: source.type,
  },
  });
}
