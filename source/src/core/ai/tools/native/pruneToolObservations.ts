import type { NativeToolDefinition } from '../ToolRegistry';

export const pruneToolObservationsTool: NativeToolDefinition = {
  name: 'prune_tool_observations',
  description: [
    'Removes duplicate tool-result messages from working memory to shrink context.',
    'Returns how many observations were pruned.',
    'Use when the conversation is long and repeated read/search results bloat context — not for fixing tool errors.',
    'Example: prune_tool_observations({})',
  ].join(' '),
  group: 'context',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async (_args, context) => {
    if (!context.contextMemory) {
      return {
        ok: false,
        summary: 'Context memory is not available for this run.',
        error: 'context_memory_unavailable',
      };
    }

    const result = context.contextMemory.pruneDuplicateToolObservations();
    return {
      ok: result.ok,
      summary: result.summary,
      data: { prunedCount: result.prunedCount ?? 0 },
    };
  },
};
