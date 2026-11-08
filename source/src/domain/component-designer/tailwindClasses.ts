import { TAILWIND_INSPECTOR_FIELDS, type TailwindInspectorField } from './inspectorRegistry';

const splitClassTokens = (className: string): string[] => className.trim().split(/\s+/).filter(Boolean);

/**
 * HeroUI leaf CSS often `@apply`s the same utilities the inspector writes
 * (e.g. Button `.button { @apply rounded-3xl px-4 h-10 text-sm }`).
 * Plain Tailwind utilities then lose to component CSS at equal specificity.
 * Promote those tokens to `!important` so Style panel edits win in preview + export.
 */
const HERO_UI_CHROME_OVERRIDE_TOKEN =
  /^((?:[a-z0-9-]+:)*)(!?)(rounded(?:-\S+)?|(?:p|px|py|pt|pr|pb|pl|ps|pe)-(?!\[)\S+|(?:w|min-w|max-w|h|min-h|max-h)-(?!\[)\S+|opacity-(?!\[)\S+|shadow(?:-(?!\[)\S+)?|text-(?:left|center|right|justify|start|end)|text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|(?:justify|items)-(?!\[)\S+)$/;

export const promoteHeroUiChromeOverrideImportant = (className: string): string => {
  if (!className.trim()) {
    return className;
  }
  return splitClassTokens(className)
    .map((token) => {
      const match = token.match(HERO_UI_CHROME_OVERRIDE_TOKEN);
      if (!match) {
        return token;
      }
      const [, prefix, , utility] = match;
      return `${prefix}!${utility}`;
    })
    .join(' ');
};

export const resolveTailwindUtilityValue = (className: string, field: TailwindInspectorField): string => {
  const tokens = splitClassTokens(className);
  const match = tokens.find((token) => field.conflictPattern.test(token));
  if (!match) {
    return '';
  }

  const normalizedMatch = match.replace(/^((?:[a-z0-9-]+:)*)!/, '$1');

  for (const option of field.options ?? []) {
    if (option.value === match || option.value === normalizedMatch) {
      return option.value;
    }
  }

  return normalizedMatch;
};

export const applyTailwindUtility = (className: string, field: TailwindInspectorField, utility: string): string => {
  const tokens = splitClassTokens(className).filter((token) => !field.conflictPattern.test(token));
  const normalizedUtility = utility.trim();

  if (normalizedUtility.length > 0) {
    tokens.push(normalizedUtility);
  }

  return tokens.join(' ');
};

export const syncTailwindPropKeys = (className: string): Record<string, string> => {
  const next: Record<string, string> = {};

  for (const field of TAILWIND_INSPECTOR_FIELDS) {
    next[field.key] = resolveTailwindUtilityValue(className, field);
  }

  return next;
};

export const detectTailwindConflicts = (className: string): string[] => {
  const tokens = splitClassTokens(className);
  const warnings: string[] = [];

  for (const field of TAILWIND_INSPECTOR_FIELDS) {
    const matches = tokens.filter((token) => field.conflictPattern.test(token));
    if (matches.length > 1) {
      warnings.push(`Conflicting ${field.label} utilities: ${matches.join(', ')}`);
    }
  }

  return warnings;
};

export const resolveResponsiveTailwindUtilityValue = (
  className: string,
  field: TailwindInspectorField,
  prefix: string, // '', 'md:', 'lg:'
): string => {
  const tokens = splitClassTokens(className);
  const match = tokens.find((token) => {
    if (prefix) {
      return token.startsWith(prefix) && field.conflictPattern.test(token);
    } else {
      return !token.includes(':') && field.conflictPattern.test(token);
    }
  });
  if (!match) {
    return '';
  }
  return match.replace(/^((?:[a-z0-9-]+:)*)!/, '$1');
};

export const applyResponsiveTailwindUtility = (
  className: string,
  field: TailwindInspectorField,
  value: string,
  prefix: string, // '', 'md:', 'lg:'
): string => {
  const tokens = splitClassTokens(className).filter((token) => {
    if (prefix) {
      return !(token.startsWith(prefix) && field.conflictPattern.test(token));
    } else {
      return !(!token.includes(':') && field.conflictPattern.test(token));
    }
  });

  const normalized = value.trim();
  if (normalized.length > 0) {
    const cleanValue = normalized.replace(/^(?:md:|lg:)/, '');
    const tokenToAdd = prefix ? `${prefix}${cleanValue}` : cleanValue;
    tokens.push(tokenToAdd);
  }

  return tokens.join(' ');
};
