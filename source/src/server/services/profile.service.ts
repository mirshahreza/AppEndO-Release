import { findUserId, findUserIdEmail, updateUserEmail } from '../domain/users/userRepository';
import { upsertUserProfile } from './users/userProfile.service';
import { invalidateSessionContextIfProfileFieldsChanged } from './attributes/profileInvalidation';
import { toOptionalTrimmed } from '../utils/usersHelpers';
import {
  findProfileUserId,
  getUserProfileForApi,
  insertUserProfile,
  updateUserProfile,
} from '../domain/users/userProfileRepository';
import { resolveUserAvatarXsSrc } from '../../shared/api/contracts/users/avatar';
import { HttpError } from '../errors/HttpError';
import type { ActorContext, RequestDbContext } from '../types/requestContext';
import { getClientAttributeSummary } from './attributes/attributeSummary.service';
import {
  getMyEditableAttributes,
  updateMyEditableAttributes,
} from './attributes/userEditableAttributes.service';
import { updateMyGridColumnLayout } from './attributes/gridColumnLayouts.service';
import { getMyDashboardLayout, updateMyDashboardLayout } from './attributes/dashboardLayout.service';
import {
  getMyEditableProfileFields,
  updateMyEditableProfileFields,
} from './profile/editableProfileFields.service';
import { ensureBaseInfoCode } from '../utils/baseInfoValidation';
import {
  BASE_INFO_ROOT_GENDER,
  BASE_INFO_ROOT_PERSON_TYPE,
  normalizeProfilePayload,
} from '../utils/profilePayload';
import { assertPersonTypeCodeUnchanged } from '../utils/profilePersonTypeGuard';
import { USERS_PROFILE_CHANGE_REASON } from '../../shared/api/contracts/record-events';
import {
  emitUserSnapshotDiff,
  loadUserHistorySnapshot,
  stripUserHistoryPayload,
} from '../domain/record-events/userHistory';
import { resolveFunctionChangeReason } from '../domain/record-events/functionChangeReason';

export class ProfileService {
  async getProfile(_ctx: RequestDbContext, actor: ActorContext) {
    const profile = await getUserProfileForApi(actor.userId);

    if (!profile) {
      throw new HttpError(404, 'User not found.');
    }

    return {
      body: {
        success: true as const,
        profile: {
          ...profile,
          avatar_url: resolveUserAvatarXsSrc({
            id: profile.id,
            has_profile_image_xs: profile.has_profile_image_xs,
            profile_image_size: profile.profile_image_size,
            updated_at: profile.updated_at,
          }),
        },
      },
    };
  }

  async updateProfile(_ctx: RequestDbContext, actor: ActorContext, payload: Record<string, unknown>) {
    const historyPayload = payload;
    payload = stripUserHistoryPayload(payload);
    const userId = payload.userId;
    const targetUserId = actor.isAdmin && userId ? Number(userId) : actor.userId;
    const before = await loadUserHistorySnapshot(targetUserId);
    const profile = normalizeProfilePayload(payload);
    await assertPersonTypeCodeUnchanged(targetUserId, profile.personTypeCode);
    await ensureBaseInfoCode(profile.genderCode, BASE_INFO_ROOT_GENDER, 'genderCode');
    await ensureBaseInfoCode(profile.personTypeCode, BASE_INFO_ROOT_PERSON_TYPE, 'personTypeCode');

    const user = await findUserId(targetUserId);
    if (!user) {
      throw new HttpError(404, 'User not found.');
    }

    const existingProfile = await findProfileUserId(targetUserId);
    const actorId = actor.userId;

    if (existingProfile) {
      await updateUserProfile(
        targetUserId,
        profile,
        profile.profileImageBody,
        profile.profileImageBodyXs,
        actorId,
      );
    } else {
      await insertUserProfile(
        targetUserId,
        profile,
        profile.profileImageBody,
        profile.profileImageBodyXs,
        actorId,
      );
    }

    await invalidateSessionContextIfProfileFieldsChanged(targetUserId, payload);

    const after = await loadUserHistorySnapshot(targetUserId);
    if (before && after) {
      const policy = await resolveFunctionChangeReason('PUT', '/api/profile', USERS_PROFILE_CHANGE_REASON);
      await emitUserSnapshotDiff(before, after, historyPayload, policy);
    }

    return { body: { success: true as const } };
  }

  async updateMyAccount(_ctx: RequestDbContext, actor: ActorContext, payload: Record<string, unknown>) {
    const historyPayload = payload;
    payload = stripUserHistoryPayload(payload);
    const targetUserId = actor.userId;
    const before = await loadUserHistorySnapshot(targetUserId);

    const user = await findUserId(targetUserId);
    if (!user) {
      throw new HttpError(404, 'User not found.');
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'email')) {
      const email = toOptionalTrimmed(payload.email);
      if (!email) {
        throw new HttpError(400, 'email is required.');
      }
      const existing = await findUserIdEmail(targetUserId);
      if (!existing) {
        throw new HttpError(404, 'User not found.');
      }
      await updateUserEmail(email, actor.userId, targetUserId);
    }

    const profile = normalizeProfilePayload(payload);
    await assertPersonTypeCodeUnchanged(targetUserId, profile.personTypeCode);
    await ensureBaseInfoCode(profile.genderCode, BASE_INFO_ROOT_GENDER, 'genderCode');
    await ensureBaseInfoCode(profile.personTypeCode, BASE_INFO_ROOT_PERSON_TYPE, 'personTypeCode');

    await upsertUserProfile(targetUserId, profile, actor.userId, { useNullFallbackForImages: true });
    await invalidateSessionContextIfProfileFieldsChanged(targetUserId, payload);

    const after = await loadUserHistorySnapshot(targetUserId);
    if (before && after) {
      const policy = await resolveFunctionChangeReason('PUT', '/api/profile/me', USERS_PROFILE_CHANGE_REASON);
      await emitUserSnapshotDiff(before, after, historyPayload, policy);
    }

    return { body: { success: true as const } };
  }

  async getMyAttributeSummary(_ctx: RequestDbContext, actor: ActorContext) {
    const items = await getClientAttributeSummary(actor.userId);
    return {
      body: {
        success: true as const,
        items,
      },
    };
  }

  async getMyEditableAttributes(_ctx: RequestDbContext, actor: ActorContext) {
    const result = await getMyEditableAttributes(actor.userId);
    return { body: result.body };
  }

  async updateMyEditableAttributes(_ctx: RequestDbContext, actor: ActorContext, payload: unknown) {
    const result = await updateMyEditableAttributes(actor, actor.userId, payload);
    return { body: result.body };
  }

  async updateMyGridColumnLayout(_ctx: RequestDbContext, actor: ActorContext, payload: unknown) {
    const result = await updateMyGridColumnLayout(actor, actor.userId, payload);
    return { body: result.body };
  }

  async updateMyDashboardLayout(_ctx: RequestDbContext, actor: ActorContext, payload: unknown) {
    const result = await updateMyDashboardLayout(actor, actor.userId, payload);
    return { body: result.body };
  }

  async getMyDashboardLayout(_ctx: RequestDbContext, actor: ActorContext) {
    const result = await getMyDashboardLayout(actor.userId);
    return { body: result.body };
  }

  async getMyEditableProfileFields(_ctx: RequestDbContext, actor: ActorContext) {
    const result = await getMyEditableProfileFields(actor.userId);
    return { body: result.body };
  }

  async updateMyEditableProfileFields(_ctx: RequestDbContext, actor: ActorContext, payload: unknown) {
    const result = await updateMyEditableProfileFields(actor, actor.userId, payload);
    return { body: result.body };
  }

  async getLinkedIdentities(_ctx: RequestDbContext, actor: ActorContext) {
    const { getAuthIdentitySettingsFromFile } = await import('../db/identityProvidersStore');
    const { SETTINGS_PATH } = await import('../config/settingsFile');
    const { listLinkedIdentitiesForUser } = await import('../../core/identity/IdentityLinkService');
    const settings = getAuthIdentitySettingsFromFile(SETTINGS_PATH);
    const labels = new Map(settings.identityProviders.map((item) => [item.id, item.label]));
    const identities = await listLinkedIdentitiesForUser(actor.userId, labels);
    return {
      body: {
        success: true as const,
        identities,
      },
    };
  }
}
