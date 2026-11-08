import { navGroupKey, navLabelKey } from '../culture/cultureShellKeys';
import { FILE_HUB_EN } from '../culture/translations/fileHubEn';
import { RDP_HUB_EN } from '../culture/translations/rdpHubEn';
import { SSH_HUB_EN } from '../culture/translations/sshHubEn';
import {
  REMOTE_HUBS_LIBRARIES,
  REMOTE_HUBS_NAV_HEADING,
  REMOTE_HUBS_NAV_HEADING_ICON,
  REMOTE_HUBS_NAV_HEADING_ORDER,
  REMOTE_HUBS_PACKAGE_ID,
  REMOTE_HUBS_PACKAGE_NAME,
  REMOTE_HUBS_PACKAGE_VERSION,
} from './remoteHubsPackage';

export const REMOTE_HUBS_NAV_AUTH = {
  accessMode: 'specific' as const,
  allowRoles: ['ADMIN'],
  allowUsers: [] as string[],
  denyRoles: [] as string[],
  denyUsers: [] as string[],
};

export const REMOTE_HUBS_NAV_PATCH_ENTRY = 'platform/navigation-patches/studio.json';
export const REMOTE_HUBS_CULTURE_KEYS_ENTRY = 'culture/keys.json';

export const REMOTE_HUBS_UI_ROUTES = [
  {
    pageKey: 'file-hub',
    entry: 'ui/sftp.tsx',
    suggestedRoutePattern: 'sftp/*',
    suggestedMountId: 'studio',
  },
  {
    pageKey: 'ssh-hub',
    entry: 'ui/ssh.tsx',
    suggestedRoutePattern: 'ssh/*',
    suggestedMountId: 'studio',
  },
  {
    pageKey: 'rdp-hub',
    entry: 'ui/rdp.tsx',
    suggestedRoutePattern: 'rdp/*',
    suggestedMountId: 'studio',
  },
] as const;

export function buildRemoteHubsUiSourceFiles(): Array<{ entry: string; source: string }> {
  return [
    { entry: 'ui/sftp.tsx', source: "export { FileHubPage as default } from '@/features/file-hub/FileHubPage';\n" },
    { entry: 'ui/ssh.tsx', source: "export { SshHubPage as default } from '@/features/ssh-hub/SshHubPage';\n" },
    { entry: 'ui/rdp.tsx', source: "export { RdpHubPage as default } from '@/features/rdp-hub/RdpHubPage';\n" },
  ];
}

export function buildRemoteHubsNavigationPatch(): {
  navigationId: string;
  heading: string;
  headingIcon: string;
  headingOrder: number;
  items: Array<{
    pageKey: string;
    label: string;
    icon: string;
    iconColor: string;
    description: string;
    routePattern: string;
    order: number;
    separatorBefore?: boolean;
    auth: typeof REMOTE_HUBS_NAV_AUTH;
  }>;
} {
  return {
    navigationId: 'studio',
    heading: REMOTE_HUBS_NAV_HEADING,
    headingIcon: REMOTE_HUBS_NAV_HEADING_ICON,
    headingOrder: REMOTE_HUBS_NAV_HEADING_ORDER,
    items: [
      {
        pageKey: 'ssh-hub',
        label: 'SSH',
        icon: 'tabler:IconTerminal2',
        iconColor: 'text-emerald-600',
        description: 'Saved SSH connections and an in-browser multi-document terminal.',
        routePattern: 'ssh/*',
        order: 1,
        auth: REMOTE_HUBS_NAV_AUTH,
      },
      {
        pageKey: 'file-hub',
        label: 'Sftp',
        icon: 'tabler:IconFolders',
        iconColor: 'text-cyan-600',
        description: 'Saved SFTP and FTP connections with a multi-document file manager.',
        routePattern: 'sftp/*',
        order: 2,
        auth: REMOTE_HUBS_NAV_AUTH,
      },
      {
        pageKey: 'rdp-hub',
        label: 'RDP',
        icon: 'tabler:IconDeviceDesktop',
        iconColor: 'text-sky-600',
        description: 'Saved RDP connections and an in-browser multi-document remote desktop.',
        routePattern: 'rdp/*',
        order: 3,
        separatorBefore: true,
        auth: REMOTE_HUBS_NAV_AUTH,
      },
    ],
  };
}

export function buildRemoteHubsCultureKeys(): Record<string, string> {
  const patch = buildRemoteHubsNavigationPatch();
  const keys: Record<string, string> = {
    [navGroupKey(REMOTE_HUBS_NAV_HEADING)]: REMOTE_HUBS_NAV_HEADING,
    ...FILE_HUB_EN,
    ...SSH_HUB_EN,
    ...RDP_HUB_EN,
  };
  for (const item of patch.items) {
    keys[navLabelKey(item.pageKey)] = item.label;
    keys[`${navLabelKey(item.pageKey)}.description`] = item.description;
  }
  keys['homeWidget.sshHub.title'] = 'SSH connections';
  keys['homeWidget.sshHub.description'] = 'Open up to five saved SSH sessions from Home.';
  keys['homeWidget.fileHub.title'] = 'SFTP connections';
  keys['homeWidget.fileHub.description'] = 'Open up to five saved file transfers from Home.';
  keys['homeWidget.rdpHub.title'] = 'RDP connections';
  keys['homeWidget.rdpHub.description'] = 'Open up to five saved remote desktops from Home.';
  keys['homeWidget.remoteHubs.loading'] = 'Loading saved connections…';
  keys['homeWidget.remoteHubs.empty'] = 'No saved connections yet.';
  keys['homeWidget.remoteHubs.unavailable'] = 'Remote Hubs is not available on this node.';
  return keys;
}

export function buildRemoteHubsManifestDraft(): Record<string, unknown> {
  return {
    $schemaVersion: '1.0',
    id: REMOTE_HUBS_PACKAGE_ID,
    name: REMOTE_HUBS_PACKAGE_NAME,
    version: REMOTE_HUBS_PACKAGE_VERSION,
    description: 'Sftp, SSH, and RDP as one optional Studio package. Home widgets (core registry) list up to five saved connections per hub.',
    createdBy: 'AppEndO',
    requiredAppVersion: '>=1.0.0',
    dependencies: [],
    libraries: REMOTE_HUBS_LIBRARIES,
    capabilities: {
      apis: [],
      ui_components: [],
      ui_routes: [...REMOTE_HUBS_UI_ROUTES],
      db_objects: [],
      mcp_servers: [],
      navigation_patches: [
        { navigationId: 'studio', entry: REMOTE_HUBS_NAV_PATCH_ENTRY },
      ],
      culture_keys: [{ entry: REMOTE_HUBS_CULTURE_KEYS_ENTRY }],
    },
    overridePolicy: {
      apis: 'deny',
      ui_components: 'deny',
      db_objects: 'deny',
      mcp_servers: 'deny',
    },
    integrity: {
      algorithm: 'sha256',
      artifactHash: '0'.repeat(64),
    },
  };
}
