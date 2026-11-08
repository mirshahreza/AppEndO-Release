import type { AiAgentCapabilityScope } from './capabilityPacks';

export type AiChatAttachment = {
  id: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'file';
  previewUrl?: string;
  size: number;
};

export type AiChatMessageTokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type AiChatStoredMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: AiChatAttachment[];
  /** Approximate input/output tokens for this assistant turn (persisted on save). */
  tokenUsage?: AiChatMessageTokenUsage;
};

export type AiChatSessionSummary = {
  id: number;
  title: string;
  modelId: string | null;
  /** Agent capability pack + external MCP selection persisted on the session. */
  agentCapabilityScope: AiAgentCapabilityScope;
  /** Segment H summary persisted for token-efficient resume (TOK-16). */
  contextHistorySummary?: string | null;
  messageCount: number;
  /** Cumulative input token estimate; only increases over the session lifetime. */
  totalInputTokens: number;
  /** Cumulative output token estimate; only increases over the session lifetime. */
  totalOutputTokens: number;
  createdAt: string;
  updatedAt: string;
};

export type AiChatSessionDetail = AiChatSessionSummary & {
  messages: AiChatStoredMessage[];
};

export type AiChatSessionListResponse = {
  success: boolean;
  items: AiChatSessionSummary[];
};

export type AiChatSessionDetailResponse = {
  success: boolean;
  session: AiChatSessionDetail;
};

export type AiChatSessionCreatePayload = {
  title?: string;
  modelId?: string;
  messages?: AiChatStoredMessage[];
  agentCapabilityScope?: AiAgentCapabilityScope;
};

export type AiChatSessionUpdatePayload = {
  title?: string;
  modelId?: string;
  messages?: AiChatStoredMessage[];
  agentCapabilityScope?: AiAgentCapabilityScope;
};

export type AiChatSessionAdminSummary = AiChatSessionSummary & {
  userId: number;
  username: string;
  /** True when the owning user soft-deleted this session from their chat history. */
  userDeleted: boolean;
};

export type AiChatSessionAdminDetail = AiChatSessionDetail & {
  userId: number;
  username: string;
  userDeleted: boolean;
};

export type AiChatSessionAdminListResponse = {
  success: boolean;
  items: AiChatSessionAdminSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type AiChatSessionAdminDetailResponse = {
  success: boolean;
  session: AiChatSessionAdminDetail;
};
