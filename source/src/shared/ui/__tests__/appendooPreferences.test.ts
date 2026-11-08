// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  APPENDOO_OPEN_STORAGE_KEY,
  APPENDOO_UI_STATE_STORAGE_KEY,
  createDefaultDockedAppEndooUiState,
  persistAppEndooOpen,
  persistAppEndooUiState,
  readStoredAppEndooOpen,
  readStoredAppEndooUiState,
  resolveOppositeSidebarDockSide,
} from '../appendooPreferences';

describe('appendooPreferences', () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.dir = 'ltr';
  });

  it('persists and restores open state', () => {
    expect(readStoredAppEndooOpen()).toBe(false);
    persistAppEndooOpen(true);
    expect(window.localStorage.getItem(APPENDOO_OPEN_STORAGE_KEY)).toBe('true');
    expect(readStoredAppEndooOpen()).toBe(true);
  });

  it('persists and restores panel ui state', () => {
    persistAppEndooUiState({
      dockSide: 'right',
      panelPos: { x: 12, y: 34 },
      panelSize: { width: 480, height: 900 },
      isMaximized: true,
      activeSessionId: 42,
    });

    expect(readStoredAppEndooUiState()).toEqual({
      dockSide: 'right',
      panelPos: { x: 12, y: 34 },
      panelSize: { width: 480, height: 900 },
      isMaximized: true,
      activeSessionId: 42,
    });
  });

  it('rejects invalid stored ui state', () => {
    window.localStorage.setItem(APPENDOO_UI_STATE_STORAGE_KEY, JSON.stringify({ dockSide: 'top' }));
    expect(readStoredAppEndooUiState()).toBeNull();
  });

  it('defaults dock side opposite the sidebar', () => {
    document.documentElement.dir = 'ltr';
    expect(resolveOppositeSidebarDockSide()).toBe('right');
    expect(createDefaultDockedAppEndooUiState().dockSide).toBe('right');

    document.documentElement.dir = 'rtl';
    expect(resolveOppositeSidebarDockSide()).toBe('left');
    expect(createDefaultDockedAppEndooUiState().dockSide).toBe('left');
  });
});
