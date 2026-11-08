/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  STUDIO_NO_SELECT_DOCUMENT_ATTR,
  STUDIO_SELECT_ALL_BLOCKED_EVENT,
  acquireStudioNoSelectDocument,
  resetStudioNoSelectDocumentForTests,
} from '../studioNoSelect';

afterEach(() => {
  resetStudioNoSelectDocumentForTests();
});

describe('studio Ctrl+A guard', () => {
  it('blocks browser select-all on chrome and notifies Live Designer', () => {
    const release = acquireStudioNoSelectDocument();
    const notified = vi.fn();
    document.addEventListener(STUDIO_SELECT_ALL_BLOCKED_EVENT, notified);

    const event = new KeyboardEvent('keydown', {
      key: 'a',
      code: 'KeyA',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(notified).toHaveBeenCalledTimes(1);

    document.removeEventListener(STUDIO_SELECT_ALL_BLOCKED_EVENT, notified);
    release();
  });

  it('leaves native Ctrl+A alone in a real text field', () => {
    const release = acquireStudioNoSelectDocument();
    const field = document.createElement('textarea');
    document.body.appendChild(field);
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      code: 'KeyA',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    field.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    field.remove();
    release();
  });
});

describe('acquireStudioNoSelectDocument', () => {
  it('sets the document attribute and clears it on release', () => {
    const release = acquireStudioNoSelectDocument();
    expect(document.documentElement.hasAttribute(STUDIO_NO_SELECT_DOCUMENT_ATTR)).toBe(true);
    release();
    expect(document.documentElement.hasAttribute(STUDIO_NO_SELECT_DOCUMENT_ATTR)).toBe(false);
  });

  it('keeps the attribute while a nested studio hold is still active', () => {
    const outer = acquireStudioNoSelectDocument();
    const inner = acquireStudioNoSelectDocument();
    inner();
    expect(document.documentElement.hasAttribute(STUDIO_NO_SELECT_DOCUMENT_ATTR)).toBe(true);
    outer();
    expect(document.documentElement.hasAttribute(STUDIO_NO_SELECT_DOCUMENT_ATTR)).toBe(false);
  });
});
