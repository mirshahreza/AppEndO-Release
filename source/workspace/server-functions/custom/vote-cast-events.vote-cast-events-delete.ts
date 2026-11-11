/**
 * Data API · Voting Cast Events · delete
 *
 * Definition : ea_684ef37eefbf2d00
 * Operation  : op_delete_7n1cxb (DELETE /api/voting/cast-events/:pk)
 * Model      : VoteCastEvents (em_c08c062973da7869)
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

const EDGE_MODEL_ID = "em_c08c062973da7869";
const EDGE_API_DEFINITION_ID = "ea_684ef37eefbf2d00";
const EDGE_API_OPERATION_ID = "op_delete_7n1cxb";
const MODEL_ALIAS = "VoteCastEvents";
const READ_FIELDS = ["id","votingId","ballotId","candidateId","voterRegistrationId","castChannelCode","idempotencyKey","payloadJson","createdBy","createdAt"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const ALLOW_FILTER = true;
const ALLOW_SORT = true;
const OPERATION = {
  "id": "op_delete_7n1cxb",
  "method": "DELETE",
  "kind": "delete",
  "pathPattern": "/api/voting/cast-events/:pk",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "votingId",
      "ballotId",
      "candidateId",
      "voterRegistrationId",
      "castChannelCode",
      "idempotencyKey",
      "payloadJson",
      "createdBy",
      "createdAt"
    ]
  }
} as const;

export default async function handler(req: any, res: any) {
  const { Model: VoteCastEvents, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const params = req.params ?? {};
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const deleted = await VoteCastEvents.destroy({ where: pkWhere });
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Record not found.' });
  }

  return res.json({
    success: true,
    data: { deleted },
    source: {
    id: source.id,
    name: source.name,
    type: source.type,
  },
  });
}
