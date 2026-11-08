// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isCtrlEnterKeyboardEvent, isPlainF5KeyboardEvent, subscribeSchemaObjectRunF5 } from '../schemaObjectRunF5Shortcut';

describe('isPlainF5KeyboardEvent', () => {
  it('detects plain F5', () => {
    expect(isPlainF5KeyboardEvent(new KeyboardEvent('keydown', { key: 'F5' }))).toBe(true);
    expect(isPlainF5KeyboardEvent(new KeyboardEvent('keydown', { code: 'F5' }))).toBe(true);
  });

  it('ignores modified F5 and unrelated keys', () => {
    expect(isPlainF5KeyboardEvent(new KeyboardEvent('keydown', { key: 'F5', ctrlKey: true }))).toBe(false);
    expect(isPlainF5KeyboardEvent(new KeyboardEvent('keydown', { key: 'F5', shiftKey: true }))).toBe(false);
    expect(isPlainF5KeyboardEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true }))).toBe(false);
  });
});

describe('isCtrlEnterKeyboardEvent', () => {
  it('detects Ctrl+Enter and Meta+Enter', () => {
    expect(isCtrlEnterKeyboardEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }))).toBe(true);
    expect(isCtrlEnterKeyboardEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }))).toBe(true);
  });

  it('ignores plain Enter', () => {
    expect(isCtrlEnterKeyboardEvent(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false);
  });
});

describe('subscribeSchemaObjectRunF5', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prevents F5 and runs play when the panel should handle it', () => {
    const onPlay = vi.fn();
    const unsubscribe = subscribeSchemaObjectRunF5({
      shouldHandle: () => true,
      onPlay,
    });

    const event = new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onPlay).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('runs play on Ctrl+Enter', () => {
    const onPlay = vi.fn();
    const unsubscribe = subscribeSchemaObjectRunF5({
      shouldHandle: () => true,
      onPlay,
    });

    const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onPlay).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('does not steal F5 when the panel should not handle it', () => {
    const onPlay = vi.fn();
    const unsubscribe = subscribeSchemaObjectRunF5({
      shouldHandle: () => false,
      onPlay,
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true }));
    expect(onPlay).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('intercepts Navigation API reloads while the panel is active', () => {
    const onPlay = vi.fn();
    let navigateHandler: ((event: Event) => void) | null = null;
    const intercept = vi.fn();

    vi.stubGlobal('navigation', {
      addEventListener: vi.fn((type: string, handler: (event: Event) => void) => {
        if (type === 'navigate') {
          navigateHandler = handler;
        }
      }),
      removeEventListener: vi.fn(),
    });

    const unsubscribe = subscribeSchemaObjectRunF5({
      shouldHandle: () => true,
      onPlay,
    });

    const event = new Event('navigate', { cancelable: true });
    Object.defineProperty(event, 'navigationType', { value: 'reload' });
    Object.defineProperty(event, 'canIntercept', { value: true });
    Object.defineProperty(event, 'intercept', { value: intercept });
    navigateHandler?.(event);

    expect(intercept).toHaveBeenCalledTimes(1);
    const interceptArg = intercept.mock.calls[0]?.[0] as { handler: () => Promise<void> };
    void interceptArg.handler();
    expect(onPlay).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
