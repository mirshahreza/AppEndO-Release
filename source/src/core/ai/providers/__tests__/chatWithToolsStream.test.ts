import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnthropicProvider } from '../AnthropicProvider';
import { OpenAiCompatibleProvider } from '../OpenAiCompatibleProvider';
import { OpenAiProvider } from '../OpenAiProvider';

const sseResponse = (lines: string[]): Response => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AnthropicProvider.chatWithToolsStream', () => {
  it('streams text deltas and assembles tool calls from SSE events', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.stream).toBe(true);
      return sseResponse([
        'data: {"type":"message_start"}',
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel"}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"lo"}}',
        'data: {"type":"content_block_stop","index":0}',
        'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"tc-1","name":"read_file"}}',
        'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"path\\":"}}',
        'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"\\"a.ts\\"}"}}',
        'data: {"type":"content_block_stop","index":1}',
        'data: {"type":"message_stop"}',
      ]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new AnthropicProvider({
      displayName: 'Claude',
      modelId: 'claude-sonnet-5',
      apiKey: 'test-key',
    });

    const deltas: string[] = [];
    const result = await provider.chatWithToolsStream(
      [{ role: 'user', content: 'read a.ts' }],
      [{ name: 'read_file', description: 'Read a file', parameters: {} }],
      'system prompt text',
      (delta) => deltas.push(delta),
    );

    expect(deltas).toEqual(['Hel', 'lo']);
    expect(result.text).toBe('Hello');
    expect(result.toolCalls).toEqual([{ id: 'tc-1', name: 'read_file', args: { path: 'a.ts' } }]);
  });
});

describe('OpenAiProvider.chatWithToolsStream', () => {
  it('streams content deltas and accumulates tool call argument chunks', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.stream).toBe(true);
      return sseResponse([
        'data: {"choices":[{"delta":{"content":"Wor"}}]}',
        'data: {"choices":[{"delta":{"content":"king"}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc-9","function":{"name":"list_dir","arguments":"{\\"pa"}}]}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"th\\":\\"src\\"}"}}]}}]}',
        'data: [DONE]',
      ]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAiProvider({
      displayName: 'GPT',
      modelId: 'gpt-4.1',
      apiKey: 'test-key',
    });

    const deltas: string[] = [];
    const result = await provider.chatWithToolsStream(
      [{ role: 'user', content: 'list src' }],
      [{ name: 'list_dir', description: 'List a directory', parameters: {} }],
      undefined,
      (delta) => deltas.push(delta),
    );

    expect(deltas).toEqual(['Wor', 'king']);
    expect(result.text).toBe('Working');
    expect(result.toolCalls).toEqual([{ id: 'tc-9', name: 'list_dir', args: { path: 'src' } }]);
  });
});

describe('OpenAiCompatibleProvider OpenRouter body finalization', () => {
  it('adds throughput provider sort and claude cache_control on openrouter requests', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        provider?: { sort?: string };
        messages?: Array<{ role: string; content: unknown }>;
      };
      expect(body.provider?.sort).toBe('throughput');
      const systemMessage = body.messages?.find((message) => message.role === 'system');
      expect(Array.isArray(systemMessage?.content)).toBe(true);
      const systemParts = systemMessage?.content as Array<{ cache_control?: { type: string } }>;
      expect(systemParts[0]?.cache_control?.type).toBe('ephemeral');
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'ok' } }],
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAiCompatibleProvider({
      displayName: 'OpenRouter Claude',
      modelId: 'anthropic/claude-sonnet-5',
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.ai/api/v1',
    });

    const result = await provider.chatWithTools(
      [{ role: 'user', content: 'hello' }],
      [],
      'system prompt',
    );
    expect(result.text).toBe('ok');
  });

  it('leaves non-openrouter bodies untouched', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { provider?: unknown };
      expect(body.provider).toBeUndefined();
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'ok' } }],
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAiCompatibleProvider({
      displayName: 'Local LLM',
      modelId: 'some-model',
      apiKey: 'test-key',
      baseUrl: 'http://localhost:1234/v1',
    });

    const result = await provider.chatWithTools([{ role: 'user', content: 'hello' }], []);
    expect(result.text).toBe('ok');
  });
});
