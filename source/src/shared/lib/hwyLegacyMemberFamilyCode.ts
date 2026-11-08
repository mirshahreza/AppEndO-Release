/**
 * Legacy member import: `HWY_Members.FamilyCode` is the electoral family number.
 * `ProvinceIdFamilyCode` is a province+family composite and must not land in `hwy_members.family_code`.
 */

const trimLegacyText = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
};

/** Map legacy member (+ optional nakhebin roll) to `hwy_members.family_code`. */
export const resolveLegacyMemberFamilyCode = (
  legacyFamilyCode: string | null | undefined,
  nakhebinRollFamilyCode?: string | null,
): string | null => {
  const fromMember = trimLegacyText(legacyFamilyCode);
  if (fromMember) {
    return fromMember;
  }
  const fromNakhebin = trimLegacyText(nakhebinRollFamilyCode);
  return fromNakhebin || null;
};
