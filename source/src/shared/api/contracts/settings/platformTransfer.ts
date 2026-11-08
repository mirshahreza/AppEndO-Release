import type { AppSettingsSectionKey } from './sections';
import type { PlatformBlobSectionKey } from './scopes';

export type PlatformTransferDataModelKey =
  | 'profile-fields'
  | 'user-attributes'
  | 'role-attributes';

export type PlatformTransferSectionKey =
  | PlatformBlobSectionKey
  | AppSettingsSectionKey
  | PlatformTransferDataModelKey;

export type PlatformTransferGroupId = 'platform-blobs' | 'app-settings' | 'data-model';

export type PlatformTransferCatalogEntry = {
  key: PlatformTransferSectionKey;
  group: PlatformTransferGroupId;
  label: string;
  description: string;
  sensitive?: boolean;
  defaultSelected: boolean;
};

export const PLATFORM_TRANSFER_GROUP_LABELS: Record<PlatformTransferGroupId, string> = {
  'platform-blobs': 'Platform blobs',
  'app-settings': 'App settings',
  'data-model': 'Data model',
};

export const PLATFORM_TRANSFER_CATALOG: PlatformTransferCatalogEntry[] = [
  { key: 'ai', group: 'platform-blobs', label: 'AI Models & MCP', description: 'Providers, models, MCP servers, and related AI configuration.', defaultSelected: true },
  { key: 'cache', group: 'platform-blobs', label: 'Cache', description: 'Shared cache driver and Redis connection.', defaultSelected: true },
  { key: 'platformCultures', group: 'platform-blobs', label: 'Cultures', description: 'Locale packs and culture combinations.', defaultSelected: true },
  { key: 'platformCultureTranslations', group: 'platform-blobs', label: 'Culture Translations', description: 'Platform UI translation bundles and per-culture overrides.', defaultSelected: true },
  { key: 'platformWebFonts', group: 'platform-blobs', label: 'Web Fonts', description: 'Uploaded self-hosted web font metadata.', defaultSelected: true },
  { key: 'platformFeedback', group: 'platform-blobs', label: 'Feedback', description: 'Embedded feedback policy, topics, and routing rules.', defaultSelected: true },
  { key: 'platformRouteLoading', group: 'platform-blobs', label: 'Route loading', description: 'Boot and lazy-route loading chrome (logo, progress).', defaultSelected: true },
  { key: 'identity-providers', group: 'platform-blobs', label: 'Identity Providers', description: 'OAuth and external identity provider configuration.', defaultSelected: true },
  { key: 'security', group: 'platform-blobs', label: 'JWT Secrets', description: 'Platform-wide token signing secrets.', sensitive: true, defaultSelected: false },
  { key: 'scheduler', group: 'platform-blobs', label: 'Scheduler', description: 'Scheduled task definitions.', defaultSelected: true },
  { key: 'git', group: 'platform-blobs', label: 'Git', description: 'Git integration preferences.', defaultSelected: true },
  { key: 'server-functions', group: 'app-settings', label: 'Server Functions', description: 'Sandbox execution policy for server functions.', defaultSelected: true },
  { key: 'logs', group: 'app-settings', label: 'Logs', description: 'Log retention and database persistence.', defaultSelected: true },
  { key: 'auth', group: 'app-settings', label: 'Auth & Security', description: 'Login, lockout, OTP, and registration policy.', defaultSelected: true },
  { key: 'email', group: 'app-settings', label: 'Email / SMTP', description: 'Outbound SMTP delivery settings.', defaultSelected: true },
  { key: 'pwa', group: 'app-settings', label: 'PWA', description: 'Web manifest, install experience, and update notices.', defaultSelected: true },
  { key: 'logging', group: 'app-settings', label: 'Per-function logging', description: 'Per server-function logging overrides.', defaultSelected: false },
  { key: 'profile-fields', group: 'data-model', label: 'Profile Fields', description: 'Profile field visibility and edit policy.', defaultSelected: true },
  { key: 'user-attributes', group: 'data-model', label: 'User Attributes', description: 'Custom attribute definitions for users.', defaultSelected: true },
  { key: 'role-attributes', group: 'data-model', label: 'Role Attributes', description: 'Custom attribute definitions for roles.', defaultSelected: true },
];

const TRANSFER_KEY_SET = new Set<string>(PLATFORM_TRANSFER_CATALOG.map((entry) => entry.key));

export const isPlatformTransferSectionKey = (value: string): value is PlatformTransferSectionKey =>
  TRANSFER_KEY_SET.has(value);

export const defaultPlatformTransferSelection = (): PlatformTransferSectionKey[] =>
  PLATFORM_TRANSFER_CATALOG.filter((entry) => entry.defaultSelected).map((entry) => entry.key);

export type PlatformTransferBundle = {
  version: 1;
  exportedAt: string;
  sections: Partial<Record<PlatformTransferSectionKey, unknown>>;
};

export const PLATFORM_TRANSFER_BUNDLE_VERSION = 1 as const;
