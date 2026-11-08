/**
 * Bidirectional codec between Tailwind spacing utility classNames
 * (p-4, px-6 py-2, m-0, gap-4, …) and visual numeric side/gap values.
 *
 * Spec: docs/refactor-spec/03-inspector-redesign-spec.md §3.2
 */

export type SpacingSide = 'top' | 'right' | 'bottom' | 'left';

export type SpacingSides = Record<SpacingSide, number | 'auto' | null>;

export type SpacingKind = 'padding' | 'margin';

/** Tailwind default spacing scale keys used by designer utilities. */
export const TAILWIND_SPACING_SCALE = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96,
] as const;

export type TailwindSpacingScaleValue = (typeof TAILWIND_SPACING_SCALE)[number];

const SPACING_TOKEN_PATTERN =
  /^(?:(?<prefix>[a-z0-9-]+:))?(?<axis>p|m|gap)(?<side>x|y|t|r|b|l|s|e)?-(?<value>0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96|auto)$/;

const PADDING_CONFLICT = /^(?:[a-z0-9-]+:)?p(?:x|y|t|r|b|l|s|e)?-(?:0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96)$/;
const MARGIN_CONFLICT = /^(?:[a-z0-9-]+:)?m(?:x|y|t|r|b|l|s|e)?-(?:0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96|auto)$/;
const GAP_CONFLICT = /^(?:[a-z0-9-]+:)?gap(?:-[xy])?-(?:0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96)$/;

const emptySides = (): SpacingSides => ({
  top: null,
  right: null,
  bottom: null,
  left: null,
});

const splitTokens = (className: string): string[] =>
  className.trim().split(/\s+/).filter(Boolean);

const parseScaleValue = (raw: string): number | 'auto' | null => {
  if (raw === 'auto') {
    return 'auto';
  }
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatScaleValue = (value: number | 'auto'): string =>
  value === 'auto' ? 'auto' : String(value);

const applySideToken = (
  sides: SpacingSides,
  side: string | undefined,
  value: number | 'auto',
): void => {
  switch (side) {
    case undefined:
    case '':
      sides.top = value;
      sides.right = value;
      sides.bottom = value;
      sides.left = value;
      break;
    case 'x':
      sides.left = value;
      sides.right = value;
      break;
    case 'y':
      sides.top = value;
      sides.bottom = value;
      break;
    case 't':
      sides.top = value;
      break;
    case 'r':
    case 'e':
      sides.right = value;
      break;
    case 'b':
      sides.bottom = value;
      break;
    case 'l':
    case 's':
      sides.left = value;
      break;
    default:
      break;
  }
};

/**
 * Parse padding or margin utilities from a className into visual side values.
 * Later tokens override earlier ones for the same side (Tailwind cascade order).
 */
export const parseSpacingClassName = (
  className: string,
  kind: SpacingKind,
  prefix: '' | 'md:' | 'lg:' = '',
): SpacingSides => {
  const sides = emptySides();
  const axis = kind === 'padding' ? 'p' : 'm';

  for (const token of splitTokens(className)) {
    const match = SPACING_TOKEN_PATTERN.exec(token);
    if (!match?.groups) {
      continue;
    }
    const tokenPrefix = match.groups.prefix ?? '';
    if (prefix) {
      if (tokenPrefix !== prefix) {
        continue;
      }
    } else if (tokenPrefix.includes(':')) {
      continue;
    }
    if (match.groups.axis !== axis) {
      continue;
    }
    const value = parseScaleValue(match.groups.value);
    if (value === null) {
      continue;
    }
    applySideToken(sides, match.groups.side, value);
  }

  return sides;
};

/**
 * Encode visual side values back to a compact Tailwind spacing class string.
 * Prefers shorthand: `p-2 px-6` over four individual sides when possible.
 */
export const encodeSpacingClassName = (
  sides: SpacingSides,
  kind: SpacingKind,
  prefix: '' | 'md:' | 'lg:' = '',
): string => {
  const { top, right, bottom, left } = sides;
  if (top === null && right === null && bottom === null && left === null) {
    return '';
  }

  const axis = kind === 'padding' ? 'p' : 'm';
  const withPrefix = (utility: string) => (prefix ? `${prefix}${utility}` : utility);
  const tokens: string[] = [];

  // Uniform → p-4 / m-0
  if (top !== null && top === right && right === bottom && bottom === left) {
    return withPrefix(`${axis}-${formatScaleValue(top)}`);
  }

  // Paired axes → prefer `p-{y} px-{x}` (e.g. p-2 px-6) over px+py
  if (top !== null && top === bottom && left !== null && left === right) {
    if (top === left) {
      return withPrefix(`${axis}-${formatScaleValue(top)}`);
    }
    return [withPrefix(`${axis}-${formatScaleValue(top)}`), withPrefix(`${axis}x-${formatScaleValue(left)}`)].join(' ');
  }

  // Three sides share a base value → shorthand + one override (e.g. p-2 pb-6)
  const values = [top, right, bottom, left];
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value === null) {
      continue;
    }
    const key = formatScaleValue(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let baseValue: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      baseValue = key;
    }
  }

  if (baseValue !== null && bestCount >= 3 && top !== null && right !== null && bottom !== null && left !== null) {
    tokens.push(withPrefix(`${axis}-${baseValue}`));
    if (formatScaleValue(top) !== baseValue) {
      tokens.push(withPrefix(`${axis}t-${formatScaleValue(top)}`));
    }
    if (formatScaleValue(right) !== baseValue) {
      tokens.push(withPrefix(`${axis}r-${formatScaleValue(right)}`));
    }
    if (formatScaleValue(bottom) !== baseValue) {
      tokens.push(withPrefix(`${axis}b-${formatScaleValue(bottom)}`));
    }
    if (formatScaleValue(left) !== baseValue) {
      tokens.push(withPrefix(`${axis}l-${formatScaleValue(left)}`));
    }
    return tokens.join(' ');
  }

  // Remaining axis pairs / individual sides (clock order for individuals)
  if (left !== null && left === right) {
    tokens.push(withPrefix(`${axis}x-${formatScaleValue(left)}`));
  }
  if (top !== null && top === bottom) {
    tokens.push(withPrefix(`${axis}y-${formatScaleValue(top)}`));
  }

  if (!(top !== null && top === bottom) && top !== null) {
    tokens.push(withPrefix(`${axis}t-${formatScaleValue(top)}`));
  }
  if (!(left !== null && left === right) && right !== null) {
    tokens.push(withPrefix(`${axis}r-${formatScaleValue(right)}`));
  }
  if (!(top !== null && top === bottom) && bottom !== null) {
    tokens.push(withPrefix(`${axis}b-${formatScaleValue(bottom)}`));
  }
  if (!(left !== null && left === right) && left !== null) {
    tokens.push(withPrefix(`${axis}l-${formatScaleValue(left)}`));
  }

  return tokens.join(' ');
};

export const parseGapClassName = (
  className: string,
  prefix: '' | 'md:' | 'lg:' = '',
): number | null => {
  for (const token of splitTokens(className)) {
    const match = SPACING_TOKEN_PATTERN.exec(token);
    if (!match?.groups || match.groups.axis !== 'gap') {
      continue;
    }
    if (match.groups.side === 'x' || match.groups.side === 'y') {
      continue;
    }
    const tokenPrefix = match.groups.prefix ?? '';
    if (prefix) {
      if (tokenPrefix !== prefix) {
        continue;
      }
    } else if (tokenPrefix.includes(':')) {
      continue;
    }
    const value = parseScaleValue(match.groups.value);
    return typeof value === 'number' ? value : null;
  }
  return null;
};

export const encodeGapClassName = (
  value: number | null,
  prefix: '' | 'md:' | 'lg:' = '',
): string => {
  if (value === null) {
    return '';
  }
  const utility = `gap-${formatScaleValue(value)}`;
  return prefix ? `${prefix}${utility}` : utility;
};

const conflictForKind = (kind: SpacingKind | 'gap'): RegExp => {
  if (kind === 'padding') {
    return PADDING_CONFLICT;
  }
  if (kind === 'margin') {
    return MARGIN_CONFLICT;
  }
  return GAP_CONFLICT;
};

/** Replace spacing utilities of one kind in className with encoded tokens. */
export const applySpacingToClassName = (
  className: string,
  kind: SpacingKind | 'gap',
  encoded: string,
  prefix: '' | 'md:' | 'lg:' = '',
): string => {
  const conflict = conflictForKind(kind);
  const retained = splitTokens(className).filter((token) => {
    if (prefix) {
      return !(token.startsWith(prefix) && conflict.test(token));
    }
    return !(!token.includes(':') && conflict.test(token));
  });
  const nextTokens = encoded.trim().length > 0 ? encoded.trim().split(/\s+/).filter(Boolean) : [];
  return [...retained, ...nextTokens].join(' ');
};

/** Round-trip helper: className fragment → visual → className fragment. */
export const roundTripSpacingClassName = (
  spacingClassName: string,
  kind: SpacingKind | 'gap',
): string => {
  if (kind === 'gap') {
    return encodeGapClassName(parseGapClassName(spacingClassName));
  }
  const sides = parseSpacingClassName(spacingClassName, kind);
  return encodeSpacingClassName(sides, kind);
};

export const areSpacingSidesUniform = (sides: SpacingSides): boolean => {
  const { top, right, bottom, left } = sides;
  if (top === null || right === null || bottom === null || left === null) {
    return false;
  }
  return top === right && right === bottom && bottom === left;
};

export const setAllSpacingSides = (
  value: number | 'auto' | null,
): SpacingSides => ({
  top: value,
  right: value,
  bottom: value,
  left: value,
});

export const snapToTailwindSpacingScale = (raw: number): TailwindSpacingScaleValue => {
  let best: TailwindSpacingScaleValue = TAILWIND_SPACING_SCALE[0];
  let bestDistance = Math.abs(raw - best);
  for (const candidate of TAILWIND_SPACING_SCALE) {
    const distance = Math.abs(raw - candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
};
