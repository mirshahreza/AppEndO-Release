import { describe, expect, it } from 'vitest';
import type { ExperienceManifestPortal } from '../../../../shared/api/contracts/platform/experienceManifest';
import { isPreviewablePortal } from '../useDesignerPreviewContext';

describe('isPreviewablePortal', () => {
  it('includes enabled shell portals', () => {
    const portal: ExperienceManifestPortal = {
      segment: 'studio',
      name: 'Studio',
      shellKey: 'studio',
      entryMode: 'shell',
      enabled: true,
      pages: [],
    };

    expect(isPreviewablePortal(portal)).toBe(true);
  });

  it('excludes redirect portals', () => {
    const portal: ExperienceManifestPortal = {
      segment: 'home',
      name: 'Home',
      shellKey: 'home-shell',
      entryMode: 'redirect',
      redirectToSegment: 'studio',
      redirectToCulture: 'us',
      enabled: true,
      pages: [],
    };

    expect(isPreviewablePortal(portal)).toBe(false);
  });

  it('excludes disabled portals', () => {
    const portal: ExperienceManifestPortal = {
      segment: 'partner',
      name: 'Partner',
      shellKey: 'partner-shell',
      entryMode: 'shell',
      enabled: false,
      pages: [],
    };

    expect(isPreviewablePortal(portal)).toBe(false);
  });
});
