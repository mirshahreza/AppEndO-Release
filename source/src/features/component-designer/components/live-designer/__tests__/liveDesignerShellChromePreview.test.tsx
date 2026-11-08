/**
 * Live Designer previously rendered shell chrome/nav system-slots as amber
 * "Available at application runtime" placeholders because `LiveDesignerPreview`
 * never passed `runtimeSlots` (unlike `DesignerPreviewViewport`).
 */
// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { createStateFromAppShellLayoutTemplate } from '../../../../../domain/component-designer/layout-presets/appShellLayoutTemplate';
import { LiveDesignerPreview } from '../LiveDesignerPreview';
import { SHELL_CHROME_HEADER, SHELL_CHROME_LOGO, SHELL_CHROME_SIDEBAR_TOGGLE } from '../../../../../shared/lib/shellChromeSlots';
import { SHELL_ROUTE_OUTLET_SLOT_ID } from '../../../../../shared/lib/shellRouteOutlet';

vi.mock('../../../../../app/platform/PlatformConfigProvider', () => {
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

vi.mock('../../../../../app/platform/PlatformMountContext', () => ({
  usePlatformMount: () => ({
    mountId: 'test-mount',
    pathPrefix: '/studio',
  }),
  useOptionalPlatformMount: () => ({
    mountId: 'test-mount',
    pathPrefix: '/studio',
  }),
}));

vi.mock('../../../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
    currentUser: { id: 1, email: 'admin@append.os', role: 'ADMIN', roles: ['ADMIN'] },
    logout: vi.fn(),
  })),
}));

vi.mock('../../../../../hooks/useCurrentUserDisplay', () => ({
  useCurrentUserDisplay: () => ({
    displayName: 'Test User',
    avatarXs: null,
    avatarInitial: 'T',
    primaryRole: 'ADMIN',
  }),
}));

vi.mock('../../../../../layouts/adminShell/useAdminShellNav', () => ({
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

vi.mock('../../../../../components/AccentColorPicker', () => ({
  AccentColorPicker: () => null,
}));

vi.mock('../../../../../shared/ui/shell/ShellAppEndooControl', () => ({
  ShellAppEndooControl: () => null,
}));

vi.mock('../../../../../components/AppEndooPanel', () => ({
  AppEndooPanel: () => null,
}));

vi.mock('../../../../../components/ProfileDrawer', () => ({
  ProfileDrawer: () => null,
}));

vi.mock('../../../../../components/AboutAppModal', () => ({
  AboutAppModal: () => null,
}));

vi.mock('../../../../../layouts/adminShell/PortalMenu', () => ({
  PortalMenu: () => <div data-testid="portal-menu-stub" />,
}));

vi.mock('../../../../../layouts/adminShell/nav/PlatformNavigationHost', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../layouts/adminShell/nav/PlatformNavigationHost')>();
  return {
    ...actual,
    PlatformNavigationHost: ({ navigationRef }: { navigationRef?: string | null }) => (
      <div data-testid="platform-nav-host">{navigationRef || 'no-ref'}</div>
    ),
  };
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('LiveDesignerPreview shell chrome runtime slots', () => {
  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('renders real shell chrome slots for an app-shell template, not amber runtime placeholders', async () => {
    const { state } = createStateFromAppShellLayoutTemplate();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/studio/child']}>
          <div className="h-[640px] w-[1024px]">
            <LiveDesignerPreview
              document={state.document}
              bindingDefinitions={state.bindingDefinitions}
            />
          </div>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const preview = screen.getByTestId('live-designer-preview');
    expect(preview).toHaveAttribute('data-shell-runtime', 'true');

    await waitFor(() => {
      expect(document.querySelector(`[data-platform-slot="${SHELL_CHROME_HEADER}"]`)).toBeTruthy();
      expect(document.querySelector(`[data-platform-slot="${SHELL_CHROME_LOGO}"]`)).toBeTruthy();
      expect(document.querySelector(`[data-platform-slot="${SHELL_CHROME_SIDEBAR_TOGGLE}"]`)).toBeTruthy();
    });

    expect(screen.queryByText('Available at application runtime')).toBeNull();
    expect(screen.getByText('Page content loads here based on the active URL')).toBeTruthy();
    expect(document.querySelector(`[data-platform-slot="${SHELL_ROUTE_OUTLET_SLOT_ID}"]`)).toBeNull();
  });

  it('blocks shell chrome pointer events in inspect mode and restores them in interact mode', () => {
    const { state } = createStateFromAppShellLayoutTemplate();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/studio/child']}>
          <LiveDesignerPreview
            document={state.document}
            bindingDefinitions={state.bindingDefinitions}
            interactive={false}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const host = screen.getByTestId('live-designer-preview-host');
    expect(host).toHaveAttribute('data-interactive', 'false');
    expect(host.className).toContain('pointer-events-none');
    expect(host.className).toContain('z-0');

    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/studio/child']}>
          <LiveDesignerPreview
            document={state.document}
            bindingDefinitions={state.bindingDefinitions}
            interactive
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const interactHost = screen.getByTestId('live-designer-preview-host');
    expect(interactHost).toHaveAttribute('data-interactive', 'true');
    expect(interactHost.className).not.toContain('pointer-events-none');
  });

  it('keeps non-shell documents off the shell chrome provider path', () => {
    const { state } = createStateFromAppShellLayoutTemplate();
    // Strip system-slots so the document no longer needs shell runtime wiring.
    const nodes = { ...state.document.nodes };
    for (const node of Object.values(nodes)) {
      if (node.type === 'system-slot') {
        nodes[node.id] = {
          ...node,
          type: 'text',
          props: { text: 'plain' },
        };
      }
    }

    render(
      <LiveDesignerPreview
        document={{ ...state.document, nodes }}
        bindingDefinitions={state.bindingDefinitions}
      />,
    );

    expect(screen.getByTestId('live-designer-preview')).toHaveAttribute('data-shell-runtime', 'false');
  });
});
