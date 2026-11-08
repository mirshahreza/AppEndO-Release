import { describe, expect, it } from 'vitest';
import {
  loadPlatformRegistryDefaultMount,
  loadPlatformRegistryDefaultMounts,
  loadPlatformRegistryDefaultRouteBindings,
  loadPlatformRegistryDefaultShellRules,
} from '../../../../../core/platform-registry/loadPlatformRegistryDefaults';
import { EXPERIENCE_MOUNT_DASHBOARD_PAGE_KEY } from '../experienceMountSeeds';

describe('experience mount defaults', () => {
  it('does not seed culture-specific mounts (culture routes use URL prefix only)', () => {
    const mounts = loadPlatformRegistryDefaultMounts();
    const mountIds = mounts.map((mount) => mount.id);

    expect(mountIds).not.toContain('us');
    expect(mountIds).not.toContain('ir');
    expect(mountIds).not.toContain('iq');
    expect(loadPlatformRegistryDefaultMount('us')).toBeUndefined();
    expect(loadPlatformRegistryDefaultMount('ir')).toBeUndefined();
    expect(loadPlatformRegistryDefaultMount('iq')).toBeUndefined();
  });

  it('keeps studio as the canonical experience mount seed', () => {
    const studio = loadPlatformRegistryDefaultMount('studio');
    expect(studio?.pathPrefix).toBe('/studio');
    expect(studio?.designerRoutePropagation).toBe('none');
  });

  it('reuses the shared dashboard page module from studio as the single source of truth', () => {
    expect(EXPERIENCE_MOUNT_DASHBOARD_PAGE_KEY).toBe('dashboard');

    const bindings = loadPlatformRegistryDefaultRouteBindings().filter((binding) => binding.pageKey === 'dashboard');
    expect(bindings.map((binding) => binding.mountId)).toEqual(['studio']);
  });

  it('keeps client-components on the studio shell (designer shell rule disabled)', () => {
    const shellRules = loadPlatformRegistryDefaultShellRules();
    expect(shellRules.every((rule) => rule.mountId === 'studio')).toBe(true);
    expect(shellRules.some((rule) => ['ir', 'us', 'iq'].includes(rule.mountId))).toBe(false);
    expect(shellRules).toHaveLength(1);
    expect(shellRules[0]?.shellKey).toBe('designer');
    expect(shellRules[0]?.pathPrefix).toBe('/studio/client-components');
    expect(shellRules[0]?.enabled).toBe(false);
  });
});
