/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCollapsingListToolbar } from '../useCollapsingListToolbar';

describe('useCollapsingListToolbar', () => {
  it('collapses on scroll down and reveals near the top', () => {
    const { result } = renderHook(() => useCollapsingListToolbar());

    act(() => {
      result.current.onListBodyScroll(40);
      result.current.onListBodyScroll(41);
    });
    expect(result.current.listToolbarCollapsed).toBe(true);

    act(() => {
      result.current.onListBodyScroll(10);
    });
    expect(result.current.listToolbarCollapsed).toBe(false);
  });

  it('does not reveal when the grid clamps scrollTop after toolbar collapse', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1_000);
    const { result } = renderHook(() => useCollapsingListToolbar());

    act(() => {
      result.current.onListBodyScroll(1_500);
      result.current.onListBodyScroll(1_520);
    });
    expect(result.current.listToolbarCollapsed).toBe(true);

    act(() => {
      result.current.onListBodyScroll(1_464);
    });
    expect(result.current.listToolbarCollapsed).toBe(true);

    vi.restoreAllMocks();
  });

  it('collapses on the first downward scroll tick away from the top', () => {
    let now = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { result } = renderHook(() => useCollapsingListToolbar());

    act(() => {
      result.current.onListBodyScroll(120);
      result.current.onListBodyScroll(121);
    });
    expect(result.current.listToolbarCollapsed).toBe(true);

    vi.restoreAllMocks();
  });

  it('reveals on small upward scroll steps away from the top', () => {
    let now = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { result } = renderHook(() => useCollapsingListToolbar());

    act(() => {
      result.current.onListBodyScroll(400);
      result.current.onListBodyScroll(420);
    });
    expect(result.current.listToolbarCollapsed).toBe(true);

    now = 1_500;
    act(() => {
      result.current.onListBodyScroll(415);
    });
    expect(result.current.listToolbarCollapsed).toBe(false);

    vi.restoreAllMocks();
  });

  it('reveals on intentional scroll up after the layout settle window', () => {
    let now = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { result } = renderHook(() => useCollapsingListToolbar());

    act(() => {
      result.current.onListBodyScroll(200);
      result.current.onListBodyScroll(220);
    });
    expect(result.current.listToolbarCollapsed).toBe(true);

    now = 1_500;
    act(() => {
      result.current.onListBodyScroll(180);
    });
    expect(result.current.listToolbarCollapsed).toBe(false);

    vi.restoreAllMocks();
  });

  it('stays expanded when layout nudges scrollTop down right after reveal', () => {
    let now = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { result } = renderHook(() => useCollapsingListToolbar());

    act(() => {
      result.current.onListBodyScroll(800);
      result.current.onListBodyScroll(820);
    });
    expect(result.current.listToolbarCollapsed).toBe(true);

    now = 1_500;
    act(() => {
      result.current.onListBodyScroll(810);
    });
    expect(result.current.listToolbarCollapsed).toBe(false);

    act(() => {
      result.current.onListBodyScroll(835);
    });
    expect(result.current.listToolbarCollapsed).toBe(false);

    vi.restoreAllMocks();
  });
});
