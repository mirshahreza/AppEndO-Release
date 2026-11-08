// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { APPENDOO_OPEN_STORAGE_KEY } from '../../appendooPreferences';
import {
  closePersistedAppEndooOpen,
  resetPersistedAppEndooOpenForTests,
  usePersistedAppEndooOpen,
} from '../usePersistedAppEndooOpen';

describe('usePersistedAppEndooOpen', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetPersistedAppEndooOpenForTests();
  });

  it('reads initial open state from storage', () => {
    window.localStorage.setItem(APPENDOO_OPEN_STORAGE_KEY, 'true');
    resetPersistedAppEndooOpenForTests();

    const { result } = renderHook(() => usePersistedAppEndooOpen());
    expect(result.current[0]).toBe(true);
  });

  it('persists open state changes', () => {
    const { result } = renderHook(() => usePersistedAppEndooOpen());

    act(() => {
      result.current[1](true);
    });
    expect(result.current[0]).toBe(true);
    expect(window.localStorage.getItem(APPENDOO_OPEN_STORAGE_KEY)).toBe('true');
  });

  it('shares state across hook instances', () => {
    const host = renderHook(() => usePersistedAppEndooOpen());
    const shell = renderHook(() => usePersistedAppEndooOpen());

    act(() => {
      host.result.current[1](true);
    });
    expect(shell.result.current[0]).toBe(true);
  });

  it('closes from auth lifecycle helpers', () => {
    const { result } = renderHook(() => usePersistedAppEndooOpen());

    act(() => {
      result.current[1](true);
    });
    expect(result.current[0]).toBe(true);

    act(() => {
      closePersistedAppEndooOpen();
    });
    expect(result.current[0]).toBe(false);
    expect(window.localStorage.getItem(APPENDOO_OPEN_STORAGE_KEY)).toBe('false');
  });
});
