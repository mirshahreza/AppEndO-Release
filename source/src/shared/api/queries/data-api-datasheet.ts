import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { EdgeModelColumn } from '../contracts/data-api';
import { apiPost } from '../client';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: string;
  field?: string;
};

export class DatasheetApiError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'DatasheetApiError';
    this.field = field;
  }
}

const unwrap = <T,>(body: ApiEnvelope<T>): T => {
  if (!body.success) {
    throw new DatasheetApiError(body.error || 'Request failed.', body.field);
  }
  return body.data;
};

export type DatasheetQueryResult = {
  columns: EdgeModelColumn[];
  primaryKey: string | string[];
  readOnly: boolean;
  selectSql: string;
  rows: Record<string, unknown>[];
  limit: number;
  totalCount: number;
};

const datasheetKey = (modelId: string, sql: string) =>
  ['data-api', 'datasheet', modelId, sql] as const;

export const useEdgeModelDatasheetQuery = (
  modelId: string | null,
  sql: string,
) => useQuery({
  queryKey: datasheetKey(modelId ?? '', sql),
  enabled: Boolean(modelId),
  retry: false,
  refetchOnWindowFocus: false,
  placeholderData: keepPreviousData,
  queryFn: async () => {
    const { data } = await apiPost<ApiEnvelope<DatasheetQueryResult>>(
      `/api/data-api/models/${encodeURIComponent(modelId ?? '')}/datasheet/query`,
      { sql },
    );
    return unwrap(data);
  },
});

export const useCommitEdgeModelDatasheetRowMutation = () => useMutation({
  mutationFn: async (input: {
    modelId: string;
    isNew: boolean;
    key: Record<string, unknown> | null;
    values: Record<string, unknown>;
  }) => {
    const { data } = await apiPost<ApiEnvelope<Record<string, unknown>>>(
      `/api/data-api/models/${encodeURIComponent(input.modelId)}/datasheet/row`,
      {
        isNew: input.isNew,
        key: input.key ?? undefined,
        values: input.values,
      },
    );
    return unwrap(data);
  },
});

export const useDeleteEdgeModelDatasheetRowMutation = () => useMutation({
  mutationFn: async (input: {
    modelId: string;
    key: Record<string, unknown>;
  }) => {
    const { data } = await apiPost<ApiEnvelope<{ ok: boolean }>>(
      `/api/data-api/models/${encodeURIComponent(input.modelId)}/datasheet/row/delete`,
      { key: input.key },
    );
    return unwrap(data);
  },
});
