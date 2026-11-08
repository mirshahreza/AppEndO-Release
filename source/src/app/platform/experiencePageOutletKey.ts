import { parseHwyMemberDossierRoute } from '../../domain/hwy/hwyMemberDossierRoute';

/**
 * React key for `DynamicOutlet` — member dossier section URLs must reuse one mount
 * (same page module + member + mode), not remount on every rail click.
 */
export function resolveExperiencePageOutletKey(pageKey: string, pathname: string): string {
  const dossier = parseHwyMemberDossierRoute(pathname);
  if (dossier) {
    return `${pageKey}:member-dossier:${dossier.mode}:${dossier.memberId}`;
  }
  return `${pageKey}:${pathname}`;
}

/** Shell formatted-reveal identity — keep dossier section swaps from resetting the cover tree. */
export function resolveShellFormattedRevealResetKey(pathname: string): string {
  const dossier = parseHwyMemberDossierRoute(pathname);
  if (dossier) {
    return `member-dossier:${dossier.mode}:${dossier.memberId}`;
  }
  return pathname;
}
