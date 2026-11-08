export function mergeDescendingPage<T>(
  hotItems: T[],
  archiveItems: T[],
  offset: number,
  limit: number,
  compareDesc: (left: T, right: T) => number,
  hotTotal: number,
  archiveTotal: number,
): { items: T[]; totalCount: number } {
  const start = Math.max(0, offset);
  const size = Math.max(0, limit);
  const merged = [...hotItems, ...archiveItems].sort(compareDesc);
  return {
    items: merged.slice(start, start + size),
    totalCount: hotTotal + archiveTotal,
  };
}
