import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { useCmsPublicSiteQuery } from '../../../shared/api/queries/cms-site';

export function useCmsPublicLanguage(): string {
  const culture = useOptionalCulture();
  const language = culture?.language?.trim().toLowerCase() || 'en';
  return language.slice(0, 2);
}

export function useCmsPublicSite() {
  const language = useCmsPublicLanguage();
  return useCmsPublicSiteQuery(language);
}
