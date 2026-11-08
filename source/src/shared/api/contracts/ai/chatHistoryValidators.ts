import type { AiChatStoredMessage, AiChatSessionCreatePayload, AiChatSessionUpdatePayload } from './chatHistoryTypes';
import { normalizeAgentCapabilityScope } from './agentValidators';
import { sanitizeUserMessageForUi } from './agentMessageAttachments';
import type { AiAgentCapabilityScope } from './capabilityPacks';
import {
  computeMonotonicSessionTokenTotals,
  computeSessionTokenTotals,
  ensureStoredMessagesHaveTokenUsage,
} from '../../../lib/appendoo/chatTurnTokenUsage';

export class AiChatHistoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiChatHistoryValidationError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const normalizeAttachment = (value: unknown): AiChatStoredMessage['attachments'] => {
  if (!Array.isArray(value)) return undefined;

  const attachments = value
    .map((item) => {
      if (!isRecord(item)) return null;
      const kind = item.kind === 'image' ? 'image' : item.kind === 'file' ? 'file' : null;
      if (!kind) return null;

      return {
        id: String(item.id ?? ''),
        name: String(item.name ?? 'attachment'),
        mimeType: String(item.mimeType ?? 'application/octet-stream'),
        kind,
        previewUrl: typeof item.previewUrl === 'string' ? item.previewUrl : undefined,
        size: Number(item.size ?? 0),
      };
    })
    .filter(Boolean) as NonNullable<AiChatStoredMessage['attachments']>;

  return attachments.length ? attachments : undefined;
};

const normalizeTokenUsage = (value: unknown): AiChatStoredMessage['tokenUsage'] => {
  if (!isRecord(value)) return undefined;

  const inputTokens = Number(value.inputTokens);
  const outputTokens = Number(value.outputTokens);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
    return undefined;
  }

  return {
    inputTokens: Math.max(0, Math.round(inputTokens)),
    outputTokens: Math.max(0, Math.round(outputTokens)),
  };
};

export const normalizeStoredMessages = (value: unknown): AiChatStoredMessage[] => {
  if (!Array.isArray(value)) {
    throw new AiChatHistoryValidationError('messages must be an array.');
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new AiChatHistoryValidationError(`messages[${index}] must be an object.`);
    }

    const role = item.role;
    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
      throw new AiChatHistoryValidationError(`messages[${index}].role is invalid.`);
    }

    const normalizedMessage = {
      role,
      content: String(item.content ?? ''),
      attachments: normalizeAttachment(item.attachments),
      ...(role === 'assistant' ? { tokenUsage: normalizeTokenUsage(item.tokenUsage) } : {}),
    };

    return role === 'user'
      ? sanitizeUserMessageForUi(normalizedMessage)
      : normalizedMessage;
  });
};

export const prepareStoredMessagesForPersistence = (messages: AiChatStoredMessage[]): AiChatStoredMessage[] => (
  ensureStoredMessagesHaveTokenUsage(messages)
);

export { computeMonotonicSessionTokenTotals, computeSessionTokenTotals };

export const normalizeTitle = (value: unknown, fallback = 'New Chat'): string => {
  const title = String(value ?? '').trim();
  if (!title) return fallback;
  return title.slice(0, 200);
};

export const generateChatTitleFromMessage = (content: string): string => {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'New Chat';
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
};

const normalizeAgentCapabilityScopeField = (
  value: unknown,
  applyDefaultWhenMissing: boolean,
): AiAgentCapabilityScope | undefined => {
  try {
    return normalizeAgentCapabilityScope(value, { applyDefaultWhenMissing });
  } catch (error) {
    if (error instanceof Error) {
      throw new AiChatHistoryValidationError(error.message);
    }
    throw error;
  }
};

export const normalizeCreatePayload = (payload: AiChatSessionCreatePayload) => {
  const messages = payload.messages ? normalizeStoredMessages(payload.messages) : [];
  const firstUserMessage = messages.find((message) => message.role === 'user')?.content ?? '';
  const title = normalizeTitle(payload.title, generateChatTitleFromMessage(firstUserMessage));

  return {
    title,
    modelId: typeof payload.modelId === 'string' && payload.modelId.trim()
      ? payload.modelId.trim()
      : null,
    messages,
    agentCapabilityScope: normalizeAgentCapabilityScopeField(payload.agentCapabilityScope, true)!,
  };
};

export const normalizeUpdatePayload = (payload: AiChatSessionUpdatePayload) => {
  const normalized: {
    title?: string;
    modelId?: string | null;
    messages?: AiChatStoredMessage[];
    agentCapabilityScope?: AiAgentCapabilityScope;
  } = {};

  if (payload.title !== undefined) {
    normalized.title = normalizeTitle(payload.title);
  }

  if (payload.modelId !== undefined) {
    normalized.modelId = typeof payload.modelId === 'string' && payload.modelId.trim()
      ? payload.modelId.trim()
      : null;
  }

  if (payload.messages !== undefined) {
    normalized.messages = normalizeStoredMessages(payload.messages);
  }

  if (payload.agentCapabilityScope !== undefined) {
    normalized.agentCapabilityScope = normalizeAgentCapabilityScopeField(
      payload.agentCapabilityScope,
      false,
    );
  }

  return normalized;
};

export const parseStoredMessagesJson = (raw: string | null): AiChatStoredMessage[] => {
  if (!raw) return [];
  try {
    return normalizeStoredMessages(JSON.parse(raw));
  } catch {
    return [];
  }
};
