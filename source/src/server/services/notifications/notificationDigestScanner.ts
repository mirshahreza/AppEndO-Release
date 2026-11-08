import { randomUUID } from 'node:crypto';
import { logger } from '../../../core/logging/Logger';
import { sendEmail } from '../email/email.service';
import { findUserIdEmail } from '../../domain/users/userRepository';
import { listUsersWithPendingDigestItems, listPendingDigestItemsForUser, markNotificationDigestItemsSent } from '../../domain/users/userNotificationDigestRepository';
import { markUserMessageDispatchesSentForDigestItems } from './userMessageDispatch.service';

const DEFAULT_DIGEST_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type NotificationDigestScanSummary = { usersDue: number; usersSent: number; itemsSent: number; sendErrors: number };

const composeDigestEmail = (items: Array<{ title: string; body: string; href: string | null }>): { subject: string; text: string } => ({
  subject: `You have ${items.length} notification${items.length === 1 ? '' : 's'}`,
  text: items.map((i) => `- ${i.title}${i.body ? `: ${i.body}` : ''}${i.href ? ` (${i.href})` : ''}`).join('\n'),
});

/**
 * HWF-4.2 — digest scanner (same "periodic invocation by AppEndO Job infrastructure, plain
 * importable function" pattern as `workItemEscalationService.ts`'s `scanAndRunDueEscalations`,
 * wired into the same `workflowEngineWorker.ts` tick). A user's digest "clock" starts at their
 * OLDEST pending item's `createdAt` (no separate per-user "last digest sent" column needed) — once
 * that item has been pending for `digestIntervalMs`, every currently-pending item for that user
 * (including newer ones queued since) is batched into one summary email and marked sent, restarting
 * the clock at the next item queued afterward.
 */
export async function scanAndSendDueNotificationDigests(digestIntervalMs = DEFAULT_DIGEST_INTERVAL_MS): Promise<NotificationDigestScanSummary> {
  const pendingUsers = await listUsersWithPendingDigestItems();
  const now = Date.now();
  const due = pendingUsers.filter((u) => now - new Date(u.oldestPendingCreatedAt).getTime() >= digestIntervalMs);

  let usersSent = 0;
  let itemsSent = 0;
  let sendErrors = 0;

  for (const { userId } of due) {
    const items = await listPendingDigestItemsForUser(userId);
    if (items.length === 0) continue;
    try {
      const user = await findUserIdEmail(userId);
      if (!user?.email) {
        throw new Error(`User #${userId} has no email address on file.`);
      }
      const { subject, text } = composeDigestEmail(items);
      await sendEmail({ to: user.email, subject, text });
      const digestBatchId = randomUUID();
      await markUserMessageDispatchesSentForDigestItems(
        items.map((i) => ({ userId, metadataJson: i.metadataJson })),
        digestBatchId,
      );
      await markNotificationDigestItemsSent(items.map((i) => i.id));
      usersSent += 1;
      itemsSent += items.length;
    } catch (error) {
      sendErrors += 1;
      logger.error('NotificationDigestScanner', `Digest send failed for user #${userId}, left pending for next scan: ${error instanceof Error ? error.message : String(error)}`, { userId });
    }
  }

  return { usersDue: due.length, usersSent, itemsSent, sendErrors };
}
