// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import type { ExperienceManifestPortal } from '../../../../shared/api/contracts/platform/experienceManifest';

import {
  appendDesignerPreviewReloadParam,
  buildDesignerRuntimePreviewUrls,
  readDesignerPreviewSession,
  resolveDesignerOutlinePreviewNewTabUrl,
  resolvePreviewCultureId,
  stashDesignerPreviewSession,
} from '../designerPreviewSession';

import { defaultComponentAlonePortal } from '../../../../shared/api/contracts/platform/experienceManifest';

import { COMPONENT_ALONE_PORTAL_SEGMENT } from '../../../../shared/api/contracts/platform/mountConstants';

const previewSessionDocument = {
  schemaVersion: '1',
  id: 'doc-1',
  name: 'Test',
  rootNodeId: 'root',
  nodes: {},
  metadata: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  diagnostics: [],
};

const studioPortal: ExperienceManifestPortal = {
  segment: 'studio',
  name: 'Studio',
  shellKey: 'admin',
  enabled: true,
  pages: [
    { path: 'welcome/', pageKey: 'welcome-page', loaderRef: 'designer:welcome-page' },
  ],
};

describe('buildDesignerRuntimePreviewUrls', () => {
  const previewPortals = [defaultComponentAlonePortal(), studioPortal];

  it('defaults to component-alone canonical URL with folder path', () => {
    const result = buildDesignerRuntimePreviewUrls({
      cultureId: 'ir',
      portalSegment: '',
      pageKey: 'general/my-component',
      portalOptions: previewPortals,
    });

    const expectedCanonicalPath = '/ir/component-alone/general/my-component';

    expect(result.displayPath).toBe(expectedCanonicalPath);
    expect(result.iframePath).toBe(expectedCanonicalPath);
    expect(result.error).toBeUndefined();
  });

  it('builds canonical display URL and matching iframe URL with portal shell', () => {
    const result = buildDesignerRuntimePreviewUrls({
      cultureId: '',
      portalSegment: 'studio',
      pageKey: 'general/welcome-page',
      portalOptions: previewPortals,
    });

    const expectedCanonicalPath = `/${resolvePreviewCultureId('')}/studio/welcome`;

    expect(result.displayPath).toBe(expectedCanonicalPath);
    expect(result.iframePath).toBe(expectedCanonicalPath);
    expect(result.error).toBeUndefined();
  });

  it('falls back to auto-propagated studio route for display URL', () => {
    const result = buildDesignerRuntimePreviewUrls({
      cultureId: 'us',
      portalSegment: 'studio',
      pageKey: 'erfan/my-widget',
      portalOptions: previewPortals,
    });

    const expectedCanonicalPath = '/us/studio/erfan/my-widget';

    expect(result.displayPath).toBe(expectedCanonicalPath);
    expect(result.iframePath).toBe(expectedCanonicalPath);
  });

  it('still renders isolated preview when page is missing from non-studio portal', () => {
    const result = buildDesignerRuntimePreviewUrls({
      cultureId: 'us',
      portalSegment: 'partner',
      pageKey: 'general/my-widget',
      portalOptions: [
        defaultComponentAlonePortal(),
        {
          segment: 'partner',
          name: 'Partner',
          shellKey: 'partner-shell',
          enabled: true,
          pages: [],
        },
      ],
    });

    const expectedFallbackPath = '/studio/component-preview?component=general%2Fmy-widget&culture=us&portal=partner&embedded=1';

    expect(result.displayPath).toBe(expectedFallbackPath);
    expect(result.iframePath).toBe(expectedFallbackPath);
    expect(result.error).toContain('Partner');
  });

  it('uses canonical component-alone URL for iframe and display', () => {
    const result = buildDesignerRuntimePreviewUrls({
      cultureId: 'us',
      portalSegment: COMPONENT_ALONE_PORTAL_SEGMENT,
      pageKey: 'general/my-widget',
      portalOptions: previewPortals,
    });

    const expectedCanonicalPath = '/us/component-alone/general/my-widget';

    expect(result.displayPath).toBe(expectedCanonicalPath);
    expect(result.iframePath).toBe(expectedCanonicalPath);
    expect(result.error).toBeUndefined();
  });
});

describe('buildDesignerRuntimePreviewUrls legacy iframe path', () => {
  it('returns iframe path for legacy callers', () => {
    const result = buildDesignerRuntimePreviewUrls({
      cultureId: 'ir',
      portalSegment: 'studio',
      pageKey: 'general/my-widget',
      portalOptions: [defaultComponentAlonePortal(), studioPortal],
    });

    expect(result.iframePath).toBe('/ir/studio/general/my-widget');
  });
});

describe('designer preview session storage', () => {
  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('reads session payload from localStorage for new-tab preview', () => {
    const sessionId = stashDesignerPreviewSession({
      document: previewSessionDocument,
      bindingDefinitions: {},
      previewResults: {},
      createdAt: new Date().toISOString(),
    });

    window.sessionStorage.clear();

    expect(readDesignerPreviewSession(sessionId)?.document.name).toBe('Test');
  });
});

describe('resolveDesignerOutlinePreviewNewTabUrl', () => {
  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('removes embedded flag and refreshes session ttl for session previews', () => {
    const sessionId = stashDesignerPreviewSession({
      document: previewSessionDocument,
      bindingDefinitions: {},
      previewResults: {},
      createdAt: new Date().toISOString(),
    });

    const nextPath = resolveDesignerOutlinePreviewNewTabUrl(
      `/studio/component-preview?session=${sessionId}&culture=us&portal=component-alone&embedded=1`,
    );

    expect(nextPath).toBe(`/studio/component-preview?session=${sessionId}&culture=us&portal=component-alone`);
    expect(readDesignerPreviewSession(sessionId)).not.toBeNull();
  });
});

describe('appendDesignerPreviewReloadParam', () => {
  it('adds reload token to preview URLs', () => {
    expect(
      appendDesignerPreviewReloadParam(
        `/studio/component-preview?component=general%2Fa&culture=us&portal=${COMPONENT_ALONE_PORTAL_SEGMENT}`,
        42,
      ),
    ).toBe(`/studio/component-preview?component=general%2Fa&culture=us&portal=${COMPONENT_ALONE_PORTAL_SEGMENT}&_reload=42`);
  });

  it('adds reload token to canonical experience URLs', () => {
    expect(
      appendDesignerPreviewReloadParam('/us/component-alone/general/a', 42),
    ).toBe('/us/component-alone/general/a?_reload=42');
  });
});
