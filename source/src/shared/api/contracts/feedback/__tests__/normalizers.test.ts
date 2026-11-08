import { describe, expect, it } from 'vitest';
import {
  normalizePlatformFeedbackConfig,
  normalizeRoutingTarget,
} from '../normalizers';
import {
  DEFAULT_PLATFORM_FEEDBACK_POLICY,
  FEEDBACK_SUBJECT_BUG,
} from '../constants';

describe('feedback normalizers', () => {
  it('normalizes disabled default config without settings topics', () => {
    const config = normalizePlatformFeedbackConfig(undefined);
    expect(config.policy.enabled).toBe(false);
    expect(config.routingRules).toEqual([]);
    expect('topics' in config).toBe(false);
    expect('enabledTypes' in config.policy).toBe(false);
  });

  it('preserves enabled policy flags', () => {
    const config = normalizePlatformFeedbackConfig({
      policy: {
        ...DEFAULT_PLATFORM_FEEDBACK_POLICY,
        enabled: true,
        allowAnonymous: true,
      },
    });
    expect(config.policy.enabled).toBe(true);
    expect(config.policy.allowAnonymous).toBe(true);
  });

  it('resolves routing targets', () => {
    expect(normalizeRoutingTarget({ kind: 'USER', userId: 42 })).toEqual({ kind: 'USER', userId: 42 });
    expect(normalizeRoutingTarget({ kind: 'ROLE', roleName: 'SUPPORT' })).toEqual({
      kind: 'ROLE',
      roleName: 'SUPPORT',
    });
    expect(normalizeRoutingTarget({ kind: 'ROLE', roleName: '' })).toEqual({ kind: 'UNASSIGNED' });
  });

  it('normalizes routing rules with Base Info subject codes', () => {
    const config = normalizePlatformFeedbackConfig({
      routingRules: [
        {
          id: 'rule-1',
          priority: 10,
          subjectId: FEEDBACK_SUBJECT_BUG,
          portalSlug: null,
          target: { kind: 'UNASSIGNED' },
          notifyTarget: false,
        },
      ],
    });
    expect(config.routingRules[0]?.subjectId).toBe(FEEDBACK_SUBJECT_BUG);
  });

  it('ignores legacy topics/enabledTypes from stored settings blobs', () => {
    const config = normalizePlatformFeedbackConfig({
      policy: {
        ...DEFAULT_PLATFORM_FEEDBACK_POLICY,
        enabledTypes: ['BUG'],
      },
      topics: [{ id: 'legacy', slug: 'legacy', label: 'Legacy', enabled: true, sortOrder: 1 }],
    });
    expect('topics' in config).toBe(false);
    expect('enabledTypes' in config.policy).toBe(false);
  });
});
