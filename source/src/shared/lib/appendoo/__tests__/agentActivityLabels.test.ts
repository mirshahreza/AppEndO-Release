import { describe, expect, it } from 'vitest';
import {
  describePreloadedRetrieveSources,
  formatAgentActivityLabel,
  formatAgentTurnSummaryMessage,
  formatScaffoldSeedActivity,
} from '../agentActivityLabels';

describe('agentActivityLabels extensions', () => {
  it('describes preload sources in English', () => {
    expect(describePreloadedRetrieveSources({
      playbookStandards: true,
      functionContext: true,
    }, 'en')).toEqual(['playbook', 'open server function']);
  });

  it('formats scaffold seed activity', () => {
    const label = formatScaffoldSeedActivity(['playbook', 'open server function'], 'en');
    expect(label.title).toContain('Starting idea from server seed');
    expect(label.detail).toContain('playbook');
  });

  it('formats structured turn summary', () => {
    const text = formatAgentTurnSummaryMessage({
      retrievalOperationCount: 2,
      draftToolCount: 1,
      changeSetCount: 1,
      changeSetTitles: ['Update handler'],
      locale: 'en',
    });
    expect(text).toContain('Retrieved via tools: 2 step(s)');
    expect(text).toContain('Update handler');
  });

  it('prefers model intention over static fallback', () => {
    const label = formatAgentActivityLabel(
      'read_file',
      { path: 'src/foo.ts' },
      'en',
      'Model-provided intention',
    );
    expect(label.intention).toBe('Model-provided intention');
  });
});
