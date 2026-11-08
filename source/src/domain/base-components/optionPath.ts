export const setAtDotPath = (
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void => {
  const segments = path.split('.');
  let cursor = target;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }
    const current = cursor[segment];
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  });
};

export const getAtDotPath = (target: unknown, path: string): unknown => {
  if (!path) return undefined;
  const segments = path.split('.');
  let cursor: unknown = target;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
};

/** Clone `props` and, when `spec` is a JSON string, parse it into an object for nested writes. */
export const unwrapPropsForCatalogWrite = (
  props: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  const next = { ...props };
  if (typeof next.spec === 'string') {
    const trimmed = next.spec.trim();
    if (trimmed.length === 0) {
      next.spec = {};
    } else {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        next.spec = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed
          : {};
      } catch {
        next.spec = {};
      }
    }
  }
  return next;
};
