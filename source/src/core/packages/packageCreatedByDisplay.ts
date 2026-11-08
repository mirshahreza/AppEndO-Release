/** Fallback when stored audit labels are technical script slugs with no human upload actor. */
export const PACKAGE_CREATED_BY_FALLBACK = 'AppEndO Team';

/** Automation slugs like pack-cms-package (3+ segments); not short usernames such as other-user. */
const TECHNICAL_CREATED_BY_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+){2,}$/;

/** Kebab-case automation labels (e.g. pack-cms-package), not people or wizard names. */
export function isTechnicalPackageCreatedBy(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes('@') || trimmed.includes(' ') || trimmed.includes('<')) return false;
  return TECHNICAL_CREATED_BY_RE.test(trimmed);
}

/**
 * Picks a human-facing Created By label for grids and metadata.
 * Wizard / profile strings win; technical slugs fall back to upload actor or {@link PACKAGE_CREATED_BY_FALLBACK}.
 */
export function resolvePackageCreatedByDisplay(
  stored: string | null | undefined,
  uploadActor: string | null | undefined,
): string | null {
  const storedTrimmed = typeof stored === 'string' ? stored.trim() : '';
  const actorTrimmed = typeof uploadActor === 'string' ? uploadActor.trim() : '';

  if (storedTrimmed && !isTechnicalPackageCreatedBy(storedTrimmed)) {
    return storedTrimmed;
  }

  if (actorTrimmed && !isTechnicalPackageCreatedBy(actorTrimmed)) {
    return actorTrimmed;
  }

  if (storedTrimmed && isTechnicalPackageCreatedBy(storedTrimmed)) {
    return PACKAGE_CREATED_BY_FALLBACK;
  }

  return storedTrimmed || actorTrimmed || null;
}
