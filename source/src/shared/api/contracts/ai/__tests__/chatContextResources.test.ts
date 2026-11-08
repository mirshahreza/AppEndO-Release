import { describe, expect, it } from 'vitest';
import {
  buildAiSystemContextWithResources,
  buildEffectivePageContext,
  resolveAgentRunPageContext,
  getAvailableChatContextResources,
  isVibeStudioPageContext,
  MAX_PROJECT_NOTES_CHARS,
  normalizeChatContextResourceIds,
  resolveChatContextResources,
  resolveDefaultAgentContextResourceIds,
  resolveDefaultChatMode,
  truncateProjectNotes,
} from '../chatContextResources';
import type { AiPageContext } from '../pageContext';

const basePageContext: AiPageContext = {
  path: '/studio/users',
  pageLabel: 'Users',
  pageKey: 'users',
};

describe('truncateProjectNotes', () => {
  it('passes through notes under the cap', () => {
    const notes = 'Use AppTableGrid for all data grids.';
    expect(truncateProjectNotes(notes)).toEqual({ text: notes, truncated: false });
  });

  it('truncates with hint when over the cap', () => {
    const notes = 'n'.repeat(MAX_PROJECT_NOTES_CHARS + 200);
    const result = truncateProjectNotes(notes);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(MAX_PROJECT_NOTES_CHARS);
    expect(result.text).toContain('Project notes truncated');
  });
});

describe('buildAiSystemContextWithResources', () => {
  it('includes truncated project notes when notes resource is attached', () => {
    const longNotes = 'p'.repeat(MAX_PROJECT_NOTES_CHARS + 100);
    const context = buildAiSystemContextWithResources(
      undefined,
      ['notes'],
      'Base assistant.',
      { projectNotes: longNotes },
    );

    expect(context).toContain('Workspace project notes');
    expect(context).not.toContain(longNotes);
    expect(context).toContain('Project notes truncated');
  });

  it('omits project notes when notes resource is not attached', () => {
    const context = buildAiSystemContextWithResources(
      undefined,
      [],
      'Base assistant.',
      { projectNotes: 'Remember to use AppTableGrid.' },
    );

    expect(context).not.toContain('Workspace project notes');
    expect(context).not.toContain('Remember to use AppTableGrid.');
  });

  it('includes feature graph block when feature resource is attached', () => {
    const context = buildAiSystemContextWithResources(
      basePageContext,
      ['feature'],
      'Base assistant.',
    );

    expect(context).toContain('Feature graph — users');
    expect(context).toContain('get_feature_graph({ pageKey: "users" })');
  });
});

describe('getAvailableChatContextResources', () => {
  it('includes page (with embedded grid data) and feature when pageKey is present', () => {
    const available = getAvailableChatContextResources(basePageContext);
    expect(available.map((option) => option.id)).toEqual(
      expect.arrayContaining(['page', 'standards', 'feature']),
    );
    expect(available.map((option) => option.id)).not.toContain('grid');
  });

  it('includes notes only when project notes exist', () => {
    const withoutNotes = getAvailableChatContextResources(basePageContext);
    expect(withoutNotes.map((option) => option.id)).not.toContain('notes');

    const withNotes = getAvailableChatContextResources(basePageContext, { hasProjectNotes: true });
    expect(withNotes.map((option) => option.id)).toContain('notes');
  });
});

describe('buildEffectivePageContext', () => {
  it('includes grid fields when page resource is attached', () => {
    const effective = buildEffectivePageContext(
      {
        ...basePageContext,
        entityType: 'users',
        activeFilters: { search: 'alice' },
        sort: { field: 'name', direction: 'asc' },
      },
      ['page'],
    );
    expect(effective?.entityType).toBe('users');
    expect(effective?.activeFilters).toEqual({ search: 'alice' });
    expect(effective?.sort).toEqual({ field: 'name', direction: 'asc' });
  });

  it('falls back to pageKey for entityType inside page slice', () => {
    const effective = buildEffectivePageContext(basePageContext, ['page']);
    expect(effective?.entityType).toBe('users');
  });

  it('includes functionId when function resource is attached', () => {
    const effective = buildEffectivePageContext(
      {
        ...basePageContext,
        functionId: 'fn-1',
        functionName: 'listUsers',
      },
      ['function'],
    );
    expect(effective?.functionId).toBe('fn-1');
    expect(effective?.functionName).toBe('listUsers');
  });
});

describe('resolveAgentRunPageContext', () => {
  it('keeps server-functions pageKey when only standards chip is attached', () => {
    const full: AiPageContext = {
      path: '/studio/server-functions',
      pageLabel: 'Server Functions',
      pageKey: 'server-functions',
    };
    const effective = resolveAgentRunPageContext(full, ['standards']);
    expect(effective?.pageKey).toBe('server-functions');
    expect(effective?.path).toBe('/studio/server-functions');
  });

  it('keeps open function context when optional chips are detached', () => {
    const full: AiPageContext = {
      path: '/us/studio/server-functions/math/sum-two-numbers',
      pageLabel: 'Server Functions',
      pageKey: 'server-functions',
      functionId: 'math.sum-two-numbers',
      functionName: 'sum-two-numbers',
    };
    const effective = resolveAgentRunPageContext(full, ['standards']);
    expect(effective?.functionId).toBe('math.sum-two-numbers');
    expect(effective?.functionName).toBe('sum-two-numbers');
    expect(effective?.pageKey).toBe('server-functions');
  });

  it('returns scoped context for non-studio pages', () => {
    const effective = resolveAgentRunPageContext(basePageContext, ['page']);
    expect(effective?.pageKey).toBe('users');
  });
});

describe('normalizeChatContextResourceIds', () => {
  it('maps legacy grid id to page', () => {
    expect(normalizeChatContextResourceIds(['grid', 'standards'])).toEqual(['page', 'standards']);
  });
});

describe('isVibeStudioPageContext', () => {
  it('detects server-functions and designer context', () => {
    expect(isVibeStudioPageContext({
      path: '/server-functions',
      pageLabel: 'Server Functions',
      pageKey: 'server-functions',
    })).toBe(true);
    expect(isVibeStudioPageContext({
      path: '/designer',
      pageLabel: 'Designer',
      layoutId: 'layout-1',
    })).toBe(true);
    expect(isVibeStudioPageContext({
      path: '/users',
      pageLabel: 'Users',
      pageKey: 'users',
    })).toBe(false);
  });
});

describe('resolveDefaultChatMode', () => {
  it('defaults to agent on vibe studio pages', () => {
    expect(resolveDefaultChatMode({
      path: '/client-components',
      pageLabel: 'Client Components',
      pageKey: 'client-components',
    })).toBe('agent');
    expect(resolveDefaultChatMode({
      path: '/users',
      pageLabel: 'Users',
      pageKey: 'users',
    })).toBe('ask');
  });
});

describe('resolveChatContextResources', () => {
  it('merges agent defaults with standards and feature on studio pages', () => {
    const resources = resolveChatContextResources('agent', [], basePageContext);
    expect(resources).toEqual(expect.arrayContaining(['page', 'standards', 'feature']));
  });

  it('keeps ask mode on user-attached resources only', () => {
    const resources = resolveChatContextResources('ask', ['standards'], basePageContext);
    expect(resources).toEqual(['page', 'standards']);
  });

  it('includes function resource when editor is open', () => {
    const resources = resolveDefaultAgentContextResourceIds({
      path: '/server-functions',
      pageLabel: 'Server Functions',
      pageKey: 'server-functions',
      functionId: 'list-users',
    });
    expect(resources).toEqual(expect.arrayContaining(['function', 'standards', 'feature']));
  });
});
