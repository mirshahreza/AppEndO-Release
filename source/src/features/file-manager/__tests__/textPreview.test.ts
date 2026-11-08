import { describe, expect, it } from 'vitest';
import {
  isFileManagerPlainTextLanguage,
  resolveFileManagerPreviewDirection,
  resolvePlainTextPreviewDirection,
} from '../textPreview';

describe('file-manager textPreview', () => {
  it('detects plain text languages', () => {
    expect(isFileManagerPlainTextLanguage('plaintext')).toBe(true);
    expect(isFileManagerPlainTextLanguage(null)).toBe(true);
    expect(isFileManagerPlainTextLanguage('typescript')).toBe(false);
  });

  it('uses rtl for arabic leading characters', () => {
    expect(resolvePlainTextPreviewDirection('مرحبا')).toBe('rtl');
    expect(resolvePlainTextPreviewDirection('السلام')).toBe('rtl');
    expect(resolvePlainTextPreviewDirection('\n# العربية')).toBe('rtl');
  });

  it('uses ltr for latin leading characters', () => {
    expect(resolvePlainTextPreviewDirection('Hello')).toBe('ltr');
    expect(resolvePlainTextPreviewDirection('# Default sandbox')).toBe('ltr');
    expect(resolvePlainTextPreviewDirection('   English')).toBe('ltr');
  });

  it('honors forced preview direction overrides', () => {
    expect(resolveFileManagerPreviewDirection('Hello', 'rtl')).toBe('rtl');
    expect(resolveFileManagerPreviewDirection('مرحبا', 'ltr')).toBe('ltr');
    expect(resolveFileManagerPreviewDirection('مرحبا', 'auto')).toBe('rtl');
  });
});
