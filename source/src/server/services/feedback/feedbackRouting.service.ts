import type {
  FeedbackRoutingRule,
  FeedbackRoutingTarget,
  FeedbackSubject,
  PlatformFeedbackConfig,
} from '../../../shared/api/contracts/feedback/types';

export type FeedbackRoutingInput = {
  subjectId: FeedbackSubject;
  portalSlug: string | null;
};

export type FeedbackRoutingResult = {
  target: FeedbackRoutingTarget;
  routingRuleId: string | null;
};

const matchesRule = (
  rule: FeedbackRoutingRule,
  input: FeedbackRoutingInput,
): boolean => {
  if (rule.subjectId && rule.subjectId !== input.subjectId) return false;
  if (rule.portalSlug && rule.portalSlug !== input.portalSlug) return false;
  return true;
};

export const resolveFeedbackRouting = (
  config: PlatformFeedbackConfig,
  input: FeedbackRoutingInput,
): FeedbackRoutingResult => {
  const sorted = [...config.routingRules].sort((left, right) => left.priority - right.priority);
  const matched = sorted.find((rule) => matchesRule(rule, input));
  if (matched) {
    return { target: matched.target, routingRuleId: matched.id };
  }
  return { target: config.policy.defaultRoutingTarget, routingRuleId: null };
};

export const applyRoutingTarget = (target: FeedbackRoutingTarget): {
  assigneeUserId: number | null;
  assigneeRoleName: string | null;
} => {
  if (target.kind === 'USER') {
    return { assigneeUserId: target.userId, assigneeRoleName: null };
  }
  if (target.kind === 'ROLE') {
    return { assigneeUserId: null, assigneeRoleName: target.roleName };
  }
  return { assigneeUserId: null, assigneeRoleName: null };
};
