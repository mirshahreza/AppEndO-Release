export const BASE_ROLES = ['ADMIN', 'DEVELOPER'] as const;

/** Default role when create/update payloads omit roles. */
export const DEFAULT_ASSIGNABLE_ROLE = 'DEVELOPER';

/** Retired built-in role names — hidden from assignment pickers only; removable from Roles admin. */
export const RETIRED_ROLE_NAMES = ['USER'] as const;

/** Roles that cannot self-delete their account (profile → Delete Account). */
export const NON_SELF_DELETABLE_ROLES = ['ADMIN', 'DEVELOPER'] as const;
