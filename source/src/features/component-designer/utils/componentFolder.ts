import { sanitizeLatinSlugInput } from '../../../shared/lib/latinSlug';
import { normalizeComponentFolder } from '../../../shared/lib/designerIdentity';

export { normalizeComponentFolder };

export const sanitizeComponentFolderInput = (value: string): string =>
  sanitizeLatinSlugInput(value);
