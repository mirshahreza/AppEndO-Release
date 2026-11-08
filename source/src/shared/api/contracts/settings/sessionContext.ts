import type { AttributeVisibility } from '../attributes/types';
import {
  PRESET_SCOPE_CONTEXT_KEYS,
  PRESET_SCOPE_DIMENSION_KEYS,
  PRESET_SCOPE_DIMENSION_LABELS,
} from '../record-policy/constants';

export type SessionContextSourceKind =
  | 'system'
  | 'shell_identity'
  | 'record_scope'
  | 'user_account'
  | 'profile_field'
  | 'user_attribute'
  | 'role_attribute';

export type SessionContextSourceEntry = {
  id: string;
  kind: SessionContextSourceKind;
  label: string;
  description?: string;
  contextKey: string;
  server: boolean;
  client: boolean;
  locked: boolean;
  lockedReason?: string;
};

export type SessionContextSourceGroup = {
  id: SessionContextSourceKind;
  title: string;
  description: string;
  entries: SessionContextSourceEntry[];
};

export type SessionContextSettingsResponse = {
  success: true;
  groups: SessionContextSourceGroup[];
};

export type SessionContextSettingsSaveEntry = {
  id: string;
  server: boolean;
  client: boolean;
};

export type UpdateSessionContextSettingsPayload = {
  entries: SessionContextSettingsSaveEntry[];
};

export type SessionContextSettingsSaveResponse = {
  success: true;
  groups: SessionContextSourceGroup[];
};

/** Blob stored in `base_settings_sections.section_key = session-context`. */
export type SessionContextBlob = {
  version: 1;
  userAccount: Record<string, { server: boolean; client: boolean }>;
};

export const SESSION_CONTEXT_SECTION_KEY = 'session-context' as const;

export const SESSION_CONTEXT_SYSTEM_SOURCE_IDS = {
  roles: 'system:roles',
  functionAccess: 'system:function-access',
} as const;

/** Always present in session context — shell identity reads from these keys only. */
export const SESSION_CONTEXT_SYSTEM_ACCOUNT_FIELDS = [
  { field: 'id', label: 'User ID', contextKey: 'user.id', server: true, client: true },
  { field: 'username', label: 'Username', contextKey: 'user.username', server: true, client: true },
  { field: 'email', label: 'Email', contextKey: 'user.email', server: true, client: true },
] as const;

export const SESSION_CONTEXT_SYSTEM_PROFILE_FIELDS = [
  { profileField: 'firstname', label: 'First name', contextKey: 'user.firstname', server: true, client: true },
  { profileField: 'lastname', label: 'Last name', contextKey: 'user.lastname', server: true, client: true },
  { profileField: 'profile_image', label: 'Profile image', contextKey: 'user.profile_image', server: true, client: true },
  { profileField: 'company_name', label: 'Company name', contextKey: 'user.company_name', server: true, client: true },
  { profileField: 'person_type_code', label: 'Person type', contextKey: 'user.person_type_code', server: true, client: true },
] as const;

/** Locked capability rows shown under System (built-in). */
export const buildSystemCapabilitySourceEntries = (): SessionContextSourceEntry[] => [
  {
    id: SESSION_CONTEXT_SYSTEM_SOURCE_IDS.roles,
    kind: 'system',
    label: 'Roles',
    description: 'Assigned role names. Always available in both server and client session context.',
    contextKey: 'sys.roles',
    server: true,
    client: true,
    locked: true,
    lockedReason: 'System built-in',
  },
  {
    id: SESSION_CONTEXT_SYSTEM_SOURCE_IDS.functionAccess,
    kind: 'system',
    label: 'Function access',
    description: 'Server-function and page capability grants. Always enforced for the session (system policy).',
    contextKey: 'sys.functionAccess',
    server: true,
    client: true,
    locked: true,
    lockedReason: 'System built-in',
  },
];

/** Locked record-scope memberships — always on serverContext for Record Policy refs. */
export const buildRecordScopeSourceEntries = (): SessionContextSourceEntry[] => (
  (Object.keys(PRESET_SCOPE_DIMENSION_KEYS) as Array<keyof typeof PRESET_SCOPE_DIMENSION_KEYS>).map((preset) => ({
    id: `system:scope:${preset}`,
    kind: 'record_scope' as const,
    label: PRESET_SCOPE_DIMENSION_LABELS[preset],
    description:
      'Membership node ids for this built-in dimension (user + role assignments). Always on server context for Record Policy.',
    contextKey: PRESET_SCOPE_CONTEXT_KEYS[preset],
    server: true,
    client: false,
    locked: true,
    lockedReason: 'Record scope',
  }))
);

/**
 * Locked shell-identity rows. Header / profile chrome must read these keys from
 * clientContext only — never a parallel /api/profile or Auth user display path.
 */
export const buildShellIdentitySourceEntries = (): SessionContextSourceEntry[] => [
  ...SESSION_CONTEXT_SYSTEM_ACCOUNT_FIELDS.map((field) => ({
    id: `system:account:${field.field}`,
    kind: 'shell_identity' as const,
    label: field.label,
    description: 'Required shell identity. Always present in server and client session context.',
    contextKey: field.contextKey,
    server: field.server,
    client: field.client,
    locked: true,
    lockedReason: 'System identity',
  })),
  ...SESSION_CONTEXT_SYSTEM_PROFILE_FIELDS.map((field) => ({
    id: `system:profile:${field.profileField}`,
    kind: 'shell_identity' as const,
    label: field.label,
    description: 'Required shell identity. Always present in server and client session context.',
    contextKey: field.contextKey,
    server: field.server,
    client: field.client,
    locked: true,
    lockedReason: 'System identity',
  })),
];

export const SESSION_CONTEXT_SYSTEM_PROFILE_FIELD_SET = new Set<string>(
  SESSION_CONTEXT_SYSTEM_PROFILE_FIELDS.map((field) => field.profileField),
);

export const SESSION_CONTEXT_SYSTEM_ACCOUNT_FIELD_SET = new Set<string>(
  SESSION_CONTEXT_SYSTEM_ACCOUNT_FIELDS.map((field) => field.field),
);

/** Extra client-only identity keys derived for avatar URLs (not admin-selectable). */
export const SESSION_CONTEXT_IDENTITY_META_KEYS = {
  hasProfileImageXs: 'user.has_profile_image_xs',
  profileUpdatedAt: 'user.profile_updated_at',
} as const;

/** Bump when shell-identity client keys/semantics change — stale session caches rebuild. */
export const SESSION_CONTEXT_SHELL_IDENTITY_REVISION = 3;

export const SESSION_CONTEXT_SHELL_IDENTITY_REVISION_KEY = 'sys.shellIdentityRev' as const;

/** Client keys the shell requires. Missing any of these means stale context must be rebuilt. */
export const SESSION_CONTEXT_SHELL_IDENTITY_CLIENT_KEYS = [
  SESSION_CONTEXT_SHELL_IDENTITY_REVISION_KEY,
  'user.id',
  'user.username',
  'user.email',
  'user.firstname',
  'user.lastname',
  'user.profile_image',
  SESSION_CONTEXT_IDENTITY_META_KEYS.hasProfileImageXs,
] as const;

export const clientContextHasShellIdentity = (
  context: Record<string, unknown> | null | undefined,
): boolean => {
  if (!context || typeof context !== 'object') return false;
  if (Number(context[SESSION_CONTEXT_SHELL_IDENTITY_REVISION_KEY]) !== SESSION_CONTEXT_SHELL_IDENTITY_REVISION) {
    return false;
  }
  return SESSION_CONTEXT_SHELL_IDENTITY_CLIENT_KEYS.every((key) => Object.prototype.hasOwnProperty.call(context, key));
};

export const USER_ACCOUNT_CONTEXT_FIELDS = [
  { field: 'id', label: 'User ID', contextKey: 'user.id' },
  { field: 'username', label: 'Username', contextKey: 'user.username' },
  { field: 'email', label: 'Email', contextKey: 'user.email' },
  { field: 'mobile', label: 'Mobile', contextKey: 'user.mobile' },
] as const;

export type UserAccountContextField = typeof USER_ACCOUNT_CONTEXT_FIELDS[number]['field'];

export const visibilityFromChannels = (
  server: boolean,
  client: boolean,
): AttributeVisibility => {
  if (server && client) return 'BOTH';
  if (server) return 'SERVER';
  if (client) return 'CLIENT';
  return 'NONE';
};

export const channelsFromVisibility = (
  visibility: string | null | undefined,
): { server: boolean; client: boolean } => {
  const normalized = String(visibility || 'BOTH').trim().toUpperCase();
  if (normalized === 'SERVER') return { server: true, client: false };
  if (normalized === 'CLIENT') return { server: false, client: true };
  if (normalized === 'NONE') return { server: false, client: false };
  return { server: true, client: true };
};

export const attributeSessionSourceId = (scope: 'USER' | 'ROLE', key: string): string =>
  `attr:${scope}:${key}`;

export const profileSessionSourceId = (profileField: string): string =>
  `profile:${profileField}`;

export const userAccountSessionSourceId = (field: string): string =>
  `user:${field}`;

export const parseAttributeSessionSourceId = (
  id: string,
): { scope: 'USER' | 'ROLE'; key: string } | null => {
  const match = /^attr:(USER|ROLE):(.+)$/.exec(id);
  if (!match) return null;
  return { scope: match[1] as 'USER' | 'ROLE', key: match[2] };
};

export const parseProfileSessionSourceId = (id: string): string | null => {
  if (!id.startsWith('profile:')) return null;
  const field = id.slice('profile:'.length).trim();
  return field || null;
};

export const parseUserAccountSessionSourceId = (id: string): string | null => {
  if (!id.startsWith('user:')) return null;
  const field = id.slice('user:'.length).trim();
  return field || null;
};
