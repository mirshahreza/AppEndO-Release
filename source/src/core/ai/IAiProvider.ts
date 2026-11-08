import type { ToolCall } from '../../shared/api/contracts/ai/agentTypes';
import type { AiRemoteModelSummary } from '../../shared/api/contracts/ai/types';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export type ChatWithToolsMessage = ChatMessage | {
  role: 'tool';
  content: string;
  toolCallId: string;
  name?: string;
} | {
  role: 'assistant';
  content: string;
  toolCalls?: ToolCall[];
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ChatWithToolsResult = {
  text?: string;
  toolCalls?: ToolCall[];
};

export type ChatStreamHandler = (delta: string) => void;

export interface IAiProvider {
  getProviderName(): string;
  chat(messages: ChatMessage[], systemContext?: string): Promise<string>;
  streamChat?(messages: ChatMessage[], systemContext: string | undefined, onDelta: ChatStreamHandler): Promise<string>;
  chatWithTools?(
    messages: ChatWithToolsMessage[],
    tools: ToolDefinition[],
    systemContext?: string,
  ): Promise<ChatWithToolsResult>;
  /**
   * Streaming variant of `chatWithTools`: text deltas are pushed to `onTextDelta` as they
   * arrive; the resolved result is identical in shape to `chatWithTools`. Providers without
   * true token streaming simply omit this and callers fall back to `chatWithTools`.
   */
  chatWithToolsStream?(
    messages: ChatWithToolsMessage[],
    tools: ToolDefinition[],
    systemContext: string | undefined,
    onTextDelta: ChatStreamHandler,
  ): Promise<ChatWithToolsResult>;
  testConnection?(): Promise<string>;
  /** List models the provider's API currently exposes (e.g. GET /models), when supported. */
  listRemoteModels?(): Promise<AiRemoteModelSummary[]>;
  /**
   * Compute embedding vectors for a batch of texts (workspace vector search). One vector
   * per input, same order. Providers without an embeddings endpoint omit this.
   */
  embedTexts?(texts: string[]): Promise<number[][]>;
}

export type { ToolCall };
