/**
 * JSON on Base Info `metadata` for nodes under inbox preset root (`100.7`).
 * Example: {"inbox":{"defaultBody":"Thanks…","tagIds":["100.8.1"]}}
 * Tag nodes live under `100.8` (use `ui_color` for chip color in reply/forward).
 */
export type InboxPresetMetadata = {
  defaultBody?: string;
  tagIds?: string[];
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

export const parseInboxPresetMetadata = (raw: string | null | undefined): InboxPresetMetadata => {
  if (!raw?.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const inbox = parsed.inbox;
    if (inbox && typeof inbox === 'object' && !Array.isArray(inbox)) {
      const block = inbox as Record<string, unknown>;
      return {
        defaultBody: typeof block.defaultBody === 'string' ? block.defaultBody : undefined,
        tagIds: isStringArray(block.tagIds) ? block.tagIds : undefined,
      };
    }
    return {
      defaultBody: typeof parsed.defaultBody === 'string' ? parsed.defaultBody : undefined,
      tagIds: isStringArray(parsed.tagIds) ? parsed.tagIds : undefined,
    };
  } catch {
    return {};
  }
};

export const buildInboxPresetMetadata = (input: InboxPresetMetadata): string =>
  JSON.stringify({
    inbox: {
      ...(input.defaultBody?.trim() ? { defaultBody: input.defaultBody.trim() } : {}),
      ...(input.tagIds?.length ? { tagIds: input.tagIds } : {}),
    },
  });
