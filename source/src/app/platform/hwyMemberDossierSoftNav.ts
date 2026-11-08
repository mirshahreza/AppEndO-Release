import { parseHwyMemberDossierRoute } from '../../domain/hwy/hwyMemberDossierRoute';

/**
 * In-shell section switches on the same member dossier (view→view or edit→edit).
 * Skips formatted-reveal cover so rail navigation feels like tabs, not page reloads.
 */
export const isHwyMemberDossierSoftNavigation = (
  fromPathname: string,
  toPathname: string,
): boolean => {
  const from = parseHwyMemberDossierRoute(fromPathname);
  const to = parseHwyMemberDossierRoute(toPathname);
  if (!from || !to) {
    return false;
  }
  return from.memberId === to.memberId && from.mode === to.mode;
};
