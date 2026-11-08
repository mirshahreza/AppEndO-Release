/**
 * Data API · HWY members · getOne
 *
 * Definition : ea_6711529b266f4a99
 * Operation  : op_get_kgstly (GET /api/hwy/members/:pk)
 * Model      : HwyMembers (em_b9b34df33282b49c)
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

const EDGE_MODEL_ID = "em_b9b34df33282b49c";
const EDGE_API_DEFINITION_ID = "ea_6711529b266f4a99";
const EDGE_API_OPERATION_ID = "op_get_kgstly";
const MODEL_ALIAS = "HwyMembers";
const READ_FIELDS = ["id","userId","username","firstName","fatherName","grandfatherName","familyName","nickname","genderCode","birthYear","birthMonth","birthDay","nationalId","phone1","phone2","email","facebookId","twitterId","tiktokId","greatGrandfatherName","motherFirstName","motherFatherName","motherGrandfatherName","addrProvinceId","addrDistrictId","addrSubdistrictId","addrQuarterName","addrQuarterNo","addrAlleyNo","addrHouseNo","addrNearestLandmark","addrMostImportantPlace","addrMaktabId","addrRegionId","addrCircleId","nakhebinId","nakhebinLinkTypeCode","nakhebinLinkProblemReasonId","nakhebinLinkProblemNote","nakhebinLinkRegionId","familyCode","votedOn2021","votedOn2023","votedOn2025","membershipStatusCode","membershipStatusUpdatedOn","membershipStatusUpdatedBy","membershipOn","referrerUsername","referrerRelationId","referrerInstituteId","secondReferrerUsername","educationLevelCode","educationLevelInCode","educationEntryYear","educationBranch","educationSchool","educationEndYear","educationUniversityCode","educationUniversityFacultyCode","jobTypeCode","jobPlace","note","createdBy","createdAt","updatedBy","updatedAt"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 1;
const DEFAULT_PAGE_SIZE = 1;
const ALLOW_FILTER = false;
const ALLOW_SORT = false;
const OPERATION = {
  "id": "op_get_kgstly",
  "method": "GET",
  "kind": "getOne",
  "pathPattern": "/api/hwy/members/:pk",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "userId",
      "username",
      "firstName",
      "fatherName",
      "grandfatherName",
      "familyName",
      "nickname",
      "genderCode",
      "birthYear",
      "birthMonth",
      "birthDay",
      "nationalId",
      "phone1",
      "phone2",
      "email",
      "facebookId",
      "twitterId",
      "tiktokId",
      "greatGrandfatherName",
      "motherFirstName",
      "motherFatherName",
      "motherGrandfatherName",
      "addrProvinceId",
      "addrDistrictId",
      "addrSubdistrictId",
      "addrQuarterName",
      "addrQuarterNo",
      "addrAlleyNo",
      "addrHouseNo",
      "addrNearestLandmark",
      "addrMostImportantPlace",
      "addrMaktabId",
      "addrRegionId",
      "addrCircleId",
      "nakhebinId",
      "nakhebinLinkTypeCode",
      "nakhebinLinkProblemReasonId",
      "nakhebinLinkProblemNote",
      "nakhebinLinkRegionId",
      "familyCode",
      "votedOn2021",
      "votedOn2023",
      "votedOn2025",
      "membershipStatusCode",
      "membershipStatusUpdatedOn",
      "membershipStatusUpdatedBy",
      "membershipOn",
      "referrerUsername",
      "referrerRelationId",
      "referrerInstituteId",
      "secondReferrerUsername",
      "educationLevelCode",
      "educationLevelInCode",
      "educationEntryYear",
      "educationBranch",
      "educationSchool",
      "educationEndYear",
      "educationUniversityCode",
      "educationUniversityFacultyCode",
      "jobTypeCode",
      "jobPlace",
      "note",
      "createdBy",
      "createdAt",
      "updatedBy",
      "updatedAt"
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
  const { Model: HwyMembers, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const query = req.query ?? {};
  const params = req.params ?? {};
  const viewName = typeof query.view === 'string' ? query.view.trim() : undefined;
  const readableAttributes = resolveReadableAttributes(OPERATION, model, viewName);
  const include = buildIncludeOptionsFromOperation(parseIncludeAliases(query, OPERATION), OPERATION, model);
  const attributes = buildQueryAttributes(readableAttributes, OPERATION.computedFields, model, sequelize.getDialect());
  const queryLang = OPERATION.query?.allowLangParam === false ? 'en' : resolveDataApiLang(query);
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const row = await HwyMembers.findOne({
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
