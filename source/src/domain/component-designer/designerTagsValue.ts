export const parseDesignerTagsValue = (value: unknown): string[] => {
  if (typeof value !== 'string') {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
      }
    } catch {
      // Fall through to comma-separated parsing.
    }
  }

  return trimmed.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
};
