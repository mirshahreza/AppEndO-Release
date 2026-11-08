import { useMemo } from 'react';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import {
  buildMountAbsolutePath,
  normalizeRoutePatternForNavPath,
  withNavLandingPath,
} from '../../../app/platform/platformConfigHelpers';

export function useCmsContentEditorHomePath(contentId: string | undefined): string | null {
  const { pathPrefix } = usePlatformMount();

  return useMemo(() => {
    if (!contentId?.trim()) {
      return null;
    }
    const relative = `studio/cms/contents/edit/${encodeURIComponent(contentId.trim())}`;
    const navRelative = withNavLandingPath(normalizeRoutePatternForNavPath(relative));
    return buildMountAbsolutePath(pathPrefix, navRelative);
  }, [contentId, pathPrefix]);
}
