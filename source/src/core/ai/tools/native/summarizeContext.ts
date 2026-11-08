import type { NativeToolDefinition } from '../ToolRegistry';

export const summarizeContextTool: NativeToolDefinition = {
  name: 'summarize_context',
  description: [
    'Compresses older chat turns into a segment-H summary to free context window space.',
    'Returns ok=false when history is too short; otherwise replaces older turns with a summary block.',
    'Use on long agent runs before context nears the model limit — prefer automatic compaction when available.',
    'Example: summarize_context({ maxChars: 4000 })',
  ].join(' '),
  group: 'context',
  parameters: {
    type: 'object',
    properties: {
      maxChars: {
        type: 'number',
        description: 'Maximum characters for the generated summary (default 4000).',
      },
    },
  },
  execute: async (args, context) => {
    if (!context.contextMemory) {
      return {
        ok: false,
        summary: 'Context memory is not available for this run.',
        error: 'context_memory_unavailable',
      };
    }

    const maxChars = typeof args.maxChars === 'number' && args.maxChars > 500
      ? Math.min(Math.floor(args.maxChars), 12_000)
      : 4_000;

    const result = context.contextMemory.summarizeHistory(maxChars);
    return {
      ok: result.ok,
      summary: result.summary,
      data: { prunedCount: result.prunedCount },
      error: result.ok ? undefined : 'insufficient_history',
    };
  },
};
