type TruncateJsonOptions = {
  maxStringLength?: number;
  maxEntries?: number;
  maxDepth?: number;
};

export const getTruncatedJsonValue = (
  input: unknown,
  options: TruncateJsonOptions = {},
  seen = new WeakSet<object>(),
  depth = 0,
): unknown => {
  const maxStringLength = options.maxStringLength ?? 180;
  const maxEntries = options.maxEntries ?? 40;
  const maxDepth = options.maxDepth ?? 8;

  if (input === null || input === undefined) return input;

  if (typeof input === 'string') {
    if (input.length <= maxStringLength) return input;
    return `${input.slice(0, maxStringLength)}...`;
  }

  if (typeof input !== 'object') {
    return input;
  }

  if (depth >= maxDepth) {
    return '[Truncated: max depth reached]';
  }

  if (seen.has(input)) {
    return '[Circular]';
  }
  seen.add(input);

  if (Array.isArray(input)) {
    const list = input.slice(0, maxEntries).map((item) => getTruncatedJsonValue(item, options, seen, depth + 1));
    if (input.length > maxEntries) {
      list.push(`... (+${input.length - maxEntries} more items)`);
    }
    return list;
  }

  const entries = Object.entries(input as Record<string, unknown>);
  const limitedEntries = entries.slice(0, maxEntries);
  const output: Record<string, unknown> = {};
  for (const [key, value] of limitedEntries) {
    output[key] = getTruncatedJsonValue(value, options, seen, depth + 1);
  }

  if (entries.length > maxEntries) {
    output.__truncated__ = `... (+${entries.length - maxEntries} more fields)`;
  }

  return output;
};

export const tryParseJson = (input: string): unknown | null => {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
};

export const buildDetailJsonPreview = (meta: unknown | undefined, message: string): string => {
  if (meta !== undefined && meta !== null) {
    return JSON.stringify(getTruncatedJsonValue(meta), null, 2);
  }

  const rawMessage = String(message ?? '');
  const parsedMessage = tryParseJson(rawMessage);

  if (parsedMessage !== null) {
    return JSON.stringify(getTruncatedJsonValue(parsedMessage), null, 2);
  }

  const normalizedMessage = rawMessage.length > 2000 ? `${rawMessage.slice(0, 2000)}...` : rawMessage;
  return JSON.stringify({ message: normalizedMessage }, null, 2);
};

export const buildDetailHeaderMessage = (message: string, emptyLabel = 'No message'): string => {
  const rawMessage = String(message ?? '').trim();
  if (!rawMessage) return emptyLabel;
  return rawMessage.length > 140 ? `${rawMessage.slice(0, 140)}...` : rawMessage;
};
