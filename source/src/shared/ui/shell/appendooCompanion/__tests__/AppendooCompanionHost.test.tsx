// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APPENDOO_OPEN_STORAGE_KEY } from '../../../appendooPreferences';
import { resetPersistedAppEndooOpenForTests } from '../../usePersistedAppEndooOpen';
import { AppendooCompanionHost } from '../AppendooCompanionHost';
import { shouldRenderAppendooCompanion } from '../shouldRenderAppendooCompanion';

const authState = {
  isAuthenticated: true,
};

const settingsState = {
  data: { enabled: true, providers: [], models: [] },
};

vi.mock('../../../../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../../../../api/queries/aiModels', () => ({
  useAiSettingsQuery: () => settingsState,
}));

describe('shouldRenderAppendooCompanion', () => {
  it('shows only for authenticated app routes while AI is enabled', () => {
    expect(shouldRenderAppendooCompanion({
      isAuthenticated: true,
      pathname: '/admin',
      aiEnabled: true,
    })).toBe(true);
    expect(shouldRenderAppendooCompanion({
      isAuthenticated: true,
      pathname: '/login',
      aiEnabled: true,
    })).toBe(false);
    expect(shouldRenderAppendooCompanion({
      isAuthenticated: false,
      pathname: '/admin',
      aiEnabled: true,
    })).toBe(false);
    expect(shouldRenderAppendooCompanion({
      isAuthenticated: true,
      pathname: '/admin',
      aiEnabled: false,
    })).toBe(false);
  });
});

describe('AppendooCompanionHost', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetPersistedAppEndooOpenForTests();
    authState.isAuthenticated = true;
    settingsState.data = { enabled: true, providers: [], models: [] };
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    });
  });

  it('renders the floating companion on authenticated studio routes when AI is enabled', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AppendooCompanionHost />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('appendoo-companion')).toBeTruthy();
    expect(screen.getByLabelText('Open AppEndoo')).toBeTruthy();
  });

  it('hides the floating companion while the chat panel is open', () => {
    window.localStorage.setItem(APPENDOO_OPEN_STORAGE_KEY, 'true');
    resetPersistedAppEndooOpenForTests();

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AppendooCompanionHost />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('appendoo-companion')).toBeNull();
  });
});
