import { apiPut } from '../api/client';
import { fetchMyEditableAttributes } from '../api/queries/profile';
import { BUILTIN_USER_ATTRIBUTE_KEYS } from '../api/contracts/attributes/builtInAttributes';
import type { AccentThemeState } from './accentColorUtils';
import { accentThemeToAttributeValue } from './accentThemePreference';

let cachedDefinitionId: number | null = null;

export const resetAccentThemeDefinitionIdCache = (): void => {
  cachedDefinitionId = null;
};

const resolveAccentThemeDefinitionId = async (): Promise<number | null> => {
  if (cachedDefinitionId) {
    return cachedDefinitionId;
  }

  const items = await fetchMyEditableAttributes();
  const match = items.find((item) => item.settingsAttribute.key === BUILTIN_USER_ATTRIBUTE_KEYS.accentTheme);
  if (!match) {
    return null;
  }

  cachedDefinitionId = match.settingsAttribute.id;
  return cachedDefinitionId;
};

export const persistUserAccentTheme = async (state: AccentThemeState): Promise<boolean> => {
  const settingsAttributeId = await resolveAccentThemeDefinitionId();
  if (!settingsAttributeId) {
    return false;
  }

  const { data, response } = await apiPut<{ success?: boolean }>(
    '/api/profile/me/editable-attributes',
    {
      values: [{
        settingsAttributeId,
        value: accentThemeToAttributeValue(state),
      }],
    },
  );

  return response.ok && Boolean(data.success);
};
