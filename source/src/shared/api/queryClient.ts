import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isAbortError, isApiError, reportApiError } from './client';

const handleGlobalQueryError = (error: unknown) => {
  if (isAbortError(error)) {
    return;
  }

  if (isApiError(error)) {
    reportApiError(error);
  }
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleGlobalQueryError,
  }),
  mutationCache: new MutationCache({
    onError: handleGlobalQueryError,
  }),
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      // Without a default, staleTime is 0 and every remount (tab switch, revisiting a list,
      // reopening a modal) triggers a full refetch even for data that's seconds old. A short
      // default cuts that redundant traffic app-wide; queries that need fresher data (polling
      // widgets, live status) already set their own shorter staleTime and are unaffected.
      staleTime: 30_000,
    },
    mutations: {
      retry: false,
    },
  },
});
