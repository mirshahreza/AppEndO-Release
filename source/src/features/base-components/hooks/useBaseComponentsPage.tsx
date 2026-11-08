import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { useOptionalPlatformMount } from '../../../app/platform/PlatformMountContext';
import { buildMountAbsolutePath } from '../../../app/platform/platformConfigHelpers';
import { STUDIO_MOUNT_ID, STUDIO_PORTAL_SEGMENT } from '../../../shared/api/contracts/platform/mountConstants';
import type { SectionId } from '../types';
import {
  buildBaseComponentsSectionRelativePath,
  DEFAULT_BASE_COMPONENTS_SECTION,
  parseBaseComponentsSectionSlug,
  resolveBaseComponentsRouteSuffix,
  resolveBaseComponentsSectionFromPathSuffix,
} from '../baseComponentsRoute';

export type BaseComponentsPageModel = {
  activeSection: SectionId;
  setActiveSection: (sectionId: SectionId) => void;
};

export function useBaseComponentsPage(): BaseComponentsPageModel {
  const navigate = useNavigate();
  const location = useLocation();
  const mount = useOptionalPlatformMount();
  const mountId = mount?.id ?? STUDIO_MOUNT_ID;
  const toMountPath = useCallback((relativePath: string) => (
    buildMountAbsolutePath(mount?.pathPrefix || `/${STUDIO_PORTAL_SEGMENT}`, relativePath)
  ), [mount?.pathPrefix]);
  const application = useOptionalPortal();
  const routeParamSuffix = useParams()['*'];
  const applicationSuffix = application?.pageRemainderPath.replace(/^\/+/, '') || undefined;
  const pathSuffix = resolveBaseComponentsRouteSuffix(applicationSuffix ?? routeParamSuffix);
  const activeSection = resolveBaseComponentsSectionFromPathSuffix(pathSuffix);

  useEffect(() => {
    const slug = pathSuffix?.split('/').filter(Boolean)[0]?.trim();
    if (slug && parseBaseComponentsSectionSlug(slug)) {
      return;
    }

    navigate(toMountPath(buildBaseComponentsSectionRelativePath(DEFAULT_BASE_COMPONENTS_SECTION, mountId)), { replace: true });
  }, [mountId, navigate, pathSuffix, toMountPath]);

  useEffect(() => {
    const canonicalPath = toMountPath(buildBaseComponentsSectionRelativePath(activeSection, mountId));
    if (location.pathname === canonicalPath) {
      return;
    }

    const resolvedSection = resolveBaseComponentsSectionFromPathSuffix(pathSuffix);
    if (resolvedSection !== activeSection) {
      return;
    }

    if (location.pathname.endsWith(`/base-components/${activeSection}`)) {
      navigate(canonicalPath, { replace: true });
    }
  }, [activeSection, location.pathname, mountId, navigate, pathSuffix, toMountPath]);

  const setActiveSection = useCallback((sectionId: SectionId) => {
    navigate(toMountPath(buildBaseComponentsSectionRelativePath(sectionId, mountId)));
  }, [mountId, navigate, toMountPath]);

  return {
    activeSection,
    setActiveSection,
  };
}
