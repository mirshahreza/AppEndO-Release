import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PORTAL_ABOUT_BODY,
  DEFAULT_PORTAL_ABOUT_TITLE,
  DEFAULT_PORTAL_LOGO_URL,
  DEFAULT_PORTAL_TITLE,
  isAllowedPortalBrandLogoUrl,
  normalizePortalBrand,
  parsePortalBrandField,
  portalBrandHasCustomAbout,
  resolvePortalBrand,
  withPortalBrandDefaults,
} from '../portalBrand';
import { defaultHomePortal, defaultStudioPortal, defaultComponentAlonePortal, validateExperienceManifest } from '../experienceManifest';

describe('portal brand contract', () => {
  it('accepts a workspace portal logo path and the built-in AppEnd logo', () => {
    expect(isAllowedPortalBrandLogoUrl('/assets/workspace/portals/shop/logo.png')).toBe(true);
    expect(isAllowedPortalBrandLogoUrl('/assets/hawiety/mark-blue.png')).toBe(true);
    expect(isAllowedPortalBrandLogoUrl('/assets/hawiety/institutes/gov.png')).toBe(true);
    expect(isAllowedPortalBrandLogoUrl('/api/hwy/institutes/100/logo')).toBe(true);
    expect(isAllowedPortalBrandLogoUrl(DEFAULT_PORTAL_LOGO_URL)).toBe(true);
    expect(isAllowedPortalBrandLogoUrl('https://evil.example/logo.png')).toBe(false);
    expect(isAllowedPortalBrandLogoUrl('/assets/workspace/../secret.png')).toBe(false);
  });

  it('normalizes empty brand objects to null', () => {
    expect(normalizePortalBrand({ title: '  ' })).toBeNull();
    expect(normalizePortalBrand({
      logoUrl: '/assets/workspace/portals/shop/logo.png',
      title: ' Shop ',
    })).toEqual({
      logoUrl: '/assets/workspace/portals/shop/logo.png',
      title: 'Shop',
      windowTitle: null,
      aboutTitle: null,
      aboutBody: null,
    });
  });

  it('rejects invalid brand payloads', () => {
    expect(parsePortalBrandField('nope').ok).toBe(false);
    expect(parsePortalBrandField({ logoUrl: '/elsewhere.png' }).ok).toBe(false);
    expect(parsePortalBrandField({ title: 'Shop' }).ok).toBe(true);
    expect(parsePortalBrandField({ logoUrl: DEFAULT_PORTAL_LOGO_URL }).ok).toBe(true);
  });

  it('resolves empty identity to the built-in AppEnd defaults', () => {
    const empty = resolvePortalBrand(null, 'Studio');
    expect(empty.title).toBe(DEFAULT_PORTAL_TITLE);
    expect(empty.logoUrl).toBe(DEFAULT_PORTAL_LOGO_URL);
    expect(empty.aboutTitle).toBe(DEFAULT_PORTAL_ABOUT_TITLE);
    expect(empty.aboutBody).toBe(DEFAULT_PORTAL_ABOUT_BODY);
    expect(empty.hasCustomBrand).toBe(false);
    expect(portalBrandHasCustomAbout(empty)).toBe(false);

    const resolved = resolvePortalBrand({ aboutBody: 'Hello' }, 'Shop');
    expect(resolved.title).toBe(DEFAULT_PORTAL_TITLE);
    expect(resolved.aboutTitle).toBe(DEFAULT_PORTAL_ABOUT_TITLE);
    expect(resolved.aboutBody).toBe('Hello');
    expect(resolved.hasCustomBrand).toBe(true);
    expect(portalBrandHasCustomAbout(resolved)).toBe(true);
  });

  it('fills missing logo and title on the identity form', () => {
    expect(withPortalBrandDefaults(null)).toEqual({
      logoUrl: DEFAULT_PORTAL_LOGO_URL,
      title: DEFAULT_PORTAL_TITLE,
      aboutTitle: DEFAULT_PORTAL_ABOUT_TITLE,
      aboutBody: DEFAULT_PORTAL_ABOUT_BODY,
    });
    expect(withPortalBrandDefaults({ title: 'Harbor' }).title).toBe('Harbor');
    expect(withPortalBrandDefaults({ title: 'Harbor' }).logoUrl).toBe(DEFAULT_PORTAL_LOGO_URL);
  });

  it('round-trips brand through experience manifest validation', () => {
    const result = validateExperienceManifest({
      id: 'admin',
      cultureId: 'us',
      portals: [
        defaultHomePortal(),
        {
          ...defaultStudioPortal(),
          brand: {
            title: 'Studio',
            aboutTitle: 'About Studio',
            aboutBody: 'Operator workspace',
          },
        },
        defaultComponentAlonePortal(),
      ],
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      const studio = result.manifest.portals.find((portal) => portal.segment === 'studio');
      expect(studio?.brand?.title).toBe('Studio');
      expect(studio?.brand?.aboutBody).toBe('Operator workspace');
    }
  });

  it('seeds Studio with the built-in identity', () => {
    expect(defaultStudioPortal().brand?.logoUrl).toBe(DEFAULT_PORTAL_LOGO_URL);
    expect(defaultStudioPortal().brand?.title).toBe(DEFAULT_PORTAL_TITLE);
    expect(defaultStudioPortal().brand?.aboutTitle).toBe(DEFAULT_PORTAL_ABOUT_TITLE);
    expect(defaultStudioPortal().brand?.aboutBody).toBe(DEFAULT_PORTAL_ABOUT_BODY);
  });
});
