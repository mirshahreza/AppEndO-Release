/**
 * Shared hash-based chip color palette (Users roles + Designer grid chips).
 * Keep known-role overrides + 8-tone palette identical across call sites.
 */

const HASH_CHIP_PALETTE = [
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
  'bg-fuchsia-100 text-fuchsia-700',
] as const;

const KNOWN_HASH_CHIP_CLASS: Record<string, string> = {
  ADMIN: 'bg-indigo-100 text-indigo-700',
  DEVELOPER: 'bg-emerald-100 text-emerald-700',
};

/** Hash a label into a stable chip class (ADMIN/DEVELOPER keep fixed colors). */
export const getHashChipClass = (value: string): string => {
  const normalized = value.toUpperCase();
  if (KNOWN_HASH_CHIP_CLASS[normalized]) {
    return KNOWN_HASH_CHIP_CLASS[normalized];
  }

  const hash = normalized.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return HASH_CHIP_PALETTE[hash % HASH_CHIP_PALETTE.length];
};

/** @deprecated Prefer getHashChipClass — alias kept for Users call sites. */
export const getRoleChipClass = getHashChipClass;

/** Truncate a chip label to the first N characters (Users default: 3). */
export const truncateChipLabel = (value: string, maxChars: number): string => {
  if (maxChars <= 0 || value.length <= maxChars) {
    return value;
  }
  return value.slice(0, maxChars);
};

export const abbreviateRoleLabel = (role: string): string => truncateChipLabel(role, 3);
