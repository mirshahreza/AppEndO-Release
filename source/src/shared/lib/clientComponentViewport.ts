import { tierMeetsMinViewport, type MinViewport, type ViewportTier } from './viewportTokens';

export const CLIENT_COMPONENT_MIN_VIEWPORT_VALUES = ['tablet', 'desktop'] as const;
export const CLIENT_COMPONENT_BELOW_MIN_VALUES = ['continue', 'hide', 'placeholder'] as const;

export type ClientComponentMinViewport = (typeof CLIENT_COMPONENT_MIN_VIEWPORT_VALUES)[number];
export type ClientComponentBelowMin = (typeof CLIENT_COMPONENT_BELOW_MIN_VALUES)[number];

export type ClientComponentViewportPolicy = {
  minViewport?: ClientComponentMinViewport;
  belowMin: ClientComponentBelowMin;
};

const isMinViewport = (value: unknown): value is ClientComponentMinViewport =>
  value === 'tablet' || value === 'desktop';

const isBelowMin = (value: unknown): value is ClientComponentBelowMin =>
  value === 'continue' || value === 'hide' || value === 'placeholder';

export function parseClientComponentMinViewport(value: unknown): ClientComponentMinViewport | undefined {
  if (value === 'phone' || value === 'always' || value === '' || value == null) {
    return undefined;
  }
  return isMinViewport(value) ? value : undefined;
}

export function parseClientComponentBelowMin(value: unknown): ClientComponentBelowMin {
  return isBelowMin(value) ? value : 'continue';
}

export function resolveClientComponentViewportPolicy(input: {
  minViewport?: unknown;
  belowMin?: unknown;
}): ClientComponentViewportPolicy {
  const minViewport = parseClientComponentMinViewport(input.minViewport);
  return {
    minViewport,
    belowMin: minViewport ? parseClientComponentBelowMin(input.belowMin) : 'continue',
  };
}

export function clientComponentMeetsMinViewport(
  tier: ViewportTier,
  minViewport?: ClientComponentMinViewport,
): boolean {
  return tierMeetsMinViewport(tier, minViewport as MinViewport | undefined);
}

export function clientComponentViewportRequiresWrap(policy: ClientComponentViewportPolicy): boolean {
  return Boolean(policy.minViewport) && policy.belowMin !== 'continue';
}
