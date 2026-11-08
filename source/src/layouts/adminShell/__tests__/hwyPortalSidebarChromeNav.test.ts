import { describe, expect, it } from 'vitest';
import { readNavigationFile } from '../../../core/platform-registry/PlatformRegistryFileStore';
import { listRouteBindingFiles } from '../../../core/platform-registry/PlatformRegistryFileStore';
import { listMountFiles } from '../../../core/platform-registry/PlatformRegistryFileStore';
import { buildAdminShellNav, resolveAdminShellHeaderContext } from '../buildAdminShellNav';
import { composeStudioSidebarNav } from '../../../shared/lib/navTreeFilter';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import {
  HWY_NAV_GROUP_MEMBERS,
  HWY_NAV_GROUP_MEMBER_STATUS,
  resolveHwyMemberListNavGroup,
} from '../../../domain/hwy/hwyMemberNavGroups';

describe('Hawiety portal sidebar chrome nav', () => {
  it('exposes Home and Theme Designer in the quick strip from hawiety.json', () => {
    const manifest = readNavigationFile('hawiety');
    expect(manifest).toBeTruthy();

    const config: PlatformRuntimeConfig = {
      version: 'test',
      mounts: listMountFiles(),
      shells: [],
      shellRules: [],
      pageModules: [],
      bindings: listRouteBindingFiles(),
      navigations: manifest ? [manifest] : [],
    };

    const nav = buildAdminShellNav({
      config,
      mountId: 'iq',
      mountPathPrefix: '/iq',
      currentUser: { roles: ['ADMIN'] },
      manifest: manifest!,
      currentCultureId: 'iq',
      currentPortalSegment: 'hawiety',
    });

    const composed = composeStudioSidebarNav(nav);
    expect(composed.quickNavItems.map((item) => item.label)).toEqual(['Home', 'Theme Designer']);
    expect(composed.quickNavItems.every((item) => Boolean(item.path))).toBe(true);
  });

  it('exposes geo responsibility as its own sidebar group (legacy ادارة مسؤولي الرقع)', () => {
    const manifest = readNavigationFile('hawiety');
    expect(manifest).toBeTruthy();

    const config: PlatformRuntimeConfig = {
      version: 'test',
      mounts: [
        {
          id: 'iq',
          pathPrefix: '/iq',
          name: 'IQ',
          enabled: true,
          defaultRoute: '/iq',
          designerRoutePropagation: 'auto',
          authProfile: { requireAuth: true },
        },
      ],
      shells: [],
      shellRules: [],
      pageModules: [],
      bindings: listRouteBindingFiles(),
      navigations: manifest ? [manifest] : [],
    };

    const nav = buildAdminShellNav({
      config,
      mountId: 'iq',
      mountPathPrefix: '/iq',
      currentUser: { roles: ['ADMIN'] },
      manifest: manifest!,
      currentCultureId: 'iq',
      currentPortalSegment: 'hawiety',
    });

    const geoGroup = nav.find((group) => group.heading === 'Area officials management');
    expect(geoGroup).toBeTruthy();
    const pipelineSecurity = geoGroup!.items.find(
      (item) => item.pageKey === 'hwy-geo-responsibility-candidate-security',
    );
    const provinces = geoGroup!.items.find((item) => item.pageKey === 'hwy-geo-responsibility-provinces');
    const removalRequests = geoGroup!.items.find(
      (item) => item.pageKey === 'hwy-geo-responsibility-removal-requests',
    );
    expect(pipelineSecurity).toMatchObject({
      path: '/iq/hawiety/geo-responsibility/candidate-pipeline/security',
    });
    expect(provinces).toMatchObject({
      label: 'Provinces',
      path: '/iq/hawiety/geo-responsibility/province',
    });
    expect(geoGroup!.items.some((item) => item.pageKey === 'hwy-geo-responsibility-assignment-requests')).toBe(
      false,
    );
    expect(removalRequests).toMatchObject({
      label: 'Official removal requests',
      path: '/iq/hawiety/geo-responsibility/removal-requests',
    });
    expect(geoGroup!.items.some((item) => item.path?.includes('candidates-admin'))).toBe(false);
    const removalIndex = geoGroup!.items.findIndex(
      (item) => item.pageKey === 'hwy-geo-responsibility-removal-requests',
    );
    expect(removalIndex).toBe(geoGroup!.items.length - 1);
  });

  it('resolves geo pipeline shell header from manifest nav leaf, not splat binding title', () => {
    const manifest = readNavigationFile('hawiety');
    expect(manifest).toBeTruthy();

    const config: PlatformRuntimeConfig = {
      version: 'test',
      mounts: [
        {
          id: 'iq',
          pathPrefix: '/iq',
          name: 'IQ',
          enabled: true,
          defaultRoute: '/iq',
          designerRoutePropagation: 'auto',
          authProfile: { requireAuth: true },
        },
      ],
      shells: [],
      shellRules: [],
      pageModules: [
        {
          pageKey: 'hwy-geo-responsibility',
          title: 'Area officials management',
          loaderKind: 'package',
          loaderRef: 'hawiety:HwyGeoResponsibility',
          defaultRoles: null,
          enabled: true,
          ownerPackageId: 'hawiety',
          ownerPluginVersion: null,
          source: 'manual',
          createdAt: '2026-01-01T00:00:00.000Z',
          createdBy: null,
          updatedAt: '2026-01-01T00:00:00.000Z',
          updatedBy: null,
        },
      ],
      bindings: listRouteBindingFiles(),
      navigations: manifest ? [manifest] : [],
    };

    const nav = buildAdminShellNav({
      config,
      mountId: 'iq',
      mountPathPrefix: '/iq',
      currentUser: { roles: ['ADMIN'] },
      manifest: manifest!,
      currentCultureId: 'iq',
      currentPortalSegment: 'hawiety',
    });

    const header = resolveAdminShellHeaderContext({
      groups: nav,
      pathname: '/iq/hawiety/geo-responsibility/candidate-pipeline/interview',
      config,
      mountId: 'iq',
    });

    expect(header.item).toMatchObject({
      pageKey: 'hwy-geo-responsibility-candidate-interview',
      label: '(2) متابعة المقابلة',
    });
    expect(header.groupHeading).toBe('Area officials management');
    expect(header.item.label).not.toBe('Area officials management');
  });

  it('splits member registry and status workflows into separate sidebar groups', () => {
    const manifest = readNavigationFile('hawiety');
    expect(manifest).toBeTruthy();

    const membersGroup = manifest!.groups?.find((group) => group.heading === HWY_NAV_GROUP_MEMBERS);
    const statusGroup = manifest!.groups?.find((group) => group.heading === HWY_NAV_GROUP_MEMBER_STATUS);
    expect(membersGroup).toBeTruthy();
    expect(statusGroup).toBeTruthy();
    const memberActivitiesGroup = manifest!.groups?.find(
      (group) => group.heading === 'Member courses and activities',
    );
    expect(memberActivitiesGroup).toBeTruthy();
    expect(
      memberActivitiesGroup!.items?.some((item) => item.pageKey === 'hwy-meetings-management'),
    ).toBe(true);
    expect(manifest!.groups?.some((group) => group.heading === 'Persons management')).toBe(false);

    for (const item of membersGroup!.items ?? []) {
      if (!item.pageKey) {
        continue;
      }
      expect(resolveHwyMemberListNavGroup(item.pageKey)).toBe(HWY_NAV_GROUP_MEMBERS);
    }
    for (const item of statusGroup!.items ?? []) {
      if (!item.pageKey) {
        continue;
      }
      expect(resolveHwyMemberListNavGroup(item.pageKey)).toBe(HWY_NAV_GROUP_MEMBER_STATUS);
    }

    expect(membersGroup!.items?.some((item) => item.pageKey === 'hwy-members-all')).toBe(true);
    expect(membersGroup!.items?.some((item) => item.pageKey === 'hwy-members-image-fix')).toBe(true);
    expect(statusGroup!.items?.some((item) => item.pageKey === 'hwy-members-waited-call-center')).toBe(true);

    const montadheminIndex = membersGroup!.items!.findIndex(
      (item) => item.pageKey === 'hwy-members-montadhemin',
    );
    const imageFixIndex = membersGroup!.items!.findIndex(
      (item) => item.pageKey === 'hwy-members-image-fix',
    );
    expect(montadheminIndex).toBeGreaterThanOrEqual(0);
    expect(imageFixIndex).toBe(montadheminIndex + 1);
    expect(membersGroup!.items![imageFixIndex]?.separatorBefore).toBe(true);
  });

  it('lists courses and activities under one member courses and activities nav group', () => {
    const manifest = readNavigationFile('hawiety');
    expect(manifest).toBeTruthy();

    const group = manifest!.groups.find((entry) => entry.heading === 'Member courses and activities');
    expect(group?.items.map((item) => item.pageKey)).toEqual([
      'hwy-courses-list',
      'hwy-courses-review',
      'hwy-activities-register',
      'hwy-activities-waited-1',
      'hwy-activities-final',
      'hwy-activities-central',
      'hwy-meetings-management',
    ]);
  });

  it('keeps System management (ادارة النظام) as the last sidebar section', () => {
    const manifest = readNavigationFile('hawiety');
    expect(manifest).toBeTruthy();

    const config: PlatformRuntimeConfig = {
      version: 'test',
      mounts: listMountFiles(),
      shells: [],
      shellRules: [],
      pageModules: [],
      bindings: listRouteBindingFiles(),
      navigations: manifest ? [manifest] : [],
    };

    const nav = buildAdminShellNav({
      config,
      mountId: 'iq',
      mountPathPrefix: '/iq',
      currentUser: { roles: ['ADMIN'] },
      manifest: manifest!,
      currentCultureId: 'iq',
      currentPortalSegment: 'hawiety',
    });

    const headedGroups = nav.filter((group) => Boolean(group.heading?.trim()));
    expect(headedGroups.length).toBeGreaterThan(1);
    expect(headedGroups[headedGroups.length - 1]?.heading).toBe('System management');
  });
});
