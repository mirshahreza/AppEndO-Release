import { describe, expect, it } from 'vitest';
import { buildHawietyVerticalAppPackageSpec } from '../../../../core/packages/hawietyPackagePackRecipe';
import { buildVerticalAppManifest } from '../../../../core/packages/testkit/verticalAppPackageBuilder';
import {
  buildRegistryFromManifest,
  verticalAppPagesAsUiRoutes,
} from '../registryBuilder';

describe('registryBuilder vertical-app pages', () => {
  it('maps capabilities.pages into object-registry uiRoutes', () => {
    const manifest = buildVerticalAppManifest(buildHawietyVerticalAppPackageSpec());
    const uiRoutes = verticalAppPagesAsUiRoutes(manifest);
    expect(uiRoutes.length).toBeGreaterThan(0);
    expect(uiRoutes.some((route) => route.pageKey === 'hwy-geo-responsibility')).toBe(true);
    expect(uiRoutes.find((route) => route.pageKey === 'hwy-geo-responsibility')?.entry).toMatch(
      /ui\/pages\/hwy_geo_responsibility/,
    );

    const registry = buildRegistryFromManifest('hawiety', manifest, '0.2.0', 'default');
    expect(registry.records.uiRoutes).toHaveLength(uiRoutes.length);
    expect(registry.records.uiRoutes.some((route) => route.pageKey === 'hwy-targhin-requests')).toBe(true);
  });
});
