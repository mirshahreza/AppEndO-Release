import * as React from 'react';
import type { ExperienceManifestPortal } from '../../../shared/api/contracts/platform/experienceManifest';
import { portalUsesRedirectEntry } from '../../../shared/api/contracts/platform/experienceManifest';
import { useExperienceManifestQuery, usePlatformCulturesQuery } from '../../../shared/api/queries/platform';
import { STUDIO_PORTAL_SEGMENT } from '../../../shared/api/contracts/platform/mountConstants';
import {
  COMPONENT_ALONE_PORTAL_SEGMENT,
  mergePreviewPortalOptions,
} from '../lib/designerPreviewPortal';

export type DesignerPreviewContextState = {
  selectedCultureId: string;
  selectedPortalSegment: string;
  previewDirectionOverride: 'ltr' | 'rtl' | null;
  setSelectedCultureId: React.Dispatch<React.SetStateAction<string>>;
  setSelectedPortalSegment: React.Dispatch<React.SetStateAction<string>>;
  setPreviewDirectionOverride: React.Dispatch<React.SetStateAction<'ltr' | 'rtl' | null>>;
  cultureOptions: string[];
  portalOptions: ExperienceManifestPortal[];
  isLoading: boolean;
};

export function isPreviewablePortal(portal: ExperienceManifestPortal): boolean {
  if (!portal.enabled) {
    return false;
  }

  return (portal.entryMode ?? 'shell') === 'shell' && !portalUsesRedirectEntry(portal);
}

export const useDesignerPreviewContext = (): DesignerPreviewContextState => {
  const culturesQuery = usePlatformCulturesQuery();
  const manifestQuery = useExperienceManifestQuery('admin');

  const [selectedCultureId, setSelectedCultureId] = React.useState('');
  const [selectedPortalSegment, setSelectedPortalSegment] = React.useState('');
  const [previewDirectionOverride, setPreviewDirectionOverride] = React.useState<'ltr' | 'rtl' | null>(null);

  const cultureOptions = culturesQuery.data?.enabledCulturePackIds ?? ['us'];
  const portalOptions = React.useMemo(
    () => mergePreviewPortalOptions(
      (manifestQuery.data?.portals ?? []).filter(isPreviewablePortal),
    ),
    [manifestQuery.data?.portals],
  );

  React.useEffect(() => {
    if (selectedPortalSegment) {
      return;
    }

    if (portalOptions.some((portal) => portal.segment === STUDIO_PORTAL_SEGMENT)) {
      setSelectedPortalSegment(STUDIO_PORTAL_SEGMENT);
      return;
    }

    if (portalOptions.some((portal) => portal.segment === COMPONENT_ALONE_PORTAL_SEGMENT)) {
      setSelectedPortalSegment(COMPONENT_ALONE_PORTAL_SEGMENT);
    }
  }, [portalOptions, selectedPortalSegment]);

  React.useEffect(() => {
    if (!selectedPortalSegment) {
      return;
    }

    if (!portalOptions.some((portal) => portal.segment === selectedPortalSegment)) {
      setSelectedPortalSegment(COMPONENT_ALONE_PORTAL_SEGMENT);
    }
  }, [portalOptions, selectedPortalSegment]);

  return {
    selectedCultureId,
    selectedPortalSegment,
    previewDirectionOverride,
    setSelectedCultureId,
    setSelectedPortalSegment,
    setPreviewDirectionOverride,
    cultureOptions,
    portalOptions,
    isLoading: culturesQuery.isLoading || manifestQuery.isLoading,
  };
};
