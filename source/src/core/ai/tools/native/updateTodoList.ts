import type { NativeToolDefinition } from '../ToolRegistry';
import { setAgentTodos, type AgentTodoItem, type AgentTodoStatus } from './agentTodoStore';

export const UPDATE_TODO_LIST_TOOL_NAME = 'update_todo_list';

const VALID_STATUSES = new Set<AgentTodoStatus>([
  'pending',
  'in_progress',
  'completed',
  'cancelled',
]);

const parseTodos = (raw: unknown): AgentTodoItem[] => {
  if (!Array.isArray(raw)) return [];
  const items: AgentTodoItem[] = [];
  for (const entry of raw.slice(0, 24)) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const statusRaw = typeof record.status === 'string' ? record.status.trim() : 'pending';
    const status = VALID_STATUSES.has(statusRaw as AgentTodoStatus)
      ? statusRaw as AgentTodoStatus
      : 'pending';
    if (!id || !title) continue;
    items.push({ id, title, status });
  }
  return items;
};

export const updateTodoListTool: NativeToolDefinition = {
  name: UPDATE_TODO_LIST_TOOL_NAME,
  description: 'Update the live todo list for this agent run. Pass a JSON array of {id, title, status}. Use to track multi-step work separately from chat history (F.1).',
  group: 'context',
  parameters: {
    type: 'object',
    properties: {
      todos: {
        type: 'string',
        description: 'JSON array, e.g. [{"id":"1","title":"Retrieve function","status":"completed"},{"id":"2","title":"Draft UI","status":"in_progress"}]',
      },
    },
    required: ['todos'],
  },
  execute: async (args) => {
    const raw = typeof args.todos === 'string' ? args.todos.trim() : '';
    if (!raw) {
      return { ok: false as const, summary: 'todos JSON is required.', error: 'missing_todos' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false as const, summary: 'todos must be valid JSON.', error: 'invalid_json' };
    }

    const items = parseTodos(parsed);
    if (!items.length) {
      return { ok: false as const, summary: 'At least one valid todo item is required.', error: 'empty_todos' };
    }

    const saved = setAgentTodos(items);
    return {
      ok: true as const,
      summary: `Updated todo list (${saved.length} item${saved.length === 1 ? '' : 's'}).`,
      data: { todos: saved },
    };
  },
};
