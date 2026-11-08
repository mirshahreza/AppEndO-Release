import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchHwyBusinessRuleDoc,
  fetchHwyBusinessRuleDocs,
  saveHwyBusinessRuleDocMarkdown,
  type HwyBusinessRuleDoc,
} from '../../../domain/hwy/hwyBusinessRulesReference';

export const hwyBusinessRuleDocsQueryKey = ['hwy', 'business-rules', 'docs'] as const;

export const hwyBusinessRuleDocQueryKey = (slug: string) =>
  [...hwyBusinessRuleDocsQueryKey, slug] as const;

const hwyBusinessRuleDocsRetry = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= 2) {
    return false;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /load business rules|Could not load|network|fetch/i.test(message);
};

export function useHwyBusinessRuleDocsQuery(enabled = true) {
  return useQuery({
    queryKey: hwyBusinessRuleDocsQueryKey,
    queryFn: fetchHwyBusinessRuleDocs,
    enabled,
    retry: hwyBusinessRuleDocsRetry,
    refetchOnMount: 'always',
  });
}

export function useHwyBusinessRuleDocQuery(slug: string, enabled = true) {
  return useQuery({
    queryKey: hwyBusinessRuleDocQueryKey(slug),
    queryFn: () => fetchHwyBusinessRuleDoc(slug),
    enabled: enabled && Boolean(slug.trim()),
    retry: hwyBusinessRuleDocsRetry,
    refetchOnMount: 'always',
  });
}

export function useSaveHwyBusinessRuleDocMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveHwyBusinessRuleDocMarkdown,
    onSuccess: (saved: HwyBusinessRuleDoc) => {
      queryClient.setQueryData(hwyBusinessRuleDocQueryKey(saved.slug), saved);
      queryClient.invalidateQueries({ queryKey: hwyBusinessRuleDocsQueryKey });
    },
  });
}
