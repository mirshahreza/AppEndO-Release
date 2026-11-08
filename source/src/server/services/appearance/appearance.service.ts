import { BUILTIN_USER_ATTRIBUTE_KEYS } from '../../../shared/api/contracts/attributes/builtInAttributes';
import {
  portalShellAppearanceDefaultsSchema,
  userShellExperienceSchema,
  type PortalShellAppearanceDefaults,
  type UserShellExperience,
} from '../../../shared/api/contracts/appearance/shellExperience.schema';
import {
  DEFAULT_PORTAL_SHELL_APPEARANCE,
  mergePortalShellAppearanceDefaults,
  resolveEffectiveShellExperience,
} from '../../../shared/theme/shellExperienceDefaults';
import {
  normalizeUserShellExperiencePatch,
  parsePortalAppearanceDefaultsBlob,
  parseUserShellExperience,
} from '../../../shared/theme/shellExperienceParsing';
import { findSettingsAttributeByScopeAndKey } from '../../domain/attributes/settingsAttributesRepository';
import {
  listUserAttributeRows,
  upsertUserAttributeValue,
} from '../../domain/attributes/valueRepository';
import {
  getPlatformBlobSection,
  upsertPlatformBlobSection,
} from '../../domain/settings/platformBlobSectionRepository';
import type { ActorContext } from '../../types/requestContext';
import { getUserRolesForRequest } from '../../domain/users/userRoleRepository';
import { invalidateSessionContext } from '../attributes/sessionContextCache';
import { parseStoredAttributeValue, serializeAttributeValue } from '../attributes/valueValidation';
import { actorId } from '../users/shared';

const APPEARANCE_PORTAL_BLOB_KEY = 'appearancePortalDefaults' as const;

const readUserShellExperienceRow = async (userId: number): Promise<UserShellExperience | null> => {
  const rows = await listUserAttributeRows(userId);
  const row = rows.find((entry) => entry.key === BUILTIN_USER_ATTRIBUTE_KEYS.shellExperience);
  if (!row) {
    return null;
  }
  return parseUserShellExperience(parseStoredAttributeValue(row.value_text));
};

export const readPortalShellAppearanceDefaults = async (
  mountId: string,
): Promise<PortalShellAppearanceDefaults> => {
  const trimmed = mountId.trim();
  if (!trimmed) {
    return mergePortalShellAppearanceDefaults();
  }

  const section = await getPlatformBlobSection(APPEARANCE_PORTAL_BLOB_KEY);
  const blob = parsePortalAppearanceDefaultsBlob(section?.value);
  const mountDefaults = blob.mounts[trimmed];
  return mergePortalShellAppearanceDefaults(mountDefaults);
};

export const writePortalShellAppearanceDefaults = async (
  actor: ActorContext,
  mountId: string,
  patch: unknown,
): Promise<PortalShellAppearanceDefaults> => {
  const trimmed = mountId.trim();
  if (!trimmed) {
    throw new Error('mountId is required.');
  }

  const parsedPatch = portalShellAppearanceDefaultsSchema.partial().safeParse(patch);
  if (!parsedPatch.success) {
    throw new Error('Invalid portal appearance defaults.');
  }

  const section = await getPlatformBlobSection(APPEARANCE_PORTAL_BLOB_KEY);
  const blob = parsePortalAppearanceDefaultsBlob(section?.value ?? { version: 1, mounts: {} });
  const current = mergePortalShellAppearanceDefaults(blob.mounts[trimmed]);
  const next = mergePortalShellAppearanceDefaults({ ...current, ...parsedPatch.data });

  await upsertPlatformBlobSection(
    APPEARANCE_PORTAL_BLOB_KEY,
    {
      ...blob,
      version: 1,
      mounts: {
        ...blob.mounts,
        [trimmed]: next,
      },
    },
    actorId(actor),
  );

  return next;
};

export const updateUserShellExperience = async (
  actor: ActorContext,
  userId: number,
  patch: unknown,
): Promise<UserShellExperience> => {
  const parsedPatch = userShellExperienceSchema.partial().safeParse(patch);
  if (!parsedPatch.success) {
    throw new Error('Invalid shell experience.');
  }

  const definition = await findSettingsAttributeByScopeAndKey(
    'USER',
    BUILTIN_USER_ATTRIBUTE_KEYS.shellExperience,
  );
  if (!definition?.id) {
    throw new Error('Shell experience attribute is not configured.');
  }

  const existing = await readUserShellExperienceRow(userId);
  const next = normalizeUserShellExperiencePatch(existing, parsedPatch.data);

  await upsertUserAttributeValue(
    definition.id,
    userId,
    serializeAttributeValue(next),
    actorId(actor),
  );
  await invalidateSessionContext(userId);

  return next;
};

export const buildAppearanceSession = async (
  userId: number,
  mountId: string,
  roles?: string[],
) => {
  const resolvedRoles = roles ?? await getUserRolesForRequest(userId);
  const isAdmin = resolvedRoles.some((role) => role.toUpperCase() === 'ADMIN');
  const portalDefaults = await readPortalShellAppearanceDefaults(mountId);
  const userExperience = await readUserShellExperienceRow(userId);
  const effective = resolveEffectiveShellExperience(portalDefaults, userExperience);

  return {
    success: true as const,
    mountId: mountId.trim() || 'studio',
    portalDefaults,
    userExperience,
    effective,
    isAdmin,
  };
};

export const resetUserShellExperienceToPortalDefaults = async (
  actor: ActorContext,
  userId: number,
): Promise<void> => {
  const definition = await findSettingsAttributeByScopeAndKey(
    'USER',
    BUILTIN_USER_ATTRIBUTE_KEYS.shellExperience,
  );
  if (!definition?.id) {
    return;
  }

  await upsertUserAttributeValue(
    definition.id,
    userId,
    serializeAttributeValue({
      version: 1,
      sidebarCollapsed: null,
      layoutWidth: null,
      navExpandedGroups: null,
    }),
    actorId(actor),
  );
  await invalidateSessionContext(userId);
};

export { DEFAULT_PORTAL_SHELL_APPEARANCE };
