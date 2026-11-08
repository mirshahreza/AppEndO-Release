import { describe, expect, it } from 'vitest';
import type { PlatformRuntimeConfig } from '../../../../shared/api/contracts/platform/types';
import type { DesignerVersionSummary } from '../../../../shared/api/queries/component-designer';
import {
  defaultHomePortal,
  defaultStudioPortal,
  type ExperienceManifestPortal,
} from '../../../../shared/api/contracts/platform/experienceManifest';
import { SHELL_DRAFT_FOLDER } from '../../../../shared/lib/designerShellEntry';
import {
  buildNavigationComponentOptions,
  buildNavigationComponentOptionsFromDesignerDrafts,
  buildNavigationPortalOptionsFromExperienceManifest,
  formatNavigationComponentLabel,
  isNavigationRedirectPortal,
  resolveDesignerDraftPageKey,
  resolveNavigationPortalKind,
  navigationSelectValueToNullable,
  NAVIGATION_DEFAULT_OPTION_VALUE,
} from '../useNavigationEditorOptions';

const runtimeConfig = {
  pageModules: [
    {
      pageKey: 'dashboard',
      title: 'Dashboard',
      loaderKind: 'core',
      loaderRef: 'core:Dashboard',
      enabled: true,
    },
    {
      pageKey: 'platform-navigations',
      title: 'Navigations',
      loaderKind: 'core',
      loaderRef: 'core:PlatformNavigations',
      enabled: true,
    },
  ],
} as PlatformRuntimeConfig;

describe('navigationSelectValueToNullable', () => {
  it('maps the default sentinel and empty values to null', () => {
    expect(navigationSelectValueToNullable(NAVIGATION_DEFAULT_OPTION_VALUE)).toBeNull();
    expect(navigationSelectValueToNullable('')).toBeNull();
    expect(navigationSelectValueToNullable('studio')).toBe('studio');
  });
});

describe('resolveDesignerDraftPageKey', () => {
  it('maps built-in layout preset drafts to their draft id', () => {
    expect(resolveDesignerDraftPageKey({
      id: 'builtin-contact-form',
      name: 'contact-form',
      folder: 'forms',
      isBuiltIn: true,
    })).toBe('builtin-contact-form');
  });

  it('maps custom designer drafts to their component path', () => {
    expect(resolveDesignerDraftPageKey({
      id: 'draft-reports',
      name: 'Reports',
      folder: 'analytics',
      isBuiltIn: false,
    })).toBe('analytics/reports');
  });
});

describe('buildNavigationComponentOptionsFromDesignerDrafts', () => {
  it('excludes portal shell layouts and prioritizes custom entries in merged options', () => {
    const drafts: DesignerVersionSummary[] = [
      {
        id: 'builtin-contact-form',
        name: 'contact-form',
        folder: 'forms',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isBuiltIn: true,
      },
      {
        id: 'my-page',
        name: 'My Page',
        folder: 'general',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
        isBuiltIn: false,
      },
      {
        id: 'portal-layout-1',
        name: 'admin-layout',
        folder: SHELL_DRAFT_FOLDER,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
        isBuiltIn: false,
      },
    ];

    const options = buildNavigationComponentOptionsFromDesignerDrafts(drafts);
    expect(options).toHaveLength(2);
    expect(options.map((option) => option.pageKey).sort()).toEqual(['builtin-contact-form', 'general/my-page']);
    expect(options.find((option) => option.pageKey === 'general/my-page')?.kind).toBe('custom');
    expect(options.find((option) => option.pageKey === 'builtin-contact-form')?.kind).toBe('built-in');
  });
});

describe('buildNavigationComponentOptions', () => {
  it('lists custom designer components first, then built-in, then uncovered core pages', () => {
    const drafts: DesignerVersionSummary[] = [
      {
        id: 'builtin-contact-form',
        name: 'contact-form',
        folder: 'forms',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isBuiltIn: true,
      },
      {
        id: 'reports',
        name: 'Reports',
        folder: 'analytics',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
        isBuiltIn: false,
      },
    ];

    const options = buildNavigationComponentOptions(runtimeConfig, drafts);
    expect(options.map((option) => option.pageKey)).toEqual([
      'analytics/reports',
      'builtin-contact-form',
      'dashboard',
      'platform-navigations',
    ]);
    expect(options[0]?.kind).toBe('custom');
    expect(options[1]?.kind).toBe('built-in');
    expect(options[2]?.kind).toBe('core');
    expect(options[3]?.kind).toBe('core');
  });
});

describe('buildNavigationPortalOptionsFromExperienceManifest', () => {
  it('lists layout portals from the experience manifest and excludes redirect portals', () => {
    const portals: ExperienceManifestPortal[] = [
      defaultHomePortal(),
      defaultStudioPortal(),
      {
        segment: 'partner',
        name: 'Partner',
        shellKey: 'partner-shell',
        entryMode: 'shell',
        enabled: true,
        pages: [],
      },
    ];

    const options = buildNavigationPortalOptionsFromExperienceManifest(portals);

    expect(options).toEqual([
      { value: 'partner', label: 'Partner', kind: 'layout' },
      { value: 'studio', label: 'Studio', kind: 'layout' },
    ]);
    expect(isNavigationRedirectPortal('home', options)).toBe(false);
    expect(isNavigationRedirectPortal('studio', options)).toBe(false);
    expect(isNavigationRedirectPortal(null, options)).toBe(false);
  });
});

describe('formatNavigationComponentLabel', () => {
  it('resolves designer component paths to title and loader path', () => {
    const options = buildNavigationComponentOptionsFromDesignerDrafts([
      {
        id: 'draft-reports',
        name: 'Reports',
        folder: 'analytics',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
        isBuiltIn: false,
      },
    ]);

    expect(formatNavigationComponentLabel('analytics/reports', options)).toBe(
      'Reports (analytics/reports)',
    );
    expect(formatNavigationComponentLabel('draft-reports', options, options.length ? [
      {
        id: 'draft-reports',
        name: 'Reports',
        folder: 'analytics',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
        isBuiltIn: false,
      },
    ] : [])).toBe(
      'Reports (analytics/reports)',
    );
    expect(formatNavigationComponentLabel('missing-draft', options)).toBe('missing-draft');
    expect(formatNavigationComponentLabel(null, options)).toBe('Not selected');
  });
});

describe('resolveNavigationPortalKind', () => {
  it('requires redirect targets before classifying a portal as redirect', () => {
    expect(resolveNavigationPortalKind({
      shellKey: 'home',
      name: 'Home',
      entry: '',
      surface: 'admin',
      enabled: true,
      entryMode: 'redirect',
      redirectToSegment: 'studio',
      redirectToCulture: 'us',
    })).toBe('redirect');

    expect(resolveNavigationPortalKind({
      shellKey: 'studio',
      name: 'Studio',
      entry: 'studio',
      surface: 'admin',
      enabled: true,
      entryMode: 'shell',
    })).toBe('layout');
  });
});
