import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ProfileFieldValueItem,
  ProfileFieldValuesResponse,
  UpdateProfileFieldValuesPayload,
} from '../contracts/profile/profileFieldSettings';
import { apiGet, apiPut, type ApiMutationResponse } from '../client';
import { profileQueryKeys } from './profile';

export type { ProfileFieldValueItem, UpdateProfileFieldValuesPayload };

const getLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export const isProfileFieldValueItemEditable = (item: ProfileFieldValueItem): boolean =>
  item.isCurrentlyEditable === true;

export async function fetchMyEditableProfileFields(): Promise<ProfileFieldValueItem[]> {
  const { data, response } = await apiGet<ProfileFieldValuesResponse>('/api/profile/me/editable-fields');

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load editable profile fields (HTTP ${response.status}).`));
  }

  if (!data.success) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load editable profile fields.'));
  }

  return data.items ?? [];
}

export function useMyEditableProfileFieldsQuery(userId?: number | null, enabled = true) {
  const normalizedUserId = Number(userId);
  const hasUserId = Number.isInteger(normalizedUserId) && normalizedUserId > 0;

  return useQuery({
    queryKey: profileQueryKeys.editableProfileFields(hasUserId ? normalizedUserId : null),
    queryFn: fetchMyEditableProfileFields,
    enabled: enabled && hasUserId,
  });
}

export function useUpdateMyEditableProfileFieldsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateProfileFieldValuesPayload) =>
      apiPut<ApiMutationResponse>('/api/profile/me/editable-fields', payload),
    onSuccess: ({ data }) => {
      if (data.success) {
        void queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
      }
    },
  });
}

export const profileFieldValuesToFormState = (items: ProfileFieldValueItem[]): Record<string, unknown> => {
  const next: Record<string, unknown> = {};
  for (const item of items) {
    next[item.profileField] = item.value ?? null;
  }
  return next;
};

const resolveProfileFieldPayloadValue = (
  item: ProfileFieldValueItem,
  valuesByProfileField: Record<string, unknown | null | undefined>,
): unknown => {
  if (Object.prototype.hasOwnProperty.call(valuesByProfileField, item.profileField)) {
    return valuesByProfileField[item.profileField] ?? null;
  }

  return item.value ?? null;
};

export const buildProfileFieldValuesPayload = (
  items: ProfileFieldValueItem[],
  valuesByProfileField: Record<string, unknown | null | undefined>,
): UpdateProfileFieldValuesPayload => ({
  fields: items
    .filter(isProfileFieldValueItemEditable)
    .map((item) => ({
      profileField: item.profileField,
      value: resolveProfileFieldPayloadValue(item, valuesByProfileField),
    })),
});
