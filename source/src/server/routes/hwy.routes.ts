import { Router, type Express, type NextFunction, type Request, type Response } from 'express';

import { requireHawietyPackage } from '../services/hawiety/hawietyRuntime';
import multer, { type File as MulterFile } from 'multer';

import type { HwyRegistrationChannelShortName } from '../../domain/hwy/hwyRegistrationChannel';
import {
  HWY_REGISTRATION_CHANNEL_SHORT_NAMES,
  HWY_STAFF_ONLY_REGISTRATION_CHANNELS,
} from '../../domain/hwy/hwyRegistrationChannel';
import {
  parseHwySelfRegistrationSubmitAttachments,
  runHwySelfRegistrationSubmitUpload,
} from './hwySelfRegistrationSubmitUpload.middleware';

import { loadHwyFamilyHousehold } from '../domain/hwy/hwyFamilyHousehold.service';

import {

  submitHwySelfRegistration,

  trackHwySelfRegistration,

} from '../domain/hwy/selfRegistration.service';

import {
  listHwySelfRegistrationDistricts,
  listHwySelfRegistrationProvinces,
} from '../domain/hwy/hwyPublicAddressGeo.service';
import {
  listHwySelfRegistrationEducationLevelOptions,
  listHwySelfRegistrationJobTypeOptions,
} from '../domain/hwy/hwyPublicEducationJobVocab.service';
import { listHwySelfRegistrationReferrerRelations } from '../domain/hwy/hwyPublicReferrerRelation.service';
import { loadHwyInstituteSelfRegistrationBrand } from '../domain/hwy/hwyInstituteSelfRegistrationBrand.service';
import { loadHwyInstituteLogo } from '../domain/hwy/hwyInstituteLogo.service';
import { listHwyInstituteScopedEditConfig } from '../domain/hwy/hwyInstituteScopedEditConfig.service';

import { requireAuth, requireRole } from '../middleware/auth.middleware';
import {
  requireHwyCoursesActivitiesAccess,
  requireHwyMemberRashhPickerAccess,
} from '../middleware/hwyCoursesActivitiesAccess.middleware';
import {
  requireHwyMemberListFaceAssetAccess,
  requireUsersListAccess,
} from '../middleware/usersListAccess.middleware';
import { createKeyedRateLimiter } from '../middleware/rateLimit';
import {
  listHwyMemberDossierFiles,
  listHwyMemberDossierInstitutes,
  createHwyMemberDossierNote,
  createHwyMemberTarghinRequest,
  listHwyMemberDossierTarghinRequests,
  listHwyMemberDossierNotes,
  listHwyMemberDossierKasbAcquired,
  readHwyMemberDossierSecurityProfile,
  listHwyMemberDossierSecurityProfileHistory,
  appendHwyMemberDossierSecurityProfileOpinion,
  readHwyMemberFileContent,
} from '../domain/hwy/hwyMemberDossierSatellites.service';
import { upsertHwyMemberDossierFile } from '../domain/hwy/hwyMemberDossierFileUpsert.service';
import { deleteHwyMemberDossierFile } from '../domain/hwy/hwyMemberDossierFileDelete.service';
import { moveHwyMemberImageFixRegistrationFileSlot } from '../domain/hwy/hwyMemberImageFixFileSlotMove.service';
import { loadHwyMemberImageFixEditorFields } from '../domain/hwy/hwyMemberImageFixEditor.service';
import { listHwyMemberDossierRegistrationFileSlots, resolveHwyMemberFileKindBySlugOrId } from '../domain/hwy/hwyMemberFileKindResolve.service';
import { resolveHwyMemberDirectoryDetailLang } from '../../domain/hwy/hwyMemberDirectoryDetail';
import {
  listHwyMemberSimilarMembers,
  parseHwyMemberSimilarMembersFilter,
} from '../domain/hwy/hwyMemberSimilarMembers.service';
import {
  listHwyMemberNakhebinJoinCandidates,
  parseHwyMemberNakhebinJoinCandidateFilter,
} from '../domain/hwy/hwyMemberNakhebinJoinCandidates.service';
import { listHwyMemberNakhebinEghteraRegions } from '../domain/hwy/hwyMemberNakhebinEghteraRegionList.service';
import { listHwyMemberDossierChangeLog } from '../domain/hwy/hwyMemberDossierChangeLog.service';
import { getHwyMemberDossierProfileNavCounts } from '../domain/hwy/hwyMemberDossierProfileNavCounts.service';
import { runHwyMemberStatRecalcStep } from '../domain/hwy/hwyMemberStatsRecalc.service';
import { hwyMemberStatRecalcStepById, type HwyMemberStatRecalcStepId } from '../../domain/hwy/hwyMemberStatsRecalcCatalog';
import {
  listHwyMemberActivityAttendances,
  listHwyMemberCourseAttendances,
} from '../domain/hwy/hwyMemberCoursesActivities.service';
import {
  listHwyMemberNbSelfieHistory,
  readHwyMemberDirectoryActivityAttendanceSelfie,
} from '../domain/hwy/hwyMemberNbSelfieHistory.service';
import { searchHwyMemberPicker } from '../domain/hwy/hwyMemberPicker.service';
import {
  readHwyActivitySelfAnnouncementSpec,
  submitHwyActivitySelfAnnouncement,
} from '../domain/hwy/hwyActivitySelfAnnouncement.service';
import {
  listHwyActivitiesAdmin,
  listHwyCoursesAdmin,
  listHwyActivityAdminApprovalSteps,
  listHwyActivityAdminAttendances,
  listHwyActivityAdminFiles,
  listHwyCourseAdminApprovalSteps,
  listHwyCourseAdminAttendances,
  readHwyActivityAdminDetail,
  readHwyActivityFileContent,
  readHwyActivityAttendanceSelfieContent,
  readHwyCourseAdminDetail,
} from '../domain/hwy/hwyCoursesActivitiesAdmin.service';
import { readClientClaimedFromRequest } from '../domain/hwy/readClientClaimedFromRequest';
import {
  applyHwyActivityWorkflowAction,
  applyHwyCourseWorkflowAction,
} from '../domain/hwy/hwyCoursesActivitiesWorkflow.service';
import {
  addHwyActivityAdminAttendance,
  addHwyCourseAdminAttendance,
  deleteHwyActivityAdminFile,
  removeHwyActivityAdminAttendance,
  removeHwyCourseAdminAttendance,
} from '../domain/hwy/hwyCoursesActivitiesAttendanceWrite.service';
import {
  createHwyActivityDraft,
  createHwyCourseDraft,
  listHwyCoursesActivitiesVocabOptions,
  readUpsertHwyActivityDraftInput,
  updateHwyActivityDraft,
  updateHwyCourseDraft,
  uploadHwyActivityFile,
} from '../domain/hwy/hwyCoursesActivitiesWrite.service';
import { countHwyActivityNbTargetAudience } from '../domain/hwy/hwyActivityNbTargetAudienceCount.service';
import { listHwyTajammoatOrganizationPickerOptions } from '../domain/hwy/hwyCoursesActivitiesAdmin.service';
import {
  cleanupHwyDraftedActivities,
  cleanupHwyDraftedCourses,
  copyHwyCourseAttendances,
} from '../domain/hwy/hwyCoursesActivitiesAdminMaintenance.service';
import type {
  HwyActivitiesAdminQueue,
  HwyActivityWorkflowAction,
  HwyCourseWorkflowAction,
  HwyCoursesAdminQueue,
} from '../../domain/hwy/hwyCoursesActivitiesCatalog';
import { listHwyMemberTarghinRequestReasonOptions } from '../domain/hwy/hwyMemberTarghinRequestReasons.service';
import type { HwyMemberDirectoryPatchInput } from '../../domain/hwy/hwyMemberDirectoryPatch';
import { parseHwyMemberDirectoryPatchFromRequestBody } from '../../domain/hwy/hwyMemberDirectoryPatch';
import { patchHwyMemberDirectoryMember } from '../domain/hwy/hwyMemberDirectoryPatch.service';
import {
  loadHwyMemberListScopedEditFields,
  patchHwyMemberListScopedEditFields,
} from '../domain/hwy/hwyMemberListScopedEdit.service';
import type { HwyMemberListScopedEditPatchBody } from '../../domain/hwy/hwyMemberListScopedEditClient';
import { assertHwyMemberDossierFileUploadAllowed } from '../domain/hwy/hwyMemberDirectoryIdentityPolicy.service';
import { resolveHwyMemberIdentitySessionForAuth } from '../domain/hwy/hwyMemberIdentityFieldMaskContext';
import type { SessionScopeSnapshot } from '../services/record-policy/sessionScope.service';
import { registerHwyEtlConsoleRoutes } from './hwyEtlConsole.routes';
import { registerHwyBusinessRuleDocsRoutes } from './hwyBusinessRuleDocs.routes';
import { registerHwyMembershipPipelineRoutes } from './hwyMembershipPipeline.routes';
import {
  readHwyOrgMembershipTransferConfig,
  requestHwyOrgMembershipTransferForMember,
  rollbackHwyOrgMembershipTransferForMember,
  searchHwyOrgMembershipTransferMembers,
} from '../domain/hwy/hwyOrgMembershipTransfer.service';
import { hwyOrgMembershipTransferRequestRoleNames } from '../../domain/hwy/hwyOrgMembershipTransferCatalog';
import {
  hwyGeoResponsibilityAllGateRoleNames,
  isHwyGeoResponsibilityLevel,
  type HwyGeoResponsibilityLevel,
} from '../../domain/hwy/hwyGeoResponsibilityCatalog';
import type { HwyGeoResponsibilityRequestStatus } from '../../domain/hwy/hwyGeoResponsibility';
import { isHwyElectoralGeoKind } from '../../domain/hwy/hwyGeoResponsibilityElectoralCascade';
import {
  approveHwyGeoResponsibilityRequest,
  cancelHwyGeoResponsibilityNominationRequest,
  cancelHwyGeoResponsibilityPendingNominationForSlot,
  readHwyGeoResponsibilityAssigneePendingRemovalRequestId,
  fetchHwyGeoResponsibilityProvinceHasGhavateh,
  getHwyGeoResponsibilityCenterStats,
  getHwyGeoResponsibilityPatchHistory,
  getHwyGeoResponsibilityPatchMemberCount,
  getHwyGeoResponsibilityPatchNakhebinCount,
  listHwyGeoResponsibilityElectoralOptions,
  listHwyGeoResponsibilityNominationCandidates,
  listHwyGeoResponsibilityNodes,
  listHwyGeoResponsibilityRequests,
  lookupHwyGeoResponsibilityMemberByUsername,
  readHwyGeoResponsibilityConfig,
  rejectHwyGeoResponsibilityRequest,
  resolveHwyGeoResponsibilityElectoralSelection,
  submitHwyGeoResponsibilityNomination,
  submitHwyGeoResponsibilityOfficialRemovalRequest,
} from '../domain/hwy/hwyGeoResponsibility.service';
import { listHwyGeoResponsibilityMontadheminAdmin } from '../domain/hwy/hwyGeoResponsibilityMontadheminAdmin.service';
import {
  applyHwyCandidatePipelineInstallAction,
  applyHwyCandidatePipelineInterviewCreate,
  applyHwyCandidatePipelineSecurityRecord,
  listHwyCandidatePipeline,
} from '../domain/hwy/hwyCandidatePipeline.service';
import { resolveHwyMemberDirectoryQueryLang } from '../domain/hwy/hwyMemberDirectoryQueryLang';
import {
  getHwyCandidatePipelineInterviewLast,
  listHwyInterview2022ScoreOptions,
  lookupHwyInterview2022HazerinMember,
} from '../domain/hwy/hwyCandidatePipelineInterview.service';
import type { HwyCandidatePipelineInterviewCreatePayload } from '../../domain/hwy/hwyCandidatePipelineInterviewCatalog';
import { applyHwyCardFlowSecurityRecord, applyHwyCardFlowStep, listHwyCardFlow } from '../domain/hwy/hwyCardFlow.service';
import type { HwyCardFlowAction } from '../../domain/hwy/hwyCardFlow';
import type { HwyCardFlowStep } from '../../domain/hwy/hwyCardFlowCatalog';
import { requireHwyCardFlowAccess } from '../middleware/hwyCardFlowAccess.middleware';
import { requireHwyCandidatePipelineAccess } from '../middleware/hwyCandidatePipelineAccess.middleware';
import { requireHwyMeetingsManagementAccess } from '../middleware/hwyMeetingsAccess.middleware';
import { requireHwyEmployeesListAccess } from '../middleware/hwyEmployeesListAccess.middleware';
import {
  listHwyEmployees,
  removeHwyEmployeePlatformRoles,
} from '../domain/hwy/hwyEmployeesList.service';
import {
  addHwyMeetingInstance,
  addHwyMeetingInstanceHazer,
  addHwyMeetingMember,
  listHwyMeetingAttendancePivot,
  listHwyMeetingDefinitions,
  listHwyMeetingInstanceAttendance,
  listHwyMeetingInstanceHazerin,
  listHwyMeetingInstances,
  listHwyMeetingMembers,
  removeHwyMeetingInstance,
  removeHwyMeetingInstanceHazer,
  removeHwyMeetingMember,
} from '../domain/hwy/hwyMeetings.service';
import type { HwyCandidatePipelineStage } from '../../domain/hwy/hwyCandidatePipelineCatalog';
import type { HwyCandidatePipelineSecurityProfilePayload } from '../../domain/hwy/hwyCandidatePipeline';
import {
  decideHwyMemberTarghinRequest,
  decideHwyMemberTarghinRequestsBulk,
  listHwyMemberTarghinAdmin,
} from '../domain/hwy/hwyMemberTarghinAdmin.service';
import { listHwyMemberTarghinMembers } from '../domain/hwy/hwyMemberTarghinMembersList.service';
import { listHwyMemberTarghinFinalReasonOptions } from '../domain/hwy/hwyMemberTarghinFinalReasons.service';
import { parseHwyMemberTarghinAdminQueue } from '../../domain/hwy/hwyMemberTarghinAdmin';
import { parseHwyMemberTarghinNegoStateFilter } from '../../domain/hwy/hwyMemberTarghinNegoState';
import { parseHwyMemberPhoneAdminQueue } from '../../domain/hwy/hwyMemberPhoneRequests';
import { resolveHwyMemberIdentityMaskViewer } from '../domain/hwy/hwyMemberIdentityFieldMaskContext';
import type { HwyMemberPhoneSlot } from '../../domain/hwy/hwyMemberPhoneRequestRules';
import {
  createHwyMemberPhoneChangeRequest,
  createHwyMemberPhoneSwapRequest,
  decideHwyMemberPhoneRequest,
  getHwyMemberPhonePendingState,
  listHwyMemberPhoneAdmin,
  listHwyMemberPhoneHistory,
} from '../domain/hwy/hwyMemberPhoneRequests.service';
import { listHwyMemberPhoneRejectReasonOptions } from '../domain/hwy/hwyMemberPhoneRejectReasons.service';
import {
  createHwyMemberTarghinNegoNote,
  listHwyMemberTarghinNegoNotes,
} from '../domain/hwy/hwyMemberTarghinNegoNotes.service';
import type { HwyMemberTarghinDecisionKind } from '../../domain/hwy/hwyMemberTarghinFinalReasons';
import { normalizeAuthRoles } from '../middleware/auth.middleware';
import {
  listHwyMemberDossierCategorySelectOptions,
  listHwyMemberDossierGenderSelectOptions,
  listHwyMemberDossierGeoKindSelectOptions,
} from '../domain/hwy/hwyMemberDossierSelectOptions.service';
import { listHwyMemberInstituteCharacterSelectOptions } from '../domain/hwy/hwyMemberInstituteCharacterSelectOptions.service';
import { resolveHwyMemberInstituteCharacterVocab } from '../../domain/hwy/hwyMemberInstituteCharacterVocab';
import type { HwyMemberDossierGeoKind } from '../../domain/hwy/hwyMemberDossierSelectOptions';
import { HWY_MEMBER_DOSSIER_GEO_KINDS } from '../../domain/hwy/hwyMemberDossierSelectOptions';
const memberDossierFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const hwyActivityFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const hwyActivitySelfieUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const resolveHwyMemberDirectoryIdentitySession = async (
  req: Request,
): Promise<SessionScopeSnapshot | null> => {
  const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
  const roles = normalizeAuthRoles(req);
  return resolveHwyMemberIdentitySessionForAuth({
    userId: actorUserId,
    roles,
    isAdmin: roles.includes('ADMIN'),
    email: req.auth?.email ?? null,
  });
};

const resolveHwyMemberPhoneWorkflowViewer = async (req: Request) => {
  const session = await resolveHwyMemberDirectoryIdentitySession(req);
  return resolveHwyMemberIdentityMaskViewer(session);
};

const readQueryString = (query: Request['query'], key: string): string => {

  const raw = query[key];

  if (typeof raw === 'string') {

    return raw.trim();

  }

  if (Array.isArray(raw) && typeof raw[0] === 'string') {

    return raw[0].trim();

  }

  return '';

};



const readBodyString = (body: unknown, key: string): string => {

  if (!body || typeof body !== 'object') return '';

  const raw = (body as Record<string, unknown>)[key];

  return typeof raw === 'string' ? raw.trim() : '';

};



const isRegistrationChannel = (value: string): value is HwyRegistrationChannelShortName => (
  (HWY_REGISTRATION_CHANNEL_SHORT_NAMES as readonly string[]).includes(value)
);

const isPublicRegistrationChannel = (value: string): value is HwyRegistrationChannelShortName => (
  isRegistrationChannel(value) && !HWY_STAFF_ONLY_REGISTRATION_CHANNELS.has(value as HwyRegistrationChannelShortName)
);



const hwyPublicMutationRateLimit = createKeyedRateLimiter({

  keyPrefix: 'hwy-public-mutation',

  maxPerMinute: 20,

  keyFor: (req) => req.ip ?? 'unknown',

});



const registerHwyOrgMembershipTransferRoutes = (router: Router): void => {
  const orgMembershipTransferRoles = ['ADMIN', ...hwyOrgMembershipTransferRequestRoleNames()];

  router.get(
    '/org-membership-transfer/config',
    requireAuth,
    requireRole(...orgMembershipTransferRoles),
    async (req: Request, res: Response) => {
      try {
        const data = await readHwyOrgMembershipTransferConfig(normalizeAuthRoles(req));
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load org membership config.';
        res.status(500).json({ success: false, message });
      }
    },
  );

  router.get(
    '/org-membership-transfer/members',
    requireAuth,
    requireRole(...orgMembershipTransferRoles),
    async (req: Request, res: Response) => {
      try {
        const cultureOrLang = readQueryString(req.query, 'lang') || 'ar';
        const lang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
        const session = await resolveHwyMemberDirectoryIdentitySession(req);
        const data = await searchHwyOrgMembershipTransferMembers(
          {
            username: readQueryString(req.query, 'username'),
            trackingCode: readQueryString(req.query, 'trackingCode'),
            phone: readQueryString(req.query, 'phone'),
            genderCode: readQueryString(req.query, 'genderCode'),
            firstName: readQueryString(req.query, 'firstName'),
            fatherName: readQueryString(req.query, 'fatherName'),
            grandfatherName: readQueryString(req.query, 'grandfatherName'),
            familyName: readQueryString(req.query, 'familyName'),
            birthYear: readQueryString(req.query, 'birthYear'),
            page: Number(readQueryString(req.query, 'page') || '1'),
            pageSize: Number(readQueryString(req.query, 'pageSize') || '20'),
          },
          normalizeAuthRoles(req),
          lang,
          session,
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not search members.';
        res.status(500).json({ success: false, message });
      }
    },
  );

  router.post(
    '/org-membership-transfer/members/:memberId/institutes/:instituteCode/request',
    requireAuth,
    requireRole(...orgMembershipTransferRoles),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const instituteCode = String(req.params.instituteCode ?? '').trim();
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        await requestHwyOrgMembershipTransferForMember({
          memberId,
          instituteCode,
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
          roleNames: normalizeAuthRoles(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not request transfer.';
        const status = message === 'Forbidden.' ? 403 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/org-membership-transfer/members/:memberId/institutes/:instituteCode/rollback',
    requireAuth,
    requireRole(...orgMembershipTransferRoles),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const instituteCode = String(req.params.instituteCode ?? '').trim();
      try {
        await rollbackHwyOrgMembershipTransferForMember({
          memberId,
          instituteCode,
          roleNames: normalizeAuthRoles(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not roll back transfer.';
        const status = message === 'Forbidden.' ? 403 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );
};

export const mountHwyRoutes = (app: Express): void => {

  const router = Router();
  router.use(requireHawietyPackage);

  registerHwyEtlConsoleRoutes(router);
  registerHwyBusinessRuleDocsRoutes(router);
  registerHwyMembershipPipelineRoutes(router);
  registerHwyOrgMembershipTransferRoutes(router);

  router.get('/family-household', async (req: Request, res: Response) => {

    const regionId = readQueryString(req.query, 'regionId');

    const familyCode = readQueryString(req.query, 'familyCode');



    if (!regionId || !familyCode) {

      res.status(400).json({

        success: false,

        message: 'regionId and familyCode are required.',

      });

      return;

    }



    try {

      const payload = await loadHwyFamilyHousehold({ regionId, familyCode }, req);

      res.json({ success: true, data: payload });

    } catch (error) {

      const message = error instanceof Error ? error.message : 'Could not load family household.';

      res.status(500).json({ success: false, message });

    }

  });



  router.get('/public/self-registration/address/provinces', async (req: Request, res: Response) => {
    const cultureId = readQueryString(req.query, 'cultureId') || 'iq';

    try {
      const data = await listHwySelfRegistrationProvinces(cultureId);
      res.json({ success: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load provinces.';
      res.status(500).json({ success: false, message });
    }
  });

  router.get('/public/self-registration/vocab/education-levels', async (req: Request, res: Response) => {
    const cultureId = readQueryString(req.query, 'cultureId') || 'iq';
    const data = await listHwySelfRegistrationEducationLevelOptions(cultureId);
    res.json({ success: true, data });
  });

  router.get('/public/self-registration/vocab/job-types', async (req: Request, res: Response) => {
    const cultureId = readQueryString(req.query, 'cultureId') || 'iq';
    const data = await listHwySelfRegistrationJobTypeOptions(cultureId);
    res.json({ success: true, data });
  });

  router.get('/public/self-registration/vocab', async (req: Request, res: Response) => {
    const cultureId = readQueryString(req.query, 'cultureId') || 'iq';
    const [educationLevels, jobTypes] = await Promise.all([
      listHwySelfRegistrationEducationLevelOptions(cultureId),
      listHwySelfRegistrationJobTypeOptions(cultureId),
    ]);
    res.json({ success: true, data: { educationLevels, jobTypes } });
  });

  router.get('/public/self-registration/referrer-relations', async (req: Request, res: Response) => {
    const cultureId = readQueryString(req.query, 'cultureId') || 'iq';
    const data = await listHwySelfRegistrationReferrerRelations(cultureId);
    res.json({ success: true, data });
  });

  router.get(
    '/institutes/scoped-edit-config',
    requireAuth,
    requireRole('ADMIN'),
    async (_req: Request, res: Response) => {
      try {
        const data = await listHwyInstituteScopedEditConfig();
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load institute scoped-edit config.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get('/institutes/:instituteId/logo', async (req: Request, res: Response) => {
    const instituteId = Number.parseInt(String(req.params.instituteId ?? ''), 10);
    if (!Number.isFinite(instituteId) || instituteId <= 0) {
      res.status(400).json({ success: false, message: 'Invalid institute id.' });
      return;
    }
    try {
      const logo = await loadHwyInstituteLogo(instituteId);
      if (!logo) {
        res.status(404).end();
        return;
      }
      res.setHeader('Content-Type', logo.contentType);
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(logo.content);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load institute logo.';
      res.status(500).json({ success: false, message });
    }
  });

  router.get('/public/self-registration/institute-brand', async (req: Request, res: Response) => {
    const channelRaw = readQueryString(req.query, 'channel');
    if (!channelRaw || !isRegistrationChannel(channelRaw)) {
      res.status(400).json({ success: false, message: 'Invalid registration channel.' });
      return;
    }
    const referrerInstituteCode = readQueryString(req.query, 'referrerInstituteCode') || null;
    try {
      const data = await loadHwyInstituteSelfRegistrationBrand({
        channel: channelRaw,
        referrerInstituteCode,
      });
      res.json({ success: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load institute brand.';
      res.status(500).json({ success: false, message });
    }
  });

  router.get('/public/self-registration/address/districts', async (req: Request, res: Response) => {
    const cultureId = readQueryString(req.query, 'cultureId') || 'iq';
    const provinceId = readQueryString(req.query, 'provinceId');

    if (!provinceId) {
      res.status(400).json({ success: false, message: 'provinceId is required.' });
      return;
    }

    try {
      const data = await listHwySelfRegistrationDistricts(provinceId, cultureId);
      res.json({ success: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load districts.';
      res.status(500).json({ success: false, message });
    }
  });

  router.post(
    '/public/self-registration/submit',
    hwyPublicMutationRateLimit,
    runHwySelfRegistrationSubmitUpload,
    async (req: Request, res: Response) => {

    const channelRaw = readBodyString(req.body, 'registrationChannel');

    if (!isPublicRegistrationChannel(channelRaw)) {

      res.status(400).json({ success: false, message: 'registrationChannel is invalid.' });

      return;

    }



    try {

      const result = await submitHwySelfRegistration({

        channel: channelRaw,

        firstName: readBodyString(req.body, 'firstName'),

        fatherName: readBodyString(req.body, 'fatherName'),

        grandfatherName: readBodyString(req.body, 'grandfatherName') || null,

        familyName: readBodyString(req.body, 'familyName'),

        birthYear: readBodyString(req.body, 'birthYear') || null,

        birthMonth: readBodyString(req.body, 'birthMonth') || null,

        birthDay: readBodyString(req.body, 'birthDay') || null,

        phone1: readBodyString(req.body, 'phone1'),

        phone2: readBodyString(req.body, 'phone2') || null,

        email: readBodyString(req.body, 'email') || null,

        nationalId: readBodyString(req.body, 'nationalId') || null,

        genderCode: readBodyString(req.body, 'genderCode') || null,

        addrProvinceId: readBodyString(req.body, 'addrProvinceId') || null,

        addrDistrictId: readBodyString(req.body, 'addrDistrictId') || null,

        addrQuarterName: readBodyString(req.body, 'addrQuarterName') || null,

        addrQuarterNo: readBodyString(req.body, 'addrQuarterNo') || null,

        addrAlleyNo: readBodyString(req.body, 'addrAlleyNo') || null,

        addrHouseNo: readBodyString(req.body, 'addrHouseNo') || null,

        addrNearestLandmark: readBodyString(req.body, 'addrNearestLandmark') || null,

        educationLevelCode: readBodyString(req.body, 'educationLevelCode') || null,

        educationSchool: readBodyString(req.body, 'educationSchool') || null,

        educationBranch: readBodyString(req.body, 'educationBranch') || null,

        educationEntryYear: readBodyString(req.body, 'educationEntryYear') || null,

        educationEndYear: readBodyString(req.body, 'educationEndYear') || null,

        jobTypeCode: readBodyString(req.body, 'jobTypeCode') || null,

        jobPlace: readBodyString(req.body, 'jobPlace') || null,

        referrerInstituteCode: readBodyString(req.body, 'referrerInstituteCode') || null,

        referrerUsername: readBodyString(req.body, 'referrerUsername') || null,

        referrerRelationId: readBodyString(req.body, 'referrerRelationId') || null,

        note: readBodyString(req.body, 'note') || null,

        attachments: parseHwySelfRegistrationSubmitAttachments(req),

      });

      res.status(201).json({ success: true, data: result });

    } catch (error) {

      const message = error instanceof Error ? error.message : 'Self-registration failed.';

      res.status(400).json({ success: false, message });

    }

  },
  );



  router.post('/public/member/login', hwyPublicMutationRateLimit, async (_req: Request, res: Response) => {
    res.status(501).json({
      success: false,
      message: 'Hawiety member login is not wired in this environment yet.',
    });
  });

  router.post('/public/self-registration/track', hwyPublicMutationRateLimit, async (req: Request, res: Response) => {

    const trackingCode = readBodyString(req.body, 'trackingCode');

    try {

      const result = await trackHwySelfRegistration(trackingCode);

      if (result.status === 'invalid') {

        res.status(404).json({ success: false, code: 'invalid-code' });

        return;

      }

      res.json({ success: true, data: { message: result.message } });

    } catch (error) {

      const message = error instanceof Error ? error.message : 'Could not track registration.';

      res.status(500).json({ success: false, message });

    }

  });



  const readBodyOptionalString = (body: unknown, key: string): string | null => {
    if (!body || typeof body !== 'object') {
      return null;
    }
    const raw = (body as Record<string, unknown>)[key];
    if (raw === null || raw === undefined) {
      return null;
    }
    return typeof raw === 'string' ? raw : null;
  };

  const requireHwyCoursesActivitiesAdmin = [
    requireAuth,
    requireHwyCoursesActivitiesAccess,
  ] as const;

  router.post(
    '/member-directory/:memberId/files',
    requireAuth,
    requireRole('ADMIN'),
    memberDossierFileUpload.single('file'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const fileKindCode = readBodyString(req.body, 'fileKindCode');
      if (!fileKindCode) {
        res.status(400).json({ success: false, message: 'fileKindCode is required.' });
        return;
      }
      const uploaded = req.file;
      if (!uploaded?.buffer?.length) {
        res.status(400).json({ success: false, message: 'No file uploaded. Send multipart field "file".' });
        return;
      }
      const userIdRaw = req.auth?.userId;
      const updatedByUserId = typeof userIdRaw === 'number' && Number.isFinite(userIdRaw) ? userIdRaw : null;
      try {
        const session = await resolveHwyMemberDirectoryIdentitySession(req);
        await assertHwyMemberDossierFileUploadAllowed({
          memberId,
          fileKindCode,
          session,
        });
        const result = await upsertHwyMemberDossierFile({
          memberId,
          fileKindCode,
          fileName: uploaded.originalname || 'upload.bin',
          mime: uploaded.mimetype || 'application/octet-stream',
          body: uploaded.buffer,
          updatedByUserId,
        });
        res.status(result.created ? 201 : 200).json({ success: true, data: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save member file.';
        const status = message === 'Forbidden.' ? 403 : message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/member-directory/:memberId/imagefix-move-slot',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const sourceKindSlug = readBodyString(req.body, 'sourceKindSlug');
      const targetKindSlug = readBodyString(req.body, 'targetKindSlug');
      const sourceFileId = readBodyString(req.body, 'sourceFileId');
      const targetFileId = readBodyOptionalString(req.body, 'targetFileId');
      if (!memberId || !sourceKindSlug || !targetKindSlug || !sourceFileId) {
        res.status(400).json({
          success: false,
          message: 'memberId, sourceKindSlug, targetKindSlug, and sourceFileId are required.',
        });
        return;
      }
      const userIdRaw = req.auth?.userId;
      const updatedByUserId = typeof userIdRaw === 'number' && Number.isFinite(userIdRaw) ? userIdRaw : null;
      try {
        await moveHwyMemberImageFixRegistrationFileSlot({
          memberId,
          sourceKindSlug,
          targetKindSlug,
          sourceFileId,
          targetFileId,
          updatedByUserId,
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not move document between slots.';
        const status = message.includes('not configured') || message.includes('invalid') ? 400 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/files',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const data = await listHwyMemberDossierFiles(memberId, queryLang);
        const memberIdNum = Number(memberId);
        const registrationSlots = Number.isFinite(memberIdNum)
          ? await listHwyMemberDossierRegistrationFileSlots(memberIdNum, queryLang)
          : [];
        const otherKind = await resolveHwyMemberFileKindBySlugOrId('other_attachment');
        const imageFixEditor = Number.isFinite(memberIdNum)
          ? await loadHwyMemberImageFixEditorFields(memberIdNum)
          : null;
        res.json({
          success: true,
          data,
          registrationSlots,
          otherAttachmentKindCode: otherKind?.id ?? null,
          imageFixEditor,
          meta: { lang: queryLang },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load member files.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member/activities/:activityId/self-announcement-spec',
    requireAuth,
    async (req: Request, res: Response) => {
      const activityId = String(req.params.activityId ?? '').trim();
      try {
        const data = await readHwyActivitySelfAnnouncementSpec(activityId);
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load submission requirements.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/member/activities/:activityId/self-announcement',
    requireAuth,
    hwyActivitySelfieUpload.single('selfie'),
    async (req: Request, res: Response) => {
      const activityId = String(req.params.activityId ?? '').trim();
      const uploaded = req.file;
      if (!uploaded?.buffer?.length) {
        res.status(400).json({ success: false, message: 'Selfie image is required.' });
        return;
      }
      const userId = req.auth?.userId;
      if (userId == null) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
      }
      try {
        const data = await submitHwyActivitySelfAnnouncement({
          activityIdRaw: activityId,
          userId,
          metadata: req.body as Record<string, unknown>,
          clientClaimed: readClientClaimedFromRequest(req),
          selfie: {
            buffer: uploaded.buffer,
            originalName: uploaded.originalname || 'selfie.jpg',
            mime: uploaded.mimetype || 'image/jpeg',
          },
        });
        res.status(201).json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Self-announcement failed.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-rashh-picker/candidates',
    requireAuth,
    requireHwyMemberRashhPickerAccess,
    async (req: Request, res: Response) => {
      const level = readGeoResponsibilityLevel(readQueryString(req.query, 'level'));
      const geoBaseInfoId = readQueryString(req.query, 'geoBaseInfoId');
      const selectionPurposeRaw = readQueryString(req.query, 'selectionPurpose');
      if (!level || !geoBaseInfoId) {
        res.status(400).json({ success: false, message: 'level and geoBaseInfoId are required.' });
        return;
      }
      if (
        selectionPurposeRaw !== 'coursesActivitiesAttendee'
        && selectionPurposeRaw !== 'coursesActivitiesTrainer'
      ) {
        res.status(400).json({ success: false, message: 'selectionPurpose is required for member rashh picker.' });
        return;
      }
      try {
        const data = await listHwyGeoResponsibilityNominationCandidates(
          {
            level,
            geoBaseInfoId,
            memberFilters: {
              membershipNumber: readQueryString(req.query, 'membershipNumber'),
              firstName: readQueryString(req.query, 'firstName'),
              fatherName: readQueryString(req.query, 'fatherName'),
              grandfatherName: readQueryString(req.query, 'grandfatherName'),
              familyName: readQueryString(req.query, 'familyName'),
            },
            page: Number(readQueryString(req.query, 'page') || '1'),
            pageSize: Number(readQueryString(req.query, 'pageSize') || '50'),
            selectionPurpose: selectionPurposeRaw,
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not list members.';
        const status = message === 'Forbidden.' ? 403 : message.includes('required') ? 400 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-picker',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const q = readQueryString(req.query, 'q');
      const limit = Math.max(1, Math.min(25, Number(readQueryString(req.query, 'limit') || '15') || 15));
      const purpose = readQueryString(req.query, 'purpose') || undefined;
      try {
        const session = await resolveHwyMemberDirectoryIdentitySession(req);
        const data = await searchHwyMemberPicker({ qRaw: q, limit, purpose, session });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not search members.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/profile-nav-counts',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const session = await resolveHwyMemberDirectoryIdentitySession(req);
        const data = await getHwyMemberDossierProfileNavCounts(memberId, queryLang, session);
        res.json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load profile section counts.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/member-directory/:memberId/stats-recalc/:stepId',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const stepId = String(req.params.stepId ?? '').trim() as HwyMemberStatRecalcStepId;
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      if (!hwyMemberStatRecalcStepById(stepId)) {
        res.status(400).json({ success: false, message: 'Unknown stats recalc step.' });
        return;
      }
      try {
        const data = await runHwyMemberStatRecalcStep(memberId, stepId);
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not recalculate member stats.';
        const status = message.toLowerCase().includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/activity-attendances',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      const limit = Math.max(1, Math.min(200, Number(readQueryString(req.query, 'limit') || '50') || 50));
      const offset = Math.max(0, Number(readQueryString(req.query, 'offset') || '0') || 0);
      try {
        const data = await listHwyMemberActivityAttendances(memberId, limit, offset, queryLang);
        res.json({ success: true, data, meta: { limit, offset, lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load activity attendances.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/nb-selfie-history',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      try {
        const data = await listHwyMemberNbSelfieHistory(memberId);
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load selfie history.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/activity-attendances/:attendanceId/selfie',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const attendanceId = String(req.params.attendanceId ?? '').trim();
      if (!memberId || !attendanceId) {
        res.status(400).json({ success: false, message: 'Member id and attendance id are required.' });
        return;
      }
      try {
        const payload = await readHwyMemberDirectoryActivityAttendanceSelfie(memberId, attendanceId);
        res.setHeader('Content-Type', payload.mime);
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.send(payload.buffer);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load selfie.';
        const status = message.includes('not found') || message.includes('not available') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/course-attendances',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      const limit = Math.max(1, Math.min(200, Number(readQueryString(req.query, 'limit') || '50') || 50));
      const offset = Math.max(0, Number(readQueryString(req.query, 'offset') || '0') || 0);
      try {
        const data = await listHwyMemberCourseAttendances(memberId, limit, offset, queryLang);
        res.json({ success: true, data, meta: { limit, offset, lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load course attendances.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  const readActivitiesAdminQueue = (raw: string): HwyActivitiesAdminQueue | null => {
    const queue = raw.trim().toLowerCase();
    if (queue === 'register' || queue === 'waited-1' || queue === 'final' || queue === 'central') {
      return queue;
    }
    return null;
  };

  const readCoursesAdminQueue = (raw: string): HwyCoursesAdminQueue | null => {
    const queue = raw.trim().toLowerCase();
    if (queue === 'list' || queue === 'review') {
      return queue;
    }
    return null;
  };

  const readActivityWorkflowAction = (raw: string): HwyActivityWorkflowAction | null => {
    const action = raw.trim().toLowerCase();
    if (
      action === 'send-to-waited-1'
      || action === 'send-to-waited-2'
      || action === 'send-to-final'
      || action === 'send-to-draft'
      || action === 'send-to-marfoozeh'
      || action === 'send-to-un-marfoozeh'
    ) {
      return action;
    }
    return null;
  };

  const readCourseWorkflowAction = (raw: string): HwyCourseWorkflowAction | null => {
    const action = raw.trim().toLowerCase();
    if (
      action === 'send-to-review'
      || action === 'mark-as-ok'
      || action === 'send-to-draft'
      || action === 'send-to-marfoozeh'
      || action === 'send-to-un-marfoozeh'
    ) {
      return action;
    }
    return null;
  };

  router.get(
    '/courses-activities/vocab',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const kindRaw = readQueryString(req.query, 'kind').trim().toLowerCase();
      const kind = kindRaw === 'course' || kindRaw === 'courses' ? 'course' : kindRaw === 'activity' || kindRaw === 'activities' ? 'activity' : null;
      if (!kind) {
        res.status(400).json({ success: false, message: 'Invalid vocab kind.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      const parentCode = readQueryString(req.query, 'parentCode');
      try {
        const data = await listHwyCoursesActivitiesVocabOptions({
          kind,
          parentCode: parentCode || null,
          queryLang,
        });
        res.json({ success: true, data, meta: { kind, lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load vocabulary.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/courses-activities/activities',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        const data = await createHwyActivityDraft(
          readUpsertHwyActivityDraftInput(req.body),
          Number.isFinite(actorUserId) ? actorUserId : null,
          queryLang,
        );
        res.status(201).json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not create activity.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.patch(
    '/courses-activities/activities/:activityId',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const activityId = String(req.params.activityId ?? '').trim();
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        const data = await updateHwyActivityDraft(
          activityId,
          readUpsertHwyActivityDraftInput(req.body),
          Number.isFinite(actorUserId) ? actorUserId : null,
          queryLang,
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not update activity.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/courses-activities/courses',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        const data = await createHwyCourseDraft(
          {
            courseDate: readBodyString(req.body, 'courseDate'),
            courseTypeCode: readBodyString(req.body, 'courseTypeCode'),
            courseSubtypeCode: readBodyString(req.body, 'courseSubtypeCode'),
            note: readBodyString(req.body, 'note'),
            trainerMemberId: readBodyString(req.body, 'trainerMemberId'),
            legacyProvinceId: readBodyString(req.body, 'legacyProvinceId'),
          },
          Number.isFinite(actorUserId) ? actorUserId : null,
          queryLang,
        );
        res.status(201).json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not create course.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.patch(
    '/courses-activities/courses/:courseId',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const courseId = String(req.params.courseId ?? '').trim();
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        const data = await updateHwyCourseDraft(
          courseId,
          {
            courseDate: readBodyString(req.body, 'courseDate'),
            courseTypeCode: readBodyString(req.body, 'courseTypeCode'),
            courseSubtypeCode: readBodyString(req.body, 'courseSubtypeCode'),
            note: readBodyString(req.body, 'note'),
            trainerMemberId: readBodyString(req.body, 'trainerMemberId'),
            legacyProvinceId: readBodyString(req.body, 'legacyProvinceId'),
          },
          Number.isFinite(actorUserId) ? actorUserId : null,
          queryLang,
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not update course.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/courses-activities/activities/:activityId/files',
    ...requireHwyCoursesActivitiesAdmin,
    hwyActivityFileUpload.single('file'),
    async (req: Request, res: Response) => {
      const activityId = String(req.params.activityId ?? '').trim();
      const uploaded = req.file;
      if (!uploaded?.buffer?.length) {
        res.status(400).json({ success: false, message: 'No file uploaded. Send multipart field "file".' });
        return;
      }
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        const data = await uploadHwyActivityFile({
          activityIdRaw: activityId,
          fileName: uploaded.originalname || 'upload.bin',
          mime: uploaded.mimetype || 'application/octet-stream',
          buffer: uploaded.buffer,
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
        });
        res.status(201).json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not upload file.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/courses-activities/activities',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const queue = readActivitiesAdminQueue(readQueryString(req.query, 'queue') || 'register');
      if (!queue) {
        res.status(400).json({ success: false, message: 'Invalid activities queue.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      const search = readQueryString(req.query, 'search');
      const page = Number(readQueryString(req.query, 'page') || '1') || 1;
      const pageSize = Number(readQueryString(req.query, 'pageSize') || '25') || 25;
      try {
        const data = await listHwyActivitiesAdmin({
          queue,
          search,
          activitySubtypeCode: readQueryString(req.query, 'activitySubtypeCode'),
          recordId: readQueryString(req.query, 'recordId'),
          title: readQueryString(req.query, 'title'),
          dateFrom: readQueryString(req.query, 'dateFrom'),
          dateTo: readQueryString(req.query, 'dateTo'),
          participantUsername: readQueryString(req.query, 'participantUsername'),
          deviceOsId: readQueryString(req.query, 'deviceOsId'),
          page,
          pageSize,
          queryLang,
        });
        res.json({ success: true, data, meta: { queue, lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load activities.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/courses-activities/activities/:activityId',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const activityId = String(req.params.activityId ?? '').trim();
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const data = await readHwyActivityAdminDetail(activityId, queryLang);
        res.json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load activity.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/courses-activities/activities/:activityId/nb-target-audience-count',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const activityId = String(req.params.activityId ?? '').trim();
      try {
        const count = await countHwyActivityNbTargetAudience(activityId);
        res.json({ success: true, data: { count } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not count target audience.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/courses-activities/tajammoat/organization-options',
    ...requireHwyCoursesActivitiesAdmin,
    async (_req: Request, res: Response) => {
      try {
        const data = await listHwyTajammoatOrganizationPickerOptions();
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load organization options.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/courses-activities/tajammoat/gender-options',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const cultureOrLang = readQueryString(req.query, 'cultureId') || readQueryString(req.query, 'lang');
      try {
        const rows = await listHwyMemberDossierGenderSelectOptions(cultureOrLang);
        const data = rows.map((row) => ({ id: row.value, label: row.label }));
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load gender options.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/courses-activities/courses',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const queue = readCoursesAdminQueue(readQueryString(req.query, 'queue') || 'list');
      if (!queue) {
        res.status(400).json({ success: false, message: 'Invalid courses queue.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      const search = readQueryString(req.query, 'search');
      const page = Number(readQueryString(req.query, 'page') || '1') || 1;
      const pageSize = Number(readQueryString(req.query, 'pageSize') || '25') || 25;
      try {
        const data = await listHwyCoursesAdmin({ queue, search, page, pageSize, queryLang });
        res.json({ success: true, data, meta: { queue, lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load courses.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/courses-activities/courses/:courseId',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const courseId = String(req.params.courseId ?? '').trim();
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const data = await readHwyCourseAdminDetail(courseId, queryLang);
        res.json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load course.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/courses-activities/activities/:activityId/attendances',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const activityId = String(req.params.activityId ?? '').trim();
      const limit = Math.max(1, Math.min(200, Number(readQueryString(req.query, 'limit') || '50') || 50));
      const offset = Math.max(0, Number(readQueryString(req.query, 'offset') || '0') || 0);
      try {
        const data = await listHwyActivityAdminAttendances(activityId, limit, offset);
        res.json({ success: true, data, meta: { limit, offset } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load attendances.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/courses-activities/activities/:activityId/files',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const activityId = String(req.params.activityId ?? '').trim();
      try {
        const data = await listHwyActivityAdminFiles(activityId);
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load files.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/courses-activities/activities/:activityId/approval-steps',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const activityId = String(req.params.activityId ?? '').trim();
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const data = await listHwyActivityAdminApprovalSteps(activityId, queryLang);
        res.json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load approval history.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/courses-activities/courses/:courseId/attendances',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const courseId = String(req.params.courseId ?? '').trim();
      const limit = Math.max(1, Math.min(200, Number(readQueryString(req.query, 'limit') || '50') || 50));
      const offset = Math.max(0, Number(readQueryString(req.query, 'offset') || '0') || 0);
      try {
        const data = await listHwyCourseAdminAttendances(courseId, limit, offset);
        res.json({ success: true, data, meta: { limit, offset } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load attendances.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/courses-activities/courses/:courseId/approval-steps',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const courseId = String(req.params.courseId ?? '').trim();
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const data = await listHwyCourseAdminApprovalSteps(courseId, queryLang);
        res.json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load approval history.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/courses-activities/activities/:activityId/attendances',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const activityId = String(req.params.activityId ?? '').trim();
      const memberId = readBodyString(req.body, 'memberId');
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        await addHwyActivityAdminAttendance({
          activityIdRaw: activityId,
          memberIdRaw: memberId,
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not add attendee.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.delete(
    '/courses-activities/activities/:activityId/attendances/:attendanceId',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const activityId = String(req.params.activityId ?? '').trim();
      const attendanceId = String(req.params.attendanceId ?? '').trim();
      try {
        await removeHwyActivityAdminAttendance({ activityIdRaw: activityId, attendanceIdRaw: attendanceId });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not remove attendee.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/courses-activities/courses/:courseId/attendances',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const courseId = String(req.params.courseId ?? '').trim();
      const memberId = readBodyString(req.body, 'memberId');
      const note = readBodyString(req.body, 'note');
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        await addHwyCourseAdminAttendance({
          courseIdRaw: courseId,
          memberIdRaw: memberId,
          note,
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not add attendee.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.delete(
    '/courses-activities/courses/:courseId/attendances/:attendanceId',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const courseId = String(req.params.courseId ?? '').trim();
      const attendanceId = String(req.params.attendanceId ?? '').trim();
      try {
        await removeHwyCourseAdminAttendance({ courseIdRaw: courseId, attendanceIdRaw: attendanceId });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not remove attendee.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.delete(
    '/courses-activities/activities/:activityId/files/:fileId',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const activityId = String(req.params.activityId ?? '').trim();
      const fileId = String(req.params.fileId ?? '').trim();
      try {
        await deleteHwyActivityAdminFile({ activityIdRaw: activityId, fileIdRaw: fileId });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not delete file.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/courses-activities/activity-attendances/:attendanceId/selfie',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const attendanceId = String(req.params.attendanceId ?? '').trim();
      try {
        const payload = await readHwyActivityAttendanceSelfieContent(attendanceId);
        res.setHeader('Content-Type', payload.mime);
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.send(payload.buffer);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load selfie.';
        const status = message.includes('not found') || message.includes('not available') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/courses-activities/activity-files/:fileId/content',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const fileId = String(req.params.fileId ?? '').trim();
      try {
        const payload = await readHwyActivityFileContent(fileId);
        res.setHeader('Content-Type', payload.mime);
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.send(payload.buffer);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load file content.';
        const status = message.includes('not found') || message.includes('not available') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/courses-activities/activities/:activityId/workflow',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const activityId = String(req.params.activityId ?? '').trim();
      const action = readActivityWorkflowAction(readBodyString(req.body, 'action'));
      if (!action) {
        res.status(400).json({ success: false, message: 'Invalid workflow action.' });
        return;
      }
      const note = readBodyString(req.body, 'note');
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        const data = await applyHwyActivityWorkflowAction({
          activityIdRaw: activityId,
          action,
          note,
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
          queryLang,
        });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Workflow action failed.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/courses-activities/courses/:courseId/workflow',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const courseId = String(req.params.courseId ?? '').trim();
      const action = readCourseWorkflowAction(readBodyString(req.body, 'action'));
      if (!action) {
        res.status(400).json({ success: false, message: 'Invalid workflow action.' });
        return;
      }
      const note = readBodyString(req.body, 'note');
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        const data = await applyHwyCourseWorkflowAction({
          courseIdRaw: courseId,
          action,
          note,
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
          queryLang,
        });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Workflow action failed.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/courses-activities/admin/cleanup-drafted-courses',
    ...requireHwyCoursesActivitiesAdmin,
    async (_req: Request, res: Response) => {
      try {
        const data = await cleanupHwyDraftedCourses();
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not cleanup drafted courses.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/courses-activities/admin/cleanup-drafted-activities',
    ...requireHwyCoursesActivitiesAdmin,
    async (_req: Request, res: Response) => {
      try {
        const data = await cleanupHwyDraftedActivities();
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not cleanup drafted activities.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/courses-activities/admin/copy-course-attendances',
    ...requireHwyCoursesActivitiesAdmin,
    async (req: Request, res: Response) => {
      const sourceCourseId = readBodyString(req.body, 'sourceCourseId');
      const targetCourseId = readBodyString(req.body, 'targetCourseId');
      if (!sourceCourseId || !targetCourseId) {
        res.status(400).json({ success: false, message: 'sourceCourseId and targetCourseId are required.' });
        return;
      }
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        const data = await copyHwyCourseAttendances({
          sourceCourseIdRaw: sourceCourseId,
          targetCourseIdRaw: targetCourseId,
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
        });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not copy course participants.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/institutes',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const data = await listHwyMemberDossierInstitutes(memberId, queryLang);
        res.json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load member institutes.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/notes',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const data = await listHwyMemberDossierNotes(memberId, queryLang);
        res.json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load member notes.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/kasb-acquired',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const data = await listHwyMemberDossierKasbAcquired(memberId, queryLang);
        res.json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load kasb acquired members.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/member-directory/:memberId/notes',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const body = readBodyString(req.body, 'body');
      if (!body?.trim()) {
        res.status(400).json({ success: false, message: 'Note body is required.' });
        return;
      }
      const subjectCode = readBodyOptionalString(req.body, 'subjectCode');
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      const userIdRaw = req.auth?.userId;
      const createdByUserId = typeof userIdRaw === 'number' && Number.isFinite(userIdRaw) ? userIdRaw : null;
      try {
        const data = await createHwyMemberDossierNote(
          memberId,
          { body, subjectCode },
          createdByUserId,
          queryLang,
        );
        res.status(201).json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save note.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/targhin-request-reasons',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      try {
        const data = await listHwyMemberTarghinRequestReasonOptions(cultureOrLang);
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load targhin request reasons.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/targhin-requests',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const data = await listHwyMemberDossierTarghinRequests(memberId, queryLang);
        res.json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load targhin history.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/targhin-requests/final-reasons',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const decisionRaw = readQueryString(req.query, 'decision');
      const decision = decisionRaw === 'reject' ? 'reject' : decisionRaw === 'approve' ? 'approve' : null;
      if (!decision) {
        res.status(400).json({ success: false, message: 'decision must be approve or reject.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      try {
        const data = await listHwyMemberTarghinFinalReasonOptions(
          decision as HwyMemberTarghinDecisionKind,
          cultureOrLang,
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load decision reasons.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/targhin-requests/members/:memberId/nego-notes',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      try {
        const data = await listHwyMemberTarghinNegoNotes(memberId);
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load negotiation notes.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/targhin-requests/members/:memberId/nego-notes',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const note = readBodyString(req.body, 'note') ?? '';
      const userIdRaw = req.auth?.userId;
      const actorUserId = typeof userIdRaw === 'number' && Number.isFinite(userIdRaw) ? userIdRaw : null;
      try {
        const data = await createHwyMemberTarghinNegoNote({ memberId, note, actorUserId });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save negotiation note.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/targhin-requests',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const userIdRaw = req.auth?.userId;
        const actorUserId = typeof userIdRaw === 'number' && Number.isFinite(userIdRaw) ? userIdRaw : null;
        const data = await listHwyMemberTarghinAdmin(
          {
            queue: parseHwyMemberTarghinAdminQueue(readQueryString(req.query, 'queue')),
            negoState: parseHwyMemberTarghinNegoStateFilter(readQueryString(req.query, 'negoState')),
            search: readQueryString(req.query, 'search'),
            page: Number(readQueryString(req.query, 'page') || '1'),
            pageSize: Number(readQueryString(req.query, 'pageSize') || '25'),
            actorUserId,
          },
          queryLang,
        );
        res.json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load targhin requests.';
        res.status(500).json({ success: false, message });
      }
    },
  );

  router.get(
    '/targhin-members',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const data = await listHwyMemberTarghinMembers(
          {
            search: readQueryString(req.query, 'search'),
            page: Number(readQueryString(req.query, 'page') || '1'),
            pageSize: Number(readQueryString(req.query, 'pageSize') || '25'),
          },
          queryLang,
        );
        res.json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load targhined members.';
        res.status(500).json({ success: false, message });
      }
    },
  );

  router.post(
    '/targhin-requests/bulk-decision',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const decisionRaw = readBodyString(req.body, 'decision');
      const decision = decisionRaw === 'reject' ? 'reject' : decisionRaw === 'approve' ? 'approve' : null;
      if (!decision) {
        res.status(400).json({ success: false, message: 'decision must be approve or reject.' });
        return;
      }
      const finalReasonCode = readBodyString(req.body, 'finalReasonCode') ?? '';
      const finalNote = readBodyString(req.body, 'finalNote') ?? '';
      const requestIdsRaw = req.body?.requestIds;
      const requestIds = Array.isArray(requestIdsRaw)
        ? requestIdsRaw.map((id) => String(id ?? '').trim()).filter(Boolean)
        : [];
      const userIdRaw = req.auth?.userId;
      const actorUserId = typeof userIdRaw === 'number' && Number.isFinite(userIdRaw) ? userIdRaw : null;
      try {
        const data = await decideHwyMemberTarghinRequestsBulk({
          requestIds,
          decision,
          finalReasonCode,
          finalNote,
          actorUserId,
        });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save targhin decisions.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/targhin-requests/:requestId/decision',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const requestId = String(req.params.requestId ?? '').trim();
      if (!requestId) {
        res.status(400).json({ success: false, message: 'Request id is required.' });
        return;
      }
      const decisionRaw = readBodyString(req.body, 'decision');
      const decision = decisionRaw === 'reject' ? 'reject' : decisionRaw === 'approve' ? 'approve' : null;
      if (!decision) {
        res.status(400).json({ success: false, message: 'decision must be approve or reject.' });
        return;
      }
      const finalReasonCode = readBodyString(req.body, 'finalReasonCode') ?? '';
      const finalNote = readBodyString(req.body, 'finalNote') ?? '';
      const userIdRaw = req.auth?.userId;
      const actorUserId = typeof userIdRaw === 'number' && Number.isFinite(userIdRaw) ? userIdRaw : null;
      try {
        const data = await decideHwyMemberTarghinRequest({
          requestId,
          decision,
          finalReasonCode,
          finalNote,
          actorUserId,
        });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save targhin decision.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/member-directory/:memberId/targhin-requests',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const requestReasonCode = readBodyString(req.body, 'requestReasonCode');
      const requestNote = readBodyString(req.body, 'requestNote');
      if (!requestReasonCode?.trim()) {
        res.status(400).json({ success: false, message: 'Targhin request reason is required.' });
        return;
      }
      if (!requestNote?.trim()) {
        res.status(400).json({ success: false, message: 'Request note is required.' });
        return;
      }
      const userIdRaw = req.auth?.userId;
      const createdByUserId = typeof userIdRaw === 'number' && Number.isFinite(userIdRaw) ? userIdRaw : null;
      try {
        const data = await createHwyMemberTarghinRequest(
          memberId,
          { requestReasonCode, requestNote },
          createdByUserId,
        );
        res.status(201).json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save targhin request.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/nakhebin-join-candidates',
    requireAuth,
    requireUsersListAccess,
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const filter = parseHwyMemberNakhebinJoinCandidateFilter(req.query as Record<string, unknown>);
      const scopeRegionGeoId = String(req.query.scopeRegionGeoId ?? '').trim() || null;
      try {
        const data = await listHwyMemberNakhebinJoinCandidates(memberId, filter, scopeRegionGeoId);
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load nakhebin candidates.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/nakhebin-eghtera-regions',
    requireAuth,
    requireHwyMemberRashhPickerAccess,
    async (req: Request, res: Response) => {
      try {
        const data = await listHwyMemberNakhebinEghteraRegions({
          provinceId: readQueryString(req.query, 'provinceId'),
          ancestorGeoId: readQueryString(req.query, 'ancestorGeoId'),
          search: readQueryString(req.query, 'search'),
          page: Number(readQueryString(req.query, 'page') || '1'),
          pageSize: Number(readQueryString(req.query, 'pageSize') || '30'),
        });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load regions.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/similar-members',
    requireAuth,
    requireUsersListAccess,
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const session = await resolveHwyMemberDirectoryIdentitySession(req);
        const filter = parseHwyMemberSimilarMembersFilter(req.query as Record<string, unknown>);
        const data = await listHwyMemberSimilarMembers(
          memberId,
          filter,
          queryLang,
          session,
        );
        res.json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load similar members.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/change-log',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const data = await listHwyMemberDossierChangeLog(memberId, queryLang);
        res.json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load change log.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/security-profile',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const data = await readHwyMemberDossierSecurityProfile(memberId, queryLang);
        res.json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load security profile.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/security-profile/history',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      const queryLang = resolveHwyMemberDirectoryDetailLang(cultureOrLang);
      try {
        const data = await listHwyMemberDossierSecurityProfileHistory(memberId, queryLang);
        res.json({ success: true, data, meta: { lang: queryLang } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load security profile history.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/member-directory/:memberId/security-profile/opinions',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const body = req.body as {
        canGetIdentityCard?: number;
        canGetIdentityCardNote?: string;
        canGetMasooliat?: number;
        canGetMasooliatNote?: string;
        canBeMemberOfAammeh?: number;
        canBeMemberOfAammehNote?: string;
        allowsResponsibility?: number;
        allowsResponsibilityNote?: string;
      };
      if (
        !memberId
        || body.canGetMasooliat == null
        || body.canGetIdentityCard == null
        || body.canBeMemberOfAammeh == null
        || body.allowsResponsibility == null
      ) {
        res.status(400).json({ success: false, message: 'Member id and all security profile dimensions are required.' });
        return;
      }
      try {
        await appendHwyMemberDossierSecurityProfileOpinion(memberId, {
          canGetIdentityCard: Number(body.canGetIdentityCard),
          canGetIdentityCardNote: body.canGetIdentityCardNote,
          canGetMasooliat: Number(body.canGetMasooliat),
          canGetMasooliatNote: body.canGetMasooliatNote,
          canBeMemberOfAammeh: Number(body.canBeMemberOfAammeh),
          canBeMemberOfAammehNote: body.canBeMemberOfAammehNote,
          allowsResponsibility: Number(body.allowsResponsibility),
          allowsResponsibilityNote: body.allowsResponsibilityNote,
          actorUsername: req.user?.username ?? req.user?.email ?? null,
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not register security opinion.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/member-files/:fileId/move-registration-slot',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const sourceFileId = String(req.params.fileId ?? '').trim();
      const memberId = readBodyString(req.body, 'memberId');
      const sourceKindSlug = readBodyString(req.body, 'sourceKindSlug');
      const targetKindSlug = readBodyString(req.body, 'targetKindSlug');
      const targetFileId = readBodyOptionalString(req.body, 'targetFileId');
      if (!sourceFileId || !memberId || !sourceKindSlug || !targetKindSlug) {
        res.status(400).json({
          success: false,
          message: 'fileId, memberId, sourceKindSlug, and targetKindSlug are required.',
        });
        return;
      }
      const userIdRaw = req.auth?.userId;
      const updatedByUserId = typeof userIdRaw === 'number' && Number.isFinite(userIdRaw) ? userIdRaw : null;
      try {
        await moveHwyMemberImageFixRegistrationFileSlot({
          memberId,
          sourceKindSlug,
          targetKindSlug,
          sourceFileId,
          targetFileId,
          updatedByUserId,
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not move document between slots.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.delete(
    '/member-files/:fileId',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const fileId = String(req.params.fileId ?? '').trim();
      if (!fileId) {
        res.status(400).json({ success: false, message: 'File id is required.' });
        return;
      }
      try {
        await deleteHwyMemberDossierFile(fileId);
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not remove document.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-files/:fileId/content',
    requireAuth,
    requireHwyMemberListFaceAssetAccess,
    async (req: Request, res: Response) => {
      const fileId = String(req.params.fileId ?? '').trim();
      if (!fileId) {
        res.status(400).json({ success: false, message: 'File id is required.' });
        return;
      }
      try {
        const payload = await readHwyMemberFileContent(fileId);
        if (!payload) {
          res.status(404).json({ success: false, message: 'File not found.' });
          return;
        }
        res.setHeader('Content-Type', payload.mime);
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.send(payload.body);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load file content.';
        res.status(500).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/select-options/gender',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const cultureOrLang = readQueryString(req.query, 'cultureId') || readQueryString(req.query, 'lang');
      try {
        const data = await listHwyMemberDossierGenderSelectOptions(cultureOrLang);
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load gender options.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/select-options/category',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const category = readQueryString(req.query, 'category');
      if (!category) {
        res.status(400).json({ success: false, message: 'category is required.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'cultureId') || readQueryString(req.query, 'lang');
      try {
        const data = await listHwyMemberDossierCategorySelectOptions(cultureOrLang, category);
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load category options.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/select-options/institute-character',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const instituteCode = readQueryString(req.query, 'instituteCode');
      if (!instituteCode || !resolveHwyMemberInstituteCharacterVocab(instituteCode)) {
        res.status(400).json({ success: false, message: 'instituteCode must be ashaaer, nokhab, or shabab.' });
        return;
      }
      try {
        const cultureOrLang = readQueryString(req.query, 'cultureId') || readQueryString(req.query, 'lang') || 'iq';
        const data = await listHwyMemberInstituteCharacterSelectOptions(instituteCode, cultureOrLang);
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load institute character options.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/select-options/geo-kind',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const kindRaw = readQueryString(req.query, 'kind').trim().toLowerCase();
      if (!HWY_MEMBER_DOSSIER_GEO_KINDS.includes(kindRaw as HwyMemberDossierGeoKind)) {
        res.status(400).json({ success: false, message: 'kind must be maktab, region, or circle.' });
        return;
      }
      const cultureOrLang = readQueryString(req.query, 'cultureId') || readQueryString(req.query, 'lang');
      try {
        const data = await listHwyMemberDossierGeoKindSelectOptions(cultureOrLang, kindRaw as HwyMemberDossierGeoKind);
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load geo options.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  const geoResponsibilityRoles = ['ADMIN', ...hwyGeoResponsibilityAllGateRoleNames()];

  const readGeoResponsibilityLevel = (raw: string): HwyGeoResponsibilityLevel | null => {
    const level = raw.trim();
    return isHwyGeoResponsibilityLevel(level) ? level : null;
  };

  const requireNominationCandidatesAccess = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const selectionPurposeRaw = readQueryString(req.query, 'selectionPurpose');
    if (
      selectionPurposeRaw === 'coursesActivitiesAttendee'
      || selectionPurposeRaw === 'coursesActivitiesTrainer'
    ) {
      requireHwyMemberRashhPickerAccess(req, res, next);
      return;
    }
    requireRole(...geoResponsibilityRoles)(req, res, next);
  };

  router.get(
    '/geo-responsibility/config',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      try {
        const data = readHwyGeoResponsibilityConfig(normalizeAuthRoles(req));
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load geo responsibility config.';
        res.status(500).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/nodes',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      const level = readGeoResponsibilityLevel(readQueryString(req.query, 'level'));
      if (!level) {
        res.status(400).json({ success: false, message: 'Invalid geo responsibility level.' });
        return;
      }
      try {
        const data = await listHwyGeoResponsibilityNodes(
          {
            level,
            search: readQueryString(req.query, 'search'),
            page: Number(readQueryString(req.query, 'page') || '1'),
            pageSize: Number(readQueryString(req.query, 'pageSize') || '25'),
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not list nodes.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/center-stats',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      const level = readGeoResponsibilityLevel(readQueryString(req.query, 'level'));
      const geoBaseInfoId = readQueryString(req.query, 'geoBaseInfoId');
      const legacyGeoIdRaw = readQueryString(req.query, 'legacyGeoId');
      const legacyGeoId = legacyGeoIdRaw ? Number(legacyGeoIdRaw) : null;
      if (!level || !geoBaseInfoId?.trim()) {
        res.status(400).json({ success: false, message: 'level and geoBaseInfoId are required.' });
        return;
      }
      try {
        const data = await getHwyGeoResponsibilityCenterStats(
          {
            level,
            geoBaseInfoId: geoBaseInfoId.trim(),
            legacyGeoId: Number.isFinite(legacyGeoId) ? legacyGeoId : null,
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load center stats.';
        const status = message === 'Forbidden.' ? 403 : message.includes('required') || message.includes('resolve') ? 400 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/patch-history',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      const level = readGeoResponsibilityLevel(readQueryString(req.query, 'level'));
      const geoBaseInfoId = readQueryString(req.query, 'geoBaseInfoId');
      const legacyGeoIdRaw = readQueryString(req.query, 'legacyGeoId');
      const legacyGeoId = legacyGeoIdRaw ? Number(legacyGeoIdRaw) : null;
      if (!level || !geoBaseInfoId?.trim()) {
        res.status(400).json({ success: false, message: 'level and geoBaseInfoId are required.' });
        return;
      }
      try {
        const data = await getHwyGeoResponsibilityPatchHistory(
          {
            level,
            geoBaseInfoId: geoBaseInfoId.trim(),
            legacyGeoId: Number.isFinite(legacyGeoId) ? legacyGeoId : null,
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true, data });
      } catch (error) {
        const raw = error instanceof Error ? error.message.trim() : '';
        const message = raw || 'Could not load patch history.';
        const status = message === 'Forbidden.' ? 403 : message.includes('required') ? 400 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/patch-member-count',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      const level = readGeoResponsibilityLevel(readQueryString(req.query, 'level'));
      const geoBaseInfoId = readQueryString(req.query, 'geoBaseInfoId');
      const membershipStatusKeyRaw = readQueryString(req.query, 'membershipStatusKey');
      const membershipStatusKey = membershipStatusKeyRaw === 'pending_local' ? 'pending_local' : 'active';
      const genderFilterRaw = readQueryString(req.query, 'genderFilter');
      const genderFilter = genderFilterRaw === 'male' || genderFilterRaw === 'female'
        ? genderFilterRaw
        : undefined;
      if (!level || !geoBaseInfoId?.trim()) {
        res.status(400).json({ success: false, message: 'level and geoBaseInfoId are required.' });
        return;
      }
      try {
        const data = await getHwyGeoResponsibilityPatchMemberCount(
          {
            level,
            geoBaseInfoId: geoBaseInfoId.trim(),
            membershipStatusKey,
            genderFilter,
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not count patch members.';
        const status = message === 'Forbidden.' ? 403 : message.includes('required') || message.includes('resolve') ? 400 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/patch-nakhebin-count',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      const level = readGeoResponsibilityLevel(readQueryString(req.query, 'level'));
      const geoBaseInfoId = readQueryString(req.query, 'geoBaseInfoId');
      if (!level || !geoBaseInfoId?.trim()) {
        res.status(400).json({ success: false, message: 'level and geoBaseInfoId are required.' });
        return;
      }
      try {
        const data = await getHwyGeoResponsibilityPatchNakhebinCount(
          { level, geoBaseInfoId: geoBaseInfoId.trim() },
          normalizeAuthRoles(req),
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not count patch nakhebin.';
        const status = message === 'Forbidden.' ? 403 : message.includes('required') || message.includes('resolve') ? 400 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/electoral-options',
    requireAuth,
    requireHwyMemberRashhPickerAccess,
    async (req: Request, res: Response) => {
      const kindRaw = readQueryString(req.query, 'kind');
      if (!kindRaw || !isHwyElectoralGeoKind(kindRaw)) {
        res.status(400).json({ success: false, message: 'Invalid electoral kind.' });
        return;
      }
      try {
        const data = await listHwyGeoResponsibilityElectoralOptions(
          {
            kind: kindRaw,
            parentBaseInfoId: readQueryString(req.query, 'parentBaseInfoId'),
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not list electoral options.';
        const status = message === 'Forbidden.' ? 403 : message.includes('required') ? 400 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/electoral-selection',
    requireAuth,
    requireHwyMemberRashhPickerAccess,
    async (req: Request, res: Response) => {
      const geoBaseInfoId = readQueryString(req.query, 'geoBaseInfoId');
      if (!geoBaseInfoId) {
        res.status(400).json({ success: false, message: 'geoBaseInfoId is required.' });
        return;
      }
      try {
        const data = await resolveHwyGeoResponsibilityElectoralSelection(
          geoBaseInfoId,
          normalizeAuthRoles(req),
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not resolve electoral path.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/province-has-ghavateh',
    requireAuth,
    requireHwyMemberRashhPickerAccess,
    async (req: Request, res: Response) => {
      const provinceBaseInfoId = readQueryString(req.query, 'provinceBaseInfoId');
      if (!provinceBaseInfoId) {
        res.status(400).json({ success: false, message: 'provinceBaseInfoId is required.' });
        return;
      }
      try {
        const data = await fetchHwyGeoResponsibilityProvinceHasGhavateh(
          provinceBaseInfoId,
          normalizeAuthRoles(req),
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not read province ghavateh flag.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/requests',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      const statusRaw = readQueryString(req.query, 'status') as HwyGeoResponsibilityRequestStatus;
      const levelRaw = readQueryString(req.query, 'level');
      const level = levelRaw ? readGeoResponsibilityLevel(levelRaw) : undefined;
      if (levelRaw && !level) {
        res.status(400).json({ success: false, message: 'Invalid level.' });
        return;
      }
      const queueRaw = readQueryString(req.query, 'queue');
      const queue = queueRaw === 'removal' ? 'removal' as const : undefined;
      if (queueRaw && queueRaw !== 'removal') {
        res.status(400).json({ success: false, message: 'Invalid queue.' });
        return;
      }
      try {
        const data = await listHwyGeoResponsibilityRequests(
          {
            status: statusRaw || 'submitted',
            level: level ?? undefined,
            queue,
            page: Number(readQueryString(req.query, 'page') || '1'),
            pageSize: Number(readQueryString(req.query, 'pageSize') || '25'),
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not list requests.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/assignment-requests',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      try {
        const data = await listHwyGeoResponsibilityMontadheminAdmin(
          {
            search: readQueryString(req.query, 'search'),
            page: Number(readQueryString(req.query, 'page') || '1'),
            pageSize: Number(readQueryString(req.query, 'pageSize') || '25'),
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not list candidates.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  const readCandidatePipelineStage = (raw: string | undefined): HwyCandidatePipelineStage | null => {
    const stage = raw?.trim().toLowerCase();
    if (stage === 'security' || stage === 'interview' || stage === 'courses' || stage === 'install') {
      return stage;
    }
    return null;
  };

  router.get(
    '/geo-responsibility/candidate-pipeline/:stage',
    requireAuth,
    requireHwyCandidatePipelineAccess,
    async (req: Request, res: Response) => {
      const stage = readCandidatePipelineStage(req.params.stage);
      if (!stage) {
        res.status(400).json({ success: false, message: 'Invalid pipeline stage.' });
        return;
      }
      try {
        const data = await listHwyCandidatePipeline(
          {
            stage,
            listType: readQueryString(req.query, 'listType'),
            roleId: readQueryString(req.query, 'roleId'),
            isApproved: readQueryString(req.query, 'isApproved'),
            approveState: readQueryString(req.query, 'approveState'),
            passedOrNot: readQueryString(req.query, 'passedOrNot'),
            interviewApproveState: readQueryString(req.query, 'interviewApproveState'),
            nakhebProvinceId: readQueryString(req.query, 'nakhebProvinceId'),
            nakhebCircleId: readQueryString(req.query, 'nakhebCircleId'),
            nakhebTamvinId: readQueryString(req.query, 'nakhebTamvinId'),
            dateStart: readQueryString(req.query, 'dateStart'),
            dateEnd: readQueryString(req.query, 'dateEnd'),
            username: readQueryString(req.query, 'username'),
            phone: readQueryString(req.query, 'phone'),
            genderId: readQueryString(req.query, 'genderId'),
            actorUserName: readQueryString(req.query, 'actorUserName'),
            page: Number(readQueryString(req.query, 'page') || '1'),
            pageSize: Number(readQueryString(req.query, 'pageSize') || '25'),
            queryLang: resolveHwyMemberDirectoryQueryLang(
              req.query as Record<string, unknown>,
              req,
            ),
          },
          normalizeAuthRoles(req),
          req.user?.username ?? req.user?.email ?? null,
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not list pipeline.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/geo-responsibility/candidate-pipeline/security/actions',
    requireAuth,
    requireHwyCandidatePipelineAccess,
    async (req: Request, res: Response) => {
      const body = req.body as HwyCandidatePipelineSecurityProfilePayload & { memberId?: string };
      if (
        !body.memberId
        || body.canGetMasooliat == null
        || body.canGetIdentityCard == null
        || body.canBeMemberOfAammeh == null
        || body.allowsResponsibility == null
      ) {
        res.status(400).json({ success: false, message: 'memberId and all security profile dimensions are required.' });
        return;
      }
      try {
        await applyHwyCandidatePipelineSecurityRecord(
          {
            memberId: String(body.memberId),
            canGetIdentityCard: Number(body.canGetIdentityCard),
            canGetIdentityCardNote: body.canGetIdentityCardNote,
            canGetMasooliat: Number(body.canGetMasooliat),
            canGetMasooliatNote: body.canGetMasooliatNote,
            canBeMemberOfAammeh: Number(body.canBeMemberOfAammeh),
            canBeMemberOfAammehNote: body.canBeMemberOfAammehNote,
            allowsResponsibility: Number(body.allowsResponsibility),
            allowsResponsibilityNote: body.allowsResponsibilityNote,
            actorUsername: req.user?.username ?? req.user?.email ?? null,
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Action failed.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/candidate-pipeline/interview/score-options',
    requireAuth,
    requireHwyCandidatePipelineAccess,
    async (req: Request, res: Response) => {
      try {
        const data = await listHwyInterview2022ScoreOptions(normalizeAuthRoles(req));
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load score options.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/candidate-pipeline/interview/last',
    requireAuth,
    requireHwyCandidatePipelineAccess,
    async (req: Request, res: Response) => {
      const memberId = readQueryString(req.query, 'memberId');
      if (!memberId) {
        res.status(400).json({ success: false, message: 'memberId is required.' });
        return;
      }
      try {
        const data = await getHwyCandidatePipelineInterviewLast(memberId, normalizeAuthRoles(req));
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load interview.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/candidate-pipeline/interview/hazerin-lookup',
    requireAuth,
    requireHwyCandidatePipelineAccess,
    async (req: Request, res: Response) => {
      const username = readQueryString(req.query, 'username');
      if (!username) {
        res.status(400).json({ success: false, message: 'username is required.' });
        return;
      }
      try {
        const data = await lookupHwyInterview2022HazerinMember(
          username,
          req.user?.username ?? req.user?.email ?? null,
          normalizeAuthRoles(req),
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Lookup failed.';
        const status = message === 'Forbidden.' ? 403 : message.includes('must be') || message.includes('not found') ? 400 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/geo-responsibility/candidate-pipeline/interview/actions',
    requireAuth,
    requireHwyCandidatePipelineAccess,
    async (req: Request, res: Response) => {
      const body = req.body as Partial<HwyCandidatePipelineInterviewCreatePayload> & { hazerinMemberIds?: unknown };
      const hazerinMemberIds = Array.isArray(body.hazerinMemberIds)
        ? body.hazerinMemberIds.map((id) => String(id))
        : [];
      if (
        !body.memberId
        || !body.interviewOn
        || body.finalResult == null
        || body.karizma == null
        || body.likeToLearnMore == null
        || body.showIsFan == null
        || body.abilityToMakeTeam == null
        || body.ghodratElec == null
        || body.knowsMasoolin == null
        || body.isMotefaregh == null
        || body.isMotefareghSaat == null
        || !body.note
      ) {
        res.status(400).json({ success: false, message: 'Complete 2022 interview form payload is required.' });
        return;
      }
      try {
        await applyHwyCandidatePipelineInterviewCreate(
          {
            memberId: String(body.memberId),
            interviewOn: String(body.interviewOn),
            karizma: Number(body.karizma),
            likeToLearnMore: Number(body.likeToLearnMore),
            showIsFan: Number(body.showIsFan),
            abilityToMakeTeam: Number(body.abilityToMakeTeam),
            ghodratElec: Number(body.ghodratElec),
            knowsMasoolin: Number(body.knowsMasoolin),
            isMotefaregh: Boolean(body.isMotefaregh),
            isMotefareghSaat: Number(body.isMotefareghSaat),
            note: String(body.note),
            finalResult: Number(body.finalResult),
            hazerinMemberIds,
          },
          req.user?.username ?? req.user?.email ?? null,
          normalizeAuthRoles(req),
        );
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Action failed.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/geo-responsibility/candidate-pipeline/install/actions',
    requireAuth,
    requireHwyCandidatePipelineAccess,
    async (req: Request, res: Response) => {
      const body = req.body as { memberId?: string; areaId?: string; action?: string };
      const action = body.action === 'approve' || body.action === 'reject' ? body.action : null;
      if (!body.memberId || !body.areaId || !action) {
        res.status(400).json({ success: false, message: 'memberId, areaId, and action are required.' });
        return;
      }
      try {
        await applyHwyCandidatePipelineInstallAction(
          {
            memberId: String(body.memberId),
            areaId: String(body.areaId),
            action,
            actorUsername: req.user?.username ?? req.user?.email ?? null,
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Action failed.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  const readCardFlowStep = (raw: string | undefined): HwyCardFlowStep | null => {
    const step = raw?.trim().toLowerCase();
    const allowed: HwyCardFlowStep[] = [
      'start',
      'security',
      'central',
      'province',
      'print',
      'province-delivery',
      'member-delivery',
      'printed-history',
    ];
    return allowed.find((s) => s === step) ?? null;
  };

  const readCardFlowAction = (raw: string | undefined): HwyCardFlowAction | null => {
    const allowed: HwyCardFlowAction[] = [
      'start',
      'accept',
      'reject',
      'printed',
      'reject-to-first',
      'deliver',
      'toggle-visibility',
      'reject-permanent',
      'recalc-can-start',
    ];
    const action = raw?.trim().toLowerCase() as HwyCardFlowAction | undefined;
    return action && allowed.includes(action) ? action : null;
  };

  router.get(
    '/card-flow/:step',
    requireAuth,
    requireHwyCardFlowAccess,
    async (req: Request, res: Response) => {
      const step = readCardFlowStep(req.params.step);
      if (!step) {
        res.status(400).json({ success: false, message: 'Invalid card flow step.' });
        return;
      }
      try {
        const data = await listHwyCardFlow(
          {
            step,
            listType: readQueryString(req.query, 'listType'),
            visibility: readQueryString(req.query, 'visibility'),
            roleId: readQueryString(req.query, 'roleId'),
            username: readQueryString(req.query, 'username'),
            phone: readQueryString(req.query, 'phone'),
            nakhebProvinceId: readQueryString(req.query, 'nakhebProvinceId'),
            nakhebCircleId: readQueryString(req.query, 'nakhebCircleId'),
            nakhebTamvinId: readQueryString(req.query, 'nakhebTamvinId'),
            page: Number(readQueryString(req.query, 'page') || '1'),
            pageSize: Number(readQueryString(req.query, 'pageSize') || '25'),
          },
          normalizeAuthRoles(req),
          req.user?.username ?? req.user?.email ?? null,
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not list card flow.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/card-flow/security/actions',
    requireAuth,
    requireHwyCardFlowAccess,
    async (req: Request, res: Response) => {
      const body = req.body as HwyCandidatePipelineSecurityProfilePayload & { memberId?: string };
      if (
        !body.memberId
        || body.canGetMasooliat == null
        || body.canGetIdentityCard == null
        || body.canBeMemberOfAammeh == null
        || body.allowsResponsibility == null
      ) {
        res.status(400).json({ success: false, message: 'memberId and all security profile dimensions are required.' });
        return;
      }
      try {
        await applyHwyCardFlowSecurityRecord(
          {
            memberId: String(body.memberId),
            canGetIdentityCard: Number(body.canGetIdentityCard),
            canGetIdentityCardNote: body.canGetIdentityCardNote,
            canGetMasooliat: Number(body.canGetMasooliat),
            canGetMasooliatNote: body.canGetMasooliatNote,
            canBeMemberOfAammeh: Number(body.canBeMemberOfAammeh),
            canBeMemberOfAammehNote: body.canBeMemberOfAammehNote,
            allowsResponsibility: Number(body.allowsResponsibility),
            allowsResponsibilityNote: body.allowsResponsibilityNote,
            actorUsername: req.user?.username ?? req.user?.email ?? null,
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Action failed.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/card-flow/:step/actions',
    requireAuth,
    requireHwyCardFlowAccess,
    async (req: Request, res: Response) => {
      const step = readCardFlowStep(req.params.step);
      const body = req.body as {
        memberId?: string;
        action?: string;
        reasonId?: string;
        note?: string;
      };
      const action = readCardFlowAction(body.action) ?? (step === 'start' ? 'start' : null);
      if (!step || !action) {
        res.status(400).json({ success: false, message: 'step and action are required.' });
        return;
      }
      if (action !== 'recalc-can-start' && !body.memberId?.trim()) {
        res.status(400).json({ success: false, message: 'memberId is required for this action.' });
        return;
      }
      try {
        await applyHwyCardFlowStep(
          {
            step,
            action,
            memberId: body.memberId?.trim() ? String(body.memberId) : undefined,
            reasonId: body.reasonId,
            note: body.note,
            actorUsername: req.user?.username ?? req.user?.email ?? null,
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Action failed.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/meetings/definitions',
    requireAuth,
    requireHwyMeetingsManagementAccess,
    async (_req: Request, res: Response) => {
      try {
        const data = await listHwyMeetingDefinitions(normalizeAuthRoles(_req));
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not list meetings.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/meetings/instances',
    requireAuth,
    requireHwyMeetingsManagementAccess,
    async (req: Request, res: Response) => {
      try {
        const data = await listHwyMeetingInstances(
          {
            meetingId: readQueryString(req.query, 'meetingId'),
            username: readQueryString(req.query, 'username'),
            page: Number(readQueryString(req.query, 'page') || '1'),
            pageSize: Number(readQueryString(req.query, 'pageSize') || '25'),
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not list instances.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/meetings/instances',
    requireAuth,
    requireHwyMeetingsManagementAccess,
    async (req: Request, res: Response) => {
      const body = req.body as { meetingId?: string; instanceDate?: string };
      if (!body.meetingId || !body.instanceDate) {
        res.status(400).json({ success: false, message: 'meetingId and instanceDate are required.' });
        return;
      }
      try {
        await addHwyMeetingInstance(
          {
            meetingId: String(body.meetingId),
            instanceDate: String(body.instanceDate),
            actorUsername: req.user?.username ?? req.user?.email ?? null,
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Add instance failed.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/meetings/attendance-pivot',
    requireAuth,
    requireHwyMeetingsManagementAccess,
    async (req: Request, res: Response) => {
      const meetingId = readQueryString(req.query, 'meetingId');
      if (!meetingId) {
        res.status(400).json({ success: false, message: 'meetingId is required.' });
        return;
      }
      try {
        const data = await listHwyMeetingAttendancePivot(meetingId, normalizeAuthRoles(req));
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load pivot.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/meetings/:meetingId/members',
    requireAuth,
    requireHwyMeetingsManagementAccess,
    async (req: Request, res: Response) => {
      const meetingId = req.params.meetingId?.trim();
      if (!meetingId) {
        res.status(400).json({ success: false, message: 'meetingId is required.' });
        return;
      }
      try {
        const data = await listHwyMeetingMembers(meetingId, normalizeAuthRoles(req));
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not list members.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/meetings/:meetingId/members',
    requireAuth,
    requireHwyMeetingsManagementAccess,
    async (req: Request, res: Response) => {
      const meetingId = req.params.meetingId?.trim();
      const body = req.body as { memberId?: string; username?: string };
      if (!meetingId) {
        res.status(400).json({ success: false, message: 'meetingId is required.' });
        return;
      }
      try {
        await addHwyMeetingMember(
          {
            meetingId,
            memberId: body.memberId,
            username: body.username,
            actorUsername: req.user?.username ?? req.user?.email ?? null,
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Add member failed.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.delete(
    '/meetings/members/:rowId',
    requireAuth,
    requireHwyMeetingsManagementAccess,
    async (req: Request, res: Response) => {
      const rowId = req.params.rowId?.trim();
      if (!rowId) {
        res.status(400).json({ success: false, message: 'rowId is required.' });
        return;
      }
      try {
        await removeHwyMeetingMember(
          { rowId, actorUsername: req.user?.username ?? req.user?.email ?? null },
          normalizeAuthRoles(req),
        );
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Remove member failed.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/meetings/instances/:instanceId/attendance',
    requireAuth,
    requireHwyMeetingsManagementAccess,
    async (req: Request, res: Response) => {
      const instanceId = req.params.instanceId?.trim();
      if (!instanceId) {
        res.status(400).json({ success: false, message: 'instanceId is required.' });
        return;
      }
      try {
        const data = await listHwyMeetingInstanceAttendance(instanceId, normalizeAuthRoles(req));
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load attendance.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/meetings/instances/:instanceId/hazerin',
    requireAuth,
    requireHwyMeetingsManagementAccess,
    async (req: Request, res: Response) => {
      const instanceId = req.params.instanceId?.trim();
      const body = req.body as {
        memberId?: string;
        username?: string;
        deviceLat?: string;
        deviceLon?: string;
        deviceDateTime?: string;
        deviceId?: string;
      };
      if (!instanceId) {
        res.status(400).json({ success: false, message: 'instanceId is required.' });
        return;
      }
      try {
        await addHwyMeetingInstanceHazer(
          {
            instanceId,
            memberId: body.memberId,
            username: body.username,
            deviceLat: body.deviceLat,
            deviceLon: body.deviceLon,
            deviceDateTime: body.deviceDateTime,
            deviceId: body.deviceId,
            actorUsername: req.user?.username ?? req.user?.email ?? null,
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Add attendee failed.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.delete(
    '/meetings/instances/:instanceId/hazerin/:memberId',
    requireAuth,
    requireHwyMeetingsManagementAccess,
    async (req: Request, res: Response) => {
      const instanceId = req.params.instanceId?.trim();
      const memberId = req.params.memberId?.trim();
      if (!instanceId || !memberId) {
        res.status(400).json({ success: false, message: 'instanceId and memberId are required.' });
        return;
      }
      try {
        await removeHwyMeetingInstanceHazer({ instanceId, memberId }, normalizeAuthRoles(req));
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Remove attendee failed.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/meetings/instances/:instanceId/hazerin',
    requireAuth,
    requireHwyMeetingsManagementAccess,
    async (req: Request, res: Response) => {
      const instanceId = req.params.instanceId?.trim();
      if (!instanceId) {
        res.status(400).json({ success: false, message: 'instanceId is required.' });
        return;
      }
      try {
        const data = await listHwyMeetingInstanceHazerin(instanceId, normalizeAuthRoles(req));
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load hazerin.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.delete(
    '/meetings/instances/:instanceId',
    requireAuth,
    requireHwyMeetingsManagementAccess,
    async (req: Request, res: Response) => {
      const instanceId = req.params.instanceId?.trim();
      if (!instanceId) {
        res.status(400).json({ success: false, message: 'instanceId is required.' });
        return;
      }
      try {
        await removeHwyMeetingInstance(instanceId, normalizeAuthRoles(req));
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Remove failed.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/employees-list',
    requireAuth,
    requireHwyEmployeesListAccess,
    async (req: Request, res: Response) => {
      try {
        const queryLang = resolveHwyMemberDirectoryQueryLang(
          readQueryString(req.query, 'lang') || req.headers['accept-language']?.toString() || 'ar',
        );
        const data = await listHwyEmployees(
          {
            username: readQueryString(req.query, 'username'),
            phone: readQueryString(req.query, 'phone'),
            firstName: readQueryString(req.query, 'firstName'),
            fatherName: readQueryString(req.query, 'fatherName'),
            grandFatherName: readQueryString(req.query, 'grandFatherName'),
            lastName: readQueryString(req.query, 'lastName'),
            genderId: readQueryString(req.query, 'genderId'),
            roleId: readQueryString(req.query, 'roleId'),
            vProvinceId: readQueryString(req.query, 'vProvinceId'),
            vCircleId: readQueryString(req.query, 'vCircleId'),
            vTamvinId: readQueryString(req.query, 'vTamvinId'),
            vHasGhasam: readQueryString(req.query, 'vHasGhasam'),
            vAreaHasProblem: readQueryString(req.query, 'vAreaHasProblem'),
            vFieldsCompleted: readQueryString(req.query, 'vFieldsCompleted'),
            page: Number(readQueryString(req.query, 'page') || '1'),
            pageSize: Number(readQueryString(req.query, 'pageSize') || '25'),
          },
          normalizeAuthRoles(req),
          queryLang,
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load employees.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/employees-list/:memberId/remove',
    requireAuth,
    requireHwyEmployeesListAccess,
    async (req: Request, res: Response) => {
      const memberId = req.params.memberId?.trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'memberId is required.' });
        return;
      }
      try {
        await removeHwyEmployeePlatformRoles(memberId, normalizeAuthRoles(req));
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Remove failed.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/nomination-candidates',
    requireAuth,
    requireNominationCandidatesAccess,
    async (req: Request, res: Response) => {
      const level = readGeoResponsibilityLevel(readQueryString(req.query, 'level'));
      const geoBaseInfoId = readQueryString(req.query, 'geoBaseInfoId');
      if (!level || !geoBaseInfoId) {
        res.status(400).json({ success: false, message: 'level and geoBaseInfoId are required.' });
        return;
      }
      if (readQueryString(req.query, 'statsOnly') === '1') {
        try {
          const data = await getHwyGeoResponsibilityCenterStats(
            { level, geoBaseInfoId: geoBaseInfoId.trim() },
            normalizeAuthRoles(req),
          );
          res.json({ success: true, data });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not load center stats.';
          const status = message === 'Forbidden.' ? 403 : message.includes('required') || message.includes('resolve') ? 400 : 500;
          res.status(status).json({ success: false, message });
        }
        return;
      }
      const selectionPurposeRaw = readQueryString(req.query, 'selectionPurpose');
      const selectionPurpose = selectionPurposeRaw === 'coursesActivitiesAttendee'
        || selectionPurposeRaw === 'coursesActivitiesTrainer'
        ? selectionPurposeRaw
        : undefined;
      try {
        const nominationTargetLevel = readGeoResponsibilityLevel(
          readQueryString(req.query, 'nominationTargetLevel'),
        );
        const data = await listHwyGeoResponsibilityNominationCandidates(
          {
            level,
            geoBaseInfoId,
            genderFilter: readQueryString(req.query, 'genderFilter')
              ?? readQueryString(req.query, 'genderSlot'),
            nominationTargetGeoBaseInfoId: readQueryString(req.query, 'nominationTargetGeoBaseInfoId'),
            nominationTargetLevel: nominationTargetLevel ?? undefined,
            memberFilters: {
              membershipNumber: readQueryString(req.query, 'membershipNumber'),
              firstName: readQueryString(req.query, 'firstName'),
              fatherName: readQueryString(req.query, 'fatherName'),
              grandfatherName: readQueryString(req.query, 'grandfatherName'),
              familyName: readQueryString(req.query, 'familyName'),
            },
            page: Number(readQueryString(req.query, 'page') || '1'),
            pageSize: Number(readQueryString(req.query, 'pageSize') || '25'),
            selectionPurpose,
          },
          normalizeAuthRoles(req),
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not list nomination candidates.';
        const status = message === 'Forbidden.' ? 403 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/members/lookup',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      const username = readQueryString(req.query, 'username');
      if (!username) {
        res.status(400).json({ success: false, message: 'username is required.' });
        return;
      }
      try {
        const data = await lookupHwyGeoResponsibilityMemberByUsername(username);
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Member lookup failed.';
        const status = message === 'Member not found.' ? 404 : 500;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/geo-responsibility/requests',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const level = readGeoResponsibilityLevel(String(body.level ?? ''));
      const memberId = String(body.memberId ?? '').trim();
      const geoBaseInfoId = String(body.geoBaseInfoId ?? '').trim();
      if (!level || !memberId || !geoBaseInfoId) {
        res.status(400).json({ success: false, message: 'level, memberId, and geoBaseInfoId are required.' });
        return;
      }
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        const data = await submitHwyGeoResponsibilityNomination({
          memberId,
          geoBaseInfoId,
          level,
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
          roleNames: normalizeAuthRoles(req),
        });
        res.status(201).json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not submit nomination.';
        const status = message === 'Forbidden.' ? 403 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/geo-responsibility/requests/:requestId/cancel',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      const requestId = String(req.params.requestId ?? '').trim();
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        await cancelHwyGeoResponsibilityNominationRequest({
          requestId,
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
          roleNames: normalizeAuthRoles(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not cancel nomination.';
        const status = message === 'Forbidden.' ? 403 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/geo-responsibility/pending-nominations/cancel',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const level = readGeoResponsibilityLevel(String(body.level ?? ''));
      const geoBaseInfoId = readBodyString(body, 'geoBaseInfoId');
      const memberId = readBodyString(body, 'memberId');
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      if (!level || !geoBaseInfoId || !memberId) {
        res.status(400).json({ success: false, message: 'Invalid cancel request.' });
        return;
      }
      try {
        await cancelHwyGeoResponsibilityPendingNominationForSlot({
          memberId,
          geoBaseInfoId,
          level,
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
          roleNames: normalizeAuthRoles(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not cancel nomination.';
        const status = message === 'Forbidden.' ? 403 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/geo-responsibility/assignee-pending-removal',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      const level = readGeoResponsibilityLevel(String(req.query.level ?? ''));
      const geoBaseInfoId = String(req.query.geoBaseInfoId ?? '').trim();
      const memberId = String(req.query.memberId ?? '').trim();
      if (!level || !geoBaseInfoId || !memberId) {
        res.status(400).json({ success: false, message: 'Invalid query.' });
        return;
      }
      try {
        const data = await readHwyGeoResponsibilityAssigneePendingRemovalRequestId({
          memberId,
          geoBaseInfoId,
          level,
        });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/geo-responsibility/official-removal-requests',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const level = readGeoResponsibilityLevel(String(body.level ?? ''));
      const geoBaseInfoId = readBodyString(body, 'geoBaseInfoId');
      const memberId = readBodyString(body, 'memberId');
      if (!level || !geoBaseInfoId || !memberId) {
        res.status(400).json({ success: false, message: 'level, geoBaseInfoId, and memberId are required.' });
        return;
      }
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        const data = await submitHwyGeoResponsibilityOfficialRemovalRequest({
          memberId,
          geoBaseInfoId,
          level,
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
          roleNames: normalizeAuthRoles(req),
        });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not submit removal request.';
        const status = message === 'Forbidden.' ? 403 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/geo-responsibility/requests/:requestId/approve',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      const requestId = String(req.params.requestId ?? '').trim();
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        await approveHwyGeoResponsibilityRequest({
          requestId,
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
          roleNames: normalizeAuthRoles(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not approve request.';
        const status = message === 'Forbidden.' ? 403 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/geo-responsibility/requests/:requestId/reject',
    requireAuth,
    requireRole(...geoResponsibilityRoles),
    async (req: Request, res: Response) => {
      const requestId = String(req.params.requestId ?? '').trim();
      const body = req.body as Record<string, unknown>;
      const note = typeof body.note === 'string' ? body.note : null;
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        await rejectHwyGeoResponsibilityRequest({
          requestId,
          note,
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
          roleNames: normalizeAuthRoles(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not reject request.';
        const status = message === 'Forbidden.' ? 403 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/phone-requests/reject-reasons',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      try {
        const data = await listHwyMemberPhoneRejectReasonOptions(cultureOrLang);
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load reject reasons.';
        res.status(500).json({ success: false, message });
      }
    },
  );

  router.get(
    '/phone-requests',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      try {
        const data = await listHwyMemberPhoneAdmin(
          {
            queue: parseHwyMemberPhoneAdminQueue(readQueryString(req.query, 'queue')),
            search: readQueryString(req.query, 'search'),
            page: Number(readQueryString(req.query, 'page') || '1'),
            pageSize: Number(readQueryString(req.query, 'pageSize') || '25'),
          },
          cultureOrLang,
        );
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load phone requests.';
        res.status(500).json({ success: false, message });
      }
    },
  );

  router.post(
    '/phone-requests/:requestId/decision',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const requestId = String(req.params.requestId ?? '').trim();
      const decisionRaw = readBodyString(req.body, 'decision');
      const decision = decisionRaw === 'reject' ? 'reject' : decisionRaw === 'approve' ? 'approve' : null;
      if (!requestId || !decision) {
        res.status(400).json({ success: false, message: 'Request id and decision (approve|reject) are required.' });
        return;
      }
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        await decideHwyMemberPhoneRequest({
          requestId,
          decision,
          finalReasonCode: readBodyString(req.body, 'finalReasonCode') ?? '',
          finalNote: readBodyString(req.body, 'finalNote') ?? '',
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
          viewer: await resolveHwyMemberPhoneWorkflowViewer(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save phone request decision.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/phone-requests/pending',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      try {
        const data = await getHwyMemberPhonePendingState(memberId);
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load pending phone requests.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/member-directory/:memberId/phone-requests/history',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const cultureOrLang = readQueryString(req.query, 'lang') || readQueryString(req.query, 'culture');
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      try {
        const data = await listHwyMemberPhoneHistory(memberId, cultureOrLang);
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load phone request history.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/member-directory/:memberId/phone-requests/change',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const slotRaw = Number(readBodyString(req.body, 'phoneSlot'));
      const phoneSlot = slotRaw === 2 ? 2 : slotRaw === 1 ? 1 : null;
      if (!memberId || !phoneSlot) {
        res.status(400).json({ success: false, message: 'Member id and phoneSlot (1|2) are required.' });
        return;
      }
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        const data = await createHwyMemberPhoneChangeRequest({
          memberIdRaw: memberId,
          phoneSlot: phoneSlot as HwyMemberPhoneSlot,
          newPhone: readBodyString(req.body, 'newPhone') ?? '',
          requestNote: readBodyString(req.body, 'requestNote') ?? '',
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
          viewer: await resolveHwyMemberPhoneWorkflowViewer(req),
        });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not submit phone change request.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/member-directory/:memberId/phone-requests/swap',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
      try {
        const data = await createHwyMemberPhoneSwapRequest({
          memberIdRaw: memberId,
          requestNote: readBodyString(req.body, 'requestNote') ?? '',
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
          viewer: await resolveHwyMemberPhoneWorkflowViewer(req),
        });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not submit phone swap request.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  const parseHwyMemberListScopedEditPatchBody = (body: unknown): HwyMemberListScopedEditPatchBody => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('Request body is invalid.');
    }
    const record = body as Record<string, unknown>;
    const kind = String(record.kind ?? '').trim();
    if (kind === 'gov_employment') {
      return {
        kind: 'gov_employment',
        jobTypeCode: readBodyString(record, 'jobTypeCode'),
        jobPlace: readBodyString(record, 'jobPlace'),
      };
    }
    if (kind === 'mehani_professional') {
      return {
        kind: 'mehani_professional',
        mehaniUnionCode: readBodyString(record, 'mehaniUnionCode'),
        mehaniUnionDegreeCode: readBodyString(record, 'mehaniUnionDegreeCode'),
        mehaniMembershipExpiresOn: readBodyString(record, 'mehaniMembershipExpiresOn'),
        jobTypeCode: readBodyString(record, 'jobTypeCode'),
        jobPlace: readBodyString(record, 'jobPlace'),
      };
    }
    if (kind === 'institute_character') {
      return {
        kind: 'institute_character',
        characterCode: readBodyString(record, 'characterCode'),
      };
    }
    throw new Error('Edit kind is invalid.');
  };

  router.get(
    '/member-directory/:memberId/list-scoped-edit',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const listScope = readQueryString(req.query, 'listScope');
      if (!memberId || !listScope) {
        res.status(400).json({ success: false, message: 'Member id and listScope are required.' });
        return;
      }
      const queryLang = readQueryString(req.query, 'lang')
        || readQueryString(req.query, 'cultureId')
        || 'iq';
      try {
        const data = await loadHwyMemberListScopedEditFields({
          memberIdRaw: memberId,
          listScopeLegacy: listScope,
          queryLang,
        });
        res.json({ success: true, ...data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load list edit fields.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.patch(
    '/member-directory/:memberId/list-scoped-edit',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const listScope = readQueryString(req.query, 'listScope');
      if (!memberId || !listScope) {
        res.status(400).json({ success: false, message: 'Member id and listScope are required.' });
        return;
      }
      try {
        const body = parseHwyMemberListScopedEditPatchBody(req.body);
        const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
        const session = await resolveHwyMemberDirectoryIdentitySession(req);
        await patchHwyMemberListScopedEditFields({
          memberIdRaw: memberId,
          listScopeLegacy: listScope,
          body,
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
          session,
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save list edit fields.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.patch(
    '/member-directory/:memberId',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }

      const body = req.body;
      const patch: HwyMemberDirectoryPatchInput = parseHwyMemberDirectoryPatchFromRequestBody(body);

      try {
        const actorUserId = req.auth?.userId != null ? Number(req.auth.userId) : null;
        const session = await resolveHwyMemberDirectoryIdentitySession(req);
        await patchHwyMemberDirectoryMember(memberId, patch, {
          actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
          session,
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not update member.';
        const status = message === 'Forbidden.'
          ? 403
          : message.includes('not found')
            ? 404
            : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  app.use('/api/hwy', router);

};


