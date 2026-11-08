import type { ChatMessage } from '../IAiProvider';

type ResponsesOutputItem = {
  type?: string;
  content?: Array<{ type?: string; text?: string }>;
  result?: string;
};

export type OpenAiResponsesPayload = {
  output_text?: string;
  output?: ResponsesOutputItem[];
};

export type OpenAiImagesGenerationsPayload = {
  data?: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
};

const IMAGE_GENERATION_MODEL_PATTERNS = [
  /^gpt-image(?:-|\.|$)/,
  /^dall-e(?:-|$)/,
  /^chatgpt-image(?:-|$)/,
];

const RESPONSES_ONLY_MODEL_PATTERNS = [
  /^o1-pro(?:-|$)/,
  /^o3-pro(?:-|$)/,
  /^o3-deep-research(?:-|$)/,
  /^o4-mini-deep-research(?:-|$)/,
  /^computer-use-preview(?:-|$)/,
  /^gpt-5-codex(?:-|$)/,
  /^gpt-5-pro(?:-|$)/,
  /^gpt-5\.1-codex-max(?:-|$)/,
];

/** Mainline models that return images via Responses API `image_generation` tool (not /images/edits). */
const RESPONSES_IMAGE_GENERATION_MODEL_PATTERNS = [
  /^gpt-5\.5(?:-|$)/,
  /^gpt-5\.4(?:-|$)/,
  /^gpt-5\.2(?:-|$)/,
  /^gpt-5(?:-|$)/,
  /^o3$/,
  /^gpt-4\.1(?:-|$)/,
  /^gpt-4o(?:-|$)/,
];

/** Models that reject `max_tokens` on /chat/completions — use `max_completion_tokens`. */
const MAX_COMPLETION_TOKENS_MODEL_PATTERNS = [
  /^o\d/,
  /^gpt-4\.1(?:-|$)/,
  /^gpt-5(?:\.|$|-)/,
  /^chatgpt-4o-latest(?:-|$)/,
];

export const requiresOpenAiImagesApi = (modelId: string): boolean => {
  const normalized = modelId.trim().toLowerCase();
  if (!normalized) return false;
  return IMAGE_GENERATION_MODEL_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const requiresOpenAiResponsesApi = (modelId: string): boolean => {
  const normalized = modelId.trim().toLowerCase();
  if (!normalized) return false;
  return RESPONSES_ONLY_MODEL_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const supportsOpenAiResponsesImageGeneration = (modelId: string): boolean => {
  const normalized = modelId.trim().toLowerCase();
  if (!normalized) return false;
  if (requiresOpenAiImagesApi(normalized)) return false;
  if (requiresOpenAiResponsesApi(normalized)) return false;
  return RESPONSES_IMAGE_GENERATION_MODEL_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const usesMaxCompletionTokens = (modelId: string): boolean => {
  const normalized = modelId.trim().toLowerCase();
  if (!normalized) return false;
  return MAX_COMPLETION_TOKENS_MODEL_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const buildOpenAiTokenLimitField = (
  modelId: string,
  maxOutputTokens: number | undefined,
  // p-63 F-1 — 1,024 truncated draft_* tool args (whole source files); see p-63 Phase A1.
  fallback = 8_192,
): Record<string, number> => {
  const value = maxOutputTokens ?? fallback;
  if (usesMaxCompletionTokens(modelId)) {
    return { max_completion_tokens: value };
  }
  return { max_tokens: value };
};

export const isMaxTokensUnsupportedError = (message: string): boolean => (
  /max_tokens.*not supported/i.test(message)
  && /max_completion_tokens/i.test(message)
);

export const isUnsupportedTemperatureError = (message: string): boolean => (
  /temperature.*does not support/i.test(message)
  || /only the default \(1\) value is supported/i.test(message)
);

export const buildImageGenerationPrompt = (
  messages: ChatMessage[],
  systemContext?: string,
): string => {
  const lastUserMessage = [...messages].reverse().find(
    (message) => message.role === 'user' && message.content.trim(),
  );

  if (!lastUserMessage?.content.trim()) {
    throw new Error('Image generation requires a user prompt.');
  }

  const guidance = [
    systemContext?.trim(),
    ...messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content.trim())
      .filter(Boolean),
  ].filter(Boolean);

  if (guidance.length === 0) {
    return lastUserMessage.content.trim();
  }

  return `${guidance.join('\n\n')}\n\n${lastUserMessage.content.trim()}`;
};

export const formatGeneratedImageContent = (
  imageData: { b64_json?: string; url?: string; revised_prompt?: string },
): string => {
  const parts: string[] = ['Generated image:'];

  if (imageData.revised_prompt?.trim()) {
    parts.push(`Prompt: ${imageData.revised_prompt.trim()}`);
  }

  if (imageData.b64_json?.trim()) {
    parts.push(`![generated image](data:image/png;base64,${imageData.b64_json.trim()})`);
    return parts.join('\n\n');
  }

  if (imageData.url?.trim()) {
    parts.push(`![generated image](${imageData.url.trim()})`);
    return parts.join('\n\n');
  }

  throw new Error('Image generation returned no image data.');
};

export const isOpenAiResponsesOnlyError = (message: string): boolean => (
  /only supported in v1\/responses/i.test(message)
  || /not accessible via the \/chat\/completions endpoint/i.test(message)
);

export const extractResponsesImageGenerationDataUrl = (data: OpenAiResponsesPayload): string | null => {
  for (const item of data.output ?? []) {
    if (item.type === 'image_generation_call' && item.result?.trim()) {
      return `data:image/png;base64,${item.result.trim()}`;
    }
  }

  return null;
};

export const extractResponsesOutputText = (data: OpenAiResponsesPayload): string => {
  if (data.output_text?.trim()) {
    return data.output_text.trim();
  }

  const parts: string[] = [];
  for (const item of data.output ?? []) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const block of item.content) {
        if (block.type === 'output_text' && block.text?.trim()) {
          parts.push(block.text.trim());
        }
      }
    }

    if (item.type === 'image_generation_call' && item.result?.trim()) {
      parts.push(`![generated image](data:image/png;base64,${item.result.trim()})`);
    }
  }

  return parts.join('\n\n');
};
