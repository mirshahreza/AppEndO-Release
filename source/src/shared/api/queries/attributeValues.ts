import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAttributeValueItemEditable } from '../contracts/attributes/editPolicy';
import { isSystemManagedUserAttributeKey } from '../contracts/attributes/builtInAttributes';
import type {
  AttributeValueItem,
  AttributeValuesResponse,
  SessionPreviewResponse,
  UpdateAttributeValuesPayload,
} from '../contracts/attributes/types';
import { apiGet, apiPut, type ApiMutationResponse } from '../client';
import { profileQueryKeys } from './profile';
import { resolveAttributeLabel } from '../../lib/attributeLabelTranslations';

export type { AttributeValueItem, AttributeValuesResponse, UpdateAttributeValuesPayload };

export const attributeValuesQueryKeys = {
  all: ['attribute-values'] as const,
  user: (userId: number) => [...attributeValuesQueryKeys.all, 'user', userId] as const,
  role: (roleId: number) => [...attributeValuesQueryKeys.all, 'role', roleId] as const,
  sessionPreview: (userId: number) => [...attributeValuesQueryKeys.all, 'session-preview', userId] as const,
};

const getLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export async function fetchUserAttributes(userId: number): Promise<AttributeValuesResponse> {
  const { data, response } = await apiGet<AttributeValuesResponse>(`/api/users/${userId}/attributes`);

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load user attributes (HTTP ${response.status}).`));
  }

  if (!data.success) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load user attributes.'));
  }

  return data;
}

export async function fetchRoleAttributes(roleId: number): Promise<AttributeValuesResponse> {
  const { data, response } = await apiGet<AttributeValuesResponse>(`/api/roles/${roleId}/attributes`);

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load role attributes (HTTP ${response.status}).`));
  }

  if (!data.success) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load role attributes.'));
  }

  return data;
}

export function useUserAttributesQuery(userId: number | null, enabled = true) {
  return useQuery({
    queryKey: attributeValuesQueryKeys.user(userId ?? 0),
    queryFn: () => fetchUserAttributes(userId as number),
    enabled: enabled && userId !== null && userId > 0,
  });
}

export function useRoleAttributesQuery(roleId: number | null, enabled = true) {
  return useQuery({
    queryKey: attributeValuesQueryKeys.role(roleId ?? 0),
    queryFn: () => fetchRoleAttributes(roleId as number),
    enabled: enabled && roleId !== null && roleId > 0,
  });
}

export async function fetchUserSessionPreview(userId: number): Promise<SessionPreviewResponse> {
  const { data, response } = await apiGet<SessionPreviewResponse>(`/api/users/${userId}/session-preview`);

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load session preview (HTTP ${response.status}).`));
  }

  if (!data.success) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load session preview.'));
  }

  return data;
}

export function useUserSessionPreviewQuery(userId: number | null, enabled = true) {
  return useQuery({
    queryKey: attributeValuesQueryKeys.sessionPreview(userId ?? 0),
    queryFn: () => fetchUserSessionPreview(userId as number),
    enabled: enabled && userId !== null && userId > 0,
  });
}

type UpdateUserAttributesVariables = {
  userId: number;
  payload: UpdateAttributeValuesPayload;
};

type UpdateRoleAttributesVariables = {
  roleId: number;
  payload: UpdateAttributeValuesPayload;
};

export function useUpdateUserAttributesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: UpdateUserAttributesVariables) =>
      apiPut<ApiMutationResponse>(`/api/users/${Number(userId)}/attributes`, payload),
    onSuccess: ({ data }, { userId }) => {
      if (data.success) {
        const normalizedUserId = Number(userId);
        void queryClient.invalidateQueries({ queryKey: attributeValuesQueryKeys.user(normalizedUserId) });
        void queryClient.invalidateQueries({ queryKey: profileQueryKeys.attributeSummary(normalizedUserId) });
      }
    },
  });
}

export function useUpdateRoleAttributesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, payload }: UpdateRoleAttributesVariables) =>
      apiPut<ApiMutationResponse>(`/api/roles/${Number(roleId)}/attributes`, payload),
    onSuccess: ({ data }, { roleId }) => {
      if (data.success) {
        void queryClient.invalidateQueries({ queryKey: attributeValuesQueryKeys.role(Number(roleId)) });
      }
    },
  });
}

const normalizeSettingsAttributeId = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

export const buildAttributeValuesPayload = (
  items: AttributeValueItem[],
  valuesBySettingsAttributeId: Record<number, unknown | null | undefined>,
): UpdateAttributeValuesPayload => ({
  values: items
    .filter((item) => isAttributeValueItemEditable(item)
      && !isSystemManagedUserAttributeKey(item.settingsAttribute.key))
    .map((item) => {
      const settingsAttributeId = normalizeSettingsAttributeId(item.settingsAttribute.id);
      return {
        settingsAttributeId,
        value: valuesBySettingsAttributeId[settingsAttributeId] ?? valuesBySettingsAttributeId[item.settingsAttribute.id] ?? null,
      };
    }),
});

export const attributeValuesToFormState = (items: AttributeValueItem[]): Record<number, unknown> => {
  const next: Record<number, unknown> = {};
  for (const item of items) {
    if (item.value === null || item.value === undefined) continue;
    next[normalizeSettingsAttributeId(item.settingsAttribute.id)] = item.value;
  }
  return next;
};

export const getAttributeFieldLabel = (
  item: AttributeValueItem,
  t?: (key: string) => string,
): string =>
  resolveAttributeLabel({
    attributeKey: item.settingsAttribute.key,
    fallbackLabel: item.settingsAttribute.label,
    t,
  });
