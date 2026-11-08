import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  bootstrapCultureTranslationRuntime,
  buildCultureTranslationsSavePayload,
} from '../../../core/culture/CultureTranslationOverrides';
import { platformQueryKeys } from '../../../shared/api/queries/platform';
import {
  fetchPlatformCultureTranslations,
  updatePlatformCultureTranslations,
} from '../../../shared/api/queries/platformCrud';
import { buildEffectiveCultureDraft } from './inlineTranslationCultureDraft';

export function useInlineTranslationSave(cultureId: string) {
  const queryClient = useQueryClient();

  return useCallback(async (key: string, nextValue: string) => {
    const trimmedKey = key.trim();
    const trimmedValue = nextValue.trim();
    if (!trimmedKey || !trimmedValue) {
      throw new Error('Translation key and value are required.');
    }

    const data = await fetchPlatformCultureTranslations();
    const effective = buildEffectiveCultureDraft(data, cultureId);
    effective[trimmedKey] = trimmedValue;

    const currentConfig = {
      revision: data.revision,
      bundles: Object.fromEntries(
        Object.entries(data.defaultBundles).map(([bundleId, bundle]) => [bundleId, { ...bundle }]),
      ),
      cultureOverrides: { ...data.cultureOverrides },
    };

    const payload = buildCultureTranslationsSavePayload(
      currentConfig,
      { [cultureId]: effective },
      data.cultures,
    );

    await updatePlatformCultureTranslations(payload);
    bootstrapCultureTranslationRuntime({
      revision: payload.revision,
      cultureOverrides: payload.cultureOverrides,
    });
    await queryClient.invalidateQueries({ queryKey: platformQueryKeys.cultureTranslations() });
  }, [cultureId, queryClient]);
}
