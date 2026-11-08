import { describe, expect, it } from 'vitest';
import {
  buildContextSuggestUserPrompt,
  normalizeContextSuggestion,
} from '../buildContextSuggestPrompt';

describe('buildContextSuggestPrompt', () => {
  it('builds placeholder prompt from field and section context', () => {
    const prompt = buildContextSuggestUserPrompt({
      mode: 'placeholder',
      fieldLabel: 'Notes',
      sectionDescription: 'Deployment metadata',
      neighborFields: [{ label: 'Display name', value: 'Northwind API' }],
    });

    expect(prompt).toContain('Notes');
    expect(prompt).toContain('Deployment metadata');
    expect(prompt).toContain('Northwind API');
    expect(prompt).toContain('placeholder');
  });

  it('normalizes single-line suggestions without line breaks', () => {
    expect(normalizeContextSuggestion('Hello\nworld', 'content', 'singleLine')).toBe('Hello world');
  });
});
