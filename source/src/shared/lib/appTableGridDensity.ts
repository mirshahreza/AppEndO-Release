export type AppTableGridDensity = 'default' | 'compact';

export type AppTableGridSizeToken = 'xs' | 'sm';

const isDensity = (value: string): value is AppTableGridDensity =>
  value === 'default' || value === 'compact';

const isSizeToken = (value: string): value is AppTableGridSizeToken =>
  value === 'xs' || value === 'sm';

/** Matches CrudSet grid density → AppTableGrid `size` (see docs/standards/crud-set.md). */
export const resolveAppTableGridSizeFromDensity = (input: {
  density?: unknown;
  size?: unknown;
  /** When neither density nor size is set. */
  fallbackDensity?: AppTableGridDensity;
}): AppTableGridSizeToken => {
  const densityRaw = typeof input.density === 'string' ? input.density.trim() : '';
  if (isDensity(densityRaw)) {
    return densityRaw === 'compact' ? 'xs' : 'sm';
  }
  const sizeRaw = typeof input.size === 'string' ? input.size.trim() : '';
  if (isSizeToken(sizeRaw)) {
    return sizeRaw;
  }
  return (input.fallbackDensity ?? 'default') === 'compact' ? 'xs' : 'sm';
};
