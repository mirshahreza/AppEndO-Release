// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalMenu } from '../PortalMenu';
import { PlatformMountProvider } from '../../../app/platform/PlatformMountContext';
import type { PlatformMount } from '../../../shared/api/contracts/platform/types';
import { STUDIO_PORTAL_SEGMENT } from '../../../shared/api/contracts/platform/mountConstants';
import { defaultHomePortal, defaultStudioPortal } from '../../../shared/api/contracts/platform/experienceManifest';

vi.mock('../../../shared/ui/UiTooltip', () => ({
  UiTooltip: ({ children }: { children: unknown }) => children,
}));

const studioMount: PlatformMount = {
  id: 'studio',
  name: 'Studio',
  pathPrefix: '/studio',
  enabled: true,
  designerRoutePropagation: 'manual',
};

vi.mock('../../../app/platform/PortalHost', () => ({
  useOptionalPortal: () => ({
    portalSegment: STUDIO_PORTAL_SEGMENT,
    shellKey: STUDIO_PORTAL_SEGMENT,
    pageRemainderPath: '/',
  }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    currentUser: { role: 'ADMIN', roles: ['ADMIN'] },
  }),
}));

vi.mock('../../../shared/api/queries/platform', () => ({
  useExperienceManifestQuery: () => ({
    data: {
      id: 'admin',
      cultureId: 'us',
      portals: [
        defaultHomePortal(),
        defaultStudioPortal(),
        {
          segment: 'designer',
          name: 'Designer',
          shellKey: 'designer',
          enabled: true,
          routes: [],
        },
      ],
    },
  }),
}));

function renderMenu(onNavigate = vi.fn()) {
  const queryClient = new QueryClient();
  return {
    onNavigate,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PlatformMountProvider mount={studioMount}>
            <PortalMenu
              isSidebarCollapsed={false}
              onNavigate={onNavigate}
              ariaLabel="Switch portal"
            />
          </PlatformMountProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe('PortalMenu', () => {
  it('opens the menu and navigates to the selected application', () => {
    const onNavigate = vi.fn();
    renderMenu(onNavigate);

    fireEvent.click(screen.getByRole('button', { name: 'Switch portal' }));
    fireEvent.click(screen.getByRole('option', { name: 'Designer' }));

    expect(onNavigate).toHaveBeenCalledWith('/studio/designer');
  });
});
