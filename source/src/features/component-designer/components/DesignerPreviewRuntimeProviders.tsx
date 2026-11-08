import * as React from 'react';
import { DesignerPublishedShellChromeProvider } from '../../../app/platform/DesignerPublishedShellChrome';
import { PlatformMountProvider } from '../../../app/platform/PlatformMountContext';
import { PortalContextProvider } from '../../../app/platform/PortalContext';
import { getMountById } from '../../../app/platform/platformConfigHelpers';
import { usePlatformConfig } from '../../../app/platform/PlatformConfigProvider';
import { STUDIO_MOUNT_ID, STUDIO_PORTAL_SEGMENT } from '../../../shared/api/contracts/platform/mountConstants';
import { resolvePreviewPortalShellKey } from '../lib/designerPreviewPortal';
import type { ExperienceManifestPortal } from '../../../shared/api/contracts/platform/experienceManifest';

export type DesignerPreviewRuntimeProvidersProps = {
  portalSegment: string;
  portalOptions: readonly ExperienceManifestPortal[];
  children: React.ReactNode;
};

export const DesignerPreviewRuntimeProviders: React.FC<DesignerPreviewRuntimeProvidersProps> = ({
  portalSegment,
  portalOptions,
  children,
}) => {
  const { config } = usePlatformConfig();
  const studioMount = getMountById(config, STUDIO_MOUNT_ID);

  const portalValue = React.useMemo(() => ({
    portalSegment: portalSegment.trim() || STUDIO_PORTAL_SEGMENT,
    shellKey: resolvePreviewPortalShellKey(portalSegment, [...portalOptions])
      ?? 'admin',
    pageRemainderPath: '/',
  }), [portalOptions, portalSegment]);

  if (!studioMount?.enabled) {
    return (
      <DesignerPublishedShellChromeProvider>
        {children}
      </DesignerPublishedShellChromeProvider>
    );
  }

  return (
    <PlatformMountProvider mount={studioMount}>
      <PortalContextProvider value={portalValue}>
        <DesignerPublishedShellChromeProvider>
          {children}
        </DesignerPublishedShellChromeProvider>
      </PortalContextProvider>
    </PlatformMountProvider>
  );
};
