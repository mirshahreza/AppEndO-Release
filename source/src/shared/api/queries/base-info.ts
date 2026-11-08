import { useMutation, useQuery } from '@tanstack/react-query';
import { useCulture } from '../../../core/culture/CultureContext';
import { resolveBaseInfoCultureId } from '../../lib/baseInfoCultureTranslations';
import type { BaseInfoLocaleTexts } from '../../lib/baseInfoCultureTranslations';
import type { BaseInfoRow } from '../contracts/base-info/types';
import type { TreeDropPosition } from '../../types/tree';
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  type ApiListResponse,
  type ApiMutationResponse,
} from '../client';

export type BaseInfoChildrenParams = {
  lang: string;
  root: string;
  parentId?: string | null;
};

export type BaseInfoNodePayload = {
  parentId?: string;
  childDigits?: number;
  title?: string;
  shortName?: string;
  note?: string;
  locales?: BaseInfoLocaleTexts;
  viewOrder?: number;
  value?: number;
  metadata?: string;
  uiColor?: string;
  uiHtml?: string;
  isActive?: boolean;
};

export type BaseInfoMovePayload = {
  targetId: string | null;
  position: TreeDropPosition;
};

export const baseInfoQueryKeys = {
  all: ['base-info'] as const,
  children: (params: BaseInfoChildrenParams) => [...baseInfoQueryKeys.all, 'children', params] as const,
  node: (id: string) => [...baseInfoQueryKeys.all, 'node', id] as const,
};

/** GET-one form payload — `items` is a single object (not an array). */
export type BaseInfoNodeDetail = {
  id: string;
  parentId: string | null;
  title?: string | null;
  shortName?: string | null;
  note?: string | null;
  locales?: BaseInfoLocaleTexts;
  viewOrder?: number | null;
  value?: number | null;
  metadata?: string | null;
  uiColor?: string | null;
  uiHtml?: string | null;
  isActive?: boolean;
};

export const formatBaseInfoTreeLabel = (node: {
  id: string;
  label?: string | null;
  title?: string | null;
  titleEn?: string | null;
  title_en?: string | null;
}): string => {
  const title = node.label || node.titleEn || node.title_en || node.title || node.id;
  return `${node.id} — ${title}`;
};

const assertListSuccess = (data: ApiListResponse, response: Response, fallback: string) => {
  if (!response.ok) {
    throw new Error(`Server returned ${response.status} for children endpoint.`);
  }
  if (!data.success) {
    throw new Error(typeof data.error === 'string' ? data.error : fallback);
  }
};

const assertMutationSuccess = (
  data: ApiMutationResponse,
  response: Response,
  fallback: string,
) => {
  if (!response.ok || !data.success) {
    throw new Error(typeof data.error === 'string' ? data.error : `${fallback} (HTTP ${response.status}).`);
  }
};

export type BaseInfoSelectOption = { id: string; label: string };

export function buildBaseInfoOptionsPath(root: string, cultureOrLang: string): string {
  const lang = resolveBaseInfoCultureId(cultureOrLang);
  return `/api/base-info/options?root=${encodeURIComponent(root)}&lang=${encodeURIComponent(lang)}`;
}

export async function fetchBaseInfoOptions(
  root: string,
  cultureOrLang: string,
): Promise<BaseInfoSelectOption[]> {
  const { data, response } = await apiGet<ApiListResponse>(buildBaseInfoOptionsPath(root, cultureOrLang));
  assertListSuccess(data, response, 'Failed to load options.');
  return ((data.items || []) as Array<{ id?: string; label?: string }>)
    .filter((item): item is { id: string; label: string } => Boolean(item.id))
    .map((item) => ({ id: item.id, label: item.label || item.id }));
}

export function useBaseInfoOptionsQuery(
  root: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const { cultureId } = useCulture();
  const normalizedRoot = root?.trim() ?? '';
  const enabled = (options?.enabled ?? true) && normalizedRoot.length > 0;

  return useQuery({
    queryKey: [...baseInfoQueryKeys.all, 'options', normalizedRoot, cultureId] as const,
    queryFn: () => fetchBaseInfoOptions(normalizedRoot, cultureId),
    enabled,
  });
}

export async function fetchBaseInfoChildren(params: BaseInfoChildrenParams): Promise<BaseInfoRow[]> {
  const searchParams = new URLSearchParams();
  if (params.lang) searchParams.set('lang', params.lang);
  if (params.root.trim()) searchParams.set('root', params.root.trim());
  if (params.parentId) searchParams.set('parentId', params.parentId);
  searchParams.set('includeInactive', 'true');

  const { data, response } = await apiGet<ApiListResponse>(`/api/base-info/children?${searchParams.toString()}`);
  assertListSuccess(data, response, 'Failed to load nodes.');
  return (data.items || []) as BaseInfoRow[];
}

export async function fetchBaseInfoNode(id: string): Promise<BaseInfoNodeDetail | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;

  const { data, response } = await apiGet<{
    success: boolean;
    error?: string;
    items?: BaseInfoNodeDetail | BaseInfoNodeDetail[];
  }>(`/api/base-info/${encodeURIComponent(trimmed)}`);

  if (response.status === 404) return null;
  if (!response.ok || !data.success) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load node.');
  }

  const item = data.items;
  if (!item || Array.isArray(item) || typeof item !== 'object') return null;
  if (!item.id) return null;
  const record = item as BaseInfoNodeDetail & { ui_html?: string | null };
  return {
    ...record,
    uiHtml: record.uiHtml ?? record.ui_html ?? null,
  };
}

/** Walk parent links from `id` up to a root; returns root → leaf. */
export async function fetchBaseInfoAncestorPath(id: string): Promise<BaseInfoNodeDetail[]> {
  const chain: BaseInfoNodeDetail[] = [];
  const seen = new Set<string>();
  let cursor: string | null = id.trim() || null;

  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const node = await fetchBaseInfoNode(cursor);
    if (!node) break;
    chain.unshift(node);
    const parentId = typeof node.parentId === 'string' ? node.parentId.trim() : '';
    cursor = parentId || null;
  }

  return chain;
}

export async function createBaseInfoNode(body: BaseInfoNodePayload): Promise<ApiMutationResponse> {
  const { data, response } = await apiPost<ApiMutationResponse>('/api/base-info', body);
  if (!response.ok || !data.success) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to create node.');
  }
  return data;
}

export async function updateBaseInfoNode(id: string, body: BaseInfoNodePayload): Promise<ApiMutationResponse> {
  const { data, response } = await apiPut<ApiMutationResponse>(`/api/base-info/${encodeURIComponent(id)}`, body);
  if (!response.ok || !data.success) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to update node.');
  }
  return data;
}

export async function deleteBaseInfoNode(id: string): Promise<void> {
  const { data, response } = await apiDelete<ApiMutationResponse>(`/api/base-info/${encodeURIComponent(id)}`);
  assertMutationSuccess(data, response, 'Failed to delete node');
}

export async function moveBaseInfoNode(id: string, body: BaseInfoMovePayload): Promise<void> {
  const { data, response } = await apiPost<ApiMutationResponse>(
    `/api/base-info/${encodeURIComponent(id)}/move`,
    body,
  );
  assertMutationSuccess(data, response, 'Failed to move node');
}

export function useBaseInfoChildrenQuery(
  params: BaseInfoChildrenParams,
  enabled = true,
) {
  return useQuery({
    queryKey: baseInfoQueryKeys.children(params),
    queryFn: () => fetchBaseInfoChildren(params),
    enabled,
  });
}

export function useCreateBaseInfoMutation() {
  return useMutation({
    mutationFn: createBaseInfoNode,
  });
}

export function useUpdateBaseInfoMutation() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: BaseInfoNodePayload }) => updateBaseInfoNode(id, body),
  });
}

export function useDeleteBaseInfoMutation() {
  return useMutation({
    mutationFn: deleteBaseInfoNode,
  });
}

export function useMoveBaseInfoMutation() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: BaseInfoMovePayload }) => moveBaseInfoNode(id, body),
  });
}
