import type { Transaction } from 'sequelize';
import {
  getDirectMessageMessageModel,
  getDirectMessageParticipantStateModel,
  getDirectMessageThreadModel,
} from './directMessageSequelizeModels';

export const DIRECT_MESSAGE_BODY_MAX = 8000;
export const DIRECT_MESSAGE_PREVIEW_MAX = 480;

export const canonicalParticipantPair = (userIdA: number, userIdB: number): [number, number] => (
  userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA]
);

export const previewDirectMessageBody = (body: string): string => {
  const trimmed = body.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= DIRECT_MESSAGE_PREVIEW_MAX) {
    return trimmed;
  }
  return `${trimmed.slice(0, DIRECT_MESSAGE_PREVIEW_MAX - 1)}…`;
};

export type DirectMessageThreadRow = {
  id: number;
  participantLowUserId: number;
  participantHighUserId: number;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
};

export type DirectMessageMessageRow = {
  id: number;
  threadId: number;
  senderUserId: number;
  body: string;
  replyToMessageId: number | null;
  forwardedFromMessageId: number | null;
  createdAt: Date;
};

export async function findThreadByParticipants(
  userIdA: number,
  userIdB: number,
): Promise<DirectMessageThreadRow | null> {
  const [low, high] = canonicalParticipantPair(userIdA, userIdB);
  const Thread = getDirectMessageThreadModel();
  const row = await Thread.findOne({
    where: { participantLowUserId: low, participantHighUserId: high },
  });
  return row ? mapThreadRow(row) : null;
}

export async function findThreadById(threadId: number): Promise<DirectMessageThreadRow | null> {
  const Thread = getDirectMessageThreadModel();
  const row = await Thread.findByPk(threadId);
  return row ? mapThreadRow(row) : null;
}

export async function listThreadsForUser(userId: number, take = 80): Promise<DirectMessageThreadRow[]> {
  const Thread = getDirectMessageThreadModel();
  const { Op } = await import('sequelize');
  const rows = await Thread.findAll({
    where: {
      [Op.or]: [
        { participantLowUserId: userId },
        { participantHighUserId: userId },
      ],
    },
    order: [['lastMessageAt', 'DESC'], ['id', 'DESC']],
    limit: Math.min(Math.max(take, 1), 200),
  });
  return rows.map(mapThreadRow);
}

export async function createThreadWithOptionalMessage(input: {
  senderUserId: number;
  recipientUserId: number;
  body?: string;
  /** When true, inserts a message even if `body` is empty (e.g. attachment-only). */
  allowEmptyBody?: boolean;
}): Promise<{ thread: DirectMessageThreadRow; message: DirectMessageMessageRow | null }> {
  const Thread = getDirectMessageThreadModel();
  const sequelize = Thread.sequelize!;
  const [low, high] = canonicalParticipantPair(input.senderUserId, input.recipientUserId);
  return sequelize.transaction(async (transaction: Transaction) => {
    const now = new Date();
    let thread = await Thread.findOne({
      where: { participantLowUserId: low, participantHighUserId: high },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!thread) {
      thread = await Thread.create(
        {
          participantLowUserId: low,
          participantHighUserId: high,
          lastMessageAt: null,
          lastMessagePreview: null,
          createdAt: now,
          updatedAt: now,
        },
        { transaction },
      );
      await ensureParticipantState(thread.id, input.senderUserId, transaction);
      await ensureParticipantState(thread.id, input.recipientUserId, transaction);
    }
    const mappedThread = mapThreadRow(thread);
    const trimmedBody = input.body?.trim() ?? '';
    if (!trimmedBody && !input.allowEmptyBody) {
      return { thread: mappedThread, message: null };
    }
    const message = await insertMessage({
      threadId: thread.id,
      senderUserId: input.senderUserId,
      body: trimmedBody,
      transaction,
    });
    return { thread: (await findThreadById(thread.id))!, message };
  });
}

export async function insertMessage(input: {
  threadId: number;
  senderUserId: number;
  body: string;
  transaction?: Transaction;
}): Promise<DirectMessageMessageRow> {
  const Message = getDirectMessageMessageModel();
  const Thread = getDirectMessageThreadModel();
  const now = new Date();
  const preview = previewDirectMessageBody(input.body);
  const row = await Message.create(
    {
      threadId: input.threadId,
      senderUserId: input.senderUserId,
      body: input.body,
      replyToMessageId: null,
      forwardedFromMessageId: null,
      createdAt: now,
    },
    { transaction: input.transaction },
  );
  await Thread.update(
    { lastMessageAt: now, lastMessagePreview: preview, updatedAt: now },
    { where: { id: input.threadId }, transaction: input.transaction },
  );
  await ensureParticipantState(input.threadId, input.senderUserId, input.transaction);
  const State = getDirectMessageParticipantStateModel();
  await State.upsert(
    {
      threadId: input.threadId,
      userId: input.senderUserId,
      lastReadMessageId: Number(row.id),
      updatedAt: now,
    },
    { transaction: input.transaction },
  );
  return mapMessageRow(row);
}

export async function listMessages(
  threadId: number,
  options?: { take?: number },
): Promise<DirectMessageMessageRow[]> {
  const Message = getDirectMessageMessageModel();
  const take = Math.min(Math.max(options?.take ?? 50, 1), 100);
  const rows = await Message.findAll({
    where: { threadId },
    order: [['id', 'DESC']],
    limit: take,
  });
  return rows.map(mapMessageRow).reverse();
}

export async function getLatestMessageId(threadId: number): Promise<number | null> {
  const Message = getDirectMessageMessageModel();
  const row = await Message.findOne({
    where: { threadId },
    order: [['id', 'DESC']],
    attributes: ['id'],
  });
  return row ? Number(row.id) : null;
}

export async function getParticipantLastReadMessageId(
  threadId: number,
  userId: number,
): Promise<number | null> {
  const State = getDirectMessageParticipantStateModel();
  const row = await State.findOne({ where: { threadId, userId } });
  return row?.lastReadMessageId != null ? Number(row.lastReadMessageId) : null;
}

export async function markThreadReadForUser(threadId: number, userId: number): Promise<void> {
  const latestId = await getLatestMessageId(threadId);
  if (latestId == null) {
    return;
  }
  const State = getDirectMessageParticipantStateModel();
  const now = new Date();
  await State.upsert({
    threadId,
    userId,
    lastReadMessageId: latestId,
    updatedAt: now,
  });
}

export async function markThreadUnreadForUser(threadId: number, userId: number): Promise<void> {
  const State = getDirectMessageParticipantStateModel();
  const now = new Date();
  await State.upsert({
    threadId,
    userId,
    lastReadMessageId: null,
    updatedAt: now,
  });
}

export async function isThreadParticipant(threadId: number, userId: number): Promise<boolean> {
  const thread = await findThreadById(threadId);
  if (!thread) {
    return false;
  }
  return thread.participantLowUserId === userId || thread.participantHighUserId === userId;
}

export async function countUnreadMessagesForUser(threadId: number, userId: number): Promise<number> {
  const lastRead = await getParticipantLastReadMessageId(threadId, userId);
  const Message = getDirectMessageMessageModel();
  const { Op } = await import('sequelize');
  const where: Record<string, unknown> = {
    threadId,
    senderUserId: { [Op.ne]: userId },
  };
  if (lastRead != null) {
    where.id = { [Op.gt]: lastRead };
  }
  return Message.count({ where });
}

async function ensureParticipantState(
  threadId: number,
  userId: number,
  transaction?: Transaction,
): Promise<void> {
  const State = getDirectMessageParticipantStateModel();
  const existing = await State.findOne({ where: { threadId, userId }, transaction });
  if (existing) {
    return;
  }
  await State.create(
    { threadId, userId, lastReadMessageId: null, updatedAt: new Date() },
    { transaction },
  );
}

const mapThreadRow = (row: {
  id: number | bigint;
  participantLowUserId: number | bigint;
  participantHighUserId: number | bigint;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
}): DirectMessageThreadRow => ({
  id: Number(row.id),
  participantLowUserId: Number(row.participantLowUserId),
  participantHighUserId: Number(row.participantHighUserId),
  lastMessageAt: row.lastMessageAt,
  lastMessagePreview: row.lastMessagePreview,
});

const mapMessageRow = (row: {
  id: number | bigint;
  threadId: number | bigint;
  senderUserId: number | bigint;
  body: string;
  replyToMessageId: number | bigint | null;
  forwardedFromMessageId: number | bigint | null;
  createdAt: Date;
}): DirectMessageMessageRow => ({
  id: Number(row.id),
  threadId: Number(row.threadId),
  senderUserId: Number(row.senderUserId),
  body: row.body,
  replyToMessageId: row.replyToMessageId != null ? Number(row.replyToMessageId) : null,
  forwardedFromMessageId: row.forwardedFromMessageId != null ? Number(row.forwardedFromMessageId) : null,
  createdAt: row.createdAt,
});

export const otherParticipantUserId = (thread: DirectMessageThreadRow, viewerUserId: number): number =>
  thread.participantLowUserId === viewerUserId
    ? thread.participantHighUserId
    : thread.participantLowUserId;
