import { z } from 'zod';
import { aiModelGateway } from '../../../../../core/ai/gateway/AiModelGatewayAdapter';
import type { ChatMessage } from '../../../../../core/ai/IAiProvider';
import { aiManager } from '../../../../../core/ai/AiManager';
import { LocalEmbeddingsProvider } from '../../../../../core/ai/providers/LocalEmbeddingsProvider';
import { validateAgainstJsonSchema } from '../../../../utils/jsonSchemaValidate';
import { searchVectorDocuments, upsertVectorDocument } from '../../engine/vectorStore';
import type { ActionDefinition, ActionExecutor } from '../types';
import type { JsonValue } from '../../awm/types';

/**
 * AI Action pack (doc 04 section 4). Wraps the real `aiModelGateway` facade
 * (src/core/ai/gateway/AiModelGatewayAdapter.ts) — provider selection, model routing and
 * telemetry stay that gateway's authority; Workflow does not talk to provider SDKs directly
 * (constitution: domain services must use the gateway).
 *
 * Known Slice 3 gap, now partially closed: `ModelGatewayStructuredRequest` requires a
 * compile-time `z.ZodType<T>`, but a workflow author's declared Action `outputSchema` is a
 * runtime `JsonSchemaRefOrInline` (doc 05 section 19) unknown until authoring time, and this repo
 * has no JSON-Schema-to-Zod bridge. `ai.llm-structured` still asks the gateway only for "is a JSON
 * object" (`z.record(z.string(), z.unknown())`) — but the result is now additionally checked with
 * `src/server/utils/jsonSchemaValidate.ts` (the canonical ajv-backed primitive) against this
 * Action's own pinned `outputSchema`, satisfying doc 04 section 8 ("output MUST validate against
 * the pinned Action output schema before semantic success") for whatever schema is actually
 * pinned. Every corePack Action here still pins an empty inline schema (`{}`, no constraints), so
 * this is a real, tested code path with no behavior change yet — it activates the moment a future
 * revision pins a non-empty `outputSchema` for one of these Actions.
 *
 * `ai.classify` / `ai.extract` / `ai.summarize` are task-labeled thin wrappers over the same
 * structured-output mechanism (not a distinct AI capability) — doc 04 section 4 lists them by
 * name but does not define them as a separate closed contract the way node/edge/error registries
 * are closed, so this is a documented Slice 3 interpretation, not a literal frozen-contract
 * requirement.
 */

const inlineSchema = (schema: unknown = {}) => ({ type: 'INLINE' as const, schema });

const promptInputSchema = () =>
  inlineSchema({
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'The user-role prompt sent to the model.' },
      systemContext: { type: 'string', title: 'System context', description: 'Optional system-role instructions.' },
    },
    required: ['prompt'],
  });

const baseDefinition = (key: string, requiredCapability: string) =>
  ({
    key,
    version: '1',
    contributor: { type: 'CORE' as const, id: 'core' },
    configSchema: inlineSchema(),
    inputSchema: promptInputSchema(),
    outputSchema: inlineSchema(),
    executionTimeoutMs: 60000,
    idempotency: { guarantee: 'NONE' as const },
    cancellationSupport: 'NONE' as const,
    sideEffectClass: 'READ_EXTERNAL' as const,
    riskClass: 'MEDIUM' as const,
    requiredCapabilities: [requiredCapability],
    requiredPermissions: [],
    secretReferenceFields: [],
    availability: 'AVAILABLE' as const,
    executionMode: 'DETERMINISTIC' as const,
    tags: ['ai'],
  }) satisfies ActionDefinition;

const toChatMessages = (input: unknown): ChatMessage[] | null => {
  const prompt = (input as { prompt?: unknown })?.prompt;
  const systemContext = (input as { systemContext?: unknown })?.systemContext;
  if (typeof prompt !== 'string') return null;
  const messages: ChatMessage[] = [];
  if (typeof systemContext === 'string') {
    messages.push({ role: 'system', content: systemContext });
  }
  messages.push({ role: 'user', content: prompt });
  return messages;
};

/** Only `ai.llm-invoke`/`ai.summarize` get a real outputSchema here — they call `invokeText`
 * directly, never `invokeStructuredPassthrough`'s ajv check, so this is purely additive UI metadata
 * with zero runtime effect. `ai.llm-structured`/`classify`/`extract` deliberately keep the empty
 * `{}` outputSchema from `baseDefinition` — see this module's own doc comment above: their output
 * shape is genuinely open/author-defined, and pinning a fake one would start being *enforced* by
 * `invokeStructuredPassthrough`'s ajv check, silently changing runtime behavior. */
const textOutputSchema = () => inlineSchema({ type: 'object', properties: { text: { type: 'string' } } });

export const aiLlmInvokeDefinition: ActionDefinition = { ...baseDefinition('ai.llm-invoke', 'ai.text-generation'), outputSchema: textOutputSchema() };
export const aiLlmInvokeExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const messages = toChatMessages(input);
    if (!messages) {
      return { status: 'FAILED', errorCode: 'AI_INVALID_INPUT', errorClass: 'VALIDATION', safeMessage: 'Expected input.prompt (string).' };
    }
    try {
      const text = await aiModelGateway.invokeText({ messages, taskProfile: 'GENERAL_CHAT' });
      return { status: 'SUCCEEDED', output: { text } };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'AI invocation failed.';
      return { status: 'FAILED', errorCode: 'AI_INVOCATION_FAILED', errorClass: 'EXTERNAL_ERROR', safeMessage };
    }
  },
};

const structuredOutputSchema = z.record(z.string(), z.unknown());

async function invokeStructuredPassthrough(input: unknown, outputSchema: ActionDefinition['outputSchema']): Promise<{ status: 'SUCCEEDED'; output: Record<string, unknown> } | { status: 'FAILED'; errorCode: string; errorClass: string; safeMessage: string }> {
  const messages = toChatMessages(input);
  if (!messages) {
    return { status: 'FAILED', errorCode: 'AI_INVALID_INPUT', errorClass: 'VALIDATION', safeMessage: 'Expected input.prompt (string).' };
  }
  try {
    const result = await aiModelGateway.invokeStructured({ messages, taskProfile: 'GENERAL_CHAT', schema: structuredOutputSchema });
    const schemaCheck = validateAgainstJsonSchema(outputSchema, result.data);
    if (!schemaCheck.valid) {
      return { status: 'FAILED', errorCode: 'AI_OUTPUT_SCHEMA_INVALID', errorClass: 'VALIDATION', safeMessage: `Model output did not match the pinned output schema: ${schemaCheck.errors.join('; ')}` };
    }
    return { status: 'SUCCEEDED', output: result.data };
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : 'AI structured invocation failed.';
    return { status: 'FAILED', errorCode: 'AI_INVOCATION_FAILED', errorClass: 'EXTERNAL_ERROR', safeMessage };
  }
}

export const aiLlmStructuredDefinition: ActionDefinition = baseDefinition('ai.llm-structured', 'ai.structured-output');
export const aiLlmStructuredExecutor: ActionExecutor = { execute: (_context, _config, input) => invokeStructuredPassthrough(input, aiLlmStructuredDefinition.outputSchema) };

/**
 * `ai.classify` accepts either:
 * - `{ prompt, systemContext? }` — raw structured invoke (author supplies the JSON contract), or
 * - `{ text, labels[] }` — convenience shape used by example / catalog machines; builds a prompt that
 *   asks the model to return `{ "label": "<one of labels>" }` and normalizes the chosen label.
 */
export const aiClassifyDefinition: ActionDefinition = {
  ...baseDefinition('ai.classify', 'ai.structured-output'),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Raw user-role prompt (alternative to text+labels).' },
      systemContext: { type: 'string', title: 'System context' },
      text: { type: 'string', description: 'Text to classify when using labels[].' },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Closed label set; model must pick exactly one.',
      },
    },
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      label: { type: 'string', title: 'Chosen label' },
    },
  }),
};

const normalizeLabel = (raw: unknown, labels: string[]): string | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const exact = labels.find((l) => l === trimmed);
  if (exact) return exact;
  const upper = trimmed.toUpperCase();
  return labels.find((l) => l.toUpperCase() === upper) ?? null;
};

export const aiClassifyExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const record = (input && typeof input === 'object' && !Array.isArray(input))
      ? input as Record<string, unknown>
      : {};
    const labelsRaw = record.labels;
    const text = record.text;
    const hasLabels = Array.isArray(labelsRaw) && labelsRaw.every((l) => typeof l === 'string') && labelsRaw.length > 0;
    const hasText = typeof text === 'string' && text.trim().length > 0;

    let structuredInput: unknown = input;
    let expectedLabels: string[] | null = null;

    if (hasLabels && hasText) {
      expectedLabels = labelsRaw as string[];
      structuredInput = {
        systemContext:
          'You are a strict classifier. Respond with a single JSON object only: {"label":"<one of the allowed labels>"}. '
          + 'Pick exactly one label from the allowed list. Do not invent labels.',
        prompt:
          `Allowed labels: ${JSON.stringify(expectedLabels)}\n\nText to classify:\n${text}`,
      };
    } else if (typeof record.prompt !== 'string') {
      return {
        status: 'FAILED',
        errorCode: 'AI_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.prompt (string), or input.text (string) with input.labels (non-empty string[]).',
      };
    }

    const result = await invokeStructuredPassthrough(structuredInput, aiClassifyDefinition.outputSchema);
    if (result.status !== 'SUCCEEDED') return result;

    const output = result.output;
    const candidate =
      output.label
      ?? output.Label
      ?? output.category
      ?? output.class
      ?? output.riskLevel;

    if (expectedLabels) {
      const label = normalizeLabel(candidate, expectedLabels);
      if (!label) {
        return {
          status: 'FAILED',
          errorCode: 'AI_CLASSIFY_LABEL_INVALID',
          errorClass: 'VALIDATION',
          safeMessage: `Model did not return one of the allowed labels: ${expectedLabels.join(', ')}.`,
        };
      }
      return { status: 'SUCCEEDED', output: { ...output, label } };
    }

    if (typeof candidate !== 'string' || !candidate.trim()) {
      return {
        status: 'FAILED',
        errorCode: 'AI_CLASSIFY_LABEL_MISSING',
        errorClass: 'VALIDATION',
        safeMessage: 'Model output did not include a string label.',
      };
    }
    return { status: 'SUCCEEDED', output: { ...output, label: candidate.trim() } };
  },
};

export const aiExtractDefinition: ActionDefinition = baseDefinition('ai.extract', 'ai.structured-output');
export const aiExtractExecutor: ActionExecutor = { execute: (_context, _config, input) => invokeStructuredPassthrough(input, aiExtractDefinition.outputSchema) };

export const aiSummarizeDefinition: ActionDefinition = { ...baseDefinition('ai.summarize', 'ai.text-generation'), outputSchema: textOutputSchema() };
export const aiSummarizeExecutor: ActionExecutor = { execute: (_context, _config, input) => aiLlmInvokeExecutor.execute(_context, _config, input) };

const localEmbeddingsProvider = new LocalEmbeddingsProvider();

const embedTexts = async (texts: string[], modelId?: string): Promise<number[][]> => {
  try {
    const { provider } = aiManager.resolveModel(modelId);
    if (typeof provider.embedTexts === 'function') {
      return provider.embedTexts(texts);
    }
  } catch {
    // Fall through to the in-process local embeddings provider.
  }
  return localEmbeddingsProvider.embedTexts(texts);
};

export const aiEmbeddingDefinition: ActionDefinition = {
  ...baseDefinition('ai.embedding', 'ai.embedding'),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      text: { type: 'string', title: 'Text to embed' },
      texts: { type: 'array', items: { type: 'string' }, title: 'Batch of texts' },
      modelId: { type: 'string', title: 'Optional embedding model id' },
    },
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      embedding: { type: 'array', items: { type: 'number' } },
      embeddings: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
      dimensions: { type: 'integer' },
    },
  }),
};

export const aiEmbeddingExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const rec = (input ?? {}) as { text?: unknown; texts?: unknown; modelId?: unknown };
    const batch: string[] = [];
    if (typeof rec.text === 'string' && rec.text.trim()) batch.push(rec.text);
    if (Array.isArray(rec.texts)) {
      for (const item of rec.texts) {
        if (typeof item === 'string' && item.trim()) batch.push(item);
      }
    }
    if (batch.length === 0) {
      return { status: 'FAILED', errorCode: 'EMBEDDING_TEXT_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'Provide input.text or input.texts.' };
    }
    try {
      const embeddings = await embedTexts(batch, typeof rec.modelId === 'string' ? rec.modelId : undefined);
      return {
        status: 'SUCCEEDED',
        output: {
          embedding: embeddings[0] ?? [],
          embeddings,
          dimensions: embeddings[0]?.length ?? 0,
        },
      };
    } catch (error) {
      return {
        status: 'FAILED',
        errorCode: 'EMBEDDING_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage: error instanceof Error ? error.message : 'Embedding failed.',
      };
    }
  },
};

export const aiVectorUpsertDefinition: ActionDefinition = {
  ...baseDefinition('ai.vector-upsert', 'ai.embedding'),
  sideEffectClass: 'WRITE_EXTERNAL',
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      collection: { type: 'string' },
      documentKey: { type: 'string' },
      text: { type: 'string' },
      metadata: { title: 'Optional metadata JSON' },
      modelId: { type: 'string' },
    },
    required: ['collection', 'documentKey', 'text'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      id: { type: 'integer' },
      collection: { type: 'string' },
      documentKey: { type: 'string' },
      dimensions: { type: 'integer' },
    },
  }),
};

export const aiVectorUpsertExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const rec = (input ?? {}) as { collection?: unknown; documentKey?: unknown; text?: unknown; metadata?: unknown; modelId?: unknown };
    if (typeof rec.collection !== 'string' || !rec.collection.trim() || typeof rec.documentKey !== 'string' || !rec.documentKey.trim() || typeof rec.text !== 'string') {
      return { status: 'FAILED', errorCode: 'VECTOR_UPSERT_FIELDS_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'collection, documentKey, and text are required.' };
    }
    try {
      const [embedding] = await embedTexts([rec.text], typeof rec.modelId === 'string' ? rec.modelId : undefined);
      const saved = await upsertVectorDocument({
        collection: rec.collection.trim(),
        documentKey: rec.documentKey.trim(),
        text: rec.text,
        embedding,
        metadata: rec.metadata as JsonValue | undefined,
      });
      return { status: 'SUCCEEDED', output: { ...saved, dimensions: embedding.length } };
    } catch (error) {
      return {
        status: 'FAILED',
        errorCode: 'VECTOR_UPSERT_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage: error instanceof Error ? error.message : 'Vector upsert failed.',
      };
    }
  },
};

export const aiVectorSearchDefinition: ActionDefinition = {
  ...baseDefinition('ai.vector-search', 'ai.embedding'),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      collection: { type: 'string' },
      query: { type: 'string' },
      limit: { type: 'integer', default: 5 },
      modelId: { type: 'string' },
    },
    required: ['collection', 'query'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      hits: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            documentKey: { type: 'string' },
            text: { type: 'string' },
            score: { type: 'number' },
          },
        },
      },
    },
  }),
};

export const aiVectorSearchExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const rec = (input ?? {}) as { collection?: unknown; query?: unknown; limit?: unknown; modelId?: unknown };
    if (typeof rec.collection !== 'string' || !rec.collection.trim() || typeof rec.query !== 'string' || !rec.query.trim()) {
      return { status: 'FAILED', errorCode: 'VECTOR_SEARCH_FIELDS_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'collection and query are required.' };
    }
    const limit = typeof rec.limit === 'number' && rec.limit > 0 ? Math.min(50, Math.floor(rec.limit)) : 5;
    try {
      const [embedding] = await embedTexts([rec.query], typeof rec.modelId === 'string' ? rec.modelId : undefined);
      const hits = await searchVectorDocuments({ collection: rec.collection.trim(), embedding, limit });
      return { status: 'SUCCEEDED', output: { hits } };
    } catch (error) {
      return {
        status: 'FAILED',
        errorCode: 'VECTOR_SEARCH_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage: error instanceof Error ? error.message : 'Vector search failed.',
      };
    }
  },
};
