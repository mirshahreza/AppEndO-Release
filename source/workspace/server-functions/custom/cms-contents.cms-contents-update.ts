/**
 * Data API · CMS Contents · update
 *
 * Definition : ea_41c8bcea5934c03c
 * Operation  : op_update_wcezaa (PUT /api/cms/contents/:pk)
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
const EDGE_API_OPERATION_ID = "op_update_wcezaa";
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
  "id": "op_update_wcezaa",
  "method": "PUT",
  "kind": "update",
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
  const params = req.params ?? {};
  const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  // PUT updates writable fields present in the request body.
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const writablePayload = Object.fromEntries(
    WRITE_FIELDS
      .filter((field) => payload[field] !== undefined)
      .map((field) => [field, payload[field]]),
  );
  if (Object.keys(writablePayload).length === 0) {
    return res.status(400).json({ success: false, error: 'Request body must include at least one updatable field.' });
  }
  const auditedPayload = applyDataApiAuditFields(
    writablePayload,
    WRITE_FIELDS,
    "update",
    req.auth?.userId,
  );

  const row = await CmsContents.findOne({ where: pkWhere });
  if (!row) {
    return res.status(404).json({ success: false, error: 'Record not found.' });
  }

  await row.update(auditedPayload);
  const plain = row.get({ plain: true }) as Record<string, unknown>;
  const responseData = Object.fromEntries(
    READ_FIELDS
      .filter((field) => plain[field] !== undefined)
      .map((field) => [field, plain[field]]),
  );
  return res.json({
    success: true,
    data: responseData,
    source: {
    id: source.id,
    name: source.name,
    type: source.type,
  },
  });
}
