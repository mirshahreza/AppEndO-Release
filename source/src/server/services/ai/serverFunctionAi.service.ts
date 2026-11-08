import type { ChatMessage } from '../../../core/ai/IAiProvider';
import { aiManager } from '../../../core/ai/AiManager';
import { HttpError } from '../../errors/HttpError';
import { resolveFieldAssistChatModelId } from './fieldAssistModelResolver';

/**
 * Context chat for the Server Functions editor — same non-agentic `processChat` pattern as
 * File Hub / SQL Console / Workflow Designer. The model proposes a full source replacement;
 * the client only stages it into Monaco. Nothing is saved until the operator clicks Save.
 */

const MAX_SNAPSHOT_CHARS = 32_000;
const MAX_HISTORY_ITEMS = 20;
const MAX_PROMPT_CHARS = 4_000;
const MAX_SOURCE_CHARS = 64_000;

const SERVER_FUNCTION_ASSIST_SYSTEM = `You are a coding assistant inside AppEndO's Server Functions editor.
The operator is editing one HTTP handler. You can see a JSON snapshot: name, method, path, language, engineType, readOnly, testPayload, source, and lastRun (the Test Console Execute result: output + logs).

Reply with a single JSON object only, no markdown fences around it:
{"text":"short explanation for the operator","source":""}

Rules:
- Put explanation in "text". Do not paste the full source inside text; it is rendered as a highlighted code block from "source".
- "source" is the COMPLETE replacement file when you are proposing an edit, or "" when the request is only a question, the function is readOnly, or the request is too ambiguous.
- Never apply anything yourself — the operator reviews and clicks Apply, then Save.
- If lastRun.output or lastRun.logs show an error, diagnose that execution result and put a complete fixed file in "source" when the operator wants a fix.
- If readOnly is true (built-in routes), always return "source":"" and explain in text.
- Keep "source" focused on what was asked. Preserve existing type definitions, comments, and unrelated logic unless the operator asked to change them.
- Match the file that is already in the snapshot:
  - engineType SANDBOX_JS: sandbox runtime. Globals are req, res, db, console. Never use import, export default, or module.exports. Keep the EdgeReq / EdgeRes / EdgeDb types and the (async () => { await handler(); })(); entry. Read POST/PUT/PATCH bodies from edgeReq.body. Prefer { success: true, data } on success.
  - engineType DATA_API: keep the existing Data API handler style (imports, EDGE_* constants, Sequelize helpers). Do not rewrite it into a sandbox template.
- Language: TypeScript unless the snapshot language is "js".
- If the current source already exists and the request is a refinement, edit that source rather than starting from a blank template.
- Never reply with only a plan for a later turn. This is one shot — if you intend to change code, put the complete file in "source" now.`;

type AssistHistoryItem = { role: 'user' | 'assistant'; content: string };

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

const normalizeSource = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  const source = value.replace(/\0/g, '').replace(/\r\n/g, '\n').trimEnd();
  if (!source.trim() || source.length > MAX_SOURCE_CHARS) {
    return '';
  }
  return source;
};

const extractFencedSource = (raw: string): string => {
  const match = raw.match(/```(?:typescript|ts|javascript|js)\s*([\s\S]*?)```/i);
  return normalizeSource(match?.[1] ?? '');
};

/**
 * Parses `{"text":..., "source":"..."}`. A missing or oversized source degrades to text-only.
 * Also accepts `commands[0]` as source, and a bare TypeScript fence when JSON is absent.
 */
export const parseServerFunctionAssistResponse = (raw: string): { text: string; source: string } => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { text: '', source: '' };
  }

  const jsonText = extractJsonObject(trimmed);
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText) as { text?: unknown; source?: unknown; commands?: unknown };
      const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
      const fromSource = normalizeSource(parsed.source);
      const fromCommands = Array.isArray(parsed.commands) ? normalizeSource(parsed.commands[0]) : '';
      const source = fromSource || fromCommands;
      return { text: text || (source ? 'Proposed updated source.' : trimmed), source };
    } catch {
      // fall through to fenced source / raw text
    }
  }

  const fencedSource = extractFencedSource(trimmed);
  if (fencedSource) {
    return { text: 'Proposed updated source.', source: fencedSource };
  }

  return { text: trimmed, source: '' };
};

export class ServerFunctionAiService {
  async assist(params: {
    prompt: unknown;
    functionSnapshot?: unknown;
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

    const snapshot = clipSnapshot(params.functionSnapshot);
    const history = normalizeHistory(params.history);
    const userContent = [
      'Current function snapshot:',
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

    const raw = await aiManager.processChat(messages, modelId, SERVER_FUNCTION_ASSIST_SYSTEM);
    const parsed = parseServerFunctionAssistResponse(raw);

    return { body: { text: parsed.text, source: parsed.source, modelId } };
  }
}
