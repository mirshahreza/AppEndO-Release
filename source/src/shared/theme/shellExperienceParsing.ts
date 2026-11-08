import {
  portalAppearanceDefaultsBlobSchema,
  portalShellAppearanceDefaultsSchema,
  userShellExperienceSchema,
  type PortalAppearanceDefaultsBlob,
  type PortalShellAppearanceDefaults,
  type UserShellExperience,
} from '../api/contracts/appearance/shellExperience.schema';
import { EMPTY_USER_SHELL_EXPERIENCE, mergePortalShellAppearanceDefaults } from './shellExperienceDefaults';

import { SHELL_EXPERIENCE_BUILTIN_CONTEXT_KEY } from '../api/contracts/attributes/builtInAttributes';

export const SHELL_EXPERIENCE_CONTEXT_KEY = SHELL_EXPERIENCE_BUILTIN_CONTEXT_KEY;

export const parseUserShellExperience = (raw: unknown): UserShellExperience | null => {
  const parsed = userShellExperienceSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
};

export const parsePortalShellAppearanceDefaults = (raw: unknown): PortalShellAppearanceDefaults => {
  const parsed = portalShellAppearanceDefaultsSchema.safeParse(raw);
  return parsed.success ? mergePortalShellAppearanceDefaults(parsed.data) : mergePortalShellAppearanceDefaults();
};

export const parsePortalAppearanceDefaultsBlob = (raw: unknown): PortalAppearanceDefaultsBlob => {
  const parsed = portalAppearanceDefaultsBlobSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  return { version: 1, mounts: {} };
};

export const userShellExperienceFromClientContext = (
  clientContext: Record<string, unknown>,
): UserShellExperience | null => parseUserShellExperience(clientContext[SHELL_EXPERIENCE_CONTEXT_KEY]);

export const normalizeUserShellExperiencePatch = (
  current: UserShellExperience | null,
  patch: Partial<UserShellExperience>,
): UserShellExperience => ({
  ...(current ?? EMPTY_USER_SHELL_EXPERIENCE),
  ...patch,
  version: 1,
});
