import { describe, expect, it } from 'vitest';
import { buildManifestScopedAccessDecisions } from '../mergeManifestAccessDecisions';

describe('buildManifestScopedAccessDecisions', () => {
  it('updates only manifest ids and preserves other allows', () => {
    const decisions = buildManifestScopedAccessDecisions({
      manifestFunctionIds: ['fn-a', 'fn-b'],
      allowedByFunctionId: { 'fn-a': true, 'fn-b': false },
      currentDecisions: {
        'fn-a': 'none',
        'fn-b': 'allow',
        'fn-other': 'allow',
      },
    });

    expect(decisions).toEqual({
      'fn-a': 'allow',
      'fn-b': 'none',
      'fn-other': 'allow',
    });
  });
});
