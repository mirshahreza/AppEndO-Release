import type { PackageLibraryRequirement } from './developerLibraries';

export const REMOTE_HUBS_PACKAGE_ID = 'remote-hubs';
export const REMOTE_HUBS_PACKAGE_NAME = 'Remote Hubs';
export const REMOTE_HUBS_PACKAGE_VERSION = '1.0.6';
export const REMOTE_HUBS_NAV_HEADING = 'Remote Hubs';
export const REMOTE_HUBS_NAV_HEADING_ICON = 'tabler:IconNetwork';
export const REMOTE_HUBS_NAV_HEADING_ORDER = 6;

const REMOTE_HUBS_PAGE_KEYS = ['file-hub', 'ssh-hub', 'rdp-hub'] as const;
type RemoteHubsPageKey = (typeof REMOTE_HUBS_PAGE_KEYS)[number];

export function isRemoteHubsPageKey(pageKey: string): pageKey is RemoteHubsPageKey {
  return (REMOTE_HUBS_PAGE_KEYS as readonly string[]).includes(pageKey);
}

/** Native + protocol widgets this package owns. Satisfied into packages-storage/libs on install. */
export const REMOTE_HUBS_LIBRARIES: PackageLibraryRequirement[] = [
  { name: 'ssh2', versionRange: '^1.17.0' },
  { name: 'basic-ftp', versionRange: '^6.2.0' },
  { name: 'ws', versionRange: '^8.21.3' },
  { name: '@xterm/xterm', versionRange: '^6.0.0' },
  { name: '@xterm/addon-fit', versionRange: '^0.11.0' },
  { name: 'guacamole-lite', versionRange: '^1.2.0' },
  { name: 'guacamole-common-js', versionRange: '^1.5.0' },
];

/** Client specifiers Vite must resolve from packages-storage/libs (or stubs when the package is absent). */
export const REMOTE_HUBS_CLIENT_LIB_SPECIFIERS = [
  '@xterm/xterm',
  '@xterm/addon-fit',
  '@xterm/xterm/css/xterm.css',
  'guacamole-common-js',
] as const;

