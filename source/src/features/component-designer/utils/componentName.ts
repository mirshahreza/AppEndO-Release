import { LATIN_SLUG_RE, sanitizeLatinSlugInput } from '../../../shared/lib/latinSlug';
import { normalizeDesignerComponentName } from '../../../shared/lib/designerIdentity';

export { normalizeDesignerComponentName };

export const sanitizeDesignerComponentNameInput = (value: string): string =>
  sanitizeLatinSlugInput(value);

export const isValidDesignerComponentName = (value: string): boolean =>
  value.length > 0 && LATIN_SLUG_RE.test(value);

const UNTITLED_COMPONENT_BASE_NAME = 'untitled-component';

/** Suggests a fresh, non-colliding name for a newly created component. */
export const suggestDesignerComponentName = (existingNames: readonly string[]): string => {
  const taken = new Set(existingNames.map((name) => name.toLowerCase()));
  if (!taken.has(UNTITLED_COMPONENT_BASE_NAME)) {
    return UNTITLED_COMPONENT_BASE_NAME;
  }

  let suffix = 2;
  while (taken.has(`${UNTITLED_COMPONENT_BASE_NAME}-${suffix}`)) {
    suffix += 1;
  }

  return `${UNTITLED_COMPONENT_BASE_NAME}-${suffix}`;
};
