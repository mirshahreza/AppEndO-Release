import {
  formatPortalUrlSegment,
  isOperatorHiddenBuiltinPortal,
  type ExperienceManifestPortal,
} from '../../../shared/api/contracts/platform/experienceManifest';
import { matchesBuiltInFilter } from '../../../shared/lib/builtInFilter';

export function portalIsBuiltIn(
  portal: Pick<ExperienceManifestPortal, 'segment'>,
): boolean {
  return isOperatorHiddenBuiltinPortal(portal);
}

export function portalMatchesSearch(
  portal: Pick<ExperienceManifestPortal, 'name' | 'segment' | 'shellKey'>,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  const haystack = [
    portal.name,
    portal.segment,
    formatPortalUrlSegment(portal.segment),
    portal.shellKey ?? '',
  ].join(' ').toLowerCase();

  return haystack.includes(needle);
}

export function filterPortals(
  portals: readonly ExperienceManifestPortal[],
  input: { builtInFilter: string; query: string },
): ExperienceManifestPortal[] {
  return portals.filter((portal) => (
    matchesBuiltInFilter(portalIsBuiltIn(portal), input.builtInFilter)
    && portalMatchesSearch(portal, input.query)
  ));
}
