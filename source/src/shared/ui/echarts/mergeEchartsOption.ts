const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object'
  && value !== null
  && !Array.isArray(value)
  && !(value instanceof Date);

export const mergeEchartsOption = <T>(base: T, overlay?: unknown): T => {
  if (overlay === undefined || overlay === null) {
    return base;
  }
  if (!isPlainRecord(base) || !isPlainRecord(overlay)) {
    return overlay as T;
  }
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) {
      continue;
    }
    next[key] = mergeEchartsOption(next[key], value);
  }
  return next as T;
};
