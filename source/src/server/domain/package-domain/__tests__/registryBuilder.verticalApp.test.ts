import { describe, expect, it } from 'vitest';
import { buildVerticalVerticalAppPackageSpec } from '../../../../core/packages/verticalPackagePackRecipe';
import { buildVerticalAppManifest } from '../../../../core/packages/testkit/verticalAppPackageBuilder';
import {
  buildRegistryFromManifest,
  verticalAppPagesAsUiRoutes,
} from '../registryBuilder';

describe('registryBuilder vertical-app pages', () => {
  it('maps capabilities.pages into object-registry uiRoutes', () => {
    const manifest = buildVerticalAppManifest(buildVerticalVerticalAppPackageSpec());
    const uiRoutes = verticalAppPagesAsUiRoutes(manifest);
    expect(uiRoutes.length).toBeGreaterThan(0);
    expect(uiRoutes.some((route) => route.pageKey === 'vx-geo-responsibility')).toBe(true);
    expect(uiRoutes.find((route) => route.pageKey === 'vx-geo-responsibility')?.entry).toMatch(
      /ui\/pages\/vx_geo_responsibility/,
    );

    const registry = buildRegistryFromManifest('vertical', manifest, '0.2.0', 'default');
    expect(registry.records.uiRoutes).toHaveLength(uiRoutes.length);
    expect(registry.records.uiRoutes.some((route) => route.pageKey === 'vx-targhin-requests')).toBe(true);
  });
});
