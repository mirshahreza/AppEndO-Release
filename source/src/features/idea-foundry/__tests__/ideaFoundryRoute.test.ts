import { describe, expect, it } from 'vitest';
import {
  buildIdeaFoundryEditRelativePath,
  buildIdeaFoundryListRelativePath,
  parseIdeaFoundryEditSlug,
  parseIdeaFoundryEditSlugFromPathname,
  resolveIdeaFoundryRouteSuffix,
  resolveIdeaIdFromEditSlug,
} from '../ideaFoundryRoute';
import { buildIdeaFoundryShellHeaderOverride } from '../hooks/useIdeaFoundryShellHeader';

describe('ideaFoundryRoute', () => {
  it('parses view suffixes only from idea-foundry/edit', () => {
    expect(resolveIdeaFoundryRouteSuffix('studio/idea-foundry')).toBeUndefined();
    expect(resolveIdeaFoundryRouteSuffix('studio/idea-foundry/idea-1')).toBeUndefined();
    expect(resolveIdeaFoundryRouteSuffix('studio/idea-foundry/edit')).toBeUndefined();
    expect(resolveIdeaFoundryRouteSuffix('studio/idea-foundry/edit/idea-1')).toBe('idea-1');
    expect(resolveIdeaFoundryRouteSuffix('us/studio/idea-foundry/edit/idea-1')).toBe('idea-1');
    expect(resolveIdeaFoundryRouteSuffix('edit/idea-1')).toBe('idea-1');
  });

  it('parses edit slugs from path suffixes and pathnames', () => {
    expect(parseIdeaFoundryEditSlug('studio/idea-foundry/edit/idea-1')).toBe('idea-1');
    expect(parseIdeaFoundryEditSlug('studio/idea-foundry/idea-1')).toBeNull();
    expect(parseIdeaFoundryEditSlug(undefined)).toBeNull();
    expect(parseIdeaFoundryEditSlugFromPathname('/us/studio/idea-foundry/edit/idea-1')).toBe('idea-1');
    expect(parseIdeaFoundryEditSlugFromPathname('/studio/idea-foundry')).toBeNull();
  });

  it('builds bookmarkable relative paths', () => {
    expect(buildIdeaFoundryListRelativePath()).toBe('idea-foundry');
    expect(buildIdeaFoundryEditRelativePath('idea-1')).toBe('idea-foundry/edit/idea-1');
  });

  it('includes the studio portal segment for culture mounts', () => {
    expect(buildIdeaFoundryListRelativePath('us')).toBe('studio/idea-foundry');
    expect(buildIdeaFoundryEditRelativePath('idea-1', 'us')).toBe('studio/idea-foundry/edit/idea-1');
  });

  it('decodes the idea id from the edit slug', () => {
    expect(resolveIdeaIdFromEditSlug('idea-1')).toBe('idea-1');
    expect(resolveIdeaIdFromEditSlug(encodeURIComponent('idea 1'))).toBe('idea 1');
  });

  it('appends Edit on the shell trail without the idea title', () => {
    const override = buildIdeaFoundryShellHeaderOverride('Idea Foundry');
    expect(override.titleTrail).toEqual(['Idea Foundry', 'Edit']);
    expect(override.label).toBe('Idea Foundry');
  });
});
