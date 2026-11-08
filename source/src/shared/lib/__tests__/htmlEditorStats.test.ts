import { describe, expect, it } from 'vitest';
import { computeHtmlEditorStats } from '../htmlEditorStats';

describe('computeHtmlEditorStats', () => {
  it('counts empty documents as zeros', () => {
    expect(computeHtmlEditorStats('')).toEqual({
      characters: 0,
      charactersNoTags: 0,
      words: 0,
    });
  });

  it('ignores tags when counting words', () => {
    const stats = computeHtmlEditorStats('<p>Hello <strong>world</strong></p>');
    expect(stats.words).toBe(2);
    expect(stats.charactersNoTags).toBe('Hello world'.length);
    expect(stats.characters).toBeGreaterThan(stats.charactersNoTags);
  });
});
