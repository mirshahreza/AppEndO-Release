import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../client';
import type {
  CmsPublicContent,
  CmsPublicContentResponse,
  CmsPublicSitePayload,
  CmsPublicSiteResponse,
} from '../contracts/cms-site/types';

export const cmsSiteQueryKeys = {
  all: ['cms-site'] as const,
  public: (language: string) => [...cmsSiteQueryKeys.all, 'public', language] as const,
  content: (language: string, slug: string) => [...cmsSiteQueryKeys.all, 'content', language, slug] as const,
};

const encodeLanguage = (language: string): string => encodeURIComponent(language || 'en');

export async function fetchCmsPublicSite(language: string): Promise<CmsPublicSitePayload> {
  const { data, response } = await apiGet<CmsPublicSiteResponse>(
    `/api/cms-site/public?language=${encodeLanguage(language)}`,
  );
  if (!response.ok || !data?.success || !data.chrome || !data.home) {
    throw new Error('Public site is not available.');
  }
  return {
    chrome: data.chrome,
    home: data.home,
    cacheTtlSeconds: data.cacheTtlSeconds,
  };
}

export async function fetchCmsPublicContent(slug: string, language: string): Promise<CmsPublicContent> {
  const { data, response } = await apiGet<CmsPublicContentResponse>(
    `/api/cms-site/public/contents/${encodeURIComponent(slug)}?language=${encodeLanguage(language)}`,
  );
  if (!response.ok || !data?.success || !data.item) {
    throw new Error('Published content is not available.');
  }
  return data.item;
}

export function useCmsPublicSiteQuery(language: string) {
  return useQuery({
    queryKey: cmsSiteQueryKeys.public(language),
    queryFn: () => fetchCmsPublicSite(language),
    staleTime: 30_000,
  });
}

export function useCmsPublicContentQuery(slug: string | undefined, language: string) {
  const normalized = slug?.trim().replace(/^\/+|\/+$/g, '') ?? '';
  return useQuery({
    queryKey: cmsSiteQueryKeys.content(language, normalized),
    queryFn: () => fetchCmsPublicContent(normalized, language),
    enabled: normalized.length > 0,
    staleTime: 30_000,
    retry: false,
  });
}
