import React, { useEffect, useState } from 'react';
import type { FunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import {
  parsePlatformRouteBindingAuth,
  platformAuthFromAccessControl,
} from '../../../shared/api/contracts/platform/platformAccessControl';
import type { ExperienceManifestPortal } from '../../../shared/api/contracts/platform/experienceManifest';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import { AccessControlModal } from '../../../shared/ui/AccessControlModal';

export type PortalAccessModalProps = {
  open: boolean;
  portal: ExperienceManifestPortal;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (auth: ReturnType<typeof platformAuthFromAccessControl>) => void | Promise<void>;
};

export const PortalAccessModal: React.FC<PortalAccessModalProps> = ({
  open,
  portal,
  isSaving = false,
  onClose,
  onSave,
}) => {
  const [draftAccess, setDraftAccess] = useState<FunctionAccessControl>(() => (
    parsePlatformRouteBindingAuth(portal.auth)
  ));
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftAccess(parsePlatformRouteBindingAuth(portal.auth));
    setSaveError(null);
  }, [open, portal.segment]);

  if (!open) {
    return null;
  }

  return (
    <AccessControlModal
      open
      titlePath={portal.name}
      accessControl={draftAccess}
      disabled={isSaving}
      isSaving={isSaving}
      error={saveError}
      onChange={setDraftAccess}
      onClose={onClose}
      onSave={async () => {
        setSaveError(null);
        try {
          await onSave(platformAuthFromAccessControl(draftAccess));
        } catch (caught) {
          setSaveError(
            isApiError(caught)
              ? formatApiErrorMessage(caught)
              : caught instanceof Error
                ? caught.message
                : 'Failed to save access.',
          );
        }
      }}
    />
  );
};
