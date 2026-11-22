import { describe, expect, it } from 'vitest';
import { buildPortalxVerticalAppPackageSpec } from '../../../../oss/excludedModuleStub';
import { buildVerticalAppManifest } from '../../../../core/packages/testkit/verticalAppPackageBuilder';
import {
  buildRegistryFromManifest,
  verticalAppPagesAsUiRoutes,
} from '../registryBuilder';

describe('registryBuilder vertical-app pages', () => {
  it('maps capabilities.pages into object-registry uiRoutes', () => {
    const manifest = buildVerticalAppManifest(buildPortalxVerticalAppPackageSpec());
    const uiRoutes = verticalAppPagesAsUiRoutes(manifest);
    expect(uiRoutes.length).toBeGreaterThan(0);
    expect(uiRoutes.some((route) => route.pageKey === 'extx-geo-responsibility')).toBe(true);
    expect(uiRoutes.find((route) => route.pageKey === 'extx-geo-responsibility')?.entry).toMatch(
      /ui\/pages\/extx_geo_responsibility/,
    );

    const registry = buildRegistryFromManifest('portalx', manifest, '0.2.0', 'default');
    expect(registry.records.uiRoutes).toHaveLength(uiRoutes.length);
    expect(registry.records.uiRoutes.some((route) => route.pageKey === 'extx-targhin-requests')).toBe(true);
  });
});
