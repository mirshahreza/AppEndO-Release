/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import type { AppearanceSessionResponse } from '../../../../shared/api/contracts/appearance/shellExperience.schema';
import { ShellExperienceProvider, useShellExperience } from '../../../../contexts/ShellExperienceContext';
import { AppearanceShellPreferencesPanel } from '../AppearanceShellPreferencesPanel';
import { DesignerDialogHostContext } from '../../../../shared/ui/designerDialogHostContext';

const { mockSession, getAppearanceSessionMock, setAppearanceSessionMock } = vi.hoisted(() => {
  const session: AppearanceSessionResponse = {
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
    sidebarExpandedWidthPx: 250,
  },
  userExperience: {
    version: 1,
    layoutWidth: 'bounded',
    sidebarCollapsed: true,
  },
  effective: {
    sidebarCollapsed: true,
    sidebarCollapsePolicy: 'rail',
    allowUserSidebarPreference: true,
    sidebarExpandedWidthPx: 250,
    layoutWidth: 'bounded',
    layoutWidthUserControl: true,
    navExpandedGroups: [],
  },
  };
  let currentSession: AppearanceSessionResponse = session;
  return {
    mockSession: session,
    getAppearanceSessionMock: () => currentSession,
    setAppearanceSessionMock: (next: AppearanceSessionResponse) => {
      currentSession = next;
    },
  };
});

const saveUserMutate = vi.fn().mockResolvedValue(undefined);
const savePortalMutate = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('../../../../shared/api/queries/appearance', () => ({
  useAppearanceSession: () => ({ data: getAppearanceSessionMock(), isLoading: false }),
  useSaveUserShellExperience: () => ({ mutateAsync: saveUserMutate, isPending: false }),
  useSavePortalAppearanceDefaults: () => ({ mutateAsync: savePortalMutate, isPending: false }),
  fetchAppearanceSession: vi.fn().mockImplementation(() => Promise.resolve(getAppearanceSessionMock())),
  resetUserShellExperience: vi.fn(),
}));

vi.mock('../../../../components/AccentColorPicker', () => ({
  AccentColorPicker: () => <div data-testid="accent-picker" />,
}));

vi.mock('../../../../contexts/AccentThemeContext', () => ({
  useAccentTheme: () => ({ accentHex: '#038387' }),
}));

const SessionSeed: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { applySession } = useShellExperience();
  React.useEffect(() => {
    applySession(mockSession);
  }, [applySession]);
  return <>{children}</>;
};

const renderPanel = () => render(
  <DesignerDialogHostContext.Provider value>
    <ShellExperienceProvider mountId="studio">
      <SessionSeed>
        <AppearanceShellPreferencesPanel />
      </SessionSeed>
    </ShellExperienceProvider>
  </DesignerDialogHostContext.Provider>,
);

const ApplySessionSpy: React.FC = () => {
  const { session } = useShellExperience();
  return (
    <span data-testid="effective-width">{session?.effective.layoutWidth ?? 'none'}</span>
  );
};

afterEach(() => {
  cleanup();
  saveUserMutate.mockClear();
  setAppearanceSessionMock(mockSession);
});

describe('AppearanceShellPreferencesPanel', () => {
  it('enables Save when page width draft differs from saved baseline', async () => {
    renderPanel();

    expect(screen.getByRole('button', { name: 'Save my preferences' })).toBeDisabled();

    fireEvent.change(screen.getByRole('combobox', { name: 'Page width' }), {
      target: { value: 'fluid' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save my preferences' })).toBeEnabled();
    });
  });

  it('previews shell layout while user prefs are dirty', async () => {
    render(
      <DesignerDialogHostContext.Provider value>
        <ShellExperienceProvider mountId="studio">
          <SessionSeed>
            <AppearanceShellPreferencesPanel />
            <ApplySessionSpy />
          </SessionSeed>
        </ShellExperienceProvider>
      </DesignerDialogHostContext.Provider>,
    );

    expect(screen.getByTestId('effective-width')).toHaveTextContent('bounded');

    fireEvent.change(screen.getByRole('combobox', { name: 'Page width' }), {
      target: { value: 'fluid' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('effective-width')).toHaveTextContent('fluid');
    });
  });

  it('portal collapse policy select enables portal save', async () => {
    renderPanel();

    expect(screen.getByRole('button', { name: 'Save portal defaults' })).toBeDisabled();

    fireEvent.change(screen.getByRole('combobox', { name: 'Sidebar collapse policy' }), {
      target: { value: 'hidden' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save portal defaults' })).toBeEnabled();
    });
  });

  it('selecting bounded from a fluid user override enables save and preview', async () => {
    const fluidOverrideSession: AppearanceSessionResponse = {
      ...mockSession,
      portalDefaults: {
        ...mockSession.portalDefaults,
        layoutWidth: 'bounded',
      },
      userExperience: {
        version: 1,
        layoutWidth: 'fluid',
        sidebarCollapsed: null,
      },
      effective: {
        ...mockSession.effective,
        layoutWidth: 'fluid',
      },
    };

    setAppearanceSessionMock(fluidOverrideSession);

    const SessionSeedFluid: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      const { applySession } = useShellExperience();
      React.useEffect(() => {
        applySession(fluidOverrideSession);
      }, [applySession]);
      return <>{children}</>;
    };

    render(
      <DesignerDialogHostContext.Provider value>
        <ShellExperienceProvider mountId="studio">
          <SessionSeedFluid>
            <AppearanceShellPreferencesPanel />
            <ApplySessionSpy />
          </SessionSeedFluid>
        </ShellExperienceProvider>
      </DesignerDialogHostContext.Provider>,
    );

    expect(screen.getByTestId('effective-width')).toHaveTextContent('fluid');

    fireEvent.change(screen.getByRole('combobox', { name: 'Page width' }), {
      target: { value: 'bounded' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save my preferences' })).toBeEnabled();
      expect(screen.getByTestId('effective-width')).toHaveTextContent('bounded');
    });

    setAppearanceSessionMock({
      ...fluidOverrideSession,
      effective: { ...fluidOverrideSession.effective },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save my preferences' })).toBeEnabled();
      expect(screen.getByTestId('effective-width')).toHaveTextContent('bounded');
    });
  });
});
