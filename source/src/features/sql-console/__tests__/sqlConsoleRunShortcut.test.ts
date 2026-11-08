/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isCtrlEnterKeyboardEvent,
  isPlainF5KeyboardEvent,
  subscribeSqlConsoleRunShortcut,
} from '../sqlConsoleRunShortcut';

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

describe('subscribeSqlConsoleRunShortcut', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prevents F5 and runs the query when the document is active', () => {
    const onRun = vi.fn();
    const unsubscribe = subscribeSqlConsoleRunShortcut({
      shouldHandle: () => true,
      onRun,
    });

    const event = new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onRun).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('does not steal F5 when the document is inactive', () => {
    const onRun = vi.fn();
    const unsubscribe = subscribeSqlConsoleRunShortcut({
      shouldHandle: () => false,
      onRun,
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true }));
    expect(onRun).not.toHaveBeenCalled();
    unsubscribe();
  });
});
