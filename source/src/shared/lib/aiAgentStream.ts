import { apiFetch } from '../api/client';
import type { AgentRunRequest, AgentStreamEvent } from '../api/contracts/ai/agentTypes';
import { normalizeAgentStreamEvent } from '../api/contracts/ai/agentValidators';

export type AiAgentStreamHandlers = {
  onEvent: (event: AgentStreamEvent) => void;
  signal?: AbortSignal;
};

export type AiAgentStreamResult = {
  text: string;
  modelId: string;
  iterationCount: number;
  sessionId?: number;
};

const parseSseChunk = (chunk: string): AgentStreamEvent | null => {
  const lines = chunk.split('\n');
  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      return normalizeAgentStreamEvent(JSON.parse(payload));
    } catch {
      return null;
    }
  }
  return null;
};

export async function streamAiAgentRun(
  payload: AgentRunRequest,
  handlers: AiAgentStreamHandlers,
): Promise<AiAgentStreamResult> {
  const response = await apiFetch('/api/ai/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: handlers.signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.error === 'string' ? data.error : response.statusText || 'Agent stream failed.');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Streaming is not supported in this browser.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalText = '';
  let modelId = payload.modelId || '';
  let iterationCount = 0;
  let sessionId = payload.sessionId;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const event = parseSseChunk(part);
      if (!event) continue;

      handlers.onEvent(event);

      if (event.type === 'text_delta') {
        finalText += event.text;
      } else if (event.type === 'done') {
        finalText = event.text || finalText;
        modelId = event.modelId || modelId;
        iterationCount = event.iterationCount;
        sessionId = event.sessionId ?? sessionId;
      } else if (event.type === 'error') {
        throw new Error(event.error || 'Agent stream failed.');
      }
    }
  }

  return { text: finalText, modelId, iterationCount, sessionId };
}
