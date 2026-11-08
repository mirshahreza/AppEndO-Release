import type { AiChatMessageTokenUsage, AiChatStoredMessage } from '../../api/contracts/ai/chatHistoryTypes';

const ESTIMATED_IMAGE_TOKENS = 765;
const MESSAGE_ROLE_OVERHEAD_TOKENS = 4;

type TokenCountableMessage = Pick<AiChatStoredMessage, 'role' | 'content' | 'attachments'>;

export const estimateTextTokens = (text: string): number => {
  if (!text.trim()) return 0;
  return Math.ceil(text.length / 4);
};

const estimateAttachmentTokens = (attachments: AiChatStoredMessage['attachments']): number => {
  if (!attachments?.length) return 0;
  return attachments.reduce((sum, attachment) => (
    sum + (attachment.kind === 'image' ? ESTIMATED_IMAGE_TOKENS : estimateTextTokens(attachment.name) + 32)
  ), 0);
};

export const estimateStoredMessageTokens = (message: TokenCountableMessage): number => (
  MESSAGE_ROLE_OVERHEAD_TOKENS
  + estimateTextTokens(message.content)
  + estimateAttachmentTokens(message.attachments)
);

export const estimateChatMessagesTokens = (messages: readonly TokenCountableMessage[]): number => (
  messages.reduce((sum, message) => sum + estimateStoredMessageTokens(message), 0)
);

export const estimateAssistantTurnTokenUsage = (
  messages: readonly TokenCountableMessage[],
  assistantIndex: number,
): AiChatMessageTokenUsage | null => {
  const message = messages[assistantIndex];
  if (!message || message.role !== 'assistant') return null;

  return {
    inputTokens: estimateChatMessagesTokens(messages.slice(0, assistantIndex)),
    outputTokens: estimateStoredMessageTokens(message),
  };
};

export const ensureStoredMessagesHaveTokenUsage = (
  messages: AiChatStoredMessage[],
): AiChatStoredMessage[] => (
  messages.map((message, index) => {
    if (message.role !== 'assistant' || message.tokenUsage) {
      return message;
    }

    const tokenUsage = estimateAssistantTurnTokenUsage(messages, index);
    return tokenUsage ? { ...message, tokenUsage } : message;
  })
);

export const computeSessionTokenTotals = (
  messages: readonly AiChatStoredMessage[],
): { totalInputTokens: number; totalOutputTokens: number } => (
  messages.reduce(
    (totals, message) => {
      if (!message.tokenUsage) return totals;
      return {
        totalInputTokens: totals.totalInputTokens + message.tokenUsage.inputTokens,
        totalOutputTokens: totals.totalOutputTokens + message.tokenUsage.outputTokens,
      };
    },
    { totalInputTokens: 0, totalOutputTokens: 0 },
  )
);

export type SessionTokenTotals = {
  totalInputTokens: number;
  totalOutputTokens: number;
};

/**
 * Session-level counters only increase. Message deletion or summarization must not reduce totals.
 */
export const computeMonotonicSessionTokenTotals = (
  previousMessages: readonly AiChatStoredMessage[],
  nextMessages: readonly AiChatStoredMessage[],
  previousTotals: SessionTokenTotals,
): SessionTokenTotals => {
  const prevPrepared = ensureStoredMessagesHaveTokenUsage([...previousMessages]);
  const nextPrepared = ensureStoredMessagesHaveTokenUsage([...nextMessages]);

  const prevComputed = computeSessionTokenTotals(prevPrepared);
  const nextComputed = computeSessionTokenTotals(nextPrepared);

  const inputDelta = Math.max(0, nextComputed.totalInputTokens - prevComputed.totalInputTokens);
  const outputDelta = Math.max(0, nextComputed.totalOutputTokens - prevComputed.totalOutputTokens);

  const cumulativeInput = previousTotals.totalInputTokens + inputDelta;
  const cumulativeOutput = previousTotals.totalOutputTokens + outputDelta;

  return {
    totalInputTokens: Math.max(
      previousTotals.totalInputTokens,
      nextComputed.totalInputTokens,
      cumulativeInput,
    ),
    totalOutputTokens: Math.max(
      previousTotals.totalOutputTokens,
      nextComputed.totalOutputTokens,
      cumulativeOutput,
    ),
  };
};

export const formatApproxTokensK = (tokens: number): string => {
  if (tokens <= 0) return '~0';
  const k = tokens / 1000;
  if (k < 0.1) return `~${k.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`;
  if (k < 10) return `~${k.toFixed(1).replace(/\.0$/, '')}`;
  return `~${Math.round(k)}`;
};

export const formatSessionTokenTotalsLabel = (
  totals: SessionTokenTotals,
): string | null => {
  const { totalInputTokens, totalOutputTokens } = totals;
  if (totalInputTokens <= 0 && totalOutputTokens <= 0) return null;

  return `In ${formatApproxTokensK(totalInputTokens)} · Out ${formatApproxTokensK(totalOutputTokens)}`;
};
