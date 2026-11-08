import { beforeEach, describe, expect, it } from 'vitest';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import { loadPlatformRuntimeConfig } from '../../../server/services/platform/platformRuntimeConfig.service';
import { resolvePortalFromPathname } from '../PortalUrlResolver';
import {
  getPageModuleByKey,
  resolveRouteBindingForPortalRemainder,
} from '../platformConfigHelpers';
import { resolvePageModule } from '../resolvers';
import {
  DEFAULT_APPEARANCE_SWATCH_ID,
  parseAppearanceSwatchId,
  resolveActiveAppearanceSwatchId,
} from '../../../features/appearance/lib/appearanceRoute';

describe('appearance route integration', () => {
  beforeEach(() => {
    bootstrapCultureRegistry(['us', 'ir']);
  });

  it('resolves /us/studio/appearance to the appearance page module', async () => {
    const config = await loadPlatformRuntimeConfig();
    const portal = resolvePortalFromPathname('/us/studio/appearance', config);
    const binding = resolveRouteBindingForPortalRemainder(
      config,
      'us',
      portal.pageRemainderPath,
      portal.portalSegment,
    );
    const pageModule = binding ? getPageModuleByKey(config, binding.pageKey) : undefined;
    const resolved = pageModule ? resolvePageModule(pageModule.loaderRef) : null;

    expect(binding?.pageKey).toBe('appearance');
    expect(binding?.auth?.accessMode).toBe('authenticated');
    expect(pageModule?.loaderRef).toBe('core:Appearance');
    expect(pageModule?.defaultRoles).toBeNull();
    expect(resolved?.component).toBeTruthy();
  });

  it('tracks the active accent swatch and legacy edit paths', async () => {
    const config = await loadPlatformRuntimeConfig();
    const editPortal = resolvePortalFromPathname('/us/studio/appearance/edit/teal-core', config);

    expect(parseAppearanceSwatchId('edit/teal-core')).toBe('teal-core');
    expect(resolveActiveAppearanceSwatchId('#111111')).toBe('gray-deep');
    expect(resolveActiveAppearanceSwatchId()).toBe(DEFAULT_APPEARANCE_SWATCH_ID);

    const editBinding = resolveRouteBindingForPortalRemainder(
      config,
      'us',
      editPortal.pageRemainderPath,
      editPortal.portalSegment,
    );

    expect(editBinding?.pageKey).toBe('appearance');
  });
});
