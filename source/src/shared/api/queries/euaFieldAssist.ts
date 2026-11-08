import { useMutation, useQuery } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost, apiPut } from '../client';
import type { EuaAssistSettings } from '../contracts/ai/euaAssistSettings';
import type {
  EuaFieldAssistAutocompleteRequest,
  EuaFieldAssistAutocompleteResponse,
  EuaFieldAssistContextSuggestRequest,
  EuaFieldAssistContextSuggestResponse,
  EuaFieldAssistExtractRequest,
  EuaFieldAssistExtractResponse,
  EuaFieldAssistFillRequest,
  EuaFieldAssistFillResponse,
  EuaFieldAssistOcrRequest,
  EuaFieldAssistOcrResponse,
  EuaFieldAssistAltTextRequest,
  EuaFieldAssistAltTextResponse,
  EuaFieldAssistTransformRequest,
  EuaFieldAssistTransformResponse,
  EuaStatusResponse,
} from '../contracts/ai/euaFieldAssist';
import type {
  EuaFieldAssistSemanticValidateRequest,
  EuaFieldAssistSemanticValidateResponse,
  EuaVocabSemanticContextGetResponse,
  EuaVocabSemanticContextPatchRequest,
  EuaVocabSemanticContextPatchResponse,
  EuaVocabSemanticContextRecord,
} from '../contracts/ai/euaSemanticValidation';

export const euaQueryKeys = {
  all: ['eua'] as const,
  status: () => [...euaQueryKeys.all, 'status'] as const,
  settings: () => [...euaQueryKeys.all, 'settings'] as const,
};

const getErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }
  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export async function fetchEuaStatus(signal?: AbortSignal): Promise<EuaStatusResponse> {
  const { data, response } = await apiGet<EuaStatusResponse>('/api/eua/status', { signal });

  if (!response.ok) {
    throw new Error(getErrorMessage(data, `Failed to load EUA status (HTTP ${response.status}).`));
  }

  if (!data.success) {
    throw new Error(getErrorMessage(data, 'Failed to load EUA status.'));
  }

  return data;
}

export function useEuaStatusQuery(enabled = true) {
  return useQuery({
    queryKey: euaQueryKeys.status(),
    queryFn: ({ signal }) => fetchEuaStatus(signal),
    enabled,
    staleTime: 60_000,
  });
}

export async function transformFieldText(
  request: EuaFieldAssistTransformRequest,
  signal?: AbortSignal,
): Promise<EuaFieldAssistTransformResponse> {
  const { data, response } = await apiPost<EuaFieldAssistTransformResponse>(
    '/api/eua/field-assist/transform',
    request,
    { signal },
  );

  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data, `Transform failed (HTTP ${response.status}).`));
  }

  return data;
}

export function useTransformFieldTextMutation() {
  return useMutation({
    mutationFn: (request: EuaFieldAssistTransformRequest) => transformFieldText(request),
  });
}

export async function autocompleteFieldText(
  request: EuaFieldAssistAutocompleteRequest,
  signal?: AbortSignal,
): Promise<EuaFieldAssistAutocompleteResponse> {
  const { data, response } = await apiPost<EuaFieldAssistAutocompleteResponse>(
    '/api/eua/field-assist/autocomplete',
    request,
    { signal },
  );

  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data, `Autocomplete failed (HTTP ${response.status}).`));
  }

  return data;
}

export async function suggestFieldContext(
  request: EuaFieldAssistContextSuggestRequest,
  signal?: AbortSignal,
): Promise<EuaFieldAssistContextSuggestResponse> {
  const { data, response } = await apiPost<EuaFieldAssistContextSuggestResponse>(
    '/api/eua/field-assist/context-suggest',
    request,
    { signal },
  );

  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data, `Context suggest failed (HTTP ${response.status}).`));
  }

  return data;
}

export async function extractFieldValues(
  request: EuaFieldAssistExtractRequest,
  signal?: AbortSignal,
): Promise<EuaFieldAssistExtractResponse> {
  const { data, response } = await apiPost<EuaFieldAssistExtractResponse>(
    '/api/eua/field-assist/extract-fields',
    request,
    { signal },
  );

  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data, `Structured extract failed (HTTP ${response.status}).`));
  }

  return data;
}

export async function fillFormFromText(
  request: EuaFieldAssistFillRequest,
  signal?: AbortSignal,
): Promise<EuaFieldAssistFillResponse> {
  const { data, response } = await apiPost<EuaFieldAssistFillResponse>(
    '/api/eua/field-assist/fill-from-text',
    request,
    { signal },
  );

  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data, `Form fill failed (HTTP ${response.status}).`));
  }

  return data;
}

export async function ocrImageText(
  request: EuaFieldAssistOcrRequest,
  signal?: AbortSignal,
): Promise<EuaFieldAssistOcrResponse> {
  const { data, response } = await apiPost<EuaFieldAssistOcrResponse>(
    '/api/eua/field-assist/ocr-image',
    request,
    { signal },
  );

  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data, `OCR failed (HTTP ${response.status}).`));
  }

  return data;
}

export async function generateImageAltText(
  request: EuaFieldAssistAltTextRequest,
  signal?: AbortSignal,
): Promise<EuaFieldAssistAltTextResponse> {
  const { data, response } = await apiPost<EuaFieldAssistAltTextResponse>(
    '/api/eua/field-assist/alt-text',
    request,
    { signal },
  );

  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data, `Alt text failed (HTTP ${response.status}).`));
  }

  return data;
}

export async function semanticValidateFieldText(
  request: EuaFieldAssistSemanticValidateRequest,
  signal?: AbortSignal,
): Promise<EuaFieldAssistSemanticValidateResponse> {
  const { data, response } = await apiPost<EuaFieldAssistSemanticValidateResponse>(
    '/api/eua/field-assist/semantic-validate',
    request,
    { signal },
  );

  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data, `Semantic validation failed (HTTP ${response.status}).`));
  }

  return data;
}

export async function fetchVocabSemanticContext(
  id: string,
  signal?: AbortSignal,
): Promise<EuaVocabSemanticContextRecord> {
  const { data, response } = await apiGet<EuaVocabSemanticContextGetResponse>(
    `/api/eua/vocab-context/${encodeURIComponent(id)}`,
    { signal },
  );

  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data, `Failed to load vocabulary context (HTTP ${response.status}).`));
  }

  return data.record;
}

export async function patchVocabSemanticContext(
  id: string,
  body: EuaVocabSemanticContextPatchRequest,
  signal?: AbortSignal,
): Promise<EuaVocabSemanticContextRecord> {
  const { data, response } = await apiPatch<EuaVocabSemanticContextPatchResponse>(
    `/api/eua/vocab-context/${encodeURIComponent(id)}`,
    body,
    { signal },
  );

  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data, `Failed to save vocabulary context (HTTP ${response.status}).`));
  }

  return data.record;
}

export async function fetchEuaSettings(signal?: AbortSignal): Promise<EuaAssistSettings> {
  const { data, response } = await apiGet<{ success: boolean; settings: EuaAssistSettings }>(
    '/api/eua/settings',
    { signal },
  );

  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data, `Failed to load EUA settings (HTTP ${response.status}).`));
  }

  return data.settings;
}

export async function updateEuaSettings(settings: EuaAssistSettings): Promise<EuaAssistSettings> {
  const { data, response } = await apiPut<{ success: boolean; settings: EuaAssistSettings }>(
    '/api/eua/settings',
    settings,
  );

  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data, `Failed to save EUA settings (HTTP ${response.status}).`));
  }

  return data.settings;
}

export function useEuaSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: euaQueryKeys.settings(),
    queryFn: ({ signal }) => fetchEuaSettings(signal),
    enabled,
    staleTime: 30_000,
  });
}

export function useUpdateEuaSettingsMutation() {
  return useMutation({
    mutationFn: updateEuaSettings,
    meta: { invalidateKeys: [euaQueryKeys.settings(), euaQueryKeys.status()] },
  });
}
