import { logger } from '../../../core/logging/Logger';
import type {
  FeedbackMessageKind,
  FeedbackRoutingResult,
  PlatformFeedbackConfig,
} from '../../../shared/api/contracts/feedback/types';
import {
  buildFeedbackInboxTicketPath,
  buildMyFeedbackTicketPath,
} from '../../../shared/lib/feedbackTicketDeepLink';
import { dispatchNotification, dispatchNotificationForRole } from '../notifications/notificationDispatch';

const MARKDOWN_DIR_COMMENT_PATTERN = /<!--\s*@dir:(rtl|ltr)\s*-->/gi;

const EVENT_NEW = 'feedback.new';
const EVENT_STAFF_REPLY = 'feedback.reply.staff';
const EVENT_SUBMITTER_REPLY = 'feedback.reply.submitter';

const previewPlainText = (markdown: string, maxLength = 240): string => {
  const stripped = markdown
    .replace(MARKDOWN_DIR_COMMENT_PATTERN, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[#>*_\[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return 'Open the thread to read the message.';
  return stripped.length > maxLength ? `${stripped.slice(0, maxLength)}…` : stripped;
};

const notifyUserOnce = async (
  seen: Set<number>,
  userId: number,
  skipUserId: number | null,
  input: Parameters<typeof dispatchNotification>[0],
): Promise<void> => {
  if (skipUserId != null && userId === skipUserId) return;
  if (seen.has(userId)) return;
  seen.add(userId);
  await dispatchNotification(input);
};

export async function notifyNewFeedbackTicket(input: {
  config: PlatformFeedbackConfig;
  routing: FeedbackRoutingResult;
  ticketId: number;
  title: string;
  submitterUserId: number | null;
  assigneeUserId: number | null;
  assigneeRoleName: string | null;
}): Promise<void> {
  const { policy } = input.config;
  const notificationTitle = `New feedback: ${input.title}`;
  const body = 'Open the feedback inbox to review and respond.';
  const metadata = { feedbackId: input.ticketId };
  const href = buildFeedbackInboxTicketPath(input.ticketId);
  const seen = new Set<number>();

  if (input.assigneeUserId != null) {
    await notifyUserOnce(seen, input.assigneeUserId, input.submitterUserId, {
      userId: input.assigneeUserId,
      title: notificationTitle,
      body,
      href,
      eventType: EVENT_NEW,
      metadata,
      severity: 'info',
    });
  }

  const matchedRule = input.routing.routingRuleId
    ? input.config.routingRules.find((rule) => rule.id === input.routing.routingRuleId)
    : null;
  const shouldNotifyRole = Boolean(
    input.assigneeRoleName
    && policy.notifyRoleOnRoute
    && (matchedRule?.notifyTarget ?? true),
  );
  if (shouldNotifyRole && input.assigneeRoleName) {
    await dispatchNotificationForRole({
      roleId: input.assigneeRoleName,
      title: notificationTitle,
      body,
      href,
      eventType: EVENT_NEW,
      metadata,
      severity: 'info',
    });
  }

  const isUnassigned = !input.assigneeUserId && !input.assigneeRoleName;
  if (policy.notifyAdminOnNew || isUnassigned) {
    await dispatchNotificationForRole({
      roleId: 'ADMIN',
      title: notificationTitle,
      body,
      href,
      eventType: EVENT_NEW,
      metadata,
      severity: 'info',
    });
  }
}

export async function notifyFeedbackMessagePosted(input: {
  ticketId: number;
  ticketTitle: string;
  kind: FeedbackMessageKind;
  messageBody: string;
  authorUserId: number;
  submitterUserId: number | null;
  assigneeUserId: number | null;
  assigneeRoleName: string | null;
}): Promise<void> {
  if (input.kind === 'INTERNAL') return;

  const metadata = { feedbackId: input.ticketId };
  const preview = previewPlainText(input.messageBody);
  const staffHref = buildFeedbackInboxTicketPath(input.ticketId);

  if (input.kind === 'STAFF' && input.submitterUserId != null) {
    const userId = input.submitterUserId;
    if (userId !== input.authorUserId) {
      await dispatchNotification({
        userId,
        title: `Reply on your feedback: ${input.ticketTitle}`,
        body: preview,
        href: buildMyFeedbackTicketPath(input.ticketId),
        eventType: EVENT_STAFF_REPLY,
        metadata,
        severity: 'info',
      });
    }
    return;
  }

  if (input.kind !== 'SUBMITTER') return;

  const staffTitle = `New reply on feedback: ${input.ticketTitle}`;
  const seen = new Set<number>();

  if (input.assigneeUserId != null) {
    await notifyUserOnce(seen, input.assigneeUserId, input.authorUserId, {
      userId: input.assigneeUserId,
      title: staffTitle,
      body: preview,
      href: staffHref,
      eventType: EVENT_SUBMITTER_REPLY,
      metadata,
      severity: 'info',
    });
  }

  if (input.assigneeRoleName) {
    await dispatchNotificationForRole({
      roleId: input.assigneeRoleName,
      title: staffTitle,
      body: preview,
      href: staffHref,
      eventType: EVENT_SUBMITTER_REPLY,
      metadata,
      severity: 'info',
    });
  }
}

export const runFeedbackNotification = (task: () => Promise<void>, context: string): void => {
  void task().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('FeedbackNotification', `${context}: ${message}`);
  });
};
