import type { ChatMessage } from '../../../core/ai/IAiProvider';
import { aiManager } from '../../../core/ai/AiManager';
import { HttpError } from '../../errors/HttpError';
import { resolveFieldAssistChatModelId } from './fieldAssistModelResolver';

/**
 * Context chat for the Client Components Live Designer — same non-agentic `processChat`
 * pattern as Server Functions. The model proposes a full document replacement; the client
 * only stages it onto the canvas. Nothing is saved until the operator clicks Save.
 */

const MAX_SNAPSHOT_CHARS = 32_000;
const MAX_HISTORY_ITEMS = 20;
const MAX_PROMPT_CHARS = 4_000;

const CLIENT_COMPONENT_ASSIST_SYSTEM = `You are a coding assistant inside AppEndO's Client Components Live Designer.
The operator is editing one visual layout. You can see a JSON snapshot: name, layoutId, selectedNodeId, readOnly, nodeCount, selectedNode, document (the canvas tree), and bindingDefinitions.

Reply with a single JSON object only, no markdown fences around it:
{"text":"short explanation for the operator","document":null,"bindingDefinitions":{}}

Rules:
- Put explanation in "text". Do not paste the full document inside text; it is rendered as a highlighted JSON block from "document".
- "document" is the COMPLETE replacement DesignerDocument when you are proposing an edit, or null when the request is only a question, the layout is readOnly, or the request is too ambiguous.
- "bindingDefinitions" is the matching bindings object when you change the document; otherwise {}.
- Never apply anything yourself — the operator reviews and clicks Apply, then Save.
- If readOnly is true, always return "document":null and explain in text.
- Keep the change focused on what was asked. Preserve unrelated nodes, ids, and bindings unless the operator asked to change them.
- Every generated form control must include label plus a plain-language hint (the studio page guide reads both).
- Match the snapshot document shape: schemaVersion, id, name, rootNodeId, nodes (each node has id, type, parentId, children, props), metadata, diagnostics.
- If the current document already exists and the request is a refinement, edit that tree rather than starting from a blank layout.
- Never reply with only a plan for a later turn. This is one shot — if you intend to change the canvas, put the complete document in "document" now.`;

type AssistHistoryItem = { role: 'user' | 'assistant'; content: string };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const normalizeHistory = (value: unknown): AssistHistoryItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: AssistHistoryItem[] = [];
  for (const entry of value.slice(-MAX_HISTORY_ITEMS)) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as { role?: unknown; content?: unknown };
    if ((record.role !== 'user' && record.role !== 'assistant') || typeof record.content !== 'string') {
      continue;
    }
    const content = record.content.trim();
    if (!content) {
      continue;
    }
    items.push({ role: record.role, content });
  }
  return items;
};

const clipSnapshot = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.replace(/\0/g, '');
  if (trimmed.length <= MAX_SNAPSHOT_CHARS) {
    return trimmed;
  }
  const head = 8_000;
  const tail = MAX_SNAPSHOT_CHARS - head - 40;
  return `${trimmed.slice(0, head)}\n/* …truncated… */\n${trimmed.slice(trimmed.length - tail)}`;
};

const extractJsonObject = (raw: string): string | null => {
  const jsonFence = raw.match(/```json\s*([\s\S]*?)```/i);
  const candidate = (jsonFence?.[1] ?? raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  return candidate.slice(start, end + 1);
};

const isDesignerDocument = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) {
    return false;
  }
  const rootNodeId = typeof value.rootNodeId === 'string' ? value.rootNodeId.trim() : '';
  const nodes = isRecord(value.nodes) ? value.nodes : null;
  return Boolean(rootNodeId && nodes && isRecord(nodes[rootNodeId]));
};

export const parseClientComponentAssistResponse = (
  raw: string,
): { text: string; document: Record<string, unknown> | null; bindingDefinitions: Record<string, unknown> } => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { text: '', document: null, bindingDefinitions: {} };
  }

  const jsonText = extractJsonObject(trimmed);
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText) as {
        text?: unknown;
        document?: unknown;
        bindingDefinitions?: unknown;
      };
      const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
      const document = isDesignerDocument(parsed.document) ? parsed.document : null;
      const bindingDefinitions = isRecord(parsed.bindingDefinitions) ? parsed.bindingDefinitions : {};
      return {
        text: text || (document ? 'Proposed updated layout.' : trimmed),
        document,
        bindingDefinitions,
      };
    } catch {
      // fall through to raw text
    }
  }

  return { text: trimmed, document: null, bindingDefinitions: {} };
};

export class ClientComponentAiService {
  async assist(params: {
    prompt: unknown;
    layoutSnapshot?: unknown;
    modelId?: unknown;
    history?: unknown;
  }) {
    const prompt = typeof params.prompt === 'string' ? params.prompt.trim() : '';
    if (!prompt) {
      throw new HttpError(400, 'prompt is required.');
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      throw new HttpError(400, `prompt exceeds ${MAX_PROMPT_CHARS} characters.`);
    }

    const settings = aiManager.getSettings();
    if (!settings?.enabled) {
      throw new HttpError(503, 'AI is disabled in platform settings.');
    }

    const requestedModelId = typeof params.modelId === 'string' ? params.modelId.trim() : '';
    const modelId = resolveFieldAssistChatModelId(settings, requestedModelId || undefined);
    if (!modelId) {
      throw new HttpError(400, 'No chat-capable AI model is configured.');
    }

    const snapshot = clipSnapshot(params.layoutSnapshot);
    const history = normalizeHistory(params.history);
    const userContent = [
      'Current layout snapshot (includes unsaved Live Designer canvas):',
      '```json',
      snapshot || '(empty)',
      '```',
      '',
      'Operator request:',
      prompt,
    ].join('\n');

    const messages: ChatMessage[] = [
      ...history.map((item) => ({ role: item.role, content: item.content })),
      { role: 'user', content: userContent },
    ];

    const raw = await aiManager.processChat(messages, modelId, CLIENT_COMPONENT_ASSIST_SYSTEM);
    const parsed = parseClientComponentAssistResponse(raw);

    return {
      body: {
        text: parsed.text,
        document: parsed.document,
        bindingDefinitions: parsed.bindingDefinitions,
        modelId,
      },
    };
  }
};
