import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '../client';
import type {
  CreateProductIdeaInput,
  IdeaPackageHome,
  ProductIdeaListItem,
  ProductIdeaRecord,
} from '../contracts/idea-foundry/types';
import { DEFAULT_IDEA_MATURITY } from '../contracts/idea-foundry/types';

export type { ProductIdeaListItem, ProductIdeaRecord, CreateProductIdeaInput, IdeaPackageHome };

const ideasKey = ['idea-foundry'] as const;
const listKey = [...ideasKey, 'list'] as const;
const homesKey = [...ideasKey, 'homes'] as const;
const itemKey = (id: string) => [...ideasKey, 'item', id] as const;

type ListResponse = { success: boolean; items?: ProductIdeaListItem[]; error?: string };
type HomesResponse = { success: boolean; items?: IdeaPackageHome[]; error?: string };
type ItemResponse = { success: boolean; item?: ProductIdeaRecord; error?: string };

export const useProductIdeasListQuery = () => useQuery({
  queryKey: listKey,
  queryFn: async () => {
    const { data } = await apiGet<ListResponse>('/api/idea-foundry');
    return data.items ?? [];
  },
});

export const useProductIdeaQuery = (id: string | null) => useQuery({
  queryKey: itemKey(id ?? ''),
  enabled: Boolean(id),
  queryFn: async () => {
    const { data } = await apiGet<ItemResponse>(`/api/idea-foundry/${encodeURIComponent(id ?? '')}`);
    if (!data.item) {
      throw new Error(data.error || 'Idea not found.');
    }
    return data.item;
  },
});

export const useIdeaPackageHomesQuery = (enabled = true) => useQuery({
  queryKey: homesKey,
  queryFn: async () => {
    const { data } = await apiGet<HomesResponse>('/api/idea-foundry/homes');
    return data.items ?? [];
  },
  enabled,
});

export const useCreateProductIdeaMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProductIdeaInput) => {
      const { data } = await apiPost<ItemResponse>('/api/idea-foundry', {
        ...input,
        maturity: DEFAULT_IDEA_MATURITY,
      });
      if (!data.item) {
        throw new Error(data.error || 'Failed to register idea.');
      }
      return data.item;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ideasKey });
    },
  });
};

export const useUpdateProductIdeaMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: CreateProductIdeaInput }) => {
      const { data, response } = await apiPut<ItemResponse>(`/api/idea-foundry/${encodeURIComponent(id)}`, input);
      if (!response.ok || !data.item) {
        throw new Error(data.error || 'Failed to reconfigure idea.');
      }
      return data.item;
    },
    onSuccess: (_item, variables) => {
      void queryClient.invalidateQueries({ queryKey: ideasKey });
      void queryClient.invalidateQueries({ queryKey: itemKey(variables.id) });
    },
  });
};
