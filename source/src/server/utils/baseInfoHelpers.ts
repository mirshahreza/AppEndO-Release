import { resolveBaseInfoCultureId } from '../../shared/lib/baseInfoCultureTranslations';
import { toOptionalTrimmed } from './profilePayload';

export { toOptionalTrimmed };

export const resolveBaseInfoCultureIdFromQuery = (lang: unknown): string => (
  resolveBaseInfoCultureId(lang)
);
