import { describe, expect, it } from 'vitest';
import {
  MODEL_STORY_EXTENSION_KEY,
  isModelStoryEmpty,
  normalizeModelStoryForStorage,
  readModelStoryFromExtensions,
} from '../edgeModelStory';

describe('edgeModelStory', () => {
  it('reads markdown story from extensions', () => {
    const story = readModelStoryFromExtensions({
      [MODEL_STORY_EXTENSION_KEY]: '## Purpose\n\nDomain rules here.',
    });
    expect(story).toBe('## Purpose\n\nDomain rules here.');
  });

  it('treats blank markdown as empty', () => {
    expect(isModelStoryEmpty('')).toBe(true);
    expect(isModelStoryEmpty('   ')).toBe(true);
    expect(isModelStoryEmpty('## Purpose')).toBe(false);
  });

  it('normalizes story for storage', () => {
    expect(normalizeModelStoryForStorage('  ## Ok\n\nBody  ')).toBe('## Ok\n\nBody');
  });
});
