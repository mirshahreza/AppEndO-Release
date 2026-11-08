import { describe, expect, it } from 'vitest';
import {
  detectProposalConfirmIntent,
  findPendingVibeProposal,
  getProposalConfirmLabel,
} from '../vibeProposalUi';
import type { ChangeSet } from '../../api/contracts/ai/agentTypes';

describe('vibeProposalUi', () => {
  it('detects short confirm phrases', () => {
    expect(detectProposalConfirmIntent('confirm')).toBe(true);
    expect(detectProposalConfirmIntent('apply')).toBe(true);
    expect(detectProposalConfirmIntent('create a new server function')).toBe(false);
  });

  it('finds latest unapplied assistant proposal', () => {
    const messages = [
      { role: 'user', content: 'build fn' },
      {
        role: 'assistant',
        vibeProposal: { proposalId: 'p1', changeSets: [] as ChangeSet[] },
      },
      { role: 'user', content: 'ok' },
      {
        role: 'assistant',
        vibeProposal: { proposalId: 'p2', changeSets: [] as ChangeSet[] },
        vibeApplied: true,
      },
    ];
    expect(findPendingVibeProposal(messages)?.proposal.proposalId).toBe('p1');
  });

  it('labels create vs apply by change set kind', () => {
    const fnChangeSet: ChangeSet = {
      id: 'cs-1',
      kind: 'function_source_patch',
      title: 'Server function: Ping',
      functionId: 'custom.ping',
      patch: { source: 'export {}' },
    };
    expect(getProposalConfirmLabel([fnChangeSet])).toBe('Create function');
    expect(getProposalConfirmLabel([fnChangeSet], { applied: true })).toBe('Created');
  });
});
