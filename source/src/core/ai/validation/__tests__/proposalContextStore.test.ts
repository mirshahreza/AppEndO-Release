import { describe, expect, it } from 'vitest';
import { clearProposalContexts, getProposalContext, putProposalContext } from '../proposalContextStore';

describe('proposalContextStore', () => {
  it('round-trips a stored context by proposalId', () => {
    clearProposalContexts();
    putProposalContext('prop-1', {
      pageContext: { path: '/functions/x', functionId: 'fn-x' } as never,
      userIntentPaths: ['src/server/functions/fn-x.ts'],
    });

    const context = getProposalContext('prop-1');
    expect(context?.userIntentPaths).toEqual(['src/server/functions/fn-x.ts']);
    expect((context?.pageContext as { functionId?: string } | undefined)?.functionId).toBe('fn-x');
  });

  it('returns undefined for an unknown proposalId', () => {
    clearProposalContexts();
    expect(getProposalContext('missing')).toBeUndefined();
  });
});
