import { useQuery } from '@tanstack/react-query';
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  ApiError,
  isAbortError,
  isApiError,
  type ApiListResponse,
  type ApiMutationResponse,
} from '../client';
import type {
  SampleMockLookupDto,
  SampleMockRecordDto,
  SampleMockRelationIncludes,
} from '../contracts/sample-mock/records';
import { serializeSampleMockIncludes } from '../contracts/sample-mock/records';

export const sampleMockQueryKeys = {
  all: ['sample-mock'] as const,
  records: (include: string) => [...sampleMockQueryKeys.all, 'records', include] as const,
  lookups: () => [...sampleMockQueryKeys.all, 'lookups'] as const,
};

type RecordsResponse = ApiListResponse<SampleMockRecordDto> & {
  items?: SampleMockRecordDto[];
};

type RecordResponse = ApiMutationResponse & {
  item?: SampleMockRecordDto;
};

type LookupsResponse = ApiMutationResponse & {
  statuses?: SampleMockLookupDto[];
  people?: SampleMockLookupDto[];
  tags?: SampleMockLookupDto[];
};

const includeQuery = (includes?: SampleMockRelationIncludes | string): string => {
  if (!includes) return '';
  const value = typeof includes === 'string' ? includes : serializeSampleMockIncludes(includes);
  return value ? `?include=${encodeURIComponent(value)}` : '';
};

const throwSampleMockFailure = (
  data: { error?: string },
  response: Response,
  fallback: string,
): never => {
  throw new ApiError(data.error || fallback, {
    status: response.status,
    statusText: response.statusText,
    bodySnippet: typeof data.error === 'string' ? data.error : '',
    path: response.url || '',
  });
};

/** Living-sample offline demo: network / 5xx only — never 4xx (reason required, not found). */
export const isSampleMockDemoFallback = (error: unknown): boolean => {
  if (isAbortError(error)) return false;
  if (isApiError(error)) {
    return error.status === 0 || error.status >= 500;
  }
  return true;
};

export async function fetchSampleMockRecords(
  includes?: SampleMockRelationIncludes | string,
  signal?: AbortSignal,
): Promise<SampleMockRecordDto[]> {
  const { data, response } = await apiGet<RecordsResponse>(
    `/api/sample-mock/records${includeQuery(includes)}`,
    { signal },
  );
  if (!response.ok) {
    throwSampleMockFailure(data, response, 'Failed to load sample mock records.');
  }
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchSampleMockRecord(
  id: string,
  includes?: SampleMockRelationIncludes | string,
): Promise<SampleMockRecordDto> {
  const { data, response } = await apiGet<RecordResponse>(
    `/api/sample-mock/records/${encodeURIComponent(id)}${includeQuery(includes)}`,
  );
  if (!response.ok || !data.item) {
    throwSampleMockFailure(data, response, 'Failed to load sample mock record.');
  }
  return data.item;
}

export async function createSampleMockRecord(payload: Record<string, unknown>): Promise<SampleMockRecordDto> {
  const { data, response } = await apiPost<RecordResponse>('/api/sample-mock/records', payload);
  if (!response.ok || !data.item) {
    throwSampleMockFailure(data, response, 'Failed to create sample mock record.');
  }
  return data.item;
}

export async function createSampleMockRecordsBulk(payload: Record<string, unknown>): Promise<SampleMockRecordDto[]> {
  const { data, response } = await apiPost<RecordsResponse>('/api/sample-mock/records/bulk', payload);
  if (!response.ok) {
    throwSampleMockFailure(data, response, 'Failed to create sample mock records.');
  }
  return Array.isArray(data.items) ? data.items : [];
}

export async function patchSampleMockRecord(
  id: string,
  payload: Record<string, unknown>,
): Promise<SampleMockRecordDto> {
  const { data, response } = await apiPatch<RecordResponse>(
    `/api/sample-mock/records/${encodeURIComponent(id)}`,
    payload,
  );
  if (!response.ok || !data.item) {
    throwSampleMockFailure(data, response, 'Failed to update sample mock record.');
  }
  return data.item;
}

export async function approveSampleMockRecord(
  id: string,
  payload: Record<string, unknown> = {},
): Promise<SampleMockRecordDto> {
  const { data, response } = await apiPatch<RecordResponse>(
    `/api/sample-mock/records/${encodeURIComponent(id)}/approve`,
    payload,
  );
  if (!response.ok || !data.item) {
    throwSampleMockFailure(data, response, 'Failed to approve sample mock record.');
  }
  return data.item;
}

export async function lockSampleMockRecord(
  id: string,
  payload: Record<string, unknown>,
): Promise<SampleMockRecordDto> {
  const { data, response } = await apiPatch<RecordResponse>(
    `/api/sample-mock/records/${encodeURIComponent(id)}/lock`,
    payload,
  );
  if (!response.ok || !data.item) {
    throwSampleMockFailure(data, response, 'Failed to lock sample mock record.');
  }
  return data.item;
}

export async function deleteSampleMockRecord(
  id: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  const { data, response } = await apiDelete<ApiMutationResponse>(
    `/api/sample-mock/records/${encodeURIComponent(id)}`,
    payload,
  );
  if (!response.ok) {
    throwSampleMockFailure(data, response, 'Failed to delete sample mock record.');
  }
}

export function useSampleMockRecordsQuery(includes: SampleMockRelationIncludes | string, enabled = true) {
  const includeKey = typeof includes === 'string' ? includes : serializeSampleMockIncludes(includes);
  return useQuery({
    queryKey: sampleMockQueryKeys.records(includeKey),
    queryFn: ({ signal }) => fetchSampleMockRecords(includeKey, signal),
    enabled,
    staleTime: 15_000,
  });
}
