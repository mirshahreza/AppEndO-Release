/**
 * Voting package — Studio navigation group (independent heading = Voting).
 */

import {
  readNavigationFile,
  writeNavigationFile,
} from '../../src/core/platform-registry/PlatformRegistryFileStore';
import type {
  NavigationManifestGroup,
  NavigationManifestItem,
} from '../../src/shared/api/contracts/platform/navigation';
import { invalidatePlatformRuntimeConfig } from '../../src/server/services/platform/platformRuntimeConfig.service';

const STUDIO_NAV_ID = 'studio';
export const VOTING_STUDIO_GROUP_HEADING = 'Voting';
export const VOTING_ROUTE_PREFIX = 'voting';

const ADMIN_AUTH = { roles: ['ADMIN'] } as unknown as NavigationManifestItem['auth'];

export type VotingStudioNavPage = {
  pageKey: string;
  routePattern: string;
  label: string;
  icon: string;
  description: string;
  iconColor: string;
  order: number;
  separatorBefore?: boolean;
};

export const buildVotingStudioNavGroup = (pages: VotingStudioNavPage[]): NavigationManifestGroup => {
  const toItem = (page: VotingStudioNavPage): NavigationManifestItem => ({
    pageKey: page.pageKey,
    routePattern: page.routePattern,
    label: page.label,
    icon: page.icon,
    description: page.description,
    iconColor: page.iconColor,
    order: page.order,
    ...(page.separatorBefore ? { separatorBefore: true } : {}),
    auth: ADMIN_AUTH,
  });

  return {
    heading: VOTING_STUDIO_GROUP_HEADING,
    icon: 'Vote',
    order: 28,
    items: pages.map(toItem),
  };
};

export const upsertVotingStudioNavGroup = (group: NavigationManifestGroup): void => {
  const manifest = readNavigationFile(STUDIO_NAV_ID);
  if (!manifest) {
    throw new Error('Studio navigation manifest not found (workspace/platform-registry/navigation/studio.json).');
  }

  const groups = (manifest.groups ?? []).filter(
    (item) => item.heading !== VOTING_STUDIO_GROUP_HEADING,
  );
  groups.push(group);
  groups.sort((left, right) => (left.order ?? 999) - (right.order ?? 999));

  writeNavigationFile({ ...manifest, groups });
  invalidatePlatformRuntimeConfig();
};

export const removeVotingStudioNavGroup = (): boolean => {
  const manifest = readNavigationFile(STUDIO_NAV_ID);
  if (!manifest) return false;

  const before = (manifest.groups ?? []).length;
  const nextGroups = (manifest.groups ?? []).filter(
    (group) => group.heading !== VOTING_STUDIO_GROUP_HEADING,
  );
  if (nextGroups.length === before) return false;

  writeNavigationFile({ ...manifest, groups: nextGroups });
  invalidatePlatformRuntimeConfig();
  return true;
};
