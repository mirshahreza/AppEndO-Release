import { describe, expect, it } from 'vitest';
import type { ExperienceManifestPortal } from '../../../../shared/api/contracts/platform/experienceManifest';
import {
  COMPONENT_ALONE_PORTAL_SEGMENT,
  COMPONENT_ALONE_SHELL_LAYOUT_KEY,
  defaultComponentAlonePreviewPortal,
  mergePreviewPortalOptions,
  resolvePreviewPortalShellKey,
  shouldFrameDesignerCanvas,
} from '../designerPreviewPortal';
import { createInitialDesignerState } from '../../../../domain/component-designer/state';
import { defaultComponentAlonePortal } from '../../../../shared/api/contracts/platform/experienceManifest';

describe('designerPreviewPortal', () => {
  it('prepends component-alone when missing from preview portal options', () => {
    const studioPortal: ExperienceManifestPortal = {
      segment: 'studio',
      name: 'Studio',
      shellKey: 'studio',
      entryMode: 'shell',
      enabled: true,
      pages: [],
    };

    const options = mergePreviewPortalOptions([studioPortal]);
    expect(options[0]).toEqual(defaultComponentAlonePreviewPortal());
    expect(options[1]).toEqual(studioPortal);
  });

  it('keeps manifest order when component-alone is already present', () => {
    const studioPortal: ExperienceManifestPortal = {
      segment: 'studio',
      name: 'Studio',
      shellKey: 'studio',
      entryMode: 'shell',
      enabled: true,
      pages: [],
    };

    const options = mergePreviewPortalOptions([defaultComponentAlonePortal(), studioPortal]);
    expect(options).toEqual([defaultComponentAlonePortal(), studioPortal]);
  });

  it('resolves component-alone shell layout key', () => {
    expect(resolvePreviewPortalShellKey(
      COMPONENT_ALONE_PORTAL_SEGMENT,
      [defaultComponentAlonePreviewPortal()],
    )).toBe(COMPONENT_ALONE_SHELL_LAYOUT_KEY);
  });

  it('frames page components in studio shell but not shell-layout drafts', () => {
    const document = createInitialDesignerState().document;

    expect(shouldFrameDesignerCanvas({
      document,
      componentFolder: 'users',
      portalShellKey: 'studio',
    })).toBe(true);

    expect(shouldFrameDesignerCanvas({
      document,
      componentFolder: 'portal-layouts',
      portalShellKey: 'studio',
    })).toBe(false);

    expect(shouldFrameDesignerCanvas({
      document,
      componentFolder: 'users',
      portalShellKey: COMPONENT_ALONE_SHELL_LAYOUT_KEY,
    })).toBe(false);
  });
});
