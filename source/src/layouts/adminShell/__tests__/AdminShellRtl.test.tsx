// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AdminLayout } from '../../AdminLayout';
import { CultureProvider } from '../../../app/platform/CultureContext';
import { PlatformMountProvider } from '../../../app/platform/PlatformMountContext';
import { usePlatformConfig } from '../../../app/platform/PlatformConfigProvider';
import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentUserDisplay } from '../../../hooks/useCurrentUserDisplay';
import { loadPlatformRegistryDefaultMount } from '../../../core/platform-registry/loadPlatformRegistryDefaults';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import { ADMIN_SHELL_SIDEBAR_CLASS } from '../../../shared/ui/surfaceClasses';

vi.mock('../../../app/platform/PlatformConfigProvider', () => ({
  usePlatformConfig: vi.fn(),
  useOptionalPlatformConfig: vi.fn(() => null),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../contexts/useHomeShortcutFallback', () => ({
  useHomeShortcutFallback: () => undefined,
}));

vi.mock('../../../hooks/useCurrentUserDisplay', () => ({
  useCurrentUserDisplay: vi.fn(),
}));

vi.mock('../../../shared/lib/aiPageContextStore', () => ({
  useAiPageContextEnrichment: () => null,
}));

vi.mock('../../../components/AppEndooPanel', () => ({
  AppEndooPanel: () => null,
}));

vi.mock('../../../shared/ui/shell/ShellAppEndooControl', () => ({
  ShellAppEndooControl: () => null,
}));

vi.mock('../../../features/feedback/components/FeedbackSubmitDialog', () => ({
  FeedbackEntryButton: () => null,
}));

vi.mock('../../../features/feedback/components/FeedbackShellFab', () => ({
  FeedbackShellFab: () => null,
}));

vi.mock('../../../components/ProfileDrawer', () => ({
  ProfileDrawer: () => null,
}));

vi.mock('../../../components/AccentColorPicker', () => ({
  AccentColorPicker: () => null,
}));

vi.mock('../../../components/AboutAppModal', () => ({
  AboutAppModal: () => null,
}));

vi.mock('../../../core/packages/PackageSlotRegistryHost', () => ({
  PackageSlotRegistryHost: () => null,
}));

vi.mock('../../../shared/api/queries/component-designer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/api/queries/component-designer')>();
  return {
    ...actual,
    loadDesignerShellDraft: vi.fn(async () => ({
      document: {
        schemaVersion: '1',
        id: 'rtl-shell-draft',
        name: 'App Shell',
        rootNodeId: 'root',
        nodes: {
          root: {
            id: 'root',
            type: 'container',
            order: 0,
            props: {},
            layout: {},
            binding: {},
            children: [],
          },
        },
        metadata: {
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          shellLayoutWidth: 'fluid',
          shellLayoutWidthUserControl: false,
        },
        diagnostics: [],
      },
      bindingDefinitions: {},
    })),
  };
});

describe('Admin shell RTL layout', () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('dir');
    bootstrapCultureRegistry(['us', 'ir', 'iq']);
  });

  it('sets dir=rtl on shell root for ir culture', async () => {
    bootstrapCultureRegistry(['us', 'ir', 'iq']);
    const studioMount = loadPlatformRegistryDefaultMount('studio');
    if (!studioMount) {
      throw new Error('studio mount seed is required');
    }

    vi.mocked(usePlatformConfig).mockReturnValue({
      config: {
        version: 'rtl-test',
        mounts: [studioMount],
        shells: [],
        shellRules: [],
        pageModules: [],
        bindings: [],
      },
      version: 'rtl-test',
    } as ReturnType<typeof usePlatformConfig>);

    vi.mocked(useAuth).mockReturnValue({
      currentUser: { roles: ['ADMIN'] },
      logout: vi.fn(),
    } as ReturnType<typeof useAuth>);

    vi.mocked(useCurrentUserDisplay).mockReturnValue({
      displayName: 'Admin',
      avatarXs: null,
      avatarInitial: 'A',
      primaryRole: 'Administrator',
    } as ReturnType<typeof useCurrentUserDisplay>);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/ir/studio']}>
          <PlatformMountProvider mount={{ ...studioMount, cultureId: 'ir' }}>
            <CultureProvider cultureId="ir">
              <AdminLayout />
            </CultureProvider>
          </PlatformMountProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const shellRoot = container.querySelector('[data-admin-shell-root]') as HTMLElement;
    expect(shellRoot?.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');

    const sidebar = container.querySelector('#admin-shell-sidebar');
    expect(sidebar).toBeTruthy();
    expect(sidebar?.className).not.toContain('border-e');
    expect(ADMIN_SHELL_SIDEBAR_CLASS).not.toContain('border-e');
  });

  it('renders the admin shell when PlatformMountProvider is missing', () => {
    bootstrapCultureRegistry(['us', 'ir', 'iq']);
    const studioMount = loadPlatformRegistryDefaultMount('studio');
    if (!studioMount) {
      throw new Error('studio mount seed is required');
    }

    vi.mocked(usePlatformConfig).mockReturnValue({
      config: {
        version: 'rtl-test',
        mounts: [studioMount],
        shells: [],
        shellRules: [],
        pageModules: [],
        bindings: [],
      },
      version: 'rtl-test',
    } as ReturnType<typeof usePlatformConfig>);

    vi.mocked(useAuth).mockReturnValue({
      currentUser: { roles: ['ADMIN'] },
      logout: vi.fn(),
    } as ReturnType<typeof useAuth>);

    vi.mocked(useCurrentUserDisplay).mockReturnValue({
      displayName: 'Admin',
      avatarXs: null,
      avatarInitial: 'A',
      primaryRole: 'Administrator',
    } as ReturnType<typeof useCurrentUserDisplay>);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    expect(() => render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/us/studio']}>
          <CultureProvider cultureId="us">
            <AdminLayout />
          </CultureProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )).not.toThrow();
  });
});
