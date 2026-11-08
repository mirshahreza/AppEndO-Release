import {
  parseStoredMessagesJson,
  prepareStoredMessagesForPersistence,
  computeMonotonicSessionTokenTotals,
  computeSessionTokenTotals,
} from '../../../shared/api/contracts/ai/chatHistoryValidators';
import {
  parseAgentCapabilityScopeJson,
  serializeAgentCapabilityScope,
} from '../../../shared/api/contracts/ai/agentValidators';
import type { AiAgentCapabilityScope } from '../../../shared/api/contracts/ai/capabilityPacks';
import type {
  AiChatSessionAdminDetail,
  AiChatSessionAdminSummary,
  AiChatSessionDetail,
  AiChatSessionSummary,
  AiChatStoredMessage,
} from '../../../shared/api/contracts/ai/chatHistoryTypes';
import type { ChatSessionListQuery } from '../../../shared/api/contracts/ai/chatHistoryListQuery';
import { CHAT_SESSION_DEFAULT_PAGE_SIZE } from '../../../shared/api/contracts/ai/chatHistoryListQuery';
import type { Prisma } from '../../../generated/prisma/client';
import {
  buildCaseInsensitiveContains,
  fromUserId,
  prisma,
  readControlPlaneProvider,
  toUserId,
} from '../users/prismaHelpers';

type ChatSessionRow = {
  id: number;
  user_id: number;
  title: string;
  model_id: string | null;
  messages_json: string;
  message_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  agent_capability_scope_json: string | null;
  context_history_summary: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type ChatSessionAdminRow = ChatSessionRow & {
  username: string;
};

const toIsoString = (value: Date | null | undefined): string =>
  value instanceof Date ? value.toISOString() : String(value ?? '');

const mapSessionRow = (row: {
  id: bigint;
  userId: bigint;
  title: string;
  modelId: string | null;
  messagesJson: string;
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  agentCapabilityScopeJson: string | null;
  contextHistorySummary: string | null;
  deletedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}): ChatSessionRow => ({
  id: fromUserId(row.id),
  user_id: fromUserId(row.userId),
  title: row.title,
  model_id: row.modelId,
  messages_json: row.messagesJson,
  message_count: row.messageCount,
  total_input_tokens: row.totalInputTokens,
  total_output_tokens: row.totalOutputTokens,
  agent_capability_scope_json: row.agentCapabilityScopeJson,
  context_history_summary: row.contextHistorySummary,
  deleted_at: row.deletedAt ? toIsoString(row.deletedAt) : null,
  created_at: toIsoString(row.createdAt),
  updated_at: toIsoString(row.updatedAt),
});

const sessionDetailSelect = {
  id: true,
  userId: true,
  title: true,
  modelId: true,
  messagesJson: true,
  messageCount: true,
  totalInputTokens: true,
  totalOutputTokens: true,
  agentCapabilityScopeJson: true,
  contextHistorySummary: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const sessionListSelect = {
  id: true,
  userId: true,
  title: true,
  modelId: true,
  messageCount: true,
  totalInputTokens: true,
  totalOutputTokens: true,
  agentCapabilityScopeJson: true,
  contextHistorySummary: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const toAgentCapabilityScope = (raw: string | null): AiAgentCapabilityScope => (
  parseAgentCapabilityScopeJson(raw)
);

const resolveMessageCount = (row: ChatSessionRow): number => {
  if (row.message_count > 0) {
    return row.message_count;
  }
  if (!row.messages_json) {
    return 0;
  }
  try {
    const parsed = JSON.parse(row.messages_json) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
};

const toSummary = (row: ChatSessionRow): AiChatSessionSummary => ({
  id: Number(row.id),
  title: row.title,
  modelId: row.model_id,
  agentCapabilityScope: toAgentCapabilityScope(row.agent_capability_scope_json),
  contextHistorySummary: row.context_history_summary,
  messageCount: resolveMessageCount(row),
  totalInputTokens: row.total_input_tokens,
  totalOutputTokens: row.total_output_tokens,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toDetail = (row: ChatSessionRow): AiChatSessionDetail => {
  const summary = toSummary(row);
  return {
    ...summary,
    messages: parseStoredMessagesJson(row.messages_json),
  };
};

const toAdminSummary = (row: ChatSessionAdminRow): AiChatSessionAdminSummary => ({
  ...toSummary(row),
  userId: Number(row.user_id),
  username: row.username,
  userDeleted: row.deleted_at != null,
});

const toAdminDetail = (row: ChatSessionAdminRow): AiChatSessionAdminDetail => ({
  ...toAdminSummary(row),
  messages: parseStoredMessagesJson(row.messages_json),
});

const buildAdminSearchWhere = (search?: string): Prisma.BaseAiChatSessionWhereInput => {
  const needle = search?.trim().toLowerCase();
  if (!needle) return {};

  const contains = buildCaseInsensitiveContains(needle, readControlPlaneProvider());
  const numericId = /^\d+$/.test(needle) ? BigInt(needle) : null;
  const orFilters: Prisma.BaseAiChatSessionWhereInput[] = [
    { title: contains },
    { user: { username: contains } },
    { modelId: contains },
  ];

  if (numericId !== null) {
    orFilters.push({ id: numericId }, { userId: numericId });
  }

  return { OR: orFilters };
};

const buildAdminOrderBy = (
  query: ChatSessionListQuery,
): Prisma.BaseAiChatSessionOrderByWithRelationInput[] => {
  const direction = query.sortDir === 'asc' ? 'asc' : 'desc';
  switch (query.sortBy) {
    case 'title':
      return [{ title: direction }];
    case 'username':
      return [{ user: { username: direction } }];
    case 'created_at':
      return [{ createdAt: direction }];
    case 'id':
      return [{ id: direction }];
    case 'updated_at':
    default:
      return [{ updatedAt: direction }, { id: direction }];
  }
};

// Sidebar-facing list — unbounded, this grows with every session a user has ever created and
// gets re-fetched on every chat sidebar load. Cap it at the app's own default page size rather
// than returning full history; a user wanting older sessions has the admin-facing paginated
// listAllChatSessions below.
const CHAT_SESSION_USER_LIST_MAX = CHAT_SESSION_DEFAULT_PAGE_SIZE;

export const listChatSessionsForUser = async (userId: number): Promise<AiChatSessionSummary[]> => {
  const rows = await prisma().baseAiChatSession.findMany({
    where: { userId: toUserId(userId), deletedAt: null },
    select: sessionListSelect,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: CHAT_SESSION_USER_LIST_MAX,
  });

  return rows.map((row) => toSummary(mapSessionRow({ ...row, messagesJson: '[]' })));
};

export const listAllChatSessions = async (
  query: ChatSessionListQuery = {},
): Promise<{ items: AiChatSessionAdminSummary[]; totalCount: number; page: number; pageSize: number }> => {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? CHAT_SESSION_DEFAULT_PAGE_SIZE;
  const where = buildAdminSearchWhere(query.search);
  const orderBy = buildAdminOrderBy(query);
  const skip = (page - 1) * pageSize;

  const [rows, totalCount] = await Promise.all([
    prisma().baseAiChatSession.findMany({
      where,
      select: {
        ...sessionListSelect,
        user: { select: { username: true } },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
    prisma().baseAiChatSession.count({ where }),
  ]);

  return {
    items: rows.map((row) => toAdminSummary({
      ...mapSessionRow({ ...row, messagesJson: '[]' }),
      username: row.user.username,
    })),
    totalCount,
    page,
    pageSize,
  };
};

export const findChatSessionForUser = async (
  sessionId: number,
  userId: number,
): Promise<AiChatSessionDetail | undefined> => {
  const row = await prisma().baseAiChatSession.findFirst({
    where: {
      id: toUserId(sessionId),
      userId: toUserId(userId),
      deletedAt: null,
    },
    select: sessionDetailSelect,
  });

  return row ? toDetail(mapSessionRow(row)) : undefined;
};

export const createChatSession = async (input: {
  userId: number;
  actorId: number | null;
  title: string;
  modelId: string | null;
  messages: AiChatStoredMessage[];
  agentCapabilityScope?: AiAgentCapabilityScope;
}): Promise<AiChatSessionDetail> => {
  const messages = prepareStoredMessagesForPersistence(input.messages);
  const tokenTotals = computeSessionTokenTotals(messages);
  const actor = input.actorId !== null ? toUserId(input.actorId) : null;
  const row = await prisma().baseAiChatSession.create({
    data: {
      userId: toUserId(input.userId),
      title: input.title,
      modelId: input.modelId,
      messagesJson: JSON.stringify(messages),
      messageCount: messages.length,
      totalInputTokens: tokenTotals.totalInputTokens,
      totalOutputTokens: tokenTotals.totalOutputTokens,
      agentCapabilityScopeJson: serializeAgentCapabilityScope(
        input.agentCapabilityScope ?? parseAgentCapabilityScopeJson(null),
      ),
      createdBy: actor,
      updatedBy: actor,
    },
    select: sessionDetailSelect,
  });

  return toDetail(mapSessionRow(row));
};

export const updateChatSession = async (input: {
  sessionId: number;
  userId: number;
  actorId: number | null;
  title?: string;
  modelId?: string | null;
  messages?: AiChatStoredMessage[];
  agentCapabilityScope?: AiAgentCapabilityScope;
}): Promise<AiChatSessionDetail | undefined> => {
  const existing = await findChatSessionForUser(input.sessionId, input.userId);
  if (!existing) return undefined;

  const nextTitle = input.title ?? existing.title;
  const nextModelId = input.modelId !== undefined ? input.modelId : existing.modelId;
  const previousMessages = prepareStoredMessagesForPersistence(existing.messages);
  const nextMessages = prepareStoredMessagesForPersistence(input.messages ?? existing.messages);
  const tokenTotals = computeMonotonicSessionTokenTotals(
    previousMessages,
    nextMessages,
    {
      totalInputTokens: existing.totalInputTokens,
      totalOutputTokens: existing.totalOutputTokens,
    },
  );
  const nextAgentCapabilityScope = input.agentCapabilityScope !== undefined
    ? input.agentCapabilityScope
    : existing.agentCapabilityScope;

  const updated = await prisma().baseAiChatSession.updateMany({
    where: {
      id: toUserId(input.sessionId),
      userId: toUserId(input.userId),
      deletedAt: null,
    },
    data: {
      title: nextTitle,
      modelId: nextModelId,
      messagesJson: JSON.stringify(nextMessages),
      messageCount: nextMessages.length,
      totalInputTokens: tokenTotals.totalInputTokens,
      totalOutputTokens: tokenTotals.totalOutputTokens,
      agentCapabilityScopeJson: serializeAgentCapabilityScope(nextAgentCapabilityScope),
      updatedAt: new Date(),
      updatedBy: input.actorId !== null ? toUserId(input.actorId) : null,
    },
  });

  if (updated.count === 0) return undefined;

  return {
    ...existing,
    title: nextTitle,
    modelId: nextModelId,
    messages: nextMessages,
    messageCount: nextMessages.length,
    totalInputTokens: tokenTotals.totalInputTokens,
    totalOutputTokens: tokenTotals.totalOutputTokens,
    agentCapabilityScope: nextAgentCapabilityScope,
    updatedAt: new Date().toISOString(),
  };
};

export const deleteChatSession = async (
  sessionId: number,
  userId: number,
  actorId: number | null,
): Promise<boolean> => {
  const existing = await prisma().baseAiChatSession.findFirst({
    where: {
      id: toUserId(sessionId),
      userId: toUserId(userId),
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma().baseAiChatSession.updateMany({
    where: {
      id: toUserId(sessionId),
      userId: toUserId(userId),
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: actorId !== null ? toUserId(actorId) : null,
    },
  });

  return true;
};

export const findChatSessionById = async (
  sessionId: number,
): Promise<AiChatSessionAdminDetail | undefined> => {
  const row = await prisma().baseAiChatSession.findUnique({
    where: { id: toUserId(sessionId) },
    select: {
      ...sessionDetailSelect,
      user: { select: { username: true } },
    },
  });

  return row
    ? toAdminDetail({
      ...mapSessionRow(row),
      username: row.user.username,
    })
    : undefined;
};

export const deleteChatSessionById = async (
  sessionId: number,
): Promise<boolean> => {
  const existing = await prisma().baseAiChatSession.findUnique({
    where: { id: toUserId(sessionId) },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma().baseAiChatSession.delete({
    where: { id: toUserId(sessionId) },
  });

  return true;
};

export const updateChatSessionContextHistorySummary = async (input: {
  sessionId: number;
  userId: number;
  actorId: number | null;
  contextHistorySummary: string | null;
}): Promise<void> => {
  await prisma().baseAiChatSession.updateMany({
    where: {
      id: toUserId(input.sessionId),
      userId: toUserId(input.userId),
      deletedAt: null,
    },
    data: {
      contextHistorySummary: input.contextHistorySummary,
      updatedAt: new Date(),
      updatedBy: input.actorId !== null ? toUserId(input.actorId) : null,
    },
  });
};
