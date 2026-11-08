/** Lowercase Latin slug: letters, digits, underscore, dash, dot. */
export const LATIN_SLUG_RE = /^[a-z0-9._-]+$/;

export const LATIN_SLUG_HELPER_TEXT =
  'Lowercase letters, numbers, dash, dot, and underscore only.';

export function sanitizeLatinSlugInput(raw: string): string {
  return raw
    .replace(/\//g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._\-]/g, '');
}

/** Derive a Latin slug candidate from an editorial title. */
export function deriveSlugFromTitle(title: string): string {
  const spaced = title
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return sanitizeLatinSlugInput(spaced);
}

/** Internal catalog slug: derive from a label, fall back to id, uniquify if taken. */
export function allocateInternalLatinSlug(input: {
  seed: string;
  id: string;
  taken: Iterable<string>;
  maxLength?: number;
}): string {
  const maxLength = input.maxLength ?? 64;
  const taken = new Set(input.taken);
  const fromSeed = deriveSlugFromTitle(input.seed).slice(0, maxLength);
  const fallback = `c-${input.id.replace(/-/g, '').slice(0, 12)}`.slice(0, maxLength);
  const base = fromSeed || fallback;

  const isFree = (value: string) => Boolean(value) && LATIN_SLUG_RE.test(value) && !taken.has(value);
  if (isFree(base)) {
    return base;
  }
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`;
    if (isFree(candidate)) {
      return candidate;
    }
  }
  return fallback;
}

export function validateLatinSlug(
  value: string,
  options?: { required?: boolean; fieldLabel?: string },
): string | null {
  const trimmed = value.trim();
  const label = options?.fieldLabel ?? 'Name';

  if (!trimmed) {
    return options?.required === false ? null : `${label} is required.`;
  }

  if (trimmed !== trimmed.toLowerCase()) {
    return `${label} must use lowercase letters only.`;
  }

  if (!LATIN_SLUG_RE.test(trimmed)) {
    return `${label} must use lowercase letters, numbers, dash, dot, and underscore only.`;
  }

  return null;
}
