import type { QueryClient } from '@tanstack/react-query';
import {
  serverFunctionsQueryKeys,
  type ServerFunctionDraft,
} from '../../../shared/api/queries/server-functions';
import { useUpdateBuiltinServerFunctionMutation, useUpdateServerFunctionMutation } from '../../../shared/api/queries/server-functions';
import { BUILTIN_FUNCTION_PERSISTABLE_KEYS } from '../../../shared/api/contracts/server-functions/constants';
import type { ServerFunctionItem } from '../types';

export type { ServerFunctionDraft };

export function getServerFunctionDraft(queryClient: QueryClient, id: string): ServerFunctionDraft | undefined {
  return queryClient.getQueryData<ServerFunctionDraft>(serverFunctionsQueryKeys.draft(id));
}

export function mergeServerFunctionWithDraft(
  catalogFn: ServerFunctionItem,
  draft: ServerFunctionDraft | undefined,
): ServerFunctionItem {
  if (!draft) {
    return catalogFn;
  }

  if (catalogFn.isBuiltIn) {
    if (!draft) {
      return catalogFn;
    }

    const patch = BUILTIN_FUNCTION_PERSISTABLE_KEYS.reduce<Partial<ServerFunctionItem>>((acc, key) => {
      if (key in draft && draft[key] !== undefined) {
        acc[key] = draft[key] as never;
      }
      return acc;
    }, {});

    return Object.keys(patch).length > 0
      ? { ...catalogFn, ...patch }
      : catalogFn;
  }

  return { ...catalogFn, ...draft };
}

export function patchServerFunctionDraft(
  queryClient: QueryClient,
  id: string,
  patch: ServerFunctionDraft,
): void {
  queryClient.setQueryData<ServerFunctionDraft>(serverFunctionsQueryKeys.draft(id), (previous) => ({
    ...previous,
    ...patch,
  }));
}

export function clearServerFunctionDraft(queryClient: QueryClient, id: string): void {
  queryClient.removeQueries({ queryKey: serverFunctionsQueryKeys.draft(id), exact: true });
}

export function mergeCatalogFunctionsWithDrafts(
  queryClient: QueryClient,
  catalogFunctions: ServerFunctionItem[],
): ServerFunctionItem[] {
  return catalogFunctions.map((fn) => mergeServerFunctionWithDraft(fn, getServerFunctionDraft(queryClient, fn.id)));
}
