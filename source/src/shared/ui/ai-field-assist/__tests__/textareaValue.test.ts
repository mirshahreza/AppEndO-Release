// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readTextareaValue } from '../textareaValue';

describe('textareaValue', () => {
  it('prefers live DOM value over stale controlled prop', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Hello world';
    expect(readTextareaValue(textarea, 'Hello')).toBe('Hello world');
  });

  it('falls back to controlled value when textarea is missing', () => {
    expect(readTextareaValue(null, 'Controlled')).toBe('Controlled');
  });
});
