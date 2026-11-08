/**
 * Bug found (parity audit item 85): the Designer's main Preview tab wired chrome slots via
 * `useDesignerShellRuntimeSlots`, a third independent copy that never passed
 * `extractShellHeaderConfigFromDocument` into `ShellHeaderChromeSlot`. Setting
 * `showBreadcrumb=false` on a Shell Layout header slot was honored in the published shell and
 * portal-shell preview frame, but the main Preview tab still showed the breadcrumb.
 * Fixed by consolidating all three call sites onto `buildShellRuntimeSlotsFromDocument`.
 */
// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DesignerPreviewViewport } from '../components/DesignerPreviewViewport';
import type { DesignerDocument } from '../../../domain/component-designer/types';
import { SHELL_CHROME_HEADER } from '../../../shared/lib/shellChromeSlots';
import { SHELL_ROUTE_OUTLET_SLOT_ID } from '../../../shared/lib/shellRouteOutlet';
import { COMPONENT_ALONE_SHELL_LAYOUT_KEY } from '../lib/designerPreviewPortal';

vi.mock('../../../app/platform/PlatformConfigProvider', () => {
  const value = {
    config: {
      version: 'application-host-v1',
      mounts: [],
      shells: [],
      shellRules: [],
      pageModules: [],
      bindings: [],
    },
  };
  return {
    usePlatformConfig: () => value,
    useOptionalPlatformConfig: () => value,
  };
});

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
    currentUser: { id: 1, email: 'admin@append.os', role: 'ADMIN', roles: ['ADMIN'] },
    logout: vi.fn(),
  })),
}));

vi.mock('../../../contexts/ClientContextContext', () => ({
  useClientContext: () => ({
    clientContext: {},
    patchClientContext: vi.fn(),
  }),
}));

vi.mock('../../../app/platform/PlatformMountContext', () => ({
  usePlatformMount: () => ({
    mountId: 'test-mount',
    pathPrefix: '/test-prefix',
  }),
  useOptionalPlatformMount: () => ({
    mountId: 'test-mount',
    pathPrefix: '/test-prefix',
  }),
}));

vi.mock('../../../app/platform/cmsSiteChromeSlots', () => ({
  cmsSiteChromeSlots: {},
}));

vi.mock('../../../components/AccentColorPicker', () => ({
  AccentColorPicker: () => null,
}));

vi.mock('../../../shared/ui/shell/ShellAppEndooControl', () => ({
  ShellAppEndooControl: () => null,
}));

vi.mock('../../../hooks/useCurrentUserDisplay', () => ({
  useCurrentUserDisplay: () => ({
    displayName: 'Test User',
    avatarXs: null,
    avatarInitial: 'T',
    primaryRole: 'ADMIN',
  }),
}));

vi.mock('../../../layouts/adminShell/useAdminShellNav', () => ({
  useAdminShellNav: () => [
    {
      heading: 'Studio',
      items: [
        {
          label: 'Parent Module',
          path: '/studio',
          icon: 'Folder',
          children: [
            {
              label: 'Child Page',
              path: '/studio/child',
              icon: 'File',
            },
          ],
        },
      ],
    },
  ],
}));

vi.mock('../../../components/AppEndooPanel', () => ({
  AppEndooPanel: () => null,
}));

vi.mock('../../../components/ProfileDrawer', () => ({
  ProfileDrawer: () => null,
}));

vi.mock('../../../components/AboutAppModal', () => ({
  AboutAppModal: () => null,
}));

vi.mock('../../../components/profile/ProfileAccountModals', () => ({
  ProfileMoreModal: () => null,
}));

function buildShellPreviewDocument(showBreadcrumb: boolean): DesignerDocument {
  return {
    schemaVersion: '1.0.0',
    id: 'shell-preview-header-config',
    name: 'Shell Preview Header Config',
    rootNodeId: 'root',
    metadata: { createdAt: '', updatedAt: '' },
    nodes: {
      root: {
        id: 'root',
        type: 'root',
        parentId: null,
        order: 0,
        props: {},
        layout: {},
        binding: {},
        children: ['header-slot', 'outlet-slot'],
      },
      'header-slot': {
        id: 'header-slot',
        type: 'system-slot',
        parentId: 'root',
        order: 0,
        props: {
          slotId: SHELL_CHROME_HEADER,
          showLogo: true,
          showBreadcrumb,
          showActions: true,
          _designerPaletteItemId: 'platform.slot.core.shell.header',
        },
        layout: {},
        binding: {},
        children: [],
      },
      'outlet-slot': {
        id: 'outlet-slot',
        type: 'system-slot',
        parentId: 'root',
        order: 1,
        props: {
          slotId: SHELL_ROUTE_OUTLET_SLOT_ID,
          _designerPaletteItemId: 'platform.slot.core.shell.route-outlet',
        },
        layout: {},
        binding: {},
        children: [],
      },
    },
    diagnostics: [],
  };
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderPreview = (document: DesignerDocument) => render(
  <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={['/studio/child']}>
      <DesignerPreviewViewport
        document={document}
        selectedCultureId="en"
        // Component-alone + document-owned route outlet forces the main Preview path that
        // uses `useDesignerShellRuntimeSlots` (not DesignerPreviewPortalShell).
        portalShellKey={COMPONENT_ALONE_SHELL_LAYOUT_KEY}
        portalSegment="studio"
        portalOptions={[]}
      />
    </MemoryRouter>
  </QueryClientProvider>,
);

describe('shell preview tab header config (item 85)', () => {
  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('hides breadcrumb in DesignerPreviewViewport when showBreadcrumb=false', async () => {
    renderPreview(buildShellPreviewDocument(false));

    await waitFor(() => {
      expect(document.querySelector('[data-platform-slot="core.shell.header"]')).toBeTruthy();
    });

    expect(document.querySelector('nav[aria-label="Breadcrumb"]')).toBeNull();
  });

  it('shows breadcrumb in DesignerPreviewViewport when showBreadcrumb=true and trail has depth', async () => {
    renderPreview(buildShellPreviewDocument(true));

    await waitFor(() => {
      expect(document.querySelector('[data-platform-slot="core.shell.header"]')).toBeTruthy();
    });

    await waitFor(() => {
      expect(document.querySelector('nav[aria-label="Breadcrumb"]')).toBeTruthy();
    });
    const breadcrumb = document.querySelector('nav[aria-label="Breadcrumb"]');
    expect(breadcrumb).toBeTruthy();
    // Trail depth > 1 is what AppShellHeader requires to render the breadcrumb nav.
    expect((breadcrumb?.textContent ?? '').includes('/')).toBe(true);
    expect(breadcrumb?.textContent).toContain('Parent Module');
  });
});
