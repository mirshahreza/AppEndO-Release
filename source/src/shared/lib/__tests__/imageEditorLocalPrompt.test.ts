import { describe, expect, it } from 'vitest';
import { matchLocalImageEditPrompt } from '../imageEditorLocalPrompt';

describe('imageEditorLocalPrompt', () => {
  it('matches explicit rotation degrees', () => {
    expect(matchLocalImageEditPrompt('rotate 33 degrees clockwise')).toEqual({
      kind: 'rotate',
      degrees: 33,
    });
  });

  it('matches rotation prompts with non-Latin digits', () => {
    expect(matchLocalImageEditPrompt('rotate \u06F3\u06F3 degrees clockwise')).toEqual({
      kind: 'rotate',
      degrees: 33,
    });
  });

  it('matches quality enhancement prompts', () => {
    expect(matchLocalImageEditPrompt('enhance quality of this image')).toEqual({
      kind: 'upscale',
      factor: 1.5,
    });
  });

  it('returns null for unsupported creative prompts', () => {
    expect(matchLocalImageEditPrompt('remove the background completely')).toBeNull();
  });
});
