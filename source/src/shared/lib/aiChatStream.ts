import { apiFetch } from '../api/client';
import type { AiPageContext } from '../api/contracts/ai/pageContext';
import type { AiChatContextResourceId } from '../api/contracts/ai/chatContextResources';
import type { AgentMessageAttachment } from '../api/contracts/ai/agentMessageAttachments';

export type AiChatStreamMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: AgentMessageAttachment[];
};

export type AiChatStreamPayload = {
  messages: AiChatStreamMessage[];
  modelId?: string;
  sessionId?: number;
  pageContext?: AiPageContext;
  contextResources?: AiChatContextResourceId[];
};

export type AiChatStreamHandlers = {
  onDelta: (text: string) => void;
  onEvent?: (event: AiChatStreamEvent) => void;
  signal?: AbortSignal;
};

export type AiChatStreamResult = {
  text: string;
  modelId: string;
  streamed: boolean;
};

export type AiChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; text: string; modelId?: string; streamed?: boolean }
  | { type: 'error'; error: string };

const parseSseChunk = (chunk: string): AiChatStreamEvent | null => {
  const lines = chunk.split('\n');
  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      return JSON.parse(payload) as AiChatStreamEvent;
    } catch {
      return null;
    }
  }
  return null;
};

export async function streamAiChat(
  payload: AiChatStreamPayload,
  handlers: AiChatStreamHandlers,
): Promise<AiChatStreamResult> {
  const response = await apiFetch('/api/ai/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: handlers.signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.error === 'string' ? data.error : response.statusText || 'AI stream failed.');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Streaming is not supported in this browser.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalText = '';
  let modelId = payload.modelId || '';
  let streamed = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const event = parseSseChunk(part);
      if (!event) continue;

      handlers.onEvent?.(event);

      if (event.type === 'delta' && event.text) {
        streamed = true;
        handlers.onDelta(event.text);
        finalText += event.text;
      } else if (event.type === 'done') {
        finalText = event.text || finalText;
        modelId = event.modelId || modelId;
        streamed = event.streamed ?? streamed;
      } else if (event.type === 'error') {
        throw new Error(event.error || 'AI stream failed.');
      }
    }
  }

  return { text: finalText, modelId, streamed };
}
