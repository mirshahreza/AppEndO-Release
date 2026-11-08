/**
 * Member directory «family code» for voter-record cells and household deep links.
 * Prefer nakhebin roll family (`nakhebin_family_code`); ignore legacy member `family_code`
 * values that are province composite ids (e.g. `10105.193586`).
 */

const LEGACY_PROVINCE_FAMILY_COMPOSITE = /^\d+\.\d+$/;

const readTrimmed = (row: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    const snake = key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
    const raw = row[key] ?? row[snake];
    if (raw === null || raw === undefined) {
      continue;
    }
    const text = String(raw).trim();
    if (text.length > 0) {
      return text;
    }
  }
  return '';
};

export const isHwyLegacyProvinceFamilyComposite = (value: string): boolean => (
  LEGACY_PROVINCE_FAMILY_COMPOSITE.test(value)
);

/** Canonical electoral family number for a member-directory row. */
export const resolveHwyMemberDirectoryFamilyCode = (
  row: Record<string, unknown>,
): string => {
  const fromNakhebin = readTrimmed(row, 'nakhebinFamilyCode', 'nakhebin_family_code');
  if (fromNakhebin) {
    return fromNakhebin;
  }

  const fromMember = readTrimmed(row, 'familyCode', 'family_code');
  if (fromMember && !isHwyLegacyProvinceFamilyComposite(fromMember)) {
    return fromMember;
  }

  return '';
};
