import type { Request, Response, Router } from 'express';

import {
  parseHwyMembershipDecisionKind,
  parseHwyMembershipStage,
} from '../../domain/hwy/hwyMembershipDecisionParse';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import {
  applyHwyMembershipCallCenterDecision,
  applyHwyMembershipLocalDecision,
  listHwyMembershipDecisionReasonOptions,
} from '../domain/hwy/hwyMembershipDecision.service';
import { lookupHwyMembershipReferrerByCode } from '../domain/hwy/hwyMembershipReferrerLookup.service';
import {
  changeHwyMemberNakhebinRoghe,
  clearHwyMemberNakhebinLink,
  linkHwyMemberNakhebinBallot,
  linkHwyMemberNakhebinEghtera,
  linkHwyMemberNakhebinFamily,
  linkHwyMemberNakhebinWithProblem,
  setHwyMemberAddrEghtera,
} from '../domain/hwy/hwyMemberNakhebinWrite.service';
import {
  clearHwyMemberInstituteEmployment,
  linkHwyMemberKasb,
  unlinkHwyMemberKasb,
  removeHwyTarghinDirect,
  respondHwyMemberInstituteInvite,
  resendHwyMemberRegistrationSms,
  syncHwyMemberRegistrationFileApproveFlags,
} from '../domain/hwy/hwyMemberDomainWriteExtras.service';
import { resolveHwyMemberDirectoryDetailLang } from '../../domain/hwy/hwyMemberDirectoryDetail';
import { loadHwyMembershipStatusIdMapForClient } from '../domain/hwy/hwyMemberMembershipStatusIds.service';
import { resolveHwyMemberKasbLinkAllowRoles } from '../domain/hwy/hwyMemberKasbAccess.service';
import { viewerCanManageHwyMemberKasbLinks } from '../../domain/hwy/hwyMemberKasbLegacyAccess';
import { requireHwyMemberKasbLinkAccess } from '../middleware/hwyMemberKasbAccess.middleware';
import { normalizeAuthRoles } from '../middleware/auth.middleware';
import {
  parseHwySelfRegistrationSubmitAttachments,
  runHwySelfRegistrationSubmitUpload,
} from './hwySelfRegistrationSubmitUpload.middleware';
import { submitHwyStaffMemberCreate } from '../domain/hwy/staffMemberCreate.service';
import { assignHwyMemberInstituteByAdmin } from '../domain/hwy/hwyMemberInstituteAdminAssign.service';

const readBodyString = (body: unknown, key: string): string => (
  typeof body === 'object' && body !== null && key in body
    ? String((body as Record<string, unknown>)[key] ?? '').trim()
    : ''
);

const readQueryString = (query: Request['query'], key: string): string => {
  const raw = query[key];
  if (Array.isArray(raw)) {
    return String(raw[0] ?? '').trim();
  }
  return String(raw ?? '').trim();
};

const actorUserId = (req: Request): number | null => {
  const raw = req.auth?.userId;
  const parsed = raw != null ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export const registerHwyMembershipPipelineRoutes = (router: Router): void => {
  router.get(
    '/membership/status-ids',
    requireAuth,
    requireRole('ADMIN'),
    async (_req: Request, res: Response) => {
      try {
        const data = await loadHwyMembershipStatusIdMapForClient();
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load membership statuses.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/membership/staff-create',
    requireAuth,
    requireRole('ADMIN'),
    runHwySelfRegistrationSubmitUpload,
    async (req: Request, res: Response) => {
      try {
        const result = await submitHwyStaffMemberCreate({
          actorUserId: actorUserId(req),
          body: {
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
            adminInstituteCode: readBodyString(req.body, 'adminInstituteCode') || null,
            attachments: parseHwySelfRegistrationSubmitAttachments(req),
          },
        });
        res.status(201).json({ success: true, data: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Staff member create failed.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/member-institutes/:memberId/admin-assign',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const instituteCode = readBodyString(req.body, 'instituteCode');
      if (!memberId || !instituteCode) {
        res.status(400).json({ success: false, message: 'Member id and instituteCode are required.' });
        return;
      }
      try {
        const data = await assignHwyMemberInstituteByAdmin({
          memberIdRaw: memberId,
          instituteCode,
          actorUserId: actorUserId(req),
        });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not assign institute.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/membership/referrer-lookup',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const code = readQueryString(req.query, 'code');
      if (!code) {
        res.status(400).json({ success: false, message: 'code is required.' });
        return;
      }
      try {
        const data = await lookupHwyMembershipReferrerByCode(code);
        if (!data) {
          res.status(404).json({ success: false, message: 'Referrer member not found.' });
          return;
        }
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not look up referrer.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/membership/decision-reasons',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      try {
        const stage = parseHwyMembershipStage(String(req.query.stage ?? ''));
        const decision = parseHwyMembershipDecisionKind(String(req.query.decision ?? ''));
        const cultureId = resolveHwyMemberDirectoryDetailLang(String(req.query.lang ?? ''));
        const data = await listHwyMembershipDecisionReasonOptions({ stage, decision, cultureId });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load decision reasons.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/membership/:memberId/resend-registration-sms',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId || !/^\d+$/.test(memberId)) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      try {
        const data = await resendHwyMemberRegistrationSms({
          memberIdRaw: memberId,
          actorUserId: actorUserId(req),
          actorLabel: req.auth?.email ?? null,
        });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not build registration SMS.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/membership/call-center/:memberId/decision',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const action = readBodyString(req.body, 'action');
      if (!memberId || !action) {
        res.status(400).json({ success: false, message: 'Member id and action are required.' });
        return;
      }
      try {
        const data = await applyHwyMembershipCallCenterDecision({
          memberIdRaw: memberId,
          action: action as 'approve' | 'reject' | 'unreject',
          decisionReasonCode: readBodyString(req.body, 'decisionReasonCode') || null,
          decisionNote: readBodyString(req.body, 'decisionNote'),
          clearReferrer: (() => {
            if (typeof req.body !== 'object' || req.body === null || !('clearReferrer' in req.body)) {
              return undefined;
            }
            const raw = (req.body as Record<string, unknown>).clearReferrer;
            if (raw === true || raw === 1 || raw === '1') {
              return true;
            }
            if (raw === false || raw === 0 || raw === '0') {
              return false;
            }
            return undefined;
          })(),
          replaceReferrerUsername: readBodyString(req.body, 'replaceReferrerUsername') || null,
          replaceReferrerRelationId: (() => {
            const relationRaw = readBodyString(req.body, 'replaceReferrerRelationId');
            if (!relationRaw || !/^\d+$/.test(relationRaw)) {
              return null;
            }
            return Number(relationRaw);
          })(),
          actorUserId: actorUserId(req),
        });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save decision.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.post(
    '/membership/local/:memberId/decision',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const action = readBodyString(req.body, 'action');
      if (!memberId || !action) {
        res.status(400).json({ success: false, message: 'Member id and action are required.' });
        return;
      }
      try {
        const data = await applyHwyMembershipLocalDecision({
          memberIdRaw: memberId,
          action: action as
            | 'approve'
            | 'reject_final'
            | 'reject_returnable'
            | 'reject_verification_bank'
            | 'unreject',
          decisionReasonCode: readBodyString(req.body, 'decisionReasonCode') || null,
          decisionNote: readBodyString(req.body, 'decisionNote'),
          tosighConfirmCodeRaw: readBodyString(req.body, 'tosighConfirmCode') || null,
          actorUserId: actorUserId(req),
        });
        res.json({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save decision.';
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  const nakhebinLinkHandler = (
    linkFn: (input: {
      memberIdRaw: string;
      nakhebinIdRaw: string;
      familyCode?: string | null;
      nakhebinLinkRegionId?: string | null;
      actorUserId: number | null;
    }) => Promise<void>,
  ) => async (req: Request, res: Response) => {
    const memberId = String(req.params.memberId ?? '').trim();
    const nakhebinId = readBodyString(req.body, 'nakhebinId');
    if (!memberId || !nakhebinId) {
      res.status(400).json({ success: false, message: 'Member id and nakhebin id are required.' });
      return;
    }
    try {
      await linkFn({
        memberIdRaw: memberId,
        nakhebinIdRaw: nakhebinId,
        familyCode: readBodyString(req.body, 'familyCode') || null,
        nakhebinLinkRegionId: readBodyString(req.body, 'nakhebinLinkRegionId') || null,
        actorUserId: actorUserId(req),
      });
      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update nakhebin link.';
      res.status(400).json({ success: false, message });
    }
  };

  router.post(
    '/member-nakhebin/:memberId/link',
    requireAuth,
    requireRole('ADMIN'),
    nakhebinLinkHandler(linkHwyMemberNakhebinBallot),
  );
  router.post(
    '/member-nakhebin/:memberId/link-family',
    requireAuth,
    requireRole('ADMIN'),
    nakhebinLinkHandler(linkHwyMemberNakhebinFamily),
  );
  router.post(
    '/member-nakhebin/:memberId/link-eghtera',
    requireAuth,
    requireRole('ADMIN'),
    nakhebinLinkHandler(linkHwyMemberNakhebinEghtera),
  );
  router.post(
    '/member-nakhebin/:memberId/link-with-problem',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const nakhebinId = readBodyString(req.body, 'nakhebinId');
      const linkTypeShort = readBodyString(req.body, 'linkTypeShort') as 'family' | 'electoral_center' | 'eghtera';
      const reasonId = readBodyString(req.body, 'nakhebinLinkProblemReasonId');
      if (!memberId || !nakhebinId || !linkTypeShort || !reasonId) {
        res.status(400).json({
          success: false,
          message: 'Member id, nakhebin id, link type, and problem reason are required.',
        });
        return;
      }
      try {
        await linkHwyMemberNakhebinWithProblem({
          memberIdRaw: memberId,
          nakhebinIdRaw: nakhebinId,
          linkTypeShort,
          nakhebinLinkProblemReasonId: reasonId,
          nakhebinLinkProblemNote: readBodyString(req.body, 'nakhebinLinkProblemNote') || null,
          nakhebinLinkRegionId: readBodyString(req.body, 'nakhebinLinkRegionId') || null,
          actorUserId: actorUserId(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save nakhebin link.';
        res.status(400).json({ success: false, message });
      }
    },
  );
  router.delete(
    '/member-nakhebin/:memberId/link',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      try {
        await clearHwyMemberNakhebinLink({ memberIdRaw: memberId, actorUserId: actorUserId(req) });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not clear nakhebin link.';
        res.status(400).json({ success: false, message });
      }
    },
  );
  router.post(
    '/member-nakhebin/:memberId/change-roghe',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const regionId = readBodyString(req.body, 'nakhebinLinkRegionId');
      if (!memberId || !regionId) {
        res.status(400).json({ success: false, message: 'Member id and region id are required.' });
        return;
      }
      try {
        await changeHwyMemberNakhebinRoghe({
          memberIdRaw: memberId,
          nakhebinLinkRegionId: regionId,
          actorUserId: actorUserId(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not update nakhebin region.';
        res.status(400).json({ success: false, message });
      }
    },
  );
  router.post(
    '/member-nakhebin/:memberId/set-addr-eghtera',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      try {
        await setHwyMemberAddrEghtera({
          memberIdRaw: memberId,
          addrRegionId: readBodyString(req.body, 'addrRegionId') || null,
          addrCircleId: readBodyString(req.body, 'addrCircleId') || null,
          addrMaktabId: readBodyString(req.body, 'addrMaktabId') || null,
          actorUserId: actorUserId(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not update address.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/targhin-members/:memberId/remove-direct',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      try {
        await removeHwyTarghinDirect({
          memberIdRaw: memberId,
          decisionReasonCode: readBodyString(req.body, 'decisionReasonCode'),
          decisionNote: readBodyString(req.body, 'decisionNote'),
          restoreMembershipStatusCode: readBodyString(req.body, 'restoreMembershipStatusCode') || null,
          actorUserId: actorUserId(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not remove targhin.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/member-institutes/:memberId/:instituteId/respond-invite',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const instituteId = Number(req.params.instituteId);
      const accept = readBodyString(req.body, 'accept') === 'true' || req.body?.accept === true;
      if (!memberId || !Number.isFinite(instituteId)) {
        res.status(400).json({ success: false, message: 'Member and institute are required.' });
        return;
      }
      try {
        await respondHwyMemberInstituteInvite({
          memberIdRaw: memberId,
          instituteId,
          accept,
          actorUserId: actorUserId(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not respond to invite.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/member-institutes/:memberId/:instituteId/clear-employment',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const instituteId = Number(req.params.instituteId);
      if (!memberId || !Number.isFinite(instituteId)) {
        res.status(400).json({ success: false, message: 'Member and institute are required.' });
        return;
      }
      try {
        await clearHwyMemberInstituteEmployment({
          memberIdRaw: memberId,
          instituteId,
          actorUserId: actorUserId(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not clear employment.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/members/:memberId/registration-files/sync-approve-flags',
    requireAuth,
    requireRole('ADMIN'),
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      if (!memberId || !/^\d+$/.test(memberId)) {
        res.status(400).json({ success: false, message: 'Member id is required.' });
        return;
      }
      const readFlag = (key: string): boolean | null | undefined => {
        if (typeof req.body !== 'object' || req.body === null || !(key in req.body)) {
          return undefined;
        }
        const raw = (req.body as Record<string, unknown>)[key];
        if (raw === null) {
          return null;
        }
        if (raw === true || raw === false) {
          return raw;
        }
        if (raw === 'true') {
          return true;
        }
        if (raw === 'false') {
          return false;
        }
        return undefined;
      };
      try {
        const readOptionalBoolean = (key: string): boolean | undefined => {
          const value = readFlag(key);
          return value === null || value === undefined ? undefined : value;
        };
        const readOptionalString = (key: string): string | null | undefined => {
          if (typeof req.body !== 'object' || req.body === null || !(key in req.body)) {
            return undefined;
          }
          const raw = (req.body as Record<string, unknown>)[key];
          if (raw === null) {
            return null;
          }
          if (typeof raw === 'string') {
            return raw.trim();
          }
          return undefined;
        };
        await syncHwyMemberRegistrationFileApproveFlags({
          memberId: Number(memberId),
          flags: {
            personalPhoto: readFlag('personalPhoto'),
            nationalCardFront: readFlag('nationalCardFront'),
            nationalCardBack: readFlag('nationalCardBack'),
            voterCardFront: readFlag('voterCardFront'),
            residenceCardFront: readFlag('residenceCardFront'),
            oathDocument: readFlag('oathDocument'),
          },
          imageFixEditor: (
            readOptionalBoolean('nakhebCardFrontCheck') !== undefined
            || readOptionalString('voterCardFrontTypeShortName') !== undefined
          ) ? {
            nakhebCardFrontCheck: readOptionalBoolean('nakhebCardFrontCheck'),
            voterCardFrontTypeShortName: readOptionalString('voterCardFrontTypeShortName'),
          } : undefined,
          actorUserId: actorUserId(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not sync registration approve flags.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.get(
    '/membership/kasb-link-access',
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const allowedRoles = await resolveHwyMemberKasbLinkAllowRoles();
        const allowed = viewerCanManageHwyMemberKasbLinks(normalizeAuthRoles(req), allowedRoles);
        res.json({ success: true, data: { allowed } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not resolve kasb link access.';
        res.status(400).json({ success: false, message });
      }
    },
  );

  router.post(
    '/members/:memberId/kasb-link',
    requireAuth,
    requireHwyMemberKasbLinkAccess,
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const kasbMemberId = readBodyString(req.body, 'kasbMemberId');
      const relationRaw = readBodyString(req.body, 'referrerRelationId');
      const referrerRelationId = relationRaw && /^\d+$/.test(relationRaw) ? Number(relationRaw) : null;
      if (!memberId || !kasbMemberId) {
        res.status(400).json({ success: false, message: 'Member id and kasb member id are required.' });
        return;
      }
      try {
        await linkHwyMemberKasb({
          memberIdRaw: memberId,
          kasbMemberIdRaw: kasbMemberId,
          referrerRelationId,
          actorUserId: actorUserId(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not link kasb.';
        const status = message === 'Forbidden.' ? 403 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );

  router.delete(
    '/members/:memberId/kasb-link/:kasbMemberId',
    requireAuth,
    requireHwyMemberKasbLinkAccess,
    async (req: Request, res: Response) => {
      const memberId = String(req.params.memberId ?? '').trim();
      const kasbMemberId = String(req.params.kasbMemberId ?? '').trim();
      if (!memberId || !kasbMemberId) {
        res.status(400).json({ success: false, message: 'Member id and kasb member id are required.' });
        return;
      }
      try {
        await unlinkHwyMemberKasb({
          memberIdRaw: memberId,
          kasbMemberIdRaw: kasbMemberId,
          actorUserId: actorUserId(req),
        });
        res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not remove kasb link.';
        const status = message === 'Forbidden.' ? 403 : 400;
        res.status(status).json({ success: false, message });
      }
    },
  );
};
