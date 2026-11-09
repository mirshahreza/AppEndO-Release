import { describe, expect, it } from 'vitest';

import { readNavigationFile } from '../../../core/platform-registry/PlatformRegistryFileStore';
import {
  listMountFiles,
  listRouteBindingFiles,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import { buildHwyNavPageShellHeaderOverride } from '../../../domain/hwy/hwyNavPageShellHeader';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import {
  buildAdminShellNav,
  flattenAdminShellNavItems,
  resolveAdminShellHeaderContext,
  type AdminShellNavGroup,
  type AdminShellNavItem,
} from '../buildAdminShellNav';
import { mergeShellHeaderModule } from '../mergeShellHeaderModule';
import { buildAppearanceShellHeaderOverride } from '../../../features/appearance/hooks/useAppearanceShellHeader';
import hawietyIqOverlay from '../../../core/system-extensions/culture-packs/overlays/hawiety.iq.json';

const TOP_LEVEL_PAGE_KEYS = new Set(['dashboard', 'home', 'hwy-home']);

function collectNavLeaves(groups: AdminShellNavGroup[]): Array<{
  item: AdminShellNavItem;
  groupHeading: string | null;
}> {
  const leaves: Array<{ item: AdminShellNavItem; groupHeading: string | null }> = [];

  const walk = (items: AdminShellNavItem[]) => {
    for (const item of items) {
      if (item.type === 'separator') {
        continue;
      }
      if (item.children && item.children.length > 0) {
        walk(item.children);
        continue;
      }
      if (item.path) {
        leaves.push({ item, groupHeading: null });
      }
    }
  };

  for (const group of groups) {
    const groupHeading = group.heading?.trim() || null;
    const groupLeaves: AdminShellNavItem[] = [];
    const captureWalk = (items: AdminShellNavItem[]) => {
      for (const item of items) {
        if (item.type === 'separator') {
          continue;
        }
        if (item.children && item.children.length > 0) {
          captureWalk(item.children);
          continue;
        }
        if (item.path) {
          groupLeaves.push(item);
        }
      }
    };
    captureWalk(group.items);
    for (const item of groupLeaves) {
      leaves.push({ item, groupHeading });
    }
  }

  return leaves;
}

function buildRegistryConfig(
  manifestId: string,
  mount: { id: string; pathPrefix: string },
  portalSegment: string,
  cultureId: string,
): { config: PlatformRuntimeConfig; manifest: NonNullable<ReturnType<typeof readNavigationFile>> } {
  const manifest = readNavigationFile(manifestId);
  if (!manifest) {
    throw new Error(`Missing navigation manifest: ${manifestId}`);
  }

  const config: PlatformRuntimeConfig = {
    version: 'shell-header-parity-test',
    mounts: [
      {
        id: mount.id,
        pathPrefix: mount.pathPrefix,
        name: mount.id,
        enabled: true,
        defaultRoute: mount.pathPrefix,
        designerRoutePropagation: 'auto',
        authProfile: { requireAuth: true },
      },
    ],
    shells: [],
    shellRules: [],
    pageModules: [],
    bindings: listRouteBindingFiles(),
    navigations: [manifest],
  };

  return { config, manifest };
}

function assertHeadedNavLeavesResolveWithGroup(input: {
  portalLabel: string;
  manifestId: string;
  mount: { id: string; pathPrefix: string };
  portalSegment: string;
  cultureId: string;
}): void {
  const { config, manifest } = buildRegistryConfig(
    input.manifestId,
    input.mount,
    input.portalSegment,
    input.cultureId,
  );

  const groups = buildAdminShellNav({
    config,
    mountId: input.mount.id,
    mountPathPrefix: input.mount.pathPrefix,
    currentUser: { roles: ['ADMIN'] },
    manifest,
    currentCultureId: input.cultureId,
    currentPortalSegment: input.portalSegment,
  });

  const missing: string[] = [];
  let headedLeafCount = 0;

  for (const { item, groupHeading } of collectNavLeaves(groups)) {
    const pageKey = item.pageKey?.trim();
    if (!pageKey || !item.path || TOP_LEVEL_PAGE_KEYS.has(pageKey)) {
      continue;
    }
    if (!groupHeading) {
      continue;
    }

    headedLeafCount += 1;

    const context = resolveAdminShellHeaderContext({
      groups,
      pathname: item.path,
      config,
      mountId: input.mount.id,
    });

    const merged = mergeShellHeaderModule(context, buildHwyNavPageShellHeaderOverride({
      pageKey,
      cultureId: input.cultureId,
      t: undefined,
      fallbackLabel: item.label ?? pageKey,
      icon: item.icon,
    }));

    if (!context.groupHeading?.trim()) {
      missing.push(`${input.portalLabel} ${pageKey} @ ${item.path} (nav group "${groupHeading}" — resolve returned no group)`);
      continue;
    }
    if (!merged.groupLabel?.trim()) {
      missing.push(`${input.portalLabel} ${pageKey} @ ${item.path} (nav group "${groupHeading}" — merge lost group)`);
    }
  }

  expect(headedLeafCount).toBeGreaterThan(0);
  expect(missing, missing.join('\n')).toEqual([]);
}

function collectManifestPageKeys(manifest: NonNullable<ReturnType<typeof readNavigationFile>>): string[] {
  const keys: string[] = [];
  const walk = (items: Array<{ pageKey?: string; children?: unknown[] }> | undefined) => {
    for (const item of items ?? []) {
      if (item.pageKey) {
        keys.push(item.pageKey);
      }
      walk(item.children as Array<{ pageKey?: string; children?: unknown[] }> | undefined);
    }
  };
  for (const group of manifest.groups ?? []) {
    if (!group.heading?.trim()) {
      continue;
    }
    walk(group.items);
  }
  return keys;
}

describe('shell header group / page parity (full nav registry)', () => {
  it('hawiety iq overlay ships nav.* for every headed sidebar pageKey', () => {
    const manifest = readNavigationFile('hawiety');
    expect(manifest).toBeTruthy();
    const overlay = hawietyIqOverlay as Record<string, string>;
    const missing = collectManifestPageKeys(manifest!).filter(
      (pageKey) => !overlay[`nav.${pageKey}`]?.trim(),
    );
    expect(missing, missing.join(', ')).toEqual([]);
  });

  it('studio manifest — every headed sidebar leaf resolves with nav group after Hawiety-style override merge', () => {
    assertHeadedNavLeavesResolveWithGroup({
      portalLabel: 'studio',
      manifestId: 'studio',
      mount: { id: 'studio', pathPrefix: '/studio' },
      portalSegment: 'studio',
      cultureId: 'us',
    });
  });

  it('hawiety manifest — every headed sidebar leaf resolves with nav group after Hawiety-style override merge', () => {
    assertHeadedNavLeavesResolveWithGroup({
      portalLabel: 'hawiety',
      manifestId: 'hawiety',
      mount: { id: 'iq', pathPrefix: '/iq' },
      portalSegment: 'hawiety',
      cultureId: 'iq',
    });
  });

  it('does not drop nav group for appearance override without titleTrail', () => {
    const studioMount = listMountFiles().find((mount) => mount.id === 'studio');
    expect(studioMount).toBeTruthy();
    const studioNav = readNavigationFile('studio');
    expect(studioNav).toBeTruthy();

    const config: PlatformRuntimeConfig = {
      version: 'test',
      mounts: studioMount ? [studioMount] : [],
      shells: [],
      shellRules: [],
      pageModules: [],
      bindings: listRouteBindingFiles(),
      navigations: studioNav ? [studioNav] : [],
    };

    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: '/studio',
      currentUser: { roles: ['ADMIN'] },
      manifest: studioNav!,
      currentCultureId: 'us',
      currentPortalSegment: 'studio',
    });

    const appearance = flattenAdminShellNavItems(groups).find((item) => item.pageKey === 'appearance');
    expect(appearance?.path).toBeTruthy();

    const context = resolveAdminShellHeaderContext({
      groups,
      pathname: appearance!.path!,
      config,
      mountId: 'studio',
    });

    const merged = mergeShellHeaderModule(context, buildAppearanceShellHeaderOverride(undefined));
    expect(merged.groupLabel).toBe(context.groupHeading);
    expect(merged.groupLabel).toBeTruthy();
  });
});
