import { afterEach, describe, expect, it, vi } from 'vitest';

import { OllamaProvider } from '../OllamaProvider';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('OllamaProvider.chatWithTools', () => {
  it('sends tools in Ollama shape and maps a tool_calls response with synthesized ids', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.stream).toBe(false);
      expect(body.tools).toEqual([
        { type: 'function', function: { name: 'get_weather', description: 'Get the weather', parameters: {} } },
      ]);

      return new Response(JSON.stringify({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ function: { name: 'get_weather', arguments: { city: 'Tokyo' } } }],
        },
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OllamaProvider({
      displayName: 'Llama 3.3 (Ollama)',
      modelId: 'llama3.3:70b',
    });

    const result = await provider.chatWithTools(
      [{ role: 'user', content: 'weather in Tokyo?' }],
      [{ name: 'get_weather', description: 'Get the weather', parameters: {} }],
    );

    expect(result.toolCalls).toEqual([{ id: 'call-1', name: 'get_weather', args: { city: 'Tokyo' } }]);
    expect(result.text).toBeUndefined();
  });

  it('serializes an outbound tool-result message as role/content/tool_name with no tool_call_id', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { messages: Array<Record<string, unknown>> };
      const toolMessage = body.messages.find((message) => message.role === 'tool');
      expect(toolMessage).toEqual({ role: 'tool', content: '11 degrees celsius', tool_name: 'get_weather' });

      return new Response(JSON.stringify({
        message: { role: 'assistant', content: 'It is 11 degrees.' },
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OllamaProvider({
      displayName: 'Llama 3.3 (Ollama)',
      modelId: 'llama3.3:70b',
    });

    const result = await provider.chatWithTools(
      [
        { role: 'user', content: 'weather in Tokyo?' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'call-1', name: 'get_weather', args: { city: 'Tokyo' } }] },
        { role: 'tool', content: '11 degrees celsius', toolCallId: 'call-1', name: 'get_weather' },
      ],
      [{ name: 'get_weather', description: 'Get the weather', parameters: {} }],
    );

    expect(result.text).toBe('It is 11 degrees.');
  });
});

describe('OllamaProvider.chatWithToolsStream', () => {
  it('streams text deltas via NDJSON and surfaces tool_calls from the final chunk', async () => {
    const ndjsonResponse = (lines: string[]): Response => {
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

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.stream).toBe(true);
      return ndjsonResponse([
        JSON.stringify({ message: { role: 'assistant', content: 'Look' } }),
        JSON.stringify({ message: { role: 'assistant', content: 'ing' } }),
        JSON.stringify({
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{ function: { name: 'get_weather', arguments: { city: 'Tokyo' } } }],
          },
        }),
        JSON.stringify({ done: true }),
      ]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OllamaProvider({
      displayName: 'Llama 3.3 (Ollama)',
      modelId: 'llama3.3:70b',
    });

    const deltas: string[] = [];
    const result = await provider.chatWithToolsStream(
      [{ role: 'user', content: 'weather in Tokyo?' }],
      [{ name: 'get_weather', description: 'Get the weather', parameters: {} }],
      undefined,
      (delta) => deltas.push(delta),
    );

    expect(deltas).toEqual(['Look', 'ing']);
    expect(result.text).toBe('Looking');
    expect(result.toolCalls).toEqual([{ id: 'call-1', name: 'get_weather', args: { city: 'Tokyo' } }]);
  });
});
