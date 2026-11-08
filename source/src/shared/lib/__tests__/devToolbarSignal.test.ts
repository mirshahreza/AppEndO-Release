// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  recordDevToolbarApiCall,
  setDevToolbarActivePage,
  useDevToolbarSnapshot,
} from '../devToolbarSignal';

describe('devToolbarSignal', () => {
  it('starts empty and reflects a recorded API call', () => {
    setDevToolbarActivePage(null);
    const { result } = renderHook(() => useDevToolbarSnapshot());

    expect(result.current).toEqual({ activePage: null, lastApiCall: null });

    act(() => {
      recordDevToolbarApiCall({ requestId: 'req-1', durationMs: 12, path: '/api/x' });
    });

    expect(result.current.lastApiCall).toEqual({ requestId: 'req-1', durationMs: 12, path: '/api/x' });
  });

  it('resets the last API call when the active page changes', () => {
    setDevToolbarActivePage(null);
    const { result } = renderHook(() => useDevToolbarSnapshot());

    act(() => {
      recordDevToolbarApiCall({ requestId: 'req-1', durationMs: 12, path: '/api/x' });
    });
    expect(result.current.lastApiCall?.requestId).toBe('req-1');

    act(() => {
      setDevToolbarActivePage({ pageKey: 'other', loaderKind: 'core', loaderRef: 'other-loader' });
    });

    expect(result.current.activePage).toEqual({
      pageKey: 'other',
      loaderKind: 'core',
      loaderRef: 'other-loader',
    });
    expect(result.current.lastApiCall).toBeNull();
  });

  it('does not reset the last API call when the active page is set to the same page again', () => {
    setDevToolbarActivePage({ pageKey: 'home', loaderKind: 'designer', loaderRef: 'general/home' });
    const { result } = renderHook(() => useDevToolbarSnapshot());

    act(() => {
      recordDevToolbarApiCall({ requestId: 'req-2', durationMs: 5, path: '/api/y' });
    });
    act(() => {
      setDevToolbarActivePage({ pageKey: 'home', loaderKind: 'designer', loaderRef: 'general/home' });
    });

    expect(result.current.lastApiCall?.requestId).toBe('req-2');
  });
});
