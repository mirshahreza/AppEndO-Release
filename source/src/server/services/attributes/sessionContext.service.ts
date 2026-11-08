import { getUserRolesForRequest } from '../../domain/users/userRoleRepository';
import {
  getUserProfileContextRow,
  listUserAttributeRows,
  type SettingsAttributeWithValueRow,
  type UserProfileContextRow,
} from '../../domain/attributes/valueRepository';
import {
  listActiveProfileFieldSettingRows,
  type ProfileFieldSettingRow,
} from '../../domain/profile/profileFieldSettingsRepository';
import type { AttributeVisibility } from '../../../shared/api/contracts/attributes/types';
import {
  SESSION_CONTEXT_IDENTITY_META_KEYS,
  SESSION_CONTEXT_SHELL_IDENTITY_REVISION,
  SESSION_CONTEXT_SHELL_IDENTITY_REVISION_KEY,
  SESSION_CONTEXT_SYSTEM_ACCOUNT_FIELDS,
  SESSION_CONTEXT_SYSTEM_PROFILE_FIELD_SET,
  SESSION_CONTEXT_SYSTEM_PROFILE_FIELDS,
  USER_ACCOUNT_CONTEXT_FIELDS,
  clientContextHasShellIdentity,
  type SessionContextBlob,
} from '../../../shared/api/contracts/settings/sessionContext';
import { scopeContextKey } from '../../../shared/api/contracts/record-policy';
import { getSessionContextBlob } from '../../domain/settings/sessionContextSettingsRepository';
import { fromUserId, prisma, toUserId } from '../../domain/users/prismaHelpers';
import { getRoleAttributeRows } from './roleAttributesCache';
import { parseStoredAttributeValue } from './valueValidation';
import {
  getCachedSessionContext,
  setCachedSessionContext,
  type CachedSessionContext,
} from './sessionContextCache';
import type { AllowedProfileField } from './profileFields';
import {
  resolveScopeDimensionSnapshots,
  type ScopeDimensionSnapshot,
} from '../record-policy/resolveScopeMemberships';
import { serverContextHasRecordScopeKeys } from '../record-policy/sessionScope.service';

export type MergedContextEntry = {
  value: unknown;
  visibility: AttributeVisibility;
};

export type SessionContextSlices = {
  serverContext: Record<string, unknown>;
  clientContext: Record<string, unknown>;
};

export type UserAccountContextRow = {
  id: number;
  username: string;
  email: string | null;
  mobile: string | null;
};

const hasResolvedValue = (value: unknown): value is NonNullable<unknown> =>
  value !== null && value !== undefined;

export const splitContextByVisibility = (
  merged: Record<string, MergedContextEntry>,
): SessionContextSlices => {
  const serverContext: Record<string, unknown> = {};
  const clientContext: Record<string, unknown> = {};

  for (const [contextKey, entry] of Object.entries(merged)) {
    if (entry.visibility === 'SERVER' || entry.visibility === 'BOTH') {
      serverContext[contextKey] = entry.value;
    }
    if (entry.visibility === 'CLIENT' || entry.visibility === 'BOTH') {
      clientContext[contextKey] = entry.value;
    }
  }

  return { serverContext, clientContext };
};

export const mergeSessionContextEntries = (
  userRows: SettingsAttributeWithValueRow[],
  roleRows: SettingsAttributeWithValueRow[],
): Record<string, MergedContextEntry> => {
  const merged: Record<string, MergedContextEntry> = {};
  const roleValueByKey = new Map<string, { value: unknown; visibility: AttributeVisibility }>();

  for (const row of roleRows) {
    const value = parseStoredAttributeValue(row.value_text);
    if (!hasResolvedValue(value)) continue;

    roleValueByKey.set(row.key, { value, visibility: row.visibility });
    merged[`role.${row.key}`] = { value, visibility: row.visibility };
  }

  for (const row of userRows) {
    const userValue = parseStoredAttributeValue(row.value_text);
    const value = hasResolvedValue(userValue)
      ? userValue
      : roleValueByKey.get(row.key)?.value ?? null;

    if (!hasResolvedValue(value)) continue;

    merged[`user.${row.key}`] = { value, visibility: row.visibility };
  }

  return merged;
};

export type UserIdentityProfileRow = {
  firstname: string | null;
  lastname: string | null;
  company_name: string | null;
  person_type_code: string | null;
  profile_image: boolean;
  has_profile_image_xs: boolean;
  profile_updated_at: string | null;
};

export const mergeProfileContextEntries = (
  profileFieldSettings: ProfileFieldSettingRow[],
  profile: UserProfileContextRow | null,
): Record<string, MergedContextEntry> => {
  const merged: Record<string, MergedContextEntry> = {};
  if (!profile) {
    return merged;
  }

  for (const setting of profileFieldSettings) {
    if (setting.visibility === 'NONE') continue;
    if (SESSION_CONTEXT_SYSTEM_PROFILE_FIELD_SET.has(setting.profile_field)) continue;
    const field = setting.profile_field as AllowedProfileField;
    const value = profile[field];
    if (!hasResolvedValue(value)) continue;

    merged[`user.${setting.context_key}`] = {
      value,
      visibility: setting.visibility,
    };
  }

  return merged;
};

export const mergeSystemContextEntries = (
  roles: string[],
): Record<string, MergedContextEntry> => ({
  [SESSION_CONTEXT_SHELL_IDENTITY_REVISION_KEY]: {
    value: SESSION_CONTEXT_SHELL_IDENTITY_REVISION,
    visibility: 'BOTH',
  },
  'sys.roles': {
    value: roles,
    visibility: 'BOTH',
  },
  'sys.functionAccess': {
    value: true,
    visibility: 'BOTH',
  },
});

/** Built-in org/geo membership id sets — server-only for Record Policy. */
export const mergeRecordScopeContextEntries = (
  scope: Record<string, ScopeDimensionSnapshot>,
): Record<string, MergedContextEntry> => {
  const merged: Record<string, MergedContextEntry> = {};
  for (const [dimensionKey, entry] of Object.entries(scope)) {
    merged[scopeContextKey(dimensionKey)] = {
      value: entry.ids,
      visibility: 'SERVER',
    };
  }
  return merged;
};

const channelsToVisibility = (server: boolean, client: boolean): AttributeVisibility => {
  if (server && client) return 'BOTH';
  if (server) return 'SERVER';
  return 'CLIENT';
};

/** Shell identity — always in context; clients must not use a parallel /api/profile display path. */
export const mergeIdentityContextEntries = (
  account: UserAccountContextRow | null,
  identity: UserIdentityProfileRow | null,
): Record<string, MergedContextEntry> => {
  const merged: Record<string, MergedContextEntry> = {};

  if (account) {
    for (const field of SESSION_CONTEXT_SYSTEM_ACCOUNT_FIELDS) {
      const value = field.field === 'id' ? account.id : account[field.field];
      merged[field.contextKey] = {
        value: value ?? null,
        visibility: channelsToVisibility(field.server, field.client),
      };
    }
  }

  if (identity) {
    for (const field of SESSION_CONTEXT_SYSTEM_PROFILE_FIELDS) {
      if (field.profileField === 'profile_image') {
        merged[field.contextKey] = {
          value: identity.profile_image,
          visibility: channelsToVisibility(field.server, field.client),
        };
        merged[SESSION_CONTEXT_IDENTITY_META_KEYS.hasProfileImageXs] = {
          value: identity.has_profile_image_xs,
          visibility: 'BOTH',
        };
        merged[SESSION_CONTEXT_IDENTITY_META_KEYS.profileUpdatedAt] = {
          value: identity.profile_updated_at,
          visibility: 'BOTH',
        };
        continue;
      }

      const value = (() => {
        switch (field.profileField) {
          case 'firstname':
            return identity.firstname;
          case 'lastname':
            return identity.lastname;
          case 'company_name':
            return identity.company_name;
          case 'person_type_code':
            return identity.person_type_code;
          default:
            return null;
        }
      })();
      merged[field.contextKey] = {
        value: value ?? null,
        visibility: channelsToVisibility(field.server, field.client),
      };
    }
  }

  return merged;
};

export const mergeUserAccountContextEntries = (
  account: UserAccountContextRow | null,
  blob: SessionContextBlob,
): Record<string, MergedContextEntry> => {
  const merged: Record<string, MergedContextEntry> = {};
  if (!account) return merged;

  for (const field of USER_ACCOUNT_CONTEXT_FIELDS) {
    // System account identity is owned by mergeIdentityContextEntries.
    if (field.field === 'id' || field.field === 'username' || field.field === 'email') {
      continue;
    }
    const channels = blob.userAccount[field.field];
    if (!channels || (!channels.server && !channels.client)) continue;

    const value = account[field.field];
    if (!hasResolvedValue(value)) continue;

    merged[field.contextKey] = {
      value,
      visibility: channelsToVisibility(channels.server, channels.client),
    };
  }

  return merged;
};

export const combineMergedContextEntries = (
  ...parts: Array<Record<string, MergedContextEntry>>
): Record<string, MergedContextEntry> => Object.assign({}, ...parts);

/** Oldest role assignment (first in list) wins when multiple roles share the same key. */
export const flattenMultiRoleRows = (
  roleRowsByPriority: SettingsAttributeWithValueRow[][],
): SettingsAttributeWithValueRow[] => {
  const seenKeys = new Set<string>();
  const effective: SettingsAttributeWithValueRow[] = [];

  for (const roleRows of roleRowsByPriority) {
    for (const row of roleRows) {
      if (seenKeys.has(row.key)) continue;

      const value = parseStoredAttributeValue(row.value_text);
      if (!hasResolvedValue(value)) continue;

      seenKeys.add(row.key);
      effective.push(row);
    }
  }

  return effective;
};

export const loadRoleRowsForRoles = async (
  roles: string[],
): Promise<SettingsAttributeWithValueRow[][]> =>
  Promise.all(roles.map((roleName) => getRoleAttributeRows(roleName)));

export async function getUserAccountContextRow(userId: number): Promise<UserAccountContextRow | null> {
  const row = await prisma().baseUser.findUnique({
    where: { id: toUserId(userId) },
    select: {
      id: true,
      username: true,
      email: true,
      mobile: true,
    },
  });
  if (!row) return null;
  return {
    id: fromUserId(row.id),
    username: row.username,
    email: row.email,
    mobile: row.mobile,
  };
}

export async function getUserIdentityProfileRow(userId: number): Promise<UserIdentityProfileRow | null> {
  const row = await prisma().baseUserProfile.findUnique({
    where: { userId: toUserId(userId) },
    select: {
      firstname: true,
      lastname: true,
      companyName: true,
      personTypeCode: true,
      profileImageMime: true,
      profileImageSize: true,
      updatedAt: true,
    },
  });
  if (!row) {
    return {
      firstname: null,
      lastname: null,
      company_name: null,
      person_type_code: null,
      profile_image: false,
      has_profile_image_xs: false,
      profile_updated_at: null,
    };
  }

  let hasImage = (row.profileImageSize ?? 0) > 0 || Boolean(row.profileImageMime?.trim());
  if (!hasImage) {
    // Some legacy rows store bytes without mime/size — detect without loading blobs.
    const presence = await prisma().baseUserProfile.findFirst({
      where: {
        userId: toUserId(userId),
        OR: [
          { profileImageBodyXs: { not: null } },
          { profileImageBody: { not: null } },
        ],
      },
      select: { userId: true },
    });
    hasImage = Boolean(presence);
  }

  return {
    firstname: row.firstname,
    lastname: row.lastname,
    company_name: row.companyName,
    person_type_code: row.personTypeCode,
    profile_image: hasImage,
    has_profile_image_xs: hasImage,
    profile_updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : null,
  };
}

export const resolveSessionContextSlices = (
  userRows: SettingsAttributeWithValueRow[],
  roleRows: SettingsAttributeWithValueRow[],
  profileFieldSettings: ProfileFieldSettingRow[] = [],
  profile: UserProfileContextRow | null = null,
  roles: string[] = [],
  account: UserAccountContextRow | null = null,
  blob: SessionContextBlob = { version: 1, userAccount: {} },
  identity: UserIdentityProfileRow | null = null,
  recordScope: Record<string, ScopeDimensionSnapshot> = {},
): SessionContextSlices => {
  const merged = combineMergedContextEntries(
    mergeSystemContextEntries(roles),
    mergeRecordScopeContextEntries(recordScope),
    mergeUserAccountContextEntries(account, blob),
    mergeSessionContextEntries(userRows, roleRows),
    mergeProfileContextEntries(profileFieldSettings, profile),
    // Identity last so shell keys cannot be overridden by optional profile toggles.
    mergeIdentityContextEntries(account, identity),
  );
  return splitContextByVisibility(merged);
};

export async function resolveSessionContext(
  userId: number,
  roles: string[],
): Promise<CachedSessionContext> {
  const orderedRoles = roles;
  const [userRows, roleRowsByPriority, profileFieldSettings, profile, account, blob, identity, recordScope] = await Promise.all([
    listUserAttributeRows(userId),
    loadRoleRowsForRoles(orderedRoles),
    listActiveProfileFieldSettingRows(),
    getUserProfileContextRow(userId),
    getUserAccountContextRow(userId),
    getSessionContextBlob(),
    getUserIdentityProfileRow(userId),
    resolveScopeDimensionSnapshots(userId),
  ]);
  const roleRows = flattenMultiRoleRows(roleRowsByPriority);

  return resolveSessionContextSlices(
    userRows,
    roleRows,
    profileFieldSettings,
    profile,
    orderedRoles,
    account,
    blob,
    identity,
    recordScope,
  );
}

export async function resolveAndCacheSessionContext(
  userId: number,
  roles?: string[],
): Promise<CachedSessionContext> {
  const resolvedRoles = roles ?? await getUserRolesForRequest(userId);
  const context = await resolveSessionContext(userId, resolvedRoles);
  await setCachedSessionContext(userId, context);
  return context;
}

export async function getSessionContextForUser(
  userId: number,
  fallbackRole?: string,
  roles?: string[],
): Promise<CachedSessionContext> {
  const cached = await getCachedSessionContext(userId);
  if (
    cached
    && clientContextHasShellIdentity(cached.clientContext)
    && serverContextHasRecordScopeKeys(cached.serverContext)
  ) {
    return cached;
  }

  const resolvedRoles = roles ?? await getUserRolesForRequest(userId, fallbackRole);
  return resolveAndCacheSessionContext(userId, resolvedRoles);
}

export async function previewSessionContext(userId: number): Promise<CachedSessionContext & { roles: string[] }> {
  const roles = await getUserRolesForRequest(userId);
  const context = await resolveSessionContext(userId, roles);
  return { ...context, roles };
}

export async function getAuthContext(
  userId: number,
  fallbackRole?: string,
  includeServer = false,
) {
  const context = await getSessionContextForUser(userId, fallbackRole);

  return {
    body: {
      success: true as const,
      clientContext: context.clientContext,
      ...(includeServer ? { serverContext: context.serverContext } : {}),
    },
  };
}
