import type { AuthRequestContext } from '../../middleware/auth.middleware';
import type { PersonalInboxItem } from '../../../shared/api/contracts/personal-inbox/types';
import {
  canonicalPersonalInboxItemKey,
  parsePersonalInboxItemRef,
} from './personalInboxItemActions.service';
import { inboxSupportsCorrespondenceAction } from '../../../shared/personal-inbox/inboxCorrespondencePolicy';
import { personalInboxCorrespondenceRepository } from '../../domain/personal-inbox/personalInboxCorrespondence.repository';
import type { FeedbackService } from '../feedback/feedback.service';
import { DirectMessageService } from '../direct-messages/directMessage.service';
import { createUserNotification } from '../notifications/userNotification.service';
import { getPrismaControlPlane } from '../../db/prismaControlPlane';
import { HttpError } from '../../errors/HttpError';
import { linkAttachmentsToMessage } from '../feedback/feedbackAttachment.service';
import { buildPersonalInboxFeedbackFocusHref } from '../../../shared/lib/personalInboxFeedbackDeepLink';

const FORWARD_BODY_MAX = 8000;

const formatForwardBody = (item: PersonalInboxItem, note: string | undefined): string => {
  const lines = [
    '---------- Forwarded inbox item ----------',
    `Type: ${item.kind}`,
    `Title: ${item.title}`,
    item.summary?.trim() ? `Summary: ${item.summary.trim()}` : null,
    `From row: ${item.id}`,
    note?.trim() ? '' : null,
    note?.trim() ? `Note: ${note.trim()}` : null,
  ].filter((line): line is string => line != null);
  return lines.join('\n').slice(0, FORWARD_BODY_MAX);
};

export class PersonalInboxCorrespondenceService {
  constructor(
    private readonly feedbackService: FeedbackService,
    private readonly directMessages: DirectMessageService,
  ) {}

  async reply(
    auth: AuthRequestContext,
    itemKey: string,
    body: string,
    stagedSessionKey: string,
    attachmentIds: string[] = [],
  ): Promise<{ itemKey: string }> {
    const canonicalKey = canonicalPersonalInboxItemKey(itemKey);
    const ref = parsePersonalInboxItemRef(canonicalKey);
    if (!ref) {
      throw new HttpError(400, 'Invalid itemKey.', { success: false, error: 'Invalid itemKey.' });
    }
    const trimmed = body.trim();
    const ids = attachmentIds.filter((id) => id.trim().length > 0);
    if (!trimmed && ids.length === 0) {
      throw new HttpError(400, 'Message body or attachment is required.', { success: false, error: 'Message body or attachment is required.' });
    }

    if (ref.type === 'feedback') {
      await this.feedbackService.postMessage(
        ref.id,
        { body: trimmed, attachmentIds: ids.length ? ids : undefined },
        auth,
        stagedSessionKey,
      );
    } else if (ref.type === 'direct_message') {
      await this.directMessages.sendMessage(auth, ref.id, trimmed, {
        attachmentIds: ids.length ? ids : undefined,
        stagedSessionKey: stagedSessionKey || undefined,
      });
    } else {
      throw new HttpError(403, 'Reply is not allowed for this inbox item type.', { success: false, error: 'Reply is not allowed for this inbox item type.' });
    }

    await personalInboxCorrespondenceRepository.markReplied(auth.userId, canonicalKey);
    return { itemKey: canonicalKey };
  }

  private async forwardWithAttachmentsAsFeedback(
    auth: AuthRequestContext,
    recipientUserId: number,
    item: PersonalInboxItem,
    canonicalKey: string,
    forwardBody: string,
    attachmentIds: string[],
    stagedSessionKey: string,
  ): Promise<void> {
    const prisma = getPrismaControlPlane();
    const ticket = await prisma.baseAppFeedback.create({
      data: {
        type: 'general',
        title: `Fwd: ${item.title}`.slice(0, 200),
        submitterUserId: BigInt(recipientUserId),
        status: 'NEW',
        priority: 'NORMAL',
        messageCount: 1,
        lastMessageAt: new Date(),
      },
    });
    const message = await prisma.baseAppFeedbackMessage.create({
      data: {
        feedbackId: ticket.id,
        kind: 'STAFF',
        body: forwardBody,
        authorUserId: BigInt(auth.userId),
      },
    });
    await linkAttachmentsToMessage({
      attachmentIds,
      feedbackId: ticket.id,
      messageId: message.id,
      stagedSessionKey,
      uploaderUserId: auth.userId,
    });
    const ticketId = Number(ticket.id);
    await createUserNotification({
      userId: recipientUserId,
      title: `Fwd: ${item.title}`.slice(0, 200),
      body: forwardBody.slice(0, 2000),
      severity: 'info',
      source: `inbox.forward.${item.kind}`,
      href: buildPersonalInboxFeedbackFocusHref(ticketId, 'mine'),
      metadataJson: JSON.stringify({
        sourceItemKey: canonicalKey,
        forwardedByUserId: auth.userId,
        forwardDeliveryTicketId: ticketId,
      }),
    });
  }

  async forward(
    auth: AuthRequestContext,
    itemKey: string,
    recipientUserId: number,
    item: PersonalInboxItem,
    note?: string,
    stagedSessionKey = '',
    attachmentIds: string[] = [],
  ): Promise<{ itemKey: string; recipientUserId: number }> {
    const canonicalKey = canonicalPersonalInboxItemKey(itemKey);
    const ref = parsePersonalInboxItemRef(canonicalKey);
    if (!ref) {
      throw new HttpError(400, 'Invalid itemKey.', { success: false, error: 'Invalid itemKey.' });
    }
    if (!inboxSupportsCorrespondenceAction(item.kind, 'forward')) {
      throw new HttpError(403, 'Forward is not allowed for this inbox item type.', { success: false, error: 'Forward is not allowed for this inbox item type.' });
    }
    if (recipientUserId === auth.userId) {
      throw new HttpError(400, 'Choose another recipient.', { success: false, error: 'Choose another recipient.' });
    }
    const recipient = await getPrismaControlPlane().baseUser.findUnique({
      where: { id: BigInt(recipientUserId) },
      select: { id: true },
    });
    if (!recipient) {
      throw new HttpError(404, 'Recipient not found.', { success: false, error: 'Recipient not found.' });
    }

    const forwardBody = formatForwardBody(item, note);
    const ids = attachmentIds.filter((id) => id.trim().length > 0);
    if (ids.length > 0) {
      await this.forwardWithAttachmentsAsFeedback(
        auth,
        recipientUserId,
        item,
        canonicalKey,
        forwardBody,
        ids,
        stagedSessionKey,
      );
      await personalInboxCorrespondenceRepository.markForwarded(auth.userId, canonicalKey);
      return { itemKey: canonicalKey, recipientUserId };
    }

    if (ref.type === 'feedback') {
      await createUserNotification({
        userId: recipientUserId,
        title: `Fwd: ${item.title}`.slice(0, 200),
        body: forwardBody,
        severity: 'info',
        source: 'inbox.forward.feedback',
        href: item.href,
        metadataJson: JSON.stringify({ sourceItemKey: canonicalKey, forwardedByUserId: auth.userId }),
      });
    } else if (ref.type === 'work_item') {
      await createUserNotification({
        userId: recipientUserId,
        title: `Fwd: ${item.title}`.slice(0, 200),
        body: forwardBody,
        severity: 'info',
        source: 'inbox.forward.work_item',
        href: item.href,
        metadataJson: JSON.stringify({ sourceItemKey: canonicalKey, workItemId: ref.id }),
      });
    } else if (ref.type === 'direct_message') {
      await this.directMessages.createThread(auth, {
        recipientUserId,
        body: forwardBody,
      });
    } else {
      throw new HttpError(403, 'Forward is not allowed for this inbox item type.', { success: false, error: 'Forward is not allowed for this inbox item type.' });
    }

    await personalInboxCorrespondenceRepository.markForwarded(auth.userId, canonicalKey);
    return { itemKey: canonicalKey, recipientUserId };
  }
}
