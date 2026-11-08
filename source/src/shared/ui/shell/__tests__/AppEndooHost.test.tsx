// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useCultureT } from '../../../../core/culture/CultureContext';
import { APPENDOO_OPEN_STORAGE_KEY } from '../../appendooPreferences';
import { APPENDOO_DOCK_PADDING_END_VAR, APPENDOO_DOCK_PADDING_START_VAR } from '../../appendooDock';
import { AppEndooHost } from '../AppEndooHost';
import { resetPersistedAppEndooOpenForTests } from '../usePersistedAppEndooOpen';

const lazyPanelSpy = vi.fn();

const CultureProbePanel = () => {
  const t = useCultureT();
  return <div data-testid="appendoo-panel">{t('appendoo.panel.closeChat')}</div>;
};

vi.mock('../../../../components/LazyAppEndooPanel', () => ({
  LazyAppEndooPanel: (props: { isOpen: boolean }) => {
    lazyPanelSpy(props);
    return props.isOpen ? <CultureProbePanel /> : null;
  },
}));

vi.mock('../../../lib/aiPageContextStore', () => ({
  useAiPageContextEnrichment: () => null,
}));

const authState = {
  isAuthenticated: true,
};

vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

describe('AppEndooHost', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetPersistedAppEndooOpenForTests();
    lazyPanelSpy.mockClear();
    authState.isAuthenticated = true;
    document.documentElement.style.removeProperty(APPENDOO_DOCK_PADDING_START_VAR);
    document.documentElement.style.removeProperty(APPENDOO_DOCK_PADDING_END_VAR);
  });

  it('hides the panel on public auth surfaces even when open state is persisted', () => {
    window.localStorage.setItem(APPENDOO_OPEN_STORAGE_KEY, 'true');
    resetPersistedAppEndooOpenForTests();

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppEndooHost />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('appendoo-panel')).toBeNull();
    expect(window.localStorage.getItem(APPENDOO_OPEN_STORAGE_KEY)).toBe('false');
    expect(lazyPanelSpy).not.toHaveBeenCalled();
  });

  it('hides the panel when the session is not authenticated', () => {
    window.localStorage.setItem(APPENDOO_OPEN_STORAGE_KEY, 'true');
    resetPersistedAppEndooOpenForTests();
    authState.isAuthenticated = false;

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AppEndooHost />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('appendoo-panel')).toBeNull();
    expect(window.localStorage.getItem(APPENDOO_OPEN_STORAGE_KEY)).toBe('false');
    expect(lazyPanelSpy).not.toHaveBeenCalled();
  });

  it('renders the panel for authenticated app routes when open', () => {
    window.localStorage.setItem(APPENDOO_OPEN_STORAGE_KEY, 'true');
    resetPersistedAppEndooOpenForTests();

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AppEndooHost />
      </MemoryRouter>,
    );

    expect(screen.getAllByTestId('appendoo-panel').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Close chat').length).toBeGreaterThan(0);
    expect(lazyPanelSpy).toHaveBeenCalledWith(expect.objectContaining({ isOpen: true }));
  });
});
