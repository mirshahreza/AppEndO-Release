/** Where a settings surface is persisted and who it applies to. */
export type SettingsScope = 'platform' | 'node' | 'data-model';

export type SettingsWorkspaceSectionId =
  | 'server-functions'
  | 'logs'
  | 'auth'
  | 'jwt-secrets'
  | 'email'
  | 'pwa'
  | 'route-loading'
  | 'cache'
  | 'ai-models'
  | 'mcp-servers'
  | 'eua-assist'
  | 'platform-transfer'
  | 'identity-providers'
  | 'cultures'
  | 'web-fonts'
  | 'feedback'
  | 'user-attributes'
  | 'role-attributes'
  | 'session-context'
  | 'profile-fields';

export type SettingsScopeMeta = {
  scope: SettingsScope;
  label: string;
  description: string;
};

export const SETTINGS_SCOPE_LABELS: Record<SettingsScope, { title: string; badge: string; hint: string }> = {
  platform: {
    title: 'Platform-wide',
    badge: 'All nodes',
    hint: 'Shared settings and data-model definitions stored in the control-plane database. Applies to every connected node.',
  },
  node: {
    title: 'This node',
    badge: 'This process',
    hint: 'Applies only to this server process (settings.json on this machine).',
  },
  'data-model': {
    title: 'Data model',
    badge: 'Control plane',
    hint: 'Structured definitions stored in control-plane tables.',
  },
};

/** Platform-wide blob sections in base_settings_sections (JSON documents). */
export const PLATFORM_BLOB_SECTION_KEYS = [
  'ai',
  'cache',
  'platformCultures',
  'platformCultureTranslations',
  'platformWebFonts',
  'platformFeedback',
  'identity-providers',
  'security',
  'scheduler',
  'git',
  'appearancePortalDefaults',
  'platformRouteLoading',
] as const;

export type PlatformBlobSectionKey = typeof PLATFORM_BLOB_SECTION_KEYS[number];

export const isPlatformBlobSectionKey = (value: string): value is PlatformBlobSectionKey =>
  (PLATFORM_BLOB_SECTION_KEYS as readonly string[]).includes(value);

/** Settings workspace nav metadata — single source for UI grouping. */
export const SETTINGS_SECTION_SCOPE: Record<SettingsWorkspaceSectionId, SettingsScopeMeta> = {
  'server-functions': {
    scope: 'platform',
    label: 'Server Functions',
    description: 'Sandbox execution policy for server functions.',
  },
  logs: {
    scope: 'platform',
    label: 'Logs / Record Events',
    description: 'Viewer defaults, database persistence, and log / record-event retention.',
  },
  email: {
    scope: 'platform',
    label: 'Email / SMTP',
    description: 'Outbound email for the whole platform.',
  },
  pwa: {
    scope: 'platform',
    label: 'PWA',
    description: 'Web manifest, install experience, and in-app update notices.',
  },
  'route-loading': {
    scope: 'platform',
    label: 'Route loading',
    description: 'Boot and lazy-route loading chrome — logo, progress signal, and layout.',
  },
  cache: {
    scope: 'platform',
    label: 'Cache',
    description: 'Shared cache driver and Redis connection.',
  },
  auth: {
    scope: 'platform',
    label: 'Auth & Security',
    description: 'Login, lockout, OTP, and registration policy.',
  },
  'jwt-secrets': {
    scope: 'platform',
    label: 'JWT secrets',
    description: 'Platform-wide token signing secrets (stored in control plane).',
  },
  'identity-providers': {
    scope: 'platform',
    label: 'Identity Providers',
    description: 'OAuth and external identity provider configuration.',
  },
  cultures: {
    scope: 'platform',
    label: 'Cultures',
    description: 'Locale packs and default culture for the platform.',
  },
  'web-fonts': {
    scope: 'platform',
    label: 'Web Fonts',
    description: 'Upload and manage self-hosted web fonts for culture typography.',
  },
  feedback: {
    scope: 'platform',
    label: 'Feedback',
    description: 'Embedded feedback policy, topics, routing, and collection settings.',
  },
  'ai-models': {
    scope: 'platform',
    label: 'AI Models',
    description: 'Chat models, providers, and API keys.',
  },
  'mcp-servers': {
    scope: 'platform',
    label: 'MCP Servers',
    description: 'Model Context Protocol server configuration.',
  },
  'eua-assist': {
    scope: 'platform',
    label: 'End-user AI assist',
    description: 'Toggle EUA capabilities, models, and safety limits.',
  },
  'platform-transfer': {
    scope: 'platform',
    label: 'Platform Transfer',
    description: 'Selective backup and restore of platform settings between environments.',
  },
  'profile-fields': {
    scope: 'data-model',
    label: 'Profile Fields',
    description: 'Which profile fields appear and who can edit them.',
  },
  'user-attributes': {
    scope: 'data-model',
    label: 'User Attributes',
    description: 'Custom attribute definitions for users.',
  },
  'role-attributes': {
    scope: 'data-model',
    label: 'Role Attributes',
    description: 'Custom attribute definitions for roles.',
  },
  'session-context': {
    scope: 'data-model',
    label: 'Session Context',
    description: 'Choose which sources populate server and client session context.',
  },
};

export const PLATFORM_SETTINGS_SECTIONS = (
  Object.entries(SETTINGS_SECTION_SCOPE) as Array<[SettingsWorkspaceSectionId, SettingsScopeMeta]>
).filter(([, meta]) => meta.scope === 'platform').map(([id, meta]) => ({ id, ...meta }));

export const NODE_SETTINGS_SECTIONS = [
  {
    id: 'node-identity' as const,
    scope: 'node' as const,
    label: 'Node identity',
    description: 'Node name and capability flags for this process.',
  },
  {
    id: 'node-runtime' as const,
    scope: 'node' as const,
    label: 'Runtime',
    description: 'HTTP port, log level, and development server options.',
  },
] as const;

export type NodeSettingsSectionId = typeof NODE_SETTINGS_SECTIONS[number]['id'];

export const DATA_MODEL_SETTINGS_SECTIONS = (
  Object.entries(SETTINGS_SECTION_SCOPE) as Array<[SettingsWorkspaceSectionId, SettingsScopeMeta]>
).filter(([, meta]) => meta.scope === 'data-model').map(([id, meta]) => ({ id, ...meta }));
