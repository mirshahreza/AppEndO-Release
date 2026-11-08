// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isBrowserRefreshKeyboardEvent, subscribePageReloadIntent } from '../browserPageReload';

describe('isBrowserRefreshKeyboardEvent', () => {
  it('detects F5', () => {
    expect(isBrowserRefreshKeyboardEvent(new KeyboardEvent('keydown', { key: 'F5' }))).toBe(true);
  });

  it('detects Ctrl+R and Meta+R', () => {
    expect(isBrowserRefreshKeyboardEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true }))).toBe(true);
    expect(isBrowserRefreshKeyboardEvent(new KeyboardEvent('keydown', { key: 'R', metaKey: true }))).toBe(true);
  });

  it('ignores unrelated keys', () => {
    expect(isBrowserRefreshKeyboardEvent(new KeyboardEvent('keydown', { key: 'r' }))).toBe(false);
    expect(isBrowserRefreshKeyboardEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }))).toBe(false);
  });
});

describe('subscribePageReloadIntent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the in-app prompt on refresh keyboard shortcuts when dirty', () => {
    const onIntent = vi.fn();
    const shouldHandle = vi.fn(() => true);

    const unsubscribe = subscribePageReloadIntent({ shouldHandle, onIntent });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', bubbles: true }));

    expect(onIntent).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('intercepts browser reload through the Navigation API when available', () => {
    const onIntent = vi.fn();
    const shouldHandle = vi.fn(() => true);
    let navigateHandler: ((event: Event) => void) | null = null;

    vi.stubGlobal('navigation', {
      addEventListener: vi.fn((type: string, handler: (event: Event) => void) => {
        if (type === 'navigate') {
          navigateHandler = handler;
        }
      }),
      removeEventListener: vi.fn(),
    });

    const unsubscribe = subscribePageReloadIntent({ shouldHandle, onIntent });
    expect(navigateHandler).not.toBeNull();

    const event = new Event('navigate', { cancelable: true }) as NavigateEvent;
    Object.defineProperty(event, 'navigationType', { value: 'reload' });
    navigateHandler?.(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onIntent).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('does nothing when the workspace is clean', () => {
    const onIntent = vi.fn();
    const shouldHandle = vi.fn(() => false);

    const unsubscribe = subscribePageReloadIntent({ shouldHandle, onIntent });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', bubbles: true }));

    expect(onIntent).not.toHaveBeenCalled();
    unsubscribe();
  });
});
