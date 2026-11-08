import { describe, expect, it } from 'vitest';
import {
  buildTransformSystemPrompt,
  mergeSelectionTransform,
  stripAiResponseWrapping,
} from '../buildTransformPrompt';

describe('buildTransformPrompt', () => {
  it('builds action-specific system prompts', () => {
    expect(buildTransformSystemPrompt('expand')).toMatch(/Expand the text/i);
    expect(buildTransformSystemPrompt('translate', { targetLanguage: 'Persian' })).toMatch(/Persian/i);
  });

  it('includes field label hint when provided', () => {
    const prompt = buildTransformSystemPrompt('summarize', { fieldLabel: 'Notes' });
    expect(prompt).toContain('Notes');
  });

  it('includes single-line rules when fieldKind is singleLine', () => {
    const prompt = buildTransformSystemPrompt('formal', { fieldKind: 'singleLine', fieldLabel: 'Title' });
    expect(prompt).toContain('single-line');
    expect(prompt).toContain('Title');
    expect(prompt).toMatch(/Be concise/i);
  });

  it('expands single-line fields without asking for concision', () => {
    const prompt = buildTransformSystemPrompt('expand', { fieldKind: 'singleLine', fieldLabel: 'Title' });
    expect(prompt).toContain('single-line');
    expect(prompt).toMatch(/Expand the text/i);
    expect(prompt).not.toMatch(/Be concise/i);
  });

  it('strips markdown fences from AI output', () => {
    expect(stripAiResponseWrapping('```markdown\nHello\n```')).toBe('Hello');
    expect(stripAiResponseWrapping('plain')).toBe('plain');
  });

  it('merges selection transforms back into full text', () => {
    expect(mergeSelectionTransform('Hello world', 6, 11, 'earth')).toBe('Hello earth');
  });
});
