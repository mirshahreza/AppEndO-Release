// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isAiAssistInputType, readInputValue } from '../inputValue';

describe('inputValue', () => {
  it('prefers live DOM value over stale controlled prop', () => {
    const input = document.createElement('input');
    input.value = 'Updated title';
    expect(readInputValue(input, 'Old title')).toBe('Updated title');
  });

  it('allows assist only on text-like input types', () => {
    expect(isAiAssistInputType('text')).toBe(true);
    expect(isAiAssistInputType('search')).toBe(true);
    expect(isAiAssistInputType(undefined)).toBe(true);
    expect(isAiAssistInputType('password')).toBe(false);
    expect(isAiAssistInputType('number')).toBe(false);
  });
});
