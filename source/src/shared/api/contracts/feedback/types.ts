import type {
  DEFAULT_ALLOWED_ATTACHMENT_MIME_TYPES,
  FEEDBACK_INBOX_BUCKETS,
  FEEDBACK_MESSAGE_KINDS,
  FEEDBACK_PRIORITIES,
  FEEDBACK_STATUSES,
} from './constants';

/** Base Info code under Feedback Subject root (`100.3.*`). */
export type FeedbackSubject = string;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];
export type FeedbackMessageKind = (typeof FEEDBACK_MESSAGE_KINDS)[number];
export type FeedbackInboxBucket = (typeof FEEDBACK_INBOX_BUCKETS)[number];
export type FeedbackWidgetPlacement = 'fab' | 'header-menu' | 'footer-link';

export type FeedbackRoutingTarget =
  | { kind: 'USER'; userId: number }
  | { kind: 'ROLE'; roleName: string }
  | { kind: 'UNASSIGNED' };

export type PlatformFeedbackPolicy = {
  enabled: boolean;
  allowAuthenticated: boolean;
  allowAnonymous: boolean;
  showContactFieldsForAnonymous: boolean;
  requireContactForAnonymous: boolean;
  requireSubject: boolean;
  requireTitle: boolean;
  allowAttachments: boolean;
  maxAttachmentsPerMessage: number;
  maxAttachmentSizeBytes: number;
  allowedAttachmentMimeTypes: string[];
  captureContext: boolean;
  portalAllowlist: string[] | null;
  pageKeyDenylist: string[];
  rateLimitPerIpPerHour: number;
  rateLimitPerUserPerHour: number;
  retentionDays: number | null;
  notifyAdminOnNew: boolean;
  showOnDashboard: boolean;
  dashboardPreviewLimit: number;
  allowSubmitterReplies: boolean;
  maxMessagesPerTicket: number;
  widgetPlacement: FeedbackWidgetPlacement;
  defaultRoutingTarget: FeedbackRoutingTarget;
  allowRoleClaim: boolean;
  notifyRoleOnRoute: boolean;
};

/** Option row for Subject (sourced from Base Info at runtime). */
export type FeedbackSubjectOption = {
  id: string;
  label: string;
};

export type FeedbackRoutingRule = {
  id: string;
  priority: number;
  subjectId: string | null;
  portalSlug: string | null;
  target: FeedbackRoutingTarget;
  notifyTarget: boolean;
};

export type PlatformFeedbackConfig = {
  policy: PlatformFeedbackPolicy;
  routingRules: FeedbackRoutingRule[];
};

export type FeedbackAnonymousContact = {
  name?: string;
  email?: string;
  phone?: string;
};

export type FeedbackMetadata = {
  userAgent?: string;
  appVersion?: string;
  locale?: string;
  viewportTier?: string;
  clientIpHash?: string;
  /** Operator-facing location line (pageKey, overlay, route). */
  sourcePath?: string;
  /** Workspace overlay token from `?overlay=` when present. */
  overlay?: string;
  pathname?: string;
  search?: string;
  hash?: string;
};

export type FeedbackAttachmentDto = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type FeedbackMessageDto = {
  id: string;
  kind: FeedbackMessageKind;
  body: string;
  authorUserId: number | null;
  authorDisplayName: string | null;
  attachments: FeedbackAttachmentDto[];
  createdAt: string;
};

export type FeedbackTicketDto = {
  id: string;
  subjectId: FeedbackSubject;
  subjectLabel: string | null;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  title: string;
  submittedAt: string;
  submitterUserId: number | null;
  submitterDisplayName: string | null;
  anonymousContact: FeedbackAnonymousContact | null;
  assigneeUserId: number | null;
  assigneeDisplayName: string | null;
  assigneeRoleName: string | null;
  routingRuleId: string | null;
  routedAt: string | null;
  portalSlug: string | null;
  pageKey: string | null;
  route: string | null;
  metadata: FeedbackMetadata | null;
  messageCount: number;
  lastMessageAt: string | null;
  /** Latest non-internal message body for compact list / dashboard previews. */
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
};

export type FeedbackTicketDetailDto = FeedbackTicketDto & {
  messages: FeedbackMessageDto[];
};

export type SubmitFeedbackRequest = {
  subjectId: FeedbackSubject;
  title: string;
  body: string;
  attachmentIds?: string[];
  anonymousContact?: FeedbackAnonymousContact;
  portalSlug?: string | null;
  pageKey?: string | null;
  route?: string | null;
  metadata?: FeedbackMetadata;
  honeypot?: string;
};

export type PostFeedbackMessageRequest = {
  body: string;
  kind?: 'STAFF' | 'INTERNAL' | 'SUBMITTER';
  attachmentIds?: string[];
};

export type AssignFeedbackRequest = {
  assigneeUserId?: number | null;
  assigneeRoleName?: string | null;
};

export type UpdateFeedbackStatusRequest = {
  status: FeedbackStatus;
  priority?: FeedbackPriority;
};

export type FeedbackListResponse = {
  success: true;
  items: FeedbackTicketDto[];
  total: number;
  page?: number;
  pageSize?: number;
};

export type FeedbackMineListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: FeedbackStatus;
  subjectId?: string;
};

export type FeedbackDetailResponse = {
  success: true;
  ticket: FeedbackTicketDetailDto;
};

export type FeedbackSubjectsResponse = {
  success: true;
  subjects: FeedbackSubjectOption[];
};

export type FeedbackPolicyResponse = {
  success: true;
  config: PlatformFeedbackConfig;
};

export type FeedbackAttachmentUploadResponse = {
  success: true;
  attachments: FeedbackAttachmentDto[];
};

export type FeedbackBootPolicy = Pick<
  PlatformFeedbackPolicy,
  | 'enabled'
  | 'allowAuthenticated'
  | 'allowAnonymous'
  | 'showContactFieldsForAnonymous'
  | 'requireSubject'
  | 'allowAttachments'
  | 'widgetPlacement'
  | 'showOnDashboard'
  | 'pageKeyDenylist'
> & {
  /** Active Feedback Subject options from Base Info (`100.3`). */
  subjects: FeedbackSubjectOption[];
};

export type AllowedAttachmentMime = (typeof DEFAULT_ALLOWED_ATTACHMENT_MIME_TYPES)[number];
