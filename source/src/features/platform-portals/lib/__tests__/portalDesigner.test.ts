import { describe, expect, it } from 'vitest';
import type { DesignerVersionSummary } from '../../../../shared/api/queries/component-designer';
import {
  buildPortalLayoutDesignerPath,
  buildCanonicalPortalLayoutDesignerPath,
  buildCanonicalPortalLayoutDesignerHref,
  buildLayoutPickerItems,
  formatPortalLayoutComponentPath,
  formatPortalLayoutDisplay,
  canOpenPortalLayoutInDesigner,
  isLayoutPickerShellDraft,
  resolveLayoutDesignerDraftId,
  resolvePortalLayoutDesignerKey,
  toLayoutPickerKey,
} from '../portalDesigner';
import { defaultComponentAlonePortal, defaultSitePortal, defaultStudioPortal } from '../../../../shared/api/contracts/platform/experienceManifest';
import {
  BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY,
  BUILT_IN_SITE_SHELL_ENTRY,
  BUILT_IN_STUDIO_SHELL_ENTRY,
  SITE_PORTAL_SEGMENT,
  SITE_SHELL_LAYOUT_KEY,
  STUDIO_PORTAL_SEGMENT,
  HOME_SHELL_KEY,
  LEGACY_CORE_SITE_SHELL_ENTRY,
} from '../../../../shared/api/contracts/platform/mountConstants';

const drafts: DesignerVersionSummary[] = [
  {
    id: 'draft-admin-layout',
    name: 'admin',
    folder: 'portal-layouts',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    updatedBy: 'admin',
    isBuiltIn: false,
  },
];

describe('portalDesigner helpers', () => {
  it('resolves layout drafts by folder and name', () => {
    expect(resolveLayoutDesignerDraftId(drafts, 'admin')).toBe('draft-admin-layout');
    expect(resolveLayoutDesignerDraftId(drafts, 'missing')).toBeNull();
  });

  it('builds component designer navigation paths under a portal base', () => {
    expect(buildPortalLayoutDesignerPath('/us/studio', 'admin'))
      .toBe('/us/studio/client-components/edit/admin');
  });

  it('builds canonical culture-aware layout designer paths', () => {
    expect(buildCanonicalPortalLayoutDesignerPath('us', 'my-portal'))
      .toBe('/us/studio/client-components/edit/my-portal');
    expect(buildCanonicalPortalLayoutDesignerPath('ir', 'my-portal'))
      .toBe('/ir/studio/client-components/edit/my-portal');
    expect(buildCanonicalPortalLayoutDesignerPath('us', 'admin', 'draft-admin-layout'))
      .toBe('/us/studio/client-components?load=draft-admin-layout');
  });

  it('builds portal layout designer hrefs from manifest rows and drafts', () => {
    expect(buildCanonicalPortalLayoutDesignerHref('us', {
      segment: 'my-portal',
      shellKey: 'admin',
    }, drafts)).toBe('/us/studio/client-components?load=draft-admin-layout');

    expect(buildCanonicalPortalLayoutDesignerHref('us', {
      segment: 'my-portal',
      shellKey: 'missing',
    }, drafts)).toBe('/us/studio/client-components/edit/missing');
  });

  it('resolves designer layout keys from stored shell references', () => {
    expect(resolvePortalLayoutDesignerKey({
      segment: 'my-portal',
      shellKey: 'designer:portal-layouts/admin',
    })).toBe('admin');
    expect(resolvePortalLayoutDesignerKey({
      segment: 'my-portal',
      shellKey: 'portal-layouts/admin',
    })).toBe('admin');
    expect(resolvePortalLayoutDesignerKey({
      segment: 'my-portal',
      shellKey: '',
    })).toBe('my-portal');
  });

  it('formats built-in portal layout entries for display', () => {
    expect(formatPortalLayoutDisplay(defaultStudioPortal())).toBe(BUILT_IN_STUDIO_SHELL_ENTRY);
    expect(formatPortalLayoutDisplay(defaultComponentAlonePortal())).toBe(BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY);
    expect(formatPortalLayoutDisplay(defaultSitePortal())).toBe(SITE_SHELL_LAYOUT_KEY);
    expect(formatPortalLayoutDisplay({
      segment: 'home',
      shellKey: BUILT_IN_SITE_SHELL_ENTRY,
      entryMode: 'shell',
    })).toBe(SITE_SHELL_LAYOUT_KEY);
  });

  it('does not open core shells in the layout designer', () => {
    expect(canOpenPortalLayoutInDesigner(defaultStudioPortal())).toBe(false);
    expect(canOpenPortalLayoutInDesigner(defaultComponentAlonePortal())).toBe(false);
    expect(canOpenPortalLayoutInDesigner(defaultSitePortal())).toBe(true);
    expect(canOpenPortalLayoutInDesigner({
      segment: 'public-app',
      shellKey: BUILT_IN_SITE_SHELL_ENTRY,
      entryMode: 'shell',
    })).toBe(true);
    expect(canOpenPortalLayoutInDesigner({
      segment: 'public-app',
      shellKey: SITE_PORTAL_SEGMENT,
      entryMode: 'shell',
    })).toBe(true);
    expect(canOpenPortalLayoutInDesigner({
      segment: 'admin-app',
      shellKey: BUILT_IN_STUDIO_SHELL_ENTRY,
      entryMode: 'shell',
    })).toBe(false);
    expect(canOpenPortalLayoutInDesigner({
      segment: 'my-portal',
      shellKey: 'my-portal',
      entryMode: 'shell',
    })).toBe(true);
    expect(canOpenPortalLayoutInDesigner({
      segment: 'home',
      shellKey: HOME_SHELL_KEY,
      entryMode: 'redirect',
      redirectToSegment: 'studio',
      redirectToCulture: 'us',
    })).toBe(false);
  });

  it('formats layout component paths for display', () => {
    expect(formatPortalLayoutComponentPath('admin')).toBe('admin');
    expect(formatPortalLayoutComponentPath('site')).toBe(SITE_SHELL_LAYOUT_KEY);
    expect(formatPortalLayoutComponentPath('home-shell')).toBe(SITE_SHELL_LAYOUT_KEY);
    expect(formatPortalLayoutComponentPath(SITE_SHELL_LAYOUT_KEY)).toBe(SITE_SHELL_LAYOUT_KEY);
    expect(formatPortalLayoutComponentPath('studio')).toBe(BUILT_IN_STUDIO_SHELL_ENTRY);
    expect(formatPortalLayoutComponentPath(BUILT_IN_STUDIO_SHELL_ENTRY)).toBe(BUILT_IN_STUDIO_SHELL_ENTRY);
    expect(formatPortalLayoutComponentPath('')).toBe('');
  });

  it('maps SiteLayout keys onto the designer site-shell picker value', () => {
    expect(toLayoutPickerKey(LEGACY_CORE_SITE_SHELL_ENTRY)).toBe(SITE_SHELL_LAYOUT_KEY);
    expect(toLayoutPickerKey('home-shell')).toBe(SITE_SHELL_LAYOUT_KEY);
    expect(toLayoutPickerKey('site')).toBe(SITE_SHELL_LAYOUT_KEY);
    expect(toLayoutPickerKey('core:AdminLayout')).toBe(STUDIO_PORTAL_SEGMENT);
    expect(toLayoutPickerKey('landing')).toBe('landing');
    expect(toLayoutPickerKey('')).toBe('');
  });

  it('accepts shell-named and shell-tagged drafts for the layout picker', () => {
    expect(isLayoutPickerShellDraft({
      name: 'app-shell',
      folder: 'general',
      isBuiltIn: true,
    })).toBe(true);
    expect(isLayoutPickerShellDraft({
      name: 'company-shell',
      folder: 'general',
    })).toBe(true);
    expect(isLayoutPickerShellDraft({
      name: 'landing',
      folder: 'general',
      tags: ['shell'],
    })).toBe(true);
    expect(isLayoutPickerShellDraft({
      name: 'admin',
      folder: 'portal-layouts',
    })).toBe(false);
    expect(isLayoutPickerShellDraft({
      name: 'cms-contents-list',
      folder: 'general',
      isPackageComponent: true,
    })).toBe(false);
    expect(isLayoutPickerShellDraft({
      name: 'blog-list',
      folder: 'templates',
      isBuiltIn: true,
    })).toBe(false);
  });

  it('builds layout picker items from shell drafts plus core layouts', () => {
    expect(buildLayoutPickerItems(drafts).map((item) => item.layoutKey)).toEqual([
      STUDIO_PORTAL_SEGMENT,
      SITE_SHELL_LAYOUT_KEY,
    ]);
    expect(buildLayoutPickerItems([
      ...drafts,
      {
        id: 'draft-page',
        name: 'dashboard',
        folder: 'pages',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'package-cms-contents-list',
        name: 'cms-contents-list',
        folder: 'general',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isPackageComponent: true,
      },
    ]).map((item) => item.layoutKey)).toEqual([
      STUDIO_PORTAL_SEGMENT,
      SITE_SHELL_LAYOUT_KEY,
    ]);
    expect(buildLayoutPickerItems([
      ...drafts,
      {
        id: 'builtin-blog-list',
        name: 'blog-list',
        folder: 'templates',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isBuiltIn: true,
      },
      {
        id: 'builtin-app-shell',
        name: 'app-shell',
        folder: 'general',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isBuiltIn: true,
      },
      {
        id: 'draft-landing',
        name: 'landing',
        folder: 'general',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        tags: ['shell'],
      },
    ]).map((item) => item.componentPath)).toEqual([
      BUILT_IN_STUDIO_SHELL_ENTRY,
      SITE_SHELL_LAYOUT_KEY,
      'app-shell',
      'landing',
    ]);
  });

  it('does not keep home-shell as a separate picker row', () => {
    expect(buildLayoutPickerItems(drafts, 'home-shell')).toEqual([
      {
        id: STUDIO_PORTAL_SEGMENT,
        layoutKey: STUDIO_PORTAL_SEGMENT,
        componentPath: BUILT_IN_STUDIO_SHELL_ENTRY,
      },
      {
        id: SITE_SHELL_LAYOUT_KEY,
        layoutKey: SITE_SHELL_LAYOUT_KEY,
        componentPath: SITE_SHELL_LAYOUT_KEY,
      },
    ]);
  });

  it('includes the built-in AdminLayout and site-shell when no drafts exist', () => {
    expect(buildLayoutPickerItems([])).toEqual([
      {
        id: STUDIO_PORTAL_SEGMENT,
        layoutKey: STUDIO_PORTAL_SEGMENT,
        componentPath: BUILT_IN_STUDIO_SHELL_ENTRY,
      },
      {
        id: SITE_SHELL_LAYOUT_KEY,
        layoutKey: SITE_SHELL_LAYOUT_KEY,
        componentPath: SITE_SHELL_LAYOUT_KEY,
      },
    ]);
  });
});
