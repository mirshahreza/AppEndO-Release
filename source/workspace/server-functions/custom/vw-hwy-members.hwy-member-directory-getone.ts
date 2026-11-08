/**
 * Data API · HWY Member directory · getOne
 *
 * Definition : ea_a140003600ded4e4
 * Operation  : op_get_pur3ks (GET /api/hwy/member-directory/:pk)
 * Model      : VwHwyMembers (em_5f3a30c99bb3420e)
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
import { enrichHwyMemberDirectoryRows } from '@/server/domain/hwy/hwyMemberDirectoryDetailDisplay';
import { resolvePrimaryKeyWhere } from '@/server/services/data-api/sequelize/buildDynamicModel';
import { resolvePublishedEdgeModel, resolveFieldEnrichmentDeps } from '@/server/services/data-api/dataApiPublishedRuntime';
import { executePivot } from '@/server/services/data-api/pivotExecute';

const EDGE_MODEL_ID = "em_5f3a30c99bb3420e";
const EDGE_API_DEFINITION_ID = "ea_a140003600ded4e4";
const EDGE_API_OPERATION_ID = "op_get_pur3ks";
const MODEL_ALIAS = "VwHwyMembers";
const READ_FIELDS = ["id","userId","username","email","userMobile","userLocked","lastLoginAt","firstname","lastname","fathername","grandfathername","nickname","nationalCode","birthYear","birthMonth","birthDay","genderCode","personTypeCode","displayFullName","phone1","phone2","hasProfileImage","avatarUrl","profileImageMime","profileImageSize","facebookId","twitterId","tiktokId","greatGrandfatherName","motherFirstName","motherFatherName","motherGrandfatherName","addrProvinceId","addrDistrictId","addrSubdistrictId","addrQuarterName","addrQuarterNo","addrAlleyNo","addrHouseNo","addrNearestLandmark","addrMostImportantPlace","addrMaktabId","addrRegionId","addrCircleId","nakhebinId","nakhebinFamilyCode","nakhebinLinkTypeCode","nakhebinLinkProblemReasonId","nakhebinLinkProblemNote","nakhebinLinkRegionId","familyCode","votedOn2021","votedOn2023","votedOn2025","membershipStatusCode","membershipStatusUpdatedOn","membershipStatusUpdatedBy","membershipOn","referrerUsername","referrerRelationId","referrerInstituteId","secondReferrerUsername","secondReferrerRelationId","educationLevelCode","educationLevelInCode","educationEntryYear","educationBranch","educationSchool","educationEndYear","educationUniversityCode","educationUniversityFacultyCode","jobTypeCode","jobPlace","note","nakhebinRegionId","nakhebinMaktabId","electoralDivisionPath","addrProvinceId","trackingCode","nakhebinJoinTasjilStateCode","createdBy","createdAt","updatedBy","updatedAt"] as const;
const DEFAULT_WHERE = {};
const MAX_PAGE_SIZE = 1;
const DEFAULT_PAGE_SIZE = 1;
const ALLOW_FILTER = false;
const ALLOW_SORT = false;
const OPERATION = {
  "id": "op_get_pur3ks",
  "method": "GET",
  "kind": "getOne",
  "pathPattern": "/api/hwy/member-directory/:pk",
  "enabled": true,
  "fields": {
    "read": [
      "id",
      "userId",
      "username",
      "email",
      "userMobile",
      "userLocked",
      "lastLoginAt",
      "firstname",
      "lastname",
      "fathername",
      "grandfathername",
      "nickname",
      "nationalCode",
      "birthYear",
      "birthMonth",
      "birthDay",
      "genderCode",
      "personTypeCode",
      "displayFullName",
      "phone1",
      "phone2",
      "hasProfileImage",
      "avatarUrl",
      "profileImageMime",
      "profileImageSize",
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
      "nakhebinFamilyCode",
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
      "secondReferrerRelationId",
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
      "nakhebinRegionId",
      "nakhebinMaktabId",
      "electoralDivisionPath",
      "trackingCode",
      "nakhebinJoinTasjilStateCode",
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
  },
  "enrichments": [
    {
      "id": "hwy_enrich_membership_status",
      "sourceField": "membershipStatusCode",
      "kind": "base_info_title",
      "joinTableSource": "base_info",
      "attachedFields": [
        {
          "sourceColumn": "title",
          "outputField": "membershipStatusCodeTitle"
        },
        {
          "sourceColumn": "ui_color",
          "outputField": "membershipStatusCodeTitleUiColor"
        }
      ],
      "langSource": "fixed:ar"
    },
    {
      "id": "hwy_enrich_tasjil_state",
      "sourceField": "nakhebinJoinTasjilStateCode",
      "kind": "base_info_title",
      "joinTableSource": "base_info",
      "attachedFields": [
        {
          "sourceColumn": "title",
          "outputField": "nakhebinJoinTasjilStateCodeTitle"
        },
        {
          "sourceColumn": "ui_color",
          "outputField": "nakhebinJoinTasjilStateCodeTitleUiColor"
        }
      ],
      "langSource": "fixed:ar"
    },
    {
      "id": "hwy_enrich_registration_channel",
      "sourceField": "registrationChannelCode",
      "kind": "base_info_title",
      "joinTableSource": "base_info",
      "attachedFields": [
        {
          "sourceColumn": "title",
          "outputField": "registrationChannelCodeTitle"
        },
        {
          "sourceColumn": "ui_color",
          "outputField": "registrationChannelCodeTitleUiColor"
        }
      ],
      "langSource": "fixed:ar"
    }
  ]
} as const;

export default async function handler(req: any, res: any) {
  const { Model: VwHwyMembers, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  const query = req.query ?? {};
  const params = req.params ?? {};
  const viewName = typeof query.view === 'string' ? query.view.trim() : undefined;
  const readableAttributes = resolveReadableAttributes(OPERATION, model, viewName);
  const include = buildIncludeOptionsFromOperation(parseIncludeAliases(query, OPERATION), OPERATION, model);
  const attributes = buildQueryAttributes(readableAttributes, OPERATION.computedFields, model, sequelize.getDialect());
  const queryLang = OPERATION.query?.allowLangParam === false ? 'en' : resolveDataApiLang(query);
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const row = await VwHwyMembers.findOne({
    where: pkWhere,
    attributes,
    include: include.length > 0 ? include : undefined,
  });
  const plainRow = row ? row.get({ plain: true }) : null;
  const enrichmentDeps = await resolveFieldEnrichmentDeps(EDGE_MODEL_ID, OPERATION);
  let enrichedRow = plainRow
    ? (await applyFieldEnrichments([plainRow], OPERATION.enrichments, queryLang, enrichmentDeps))[0]
    : null;
  if (enrichedRow) {
    await enrichHwyMemberDirectoryRows([enrichedRow], queryLang);
  }

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
