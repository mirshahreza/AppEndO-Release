import { useCallback, useRef } from 'react';
import {
  streamAiChat,
  type AiChatStreamHandlers,
  type AiChatStreamPayload,
  type AiChatStreamResult,
} from '../../../shared/lib/aiChatStream';

export function useAiChatStream() {
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const send = useCallback(async (
    payload: AiChatStreamPayload,
    handlers: Omit<AiChatStreamHandlers, 'signal'>,
  ): Promise<AiChatStreamResult> => {
    cancel();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      return await streamAiChat(payload, {
        ...handlers,
        signal: controller.signal,
      });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [cancel]);

  return { send, cancel };
}
