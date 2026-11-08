import type { NativeToolDefinition } from '../ToolRegistry';

export const ASK_CLARIFYING_QUESTION_TOOL_NAME = 'ask_clarifying_question';

const parseOptions = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 8);
};

export const askClarifyingQuestionTool: NativeToolDefinition = {
  name: ASK_CLARIFYING_QUESTION_TOOL_NAME,
  description: 'Ask the user one clarifying question when the target is ambiguous (multiple matching functions, missing functionId, unclear scope). Use instead of guessing. Returns the question for the chat UI — do not invent answers.',
  group: 'context',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'Short clarifying question in the user language (fa or en).' },
      options: {
        type: 'string',
        description: 'Optional JSON array of suggested answers, e.g. ["math.sum-two-numbers","users.list"]',
      },
      reason: { type: 'string', description: 'Optional one-line reason why clarification is needed.' },
    },
    required: ['question'],
  },
  execute: async (args) => {
    const question = typeof args.question === 'string' ? args.question.trim() : '';
    if (!question) {
      return { ok: false as const, summary: 'question is required.', error: 'missing_question' };
    }

    let options: string[] = [];
    if (typeof args.options === 'string' && args.options.trim()) {
      try {
        options = parseOptions(JSON.parse(args.options));
      } catch {
        options = parseOptions(args.options.split(',').map((item) => item.trim()));
      }
    }

    const reason = typeof args.reason === 'string' ? args.reason.trim() : undefined;

    return {
      ok: true as const,
      summary: question,
      data: {
        question,
        options: options.length ? options : undefined,
        reason,
      },
    };
  },
};
