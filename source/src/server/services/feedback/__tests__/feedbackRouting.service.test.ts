import { describe, expect, it } from 'vitest';
import { applyRoutingTarget, resolveFeedbackRouting } from '../feedbackRouting.service';
import { normalizePlatformFeedbackConfig } from '../../../../shared/api/contracts/feedback/normalizers';
import {
  FEEDBACK_SUBJECT_BUG,
  FEEDBACK_SUBJECT_QUESTION,
} from '../../../../shared/api/contracts/feedback/constants';

describe('feedbackRouting.service', () => {
  const baseConfig = normalizePlatformFeedbackConfig({
    policy: {
      enabled: true,
      defaultRoutingTarget: { kind: 'ROLE', roleName: 'SUPPORT' },
    },
    routingRules: [
      {
        id: 'rule-bug',
        priority: 10,
        subjectId: FEEDBACK_SUBJECT_BUG,
        portalSlug: null,
        target: { kind: 'USER', userId: 7 },
        notifyTarget: true,
      },
    ],
  });

  it('matches the highest-priority routing rule', () => {
    const result = resolveFeedbackRouting(baseConfig, {
      subjectId: FEEDBACK_SUBJECT_BUG,
      portalSlug: 'studio',
    });
    expect(result).toEqual({
      target: { kind: 'USER', userId: 7 },
      routingRuleId: 'rule-bug',
    });
  });

  it('falls back to default routing target', () => {
    const result = resolveFeedbackRouting(baseConfig, {
      subjectId: FEEDBACK_SUBJECT_QUESTION,
      portalSlug: 'studio',
    });
    expect(result).toEqual({
      target: { kind: 'ROLE', roleName: 'SUPPORT' },
      routingRuleId: null,
    });
  });

  it('maps routing targets to assignee fields', () => {
    expect(applyRoutingTarget({ kind: 'USER', userId: 3 })).toEqual({
      assigneeUserId: 3,
      assigneeRoleName: null,
    });
    expect(applyRoutingTarget({ kind: 'ROLE', roleName: 'ADMIN' })).toEqual({
      assigneeUserId: null,
      assigneeRoleName: 'ADMIN',
    });
    expect(applyRoutingTarget({ kind: 'UNASSIGNED' })).toEqual({
      assigneeUserId: null,
      assigneeRoleName: null,
    });
  });
});
