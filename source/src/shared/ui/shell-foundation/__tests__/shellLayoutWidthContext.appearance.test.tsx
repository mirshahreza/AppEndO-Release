/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import * as React from 'react';
import type { DesignerDocument } from '../../../../domain/component-designer/types';
import type { AppearanceSessionResponse } from '../../../api/contracts/appearance/shellExperience.schema';
import { ShellExperienceProvider, useShellExperience } from '../../../../contexts/ShellExperienceContext';
import { ShellLayoutWidthProvider, useShellLayoutWidth } from '../ShellLayoutWidthContext';
import { ShellPageWidthHeaderControl } from '../ShellPageWidthHeaderControl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const withProviders = (ui: React.ReactElement) => (
  <QueryClientProvider client={queryClient}>
    {ui}
  </QueryClientProvider>
);

afterEach(() => {
  cleanup();
});

const boundedDocument = (): DesignerDocument => ({
  schemaVersion: '1',
  id: 'shell-doc',
  name: 'Portal',
  rootNodeId: 'root',
  nodes: {
    root: {
      id: 'root',
      type: 'container',
      parentId: undefined,
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
    shellLayoutWidth: 'bounded',
    shellLayoutWidthUserControl: true,
  },
  diagnostics: [],
});

const fluidPortalSession: AppearanceSessionResponse = {
  success: true,
  mountId: 'studio',
  isAdmin: true,
  portalDefaults: {
    version: 1,
    layoutWidth: 'fluid',
    layoutWidthUserControl: true,
    sidebarCollapsePolicy: 'rail',
    sidebarDefaultCollapsed: false,
    allowUserSidebarPreference: true,
  },
  userExperience: null,
  effective: {
    sidebarCollapsed: false,
    sidebarCollapsePolicy: 'rail',
    allowUserSidebarPreference: true,
    sidebarExpandedWidthPx: 250,
    layoutWidth: 'fluid',
    layoutWidthUserControl: true,
    navExpandedGroups: [],
  },
};

const boundedPortalSession: AppearanceSessionResponse = {
  ...fluidPortalSession,
  portalDefaults: {
    ...fluidPortalSession.portalDefaults,
    layoutWidth: 'bounded',
  },
  effective: {
    ...fluidPortalSession.effective,
    layoutWidth: 'bounded',
  },
};

const SessionSeed: React.FC<{ session: AppearanceSessionResponse; children: React.ReactNode }> = ({
  session,
  children,
}) => {
  const { applySession } = useShellExperience();
  React.useEffect(() => {
    applySession(session);
  }, [applySession, session]);
  return <>{children}</>;
};

const HeaderProbe: React.FC = () => {
  const layout = useShellLayoutWidth();
  return (
    <div>
      <span data-testid="header-visible">{String(layout.headerControlVisible)}</span>
      <ShellPageWidthHeaderControl studioAdminChrome />
    </div>
  );
};

describe('ShellLayoutWidthProvider with appearance session', () => {
  it('shows header width control when portal default is fluid and user control is on', () => {
    render(withProviders(
      <ShellExperienceProvider mountId="studio">
        <SessionSeed session={fluidPortalSession}>
          <ShellLayoutWidthProvider document={boundedDocument()} shellKey="studio" appShellChrome>
            <HeaderProbe />
          </ShellLayoutWidthProvider>
        </SessionSeed>
      </ShellExperienceProvider>,
    ));

    expect(screen.getByTestId('header-visible')).toHaveTextContent('true');
    expect(screen.getByTestId('shell-page-width-header-control')).toBeInTheDocument();
  });

  it('shows header width control when portal default is bounded and user control is on', () => {
    render(withProviders(
      <ShellExperienceProvider mountId="studio">
        <SessionSeed session={boundedPortalSession}>
          <ShellLayoutWidthProvider document={boundedDocument()} shellKey="studio" appShellChrome>
            <HeaderProbe />
          </ShellLayoutWidthProvider>
        </SessionSeed>
      </ShellExperienceProvider>,
    ));

    expect(screen.getByTestId('header-visible')).toHaveTextContent('true');
    expect(screen.getByTestId('shell-page-width-header-control')).toBeInTheDocument();
  });
});
