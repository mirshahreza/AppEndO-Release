/**
 * Data API · Voting Candidates · create
 *
 * Definition : ea_b11f2e57e56440bb
 * Operation  : op_create_z06aev (POST /api/voting/candidates)
 * Model      : VoteCandidates (em_efa8e9859bf37d3c)
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

const EDGE_MODEL_ID = "em_efa8e9859bf37d3c";
const EDGE_API_DEFINITION_ID = "ea_b11f2e57e56440bb";
const EDGE_API_OPERATION_ID = "op_create_z06aev";
const MODEL_ALIAS = "VoteCandidates";
const READ_FIELDS = ["id","votingId","ballotId","displayName","hwyMemberId","hwyNakhebId","geoScopeId","statusCode","listScopeLegacy","operatorNote","createdAt","updatedAt","sortOrder"] as const;
const WRITE_FIELDS = ["votingId","ballotId","displayName","hwyMemberId","hwyNakhebId","geoScopeId","statusCode","listScopeLegacy","operatorNote","createdAt","updatedAt","sortOrder"] as const;
const REQUIRED_FIELDS = ["votingId","displayName","createdAt","updatedAt","sortOrder"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const ALLOW_FILTER = true;
const ALLOW_SORT = true;
const OPERATION = {
  "id": "op_create_z06aev",
  "method": "POST",
  "kind": "create",
  "pathPattern": "/api/voting/candidates",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "votingId",
      "ballotId",
      "displayName",
      "hwyMemberId",
      "hwyNakhebId",
      "geoScopeId",
      "statusCode",
      "listScopeLegacy",
      "operatorNote",
      "createdAt",
      "updatedAt",
      "sortOrder"
    ],
    "write": [
      "votingId",
      "ballotId",
      "displayName",
      "hwyMemberId",
      "hwyNakhebId",
      "geoScopeId",
      "statusCode",
      "listScopeLegacy",
      "operatorNote",
      "createdAt",
      "updatedAt",
      "sortOrder"
    ],
    "required": [
      "votingId",
      "displayName",
      "createdAt",
      "updatedAt",
      "sortOrder"
    ]
  }
} as const;

export default async function handler(req: any, res: any) {
  const { Model: VoteCandidates, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
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
  const created = await VoteCandidates.create(auditedPayload);
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
