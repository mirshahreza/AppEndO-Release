import type { ChatMessage } from '../../../core/ai/IAiProvider';
import { aiManager } from '../../../core/ai/AiManager';
import { HttpError } from '../../errors/HttpError';
import { parseRemoteAssistResponse } from '../../../shared/lib/remoteAssist/parseRemoteAssistResponse';
import { resolveFieldAssistChatModelId } from './fieldAssistModelResolver';

const MAX_SNAPSHOT_CHARS = 8_000;
const MAX_HISTORY_ITEMS = 20;
const MAX_PROMPT_CHARS = 4_000;

const FILE_HUB_ASSIST_SYSTEM = `You are a File Hub assistant inside AppEndO for SFTP, FTP, and FTPS sessions.
The operator is browsing a remote folder. You can see a snapshot of the current path and entries.
Reply with a single JSON object only, no markdown:
{"text":"short explanation for the operator","commands":["exact file command"]}
Rules:
- Put explanation in text. Do not repeat commands inside text; they are rendered as highlighted code blocks.
- commands are FTP-like one-liners: ls, pwd, cd, mkdir, rm, rename.
- Read-only listing and navigation may run automatically; mkdir, rm, and rename wait for the operator in Safe mode.
- Use commands only when they are needed to fulfill the request.
- Prefer listing and inspecting unless the operator clearly asked to change remote files.
- Never request uploads, downloads, or secrets.
- If the snapshot is enough to answer, return an empty commands array.
- Each command is one line. Paths may be absolute or relative to the current folder.
Examples: ls, ls /var/www, cd logs, mkdir backup, rm old.txt, rename a.txt b.txt`;

type AssistHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

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
  return trimmed.slice(trimmed.length - MAX_SNAPSHOT_CHARS);
};

export class FileHubAiService {
  async assist(params: {
    prompt: unknown;
    listingSnapshot?: unknown;
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

    const snapshot = clipSnapshot(params.listingSnapshot);
    const history = normalizeHistory(params.history);
    const userContent = [
      'Current remote folder snapshot:',
      '```text',
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

    const raw = await aiManager.processChat(messages, modelId, FILE_HUB_ASSIST_SYSTEM);
    const parsed = parseRemoteAssistResponse(raw);

    return {
      body: {
        text: parsed.text,
        commands: parsed.commands,
        modelId,
      },
    };
  }
}
