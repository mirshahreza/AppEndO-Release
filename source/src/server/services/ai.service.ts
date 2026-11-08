import type { ChatMessage } from '../../core/ai/IAiProvider';
import { aiManager } from '../../core/ai/AiManager';
import { AiValidationError } from '../../shared/api/contracts/ai/validators';
import {
  APPENDO_ASK_BASE_CONTEXT,
  buildAiSystemContextWithResources,
  normalizeChatContextResourceIds,
  resolveChatContextResources,
} from '../../shared/api/contracts/ai/chatContextResources';
import { normalizeAgentChatMessage, normalizeAiPageContext } from '../../shared/api/contracts/ai/agentValidators';
import { enrichAgentMessageContent } from '../../shared/api/contracts/ai/agentMessageAttachments';
import { HttpError } from '../errors/HttpError';
import { buildPageContextPreload } from './ai/pageContextPreload.service';

const buildSystemContext = async (
  pageContext?: unknown,
  contextResources?: unknown,
) => {
  const settings = aiManager.getSettings();
  const normalizedPageContext = normalizeAiPageContext(pageContext);
  const normalizedResources = normalizeChatContextResourceIds(contextResources);
  const effectiveResources = resolveChatContextResources(
    'ask',
    normalizedResources,
    normalizedPageContext,
    { hasProjectNotes: Boolean(settings?.projectNotes?.trim()) },
  );

  const base = buildAiSystemContextWithResources(
    normalizedPageContext,
    effectiveResources,
    APPENDO_ASK_BASE_CONTEXT,
    { projectNotes: settings?.projectNotes, askMode: true },
  );

  const preload = await buildPageContextPreload(normalizedPageContext);
  if (!preload.block?.trim()) {
    return base;
  }

  return `${base}\n\n${preload.block}`;
};

export const normalizeAskMessagesForModel = (messages: unknown): ChatMessage[] => {
  if (!messages || !Array.isArray(messages)) {
    throw new HttpError(400, 'Messages array is required.');
  }

  try {
    return messages.map((message, index) => {
      const normalized = normalizeAgentChatMessage(message, index);
      if (normalized.role === 'tool') {
        throw new AiValidationError(`Message at index ${index} has invalid role "tool".`);
      }
      return {
        role: normalized.role,
        content: enrichAgentMessageContent(normalized.content, normalized.attachments),
      };
    });
  } catch (error) {
    if (error instanceof AiValidationError) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
};

export class AiService {
  async chat(messages: unknown, modelId?: unknown, pageContext?: unknown, contextResources?: unknown) {
    const settings = aiManager.getSettings();
    if (!settings?.enabled) {
      throw new HttpError(503, 'AI is disabled in platform settings.');
    }

    const resolvedModelId = typeof modelId === 'string' && modelId.trim()
      ? modelId.trim()
      : undefined;

    try {
      const text = await aiManager.processChat(
        normalizeAskMessagesForModel(messages),
        resolvedModelId,
        await buildSystemContext(pageContext, contextResources),
      );
      return { body: { text, modelId: resolvedModelId ?? settings.defaultModelId } };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI request failed.';
      if (/does not support chat/i.test(message)) {
        throw new HttpError(400, message);
      }
      if (/not configured|disabled|not found/i.test(message)) {
        throw new HttpError(503, message);
      }
      throw error;
    }
  }

  async chatStream(
    messages: unknown,
    modelId: unknown,
    onDelta: (delta: string) => void,
    pageContext?: unknown,
    contextResources?: unknown,
  ) {
    const settings = aiManager.getSettings();
    if (!settings?.enabled) {
      throw new HttpError(503, 'AI is disabled in platform settings.');
    }

    const resolvedModelId = typeof modelId === 'string' && modelId.trim()
      ? modelId.trim()
      : undefined;

    try {
      const result = await aiManager.processChatStream(
        normalizeAskMessagesForModel(messages),
        resolvedModelId,
        onDelta,
        await buildSystemContext(pageContext, contextResources),
      );

      return {
        body: {
          text: result.text,
          modelId: result.modelId,
          streamed: result.streamed,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI request failed.';
      if (/does not support chat/i.test(message)) {
        throw new HttpError(400, message);
      }
      if (/not configured|disabled|not found/i.test(message)) {
        throw new HttpError(503, message);
      }
      throw error;
    }
  }
}
