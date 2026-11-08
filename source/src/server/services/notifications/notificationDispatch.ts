import { logger } from '../../../core/logging/Logger';
import { sendEmail } from '../email/email.service';
import { findUserIdEmail } from '../../domain/users/userRepository';
import { listRoleMemberSummaries } from '../../domain/users/userRoleRepository';
import { getUserNotificationPreference } from '../../domain/users/userNotificationPreferenceRepository';
import { queueNotificationDigestItem } from '../../domain/users/userNotificationDigestRepository';
import { createUserNotification, parseNotificationUserId } from './userNotification.service';
import {
  createUserMessageDispatch,
  mergeDispatchMetadata,
  newMessageDispatchCorrelationId,
} from './userMessageDispatch.service';

/**
 * HWF-4.2 — extensible notification channel abstraction (doc-benchmark follow-up). `IN_APP` and
 * `EMAIL` are the two channels a per-user preference can meaningfully target (each has a per-user
 * identity: an inbox row, or an email address) — `WEBHOOK` stays exactly what it already was, a
 * workflow-authored `communication.webhook-notify` ACTION node pointed at a fixed integration
 * endpoint, not something an individual end user personally subscribes to. Adding Slack/Teams/Push
 * later means adding one more `NotificationChannel` implementation and one more case in
 * `dispatchNotification` below — every existing call site (`workItemEscalationService.ts`,
 * `workflowWorkItems.controller.ts`'s comment-mention notify, `communicationActions.ts`'s
 * `communication.notification-send`) already routes through `dispatchNotification`, not a hardcoded
 * channel, so none of them need to change again when that happens.
 *
 * MSGI-1 — each dispatch also writes `base_user_message_dispatches` (see userMessageDispatch.service).
 */
export type NotificationChannelKey = 'IN_APP' | 'EMAIL';

export type NotificationDispatchInput = {
  userId: number;
  title: string;
  body: string;
  severity?: string;
  href?: string | null;
  /** Both the `BaseUserNotification.source` value AND the key a `UserNotificationPreference` row is looked up by — the existing `source` taxonomy ('workflow', 'workflow.escalation', 'workflow.comment') doubles as the event-type taxonomy, no separate vocabulary introduced. */
  eventType: string;
  metadata?: unknown;
};

const sendInApp = async (input: NotificationDispatchInput): Promise<{ inAppNotificationId: number }> => {
  const created = await createUserNotification({
    userId: input.userId,
    title: input.title,
    body: input.body,
    severity: input.severity,
    href: input.href,
    source: input.eventType,
    metadata: input.metadata,
  });
  return { inAppNotificationId: created.id };
};

const sendEmailChannel = async (input: NotificationDispatchInput): Promise<void> => {
  const user = await findUserIdEmail(input.userId);
  if (!user?.email) {
    throw new Error(`User #${input.userId} has no email address on file.`);
  }
  await sendEmail({ to: user.email, subject: input.title, text: input.body });
};

const ledgerBase = (input: NotificationDispatchInput, correlationId: string) => ({
  userId: input.userId,
  correlationId,
  eventType: input.eventType,
  title: input.title,
  body: input.body,
  href: input.href,
  severity: input.severity,
  metadata: input.metadata,
});

/**
 * Resolves the caller's preference for (userId, eventType) — defaulting to IN_APP/immediate, exactly
 * today's behavior, when no preference row exists (opt-in only, per the same "nothing changes
 * silently" pattern HWF-2.1/2.2/2.4 already established) — then dispatches through the resolved
 * channel. EMAIL failures (no address on file, SMTP error) degrade to IN_APP rather than silently
 * dropping the notification — a human still needs to see it somewhere.
 */
export async function dispatchNotification(input: NotificationDispatchInput): Promise<void> {
  const correlationId = newMessageDispatchCorrelationId();
  const preference = await getUserNotificationPreference(input.userId, input.eventType);
  const channel = preference?.channel ?? 'IN_APP';
  const digest = preference?.digest ?? false;

  if (channel === 'EMAIL' && digest) {
    const { id: dispatchId } = await createUserMessageDispatch({
      ...ledgerBase(input, correlationId),
      channel: 'EMAIL',
      deliveryStatus: 'digest_pending',
    });
    await queueNotificationDigestItem({
      userId: input.userId,
      title: input.title,
      body: input.body,
      href: input.href,
      source: input.eventType,
      metadata: mergeDispatchMetadata(input.metadata, { dispatchId, correlationId }),
    });
    return;
  }

  if (channel === 'EMAIL') {
    try {
      await sendEmailChannel(input);
      await createUserMessageDispatch({
        ...ledgerBase(input, correlationId),
        channel: 'EMAIL',
        deliveryStatus: 'sent',
      });
      return;
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : String(error);
      logger.warn('NotificationDispatch', `EMAIL channel failed for user #${input.userId}, falling back to IN_APP: ${safeMessage}`, { userId: input.userId, eventType: input.eventType });
      await createUserMessageDispatch({
        ...ledgerBase(input, correlationId),
        channel: 'EMAIL',
        deliveryStatus: 'failed',
        errorSummary: safeMessage.slice(0, 500),
        deliveredAt: null,
      });
      const { inAppNotificationId } = await sendInApp(input);
      await createUserMessageDispatch({
        ...ledgerBase(input, correlationId),
        channel: 'IN_APP',
        deliveryStatus: 'fallback_in_app',
        inAppNotificationId,
      });
      return;
    }
  }

  const { inAppNotificationId } = await sendInApp(input);
  await createUserMessageDispatch({
    ...ledgerBase(input, correlationId),
    channel: 'IN_APP',
    deliveryStatus: 'sent',
    inAppNotificationId,
  });
}

/** Role fan-out sibling of `dispatchNotification` — each member's own channel preference is resolved and applied individually (a role fan-out is not itself a "user", so it can't carry one shared preference). */
export async function dispatchNotificationForRole(input: Omit<NotificationDispatchInput, 'userId'> & { roleId: string }): Promise<{ created: number; userIds: number[] }> {
  const listed = await listRoleMemberSummaries(input.roleId);
  if ('roleMissing' in listed) {
    return { created: 0, userIds: [] };
  }
  const userIds = [...new Set(listed.members.map((m) => parseNotificationUserId(m.userId)).filter((id): id is number => id !== null))];
  for (const userId of userIds) {
    await dispatchNotification({ ...input, userId });
  }
  return { created: userIds.length, userIds };
}
