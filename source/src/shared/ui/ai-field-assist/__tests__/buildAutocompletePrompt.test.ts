import { describe, expect, it } from 'vitest';
import {
  buildAutocompleteUserPrompt,
  normalizeAutocompleteCompletion,
} from '../buildAutocompletePrompt';

describe('buildAutocompletePrompt', () => {
  it('builds user prompt with optional field label', () => {
    expect(buildAutocompleteUserPrompt('Hello')).toContain('Hello');
    expect(buildAutocompleteUserPrompt('Hello', 'Notes')).toContain('Notes');
  });

  it('returns only the suffix when model repeats existing text', () => {
    expect(normalizeAutocompleteCompletion('Hello ', 'Hello world')).toBe('world');
  });

  it('returns empty when completion duplicates trailing text', () => {
    expect(normalizeAutocompleteCompletion('Hello world', 'world')).toBe('');
  });

  it('trims and keeps standalone completion', () => {
    expect(normalizeAutocompleteCompletion('Hi', ' there')).toBe('there');
  });
});
