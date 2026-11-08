export type RemoteAssistParsed = {
  text: string;
  commands: string[];
};

const MAX_COMMANDS = 12;
const MAX_COMMAND_LENGTH = 2_000;

const extractJsonObject = (raw: string): string | null => {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  return candidate.slice(start, end + 1);
};

const normalizeCommands = (value: unknown): string[] => {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? [value]
      : [];

  const commands: string[] = [];
  for (const item of rawItems) {
    if (typeof item !== 'string') {
      continue;
    }
    const command = item.replace(/\0/g, '').trim();
    if (!command || command.length > MAX_COMMAND_LENGTH) {
      continue;
    }
    commands.push(command);
    if (commands.length >= MAX_COMMANDS) {
      break;
    }
  }
  return commands;
};

export function parseRemoteAssistResponse(raw: string): RemoteAssistParsed {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { text: '', commands: [] };
  }

  const jsonText = extractJsonObject(trimmed);
  if (!jsonText) {
    return { text: trimmed, commands: [] };
  }

  try {
    const parsed = JSON.parse(jsonText) as {
      text?: unknown;
      message?: unknown;
      commands?: unknown;
      command?: unknown;
    };
    const text = typeof parsed.text === 'string'
      ? parsed.text.trim()
      : typeof parsed.message === 'string'
        ? parsed.message.trim()
        : '';
    const commands = normalizeCommands(parsed.commands ?? parsed.command);
    return {
      text: text || (commands.length ? `Prepared ${commands.length} command(s).` : trimmed),
      commands,
    };
  } catch {
    return { text: trimmed, commands: [] };
  }
}
