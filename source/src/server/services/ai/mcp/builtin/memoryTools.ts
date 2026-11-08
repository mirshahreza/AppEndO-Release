import fs from 'fs';
import path from 'path';
import type { NativeToolDefinition } from '../../../../../core/ai/tools/ToolRegistry';
import { aiManager } from '../../../../../core/ai/AiManager';
import { getAiSettingsFromFile, saveAiSettingsToFile } from '../../../../db/aiSettingsStore';
import { SETTINGS_PATH } from '../../../../config/settingsFile';

export const READ_MEMORY_TOOL_NAME = 'read_memory';
export const WRITE_MEMORY_TOOL_NAME = 'write_memory';

const MEMORY_DIR = '.appendo';
const MEMORY_FILE = 'workspace-memory.json';

type WorkspaceMemoryFile = {
  entries: Record<string, string>;
};

const memoryFilePath = () => path.join(process.cwd(), MEMORY_DIR, MEMORY_FILE);

const readMemoryFile = (): WorkspaceMemoryFile => {
  const filePath = memoryFilePath();
  if (!fs.existsSync(filePath)) {
    return { entries: {} };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { entries: {} };
    }
    const entries = (parsed as WorkspaceMemoryFile).entries;
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
      return { entries: {} };
    }
    const normalized: Record<string, string> = {};
    Object.entries(entries).forEach(([key, value]) => {
      if (typeof value === 'string') {
        normalized[key] = value;
      }
    });
    return { entries: normalized };
  } catch {
    return { entries: {} };
  }
};

const writeMemoryFile = (data: WorkspaceMemoryFile): void => {
  const dir = path.join(process.cwd(), MEMORY_DIR);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(memoryFilePath(), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
};

const resolveMemoryValue = (key: string): string | null => {
  if (key === '_project_notes') {
    const notes = aiManager.getSettings()?.projectNotes?.trim();
    return notes || null;
  }

  const file = readMemoryFile();
  return file.entries[key] ?? null;
};

export const executeReadMemory = async (args: Record<string, unknown>) => {
  const key = typeof args.key === 'string' ? args.key.trim() : '';
  if (!key) {
    return {
      ok: false as const,
      summary: 'key is required.',
      error: 'missing_key',
    };
  }

  const value = resolveMemoryValue(key);
  if (value === null) {
    return {
      ok: true as const,
      summary: `No workspace memory entry for key "${key}".`,
      data: { key, value: null },
    };
  }

  return {
    ok: true as const,
    summary: `Read workspace memory key "${key}".`,
    data: { key, value },
  };
};

export const executeWriteMemory = async (args: Record<string, unknown>) => {
  const key = typeof args.key === 'string' ? args.key.trim() : '';
  const value = typeof args.value === 'string' ? args.value : '';
  if (!key) {
    return {
      ok: false as const,
      summary: 'key is required.',
      error: 'missing_key',
    };
  }

  if (key === '_project_notes') {
    const current = getAiSettingsFromFile(SETTINGS_PATH);
    const saved = saveAiSettingsToFile(SETTINGS_PATH, { ...current, projectNotes: value });
    aiManager.reloadFromSettings(saved);
    return {
      ok: true as const,
      summary: 'Updated workspace project notes.',
      data: { key, value },
    };
  }

  const file = readMemoryFile();
  file.entries[key] = value;
  writeMemoryFile(file);

  return {
    ok: true as const,
    summary: `Wrote workspace memory key "${key}".`,
    data: { key, value },
  };
};

export const createMemoryTools = (): NativeToolDefinition[] => [
  {
    name: READ_MEMORY_TOOL_NAME,
    description: 'Read a workspace memory entry. Use key _project_notes for operator project notes.',
    group: 'memory',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Memory key (e.g. architecture, conventions, _project_notes).' },
      },
      required: ['key'],
    },
    execute: async (args) => executeReadMemory(args),
  },
  {
    name: WRITE_MEMORY_TOOL_NAME,
    description: 'Write a workspace memory entry. Use key _project_notes for operator project notes.',
    group: 'memory',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Memory key to write.' },
        value: { type: 'string', description: 'Markdown or plain-text value.' },
      },
      required: ['key', 'value'],
    },
    execute: async (args) => executeWriteMemory(args),
  },
];
