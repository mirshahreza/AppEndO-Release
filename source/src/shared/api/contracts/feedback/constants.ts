import type { PlatformFeedbackPolicy } from './types';

/** Base Info root under `100 Base` for feedback Subject LOV. */
export const BASE_INFO_ROOT_FEEDBACK_SUBJECT = '100.3';

/** Seeded Feedback Subject codes (children of 100.3). */
export const FEEDBACK_SUBJECT_BUG = '100.3.1';
export const FEEDBACK_SUBJECT_SUGGESTION = '100.3.2';
export const FEEDBACK_SUBJECT_QUESTION = '100.3.3';
export const FEEDBACK_SUBJECT_PRAISE = '100.3.4';

/** Default subject codes used when Base Info is unavailable (tests / offline fallback). */
export const FEEDBACK_SUBJECT_CODES = [
  FEEDBACK_SUBJECT_BUG,
  FEEDBACK_SUBJECT_SUGGESTION,
  FEEDBACK_SUBJECT_QUESTION,
  FEEDBACK_SUBJECT_PRAISE,
] as const;

export const FEEDBACK_STATUSES = [
  'NEW',
  'TRIAGED',
  'IN_PROGRESS',
  'RESOLVED',
  'WONT_FIX',
  'DUPLICATE',
] as const;

export const FEEDBACK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;

export const FEEDBACK_MESSAGE_KINDS = ['SUBMITTER', 'STAFF', 'INTERNAL'] as const;

export const FEEDBACK_INBOX_BUCKETS = [
  'ASSIGNED_TO_ME',
  'MY_ROLE_QUEUE',
  'UNASSIGNED',
  'ALL',
] as const;

export const DEFAULT_ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

export const DEFAULT_PLATFORM_FEEDBACK_POLICY: PlatformFeedbackPolicy = {
  enabled: false,
  allowAuthenticated: true,
  allowAnonymous: false,
  showContactFieldsForAnonymous: true,
  requireContactForAnonymous: false,
  requireSubject: true,
  requireTitle: true,
  allowAttachments: true,
  maxAttachmentsPerMessage: 3,
  maxAttachmentSizeBytes: 5 * 1024 * 1024,
  allowedAttachmentMimeTypes: [...DEFAULT_ALLOWED_ATTACHMENT_MIME_TYPES],
  captureContext: true,
  portalAllowlist: null,
  // Keep Settings out of the denylist so operators can verify the header entry
  // while configuring Feedback (auth/install remain blocked).
  pageKeyDenylist: ['auth', 'install'],
  rateLimitPerIpPerHour: 20,
  rateLimitPerUserPerHour: 10,
  retentionDays: 365,
  notifyAdminOnNew: false,
  showOnDashboard: true,
  dashboardPreviewLimit: 5,
  allowSubmitterReplies: true,
  maxMessagesPerTicket: 50,
  widgetPlacement: 'header-menu',
  defaultRoutingTarget: { kind: 'UNASSIGNED' },
  allowRoleClaim: true,
  notifyRoleOnRoute: true,
};
