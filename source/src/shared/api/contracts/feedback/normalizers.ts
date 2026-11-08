import { DEFAULT_PLATFORM_FEEDBACK_POLICY } from './constants';
import type {
  FeedbackRoutingRule,
  FeedbackRoutingTarget,
  FeedbackSubject,
  PlatformFeedbackConfig,
  PlatformFeedbackPolicy,
} from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const asNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asStringArray = (value: unknown, fallback: string[]): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : fallback;

const normalizeFeedbackSubjectCode = (value: unknown): FeedbackSubject | null => {
  const raw = asString(value).trim();
  return raw ? raw : null;
};

export const normalizeRoutingTarget = (value: unknown): FeedbackRoutingTarget => {
  if (!isRecord(value)) {
    return { kind: 'UNASSIGNED' };
  }
  const kind = asString(value.kind).toUpperCase();
  if (kind === 'USER') {
    const userId = asNumber(value.userId, NaN);
    return Number.isFinite(userId) ? { kind: 'USER', userId } : { kind: 'UNASSIGNED' };
  }
  if (kind === 'ROLE') {
    const roleName = asString(value.roleName).trim();
    return roleName ? { kind: 'ROLE', roleName } : { kind: 'UNASSIGNED' };
  }
  return { kind: 'UNASSIGNED' };
};

export const normalizeRoutingRule = (value: unknown): FeedbackRoutingRule | null => {
  if (!isRecord(value)) return null;
  const id = asString(value.id).trim();
  if (!id) return null;
  const subjectRaw = value.subjectId;
  const subjectId = subjectRaw == null ? null : normalizeFeedbackSubjectCode(subjectRaw);
  if (subjectRaw != null && !subjectId) return null;
  return {
    id,
    priority: asNumber(value.priority, 999),
    subjectId,
    portalSlug: value.portalSlug == null ? null : asString(value.portalSlug).trim() || null,
    target: normalizeRoutingTarget(value.target),
    notifyTarget: asBoolean(value.notifyTarget, false),
  };
};

export const normalizeFeedbackPolicy = (value: unknown): PlatformFeedbackPolicy => {
  const raw = isRecord(value) ? value : {};
  return {
    ...DEFAULT_PLATFORM_FEEDBACK_POLICY,
    enabled: asBoolean(raw.enabled, DEFAULT_PLATFORM_FEEDBACK_POLICY.enabled),
    allowAuthenticated: asBoolean(raw.allowAuthenticated, DEFAULT_PLATFORM_FEEDBACK_POLICY.allowAuthenticated),
    allowAnonymous: asBoolean(raw.allowAnonymous, DEFAULT_PLATFORM_FEEDBACK_POLICY.allowAnonymous),
    showContactFieldsForAnonymous: asBoolean(
      raw.showContactFieldsForAnonymous,
      DEFAULT_PLATFORM_FEEDBACK_POLICY.showContactFieldsForAnonymous,
    ),
    requireContactForAnonymous: asBoolean(
      raw.requireContactForAnonymous,
      DEFAULT_PLATFORM_FEEDBACK_POLICY.requireContactForAnonymous,
    ),
    requireSubject: asBoolean(raw.requireSubject, DEFAULT_PLATFORM_FEEDBACK_POLICY.requireSubject),
    requireTitle: asBoolean(raw.requireTitle, DEFAULT_PLATFORM_FEEDBACK_POLICY.requireTitle),
    allowAttachments: asBoolean(raw.allowAttachments, DEFAULT_PLATFORM_FEEDBACK_POLICY.allowAttachments),
    maxAttachmentsPerMessage: asNumber(
      raw.maxAttachmentsPerMessage,
      DEFAULT_PLATFORM_FEEDBACK_POLICY.maxAttachmentsPerMessage,
    ),
    maxAttachmentSizeBytes: asNumber(
      raw.maxAttachmentSizeBytes,
      DEFAULT_PLATFORM_FEEDBACK_POLICY.maxAttachmentSizeBytes,
    ),
    allowedAttachmentMimeTypes: asStringArray(
      raw.allowedAttachmentMimeTypes,
      [...DEFAULT_PLATFORM_FEEDBACK_POLICY.allowedAttachmentMimeTypes],
    ),
    captureContext: asBoolean(raw.captureContext, DEFAULT_PLATFORM_FEEDBACK_POLICY.captureContext),
    portalAllowlist: Array.isArray(raw.portalAllowlist)
      ? raw.portalAllowlist.filter((item): item is string => typeof item === 'string')
      : null,
    pageKeyDenylist: asStringArray(raw.pageKeyDenylist, [...DEFAULT_PLATFORM_FEEDBACK_POLICY.pageKeyDenylist]),
    rateLimitPerIpPerHour: asNumber(raw.rateLimitPerIpPerHour, DEFAULT_PLATFORM_FEEDBACK_POLICY.rateLimitPerIpPerHour),
    rateLimitPerUserPerHour: asNumber(
      raw.rateLimitPerUserPerHour,
      DEFAULT_PLATFORM_FEEDBACK_POLICY.rateLimitPerUserPerHour,
    ),
    retentionDays: raw.retentionDays == null
      ? DEFAULT_PLATFORM_FEEDBACK_POLICY.retentionDays
      : asNumber(raw.retentionDays, DEFAULT_PLATFORM_FEEDBACK_POLICY.retentionDays ?? 365),
    notifyAdminOnNew: asBoolean(raw.notifyAdminOnNew, DEFAULT_PLATFORM_FEEDBACK_POLICY.notifyAdminOnNew),
    showOnDashboard: asBoolean(raw.showOnDashboard, DEFAULT_PLATFORM_FEEDBACK_POLICY.showOnDashboard),
    dashboardPreviewLimit: asNumber(
      raw.dashboardPreviewLimit,
      DEFAULT_PLATFORM_FEEDBACK_POLICY.dashboardPreviewLimit,
    ),
    allowSubmitterReplies: asBoolean(
      raw.allowSubmitterReplies,
      DEFAULT_PLATFORM_FEEDBACK_POLICY.allowSubmitterReplies,
    ),
    maxMessagesPerTicket: asNumber(raw.maxMessagesPerTicket, DEFAULT_PLATFORM_FEEDBACK_POLICY.maxMessagesPerTicket),
    widgetPlacement: raw.widgetPlacement === 'fab'
      || raw.widgetPlacement === 'header-menu'
      || raw.widgetPlacement === 'footer-link'
      ? raw.widgetPlacement
      : DEFAULT_PLATFORM_FEEDBACK_POLICY.widgetPlacement,
    defaultRoutingTarget: normalizeRoutingTarget(raw.defaultRoutingTarget),
    allowRoleClaim: asBoolean(raw.allowRoleClaim, DEFAULT_PLATFORM_FEEDBACK_POLICY.allowRoleClaim),
    notifyRoleOnRoute: asBoolean(raw.notifyRoleOnRoute, DEFAULT_PLATFORM_FEEDBACK_POLICY.notifyRoleOnRoute),
  };
};

export const normalizePlatformFeedbackConfig = (value: unknown): PlatformFeedbackConfig => {
  const raw = isRecord(value) ? value : {};
  const routingRules = Array.isArray(raw.routingRules)
    ? raw.routingRules.map(normalizeRoutingRule).filter((item): item is FeedbackRoutingRule => item != null)
    : [];
  return {
    policy: normalizeFeedbackPolicy(raw.policy ?? raw),
    routingRules,
  };
};
