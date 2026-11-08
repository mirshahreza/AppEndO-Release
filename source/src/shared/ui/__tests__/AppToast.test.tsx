/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppToast } from '../AppToast';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AppToast', () => {
  it('auto-dismisses success toasts after the requested duration', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <AppToast type="success" text="Saved." durationMs={2000} onDismiss={onDismiss} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps error toasts until the operator dismisses them', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <AppToast type="error" text="Failed to save draft." onDismiss={onDismiss} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to save draft.');
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
