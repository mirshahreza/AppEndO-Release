import { describe, expect, it } from 'vitest';
import {
  isInlineTranslationCaptureActive,
  noteInlineTranslationKey,
  setInlineTranslationCaptureActive,
  takePendingInlineTranslationKeys,
} from '../inlineTranslationCapture';

describe('inlineTranslationCapture', () => {
  it('records keys only while capture is active', () => {
    setInlineTranslationCaptureActive(false);
    noteInlineTranslationKey('nav.users', 'Users');
    expect(takePendingInlineTranslationKeys().size).toBe(0);

    setInlineTranslationCaptureActive(true);
    expect(isInlineTranslationCaptureActive()).toBe(true);
    noteInlineTranslationKey('nav.users', 'Users');
    const snapshot = takePendingInlineTranslationKeys();
    expect(snapshot.get('nav.users')).toBe('Users');
    expect(takePendingInlineTranslationKeys().size).toBe(0);

    setInlineTranslationCaptureActive(false);
    expect(isInlineTranslationCaptureActive()).toBe(false);
  });
});
