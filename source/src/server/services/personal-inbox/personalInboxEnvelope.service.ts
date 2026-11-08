import type { AuthRequestContext } from '../../middleware/auth.middleware';
import type { PersonalInboxItem } from '../../../shared/api/contracts/personal-inbox/types';
import type {
  PersonalInboxEnvelopeAttachment,
  PersonalInboxEnvelopeCapabilities,
  PersonalInboxEnvelopeMessage,
  PersonalInboxEnvelopeMessageRole,
  PersonalInboxItemDetailEnvelope,
} from '../../../shared/api/contracts/personal-inbox/envelopeTypes';
import { inboxCorrespondenceCapabilities } from '../../../shared/personal-inbox/inboxCorrespondencePolicy';
import { HttpError } from '../../errors/HttpError';
import type { FeedbackService } from '../feedback/feedback.service';
import type { PersonalInboxService } from './personalInbox.service';
import {
  canonicalPersonalInboxItemKey,
  parsePersonalInboxItemRef,
} from './personalInboxItemActions.service';
import { getUserNotificationForUser } from '../notifications/userNotification.service';
import { getUserMessageDispatchById } from '../notifications/userMessageDispatch.service';
import { DirectMessageService } from '../direct-messages/directMessage.service';
import type { FeedbackMessageDto } from '../../../shared/api/contracts/feedback/types';

const mapFeedbackRole = (kind: FeedbackMessageDto['kind']): PersonalInboxEnvelopeMessageRole => {
  if (kind === 'INTERNAL') return 'internal';
  if (kind === 'SUBMITTER') return 'submitter';
  if (kind === 'STAFF') return 'staff';
  return 'default';
};

const mapFeedbackAttachments = (
  attachments: FeedbackMessageDto['attachments'],
): PersonalInboxEnvelopeAttachment[] => attachments.map((file) => ({
  id: file.id,
  fileName: file.fileName,
  mimeType: file.mimeType ?? null,
  sizeBytes: file.sizeBytes ?? null,
}));

const mapFeedbackMessages = (messages: FeedbackMessageDto[]): PersonalInboxEnvelopeMessage[] => (
  messages.map((message) => ({
    id: message.id,
    body: message.body,
    authorDisplayName: message.authorDisplayName,
    createdAt: message.createdAt,
    role: mapFeedbackRole(message.kind),
    attachments: mapFeedbackAttachments(message.attachments),
  }))
);

const syntheticMessage = (
  id: string,
  body: string,
  createdAt: string,
  authorDisplayName: string | null = 'System',
): PersonalInboxEnvelopeMessage => ({
  id,
  body,
  authorDisplayName,
  createdAt,
  role: 'system',
  attachments: [],
});

const buildCapabilities = (item: PersonalInboxItem): PersonalInboxEnvelopeCapabilities => {
  const caps = inboxCorrespondenceCapabilities(item.kind);
  const href = item.href.trim();
  const showRelatedHref = href.length > 0 && !href.startsWith('my-inbox');
  return {
    reply: caps.reply,
    forward: caps.forward,
    showRelatedHref,
  };
};

export class PersonalInboxEnvelopeService {
  constructor(
    private readonly inboxService: PersonalInboxService,
    private readonly feedbackService: FeedbackService,
    private readonly directMessages: DirectMessageService,
  ) {}

  async getItemDetail(auth: AuthRequestContext, itemKey: string): Promise<PersonalInboxItemDetailEnvelope> {
    const canonicalKey = canonicalPersonalInboxItemKey(itemKey);
    const ref = parsePersonalInboxItemRef(canonicalKey);
    if (!ref) {
      throw new HttpError(400, 'Invalid itemKey.', { success: false, error: 'Invalid itemKey.' });
    }

    const item = await this.inboxService.findItemForUser(auth, canonicalKey);
    if (!item) {
      throw new HttpError(404, 'Inbox item not found.', { success: false, error: 'Inbox item not found.' });
    }

    const { messages, dispatchLedger } = await this.loadMessages(auth, ref, item, canonicalKey);
    return {
      itemKey: canonicalKey,
      item,
      threadId: canonicalKey,
      messages,
      capabilities: buildCapabilities(item),
      ...(dispatchLedger ? { dispatchLedger } : {}),
    };
  }

  private async loadMessages(
    auth: AuthRequestContext,
    ref: NonNullable<ReturnType<typeof parsePersonalInboxItemRef>>,
    item: PersonalInboxItem,
    canonicalKey: string,
  ): Promise<{
    messages: PersonalInboxEnvelopeMessage[];
    dispatchLedger?: PersonalInboxItemDetailEnvelope['dispatchLedger'];
  }> {
    if (ref.type === 'feedback') {
      const ticket = await this.feedbackService.getTicketDetail(ref.id, auth);
      return { messages: mapFeedbackMessages(ticket.messages) };
    }

    if (ref.type === 'notification') {
      const row = await getUserNotificationForUser(auth.userId, ref.id);
      if (!row) {
        throw new HttpError(404, 'Inbox item not found.', { success: false, error: 'Inbox item not found.' });
      }
      const body = row.body.trim() || item.summary?.trim() || item.title;
      return {
        messages: [syntheticMessage(`notification:${ref.id}`, body, row.createdAt, 'Notification')],
      };
    }

    if (ref.type === 'direct_message') {
      const [thread, { messages }] = await Promise.all([
        this.directMessages.getThread(auth, ref.id),
        this.directMessages.listThreadMessages(auth, ref.id),
      ]);
      const counterpart = thread.counterpartUsername;
      return {
        messages: messages.map((message) => ({
          id: String(message.id),
          body: message.body,
          authorDisplayName: message.senderUserId === auth.userId ? 'You' : counterpart,
          createdAt: message.createdAt,
          role: 'default' as const,
          attachments: message.attachments.map((file) => ({
            id: file.id,
            fileName: file.fileName,
            mimeType: file.mimeType ?? null,
            sizeBytes: file.sizeBytes ?? null,
          })),
        })),
      };
    }

    if (ref.type === 'message_dispatch') {
      const row = await getUserMessageDispatchById(auth.userId, ref.id);
      if (!row) {
        throw new HttpError(404, 'Inbox item not found.', { success: false, error: 'Inbox item not found.' });
      }
      const body = row.bodySummary?.trim() || item.summary?.trim() || row.eventType;
      return {
        messages: [syntheticMessage(`dispatch:${ref.id}`, body, row.deliveredAt ?? row.createdAt, 'Dispatch')],
        dispatchLedger: {
          channel: row.channel,
          deliveryStatus: row.deliveryStatus,
          eventType: row.eventType,
          createdAt: row.createdAt,
          deliveredAt: row.deliveredAt,
          errorSummary: row.errorSummary,
          href: row.href,
        },
      };
    }

    if (ref.type === 'work_item') {
      const body = item.summary?.trim()
        || 'Open the work item to review form fields and complete the task.';
      return {
        messages: [syntheticMessage(`work_item:${ref.id}`, body, item.surfacedAt, 'Work item')],
      };
    }

    return {
      messages: [syntheticMessage(`${canonicalKey}:placeholder`, item.title, item.surfacedAt)],
    };
  }
}
