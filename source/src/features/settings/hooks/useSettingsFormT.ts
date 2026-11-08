import { useCallback } from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';

function interpolateTemplate(
  template: string,
  params: Record<string, string | number>,
): string {
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

/** Translation helper for settings form fields (supports `{param}` placeholders). */
export function useSettingsFormT() {
  const culture = useOptionalCulture();
  const t = culture?.t ?? ((key: string) => key);

  return useCallback((
    key: string,
    params?: Record<string, string | number>,
  ) => {
    const template = t(key);
    return params ? interpolateTemplate(template, params) : template;
  }, [t]);
}
