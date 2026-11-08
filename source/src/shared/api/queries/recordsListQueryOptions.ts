/** Records nav lists use a short stale window; mutations invalidate explicitly. */
export const RECORDS_LIST_QUERY_OPTIONS = {
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  refetchOnMount: 'ifStale' as const,
};
