import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import {
  DATA_STUDIO_MODELER_OVERLAY_DIALOG_DEPENDENCIES,
  DATA_STUDIO_MODELER_OVERLAY_DIALOG_GENERAL,
  DATA_STUDIO_MODELER_OVERLAY_DIALOG_IDENTITY,
  DATA_STUDIO_MODELER_OVERLAY_DIALOG_LIST_ACCESS,
  DATA_STUDIO_MODELER_OVERLAY_DIALOG_RECORD_POLICIES,
  resolveDataStudioModelerOverlayToken,
} from '../lib/dataStudioModelerOverlay';

type Args = {
  enabled: boolean;
  generalEditOpen: boolean;
  setGeneralEditOpen: (open: boolean) => void;
  identityOpen: boolean;
  setIdentityOpen: (open: boolean) => void;
  recordPoliciesOpen: boolean;
  setRecordPoliciesOpen: (open: boolean) => void;
  listAccessOpen: boolean;
  setListAccessOpen: (open: boolean) => void;
  dependenciesOpen: boolean;
  setDependenciesOpen: (open: boolean) => void;
};

export function useDataStudioModelerOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => resolveDataStudioModelerOverlayToken({
      generalEditOpen: args.generalEditOpen,
      identityOpen: args.identityOpen,
      recordPoliciesOpen: args.recordPoliciesOpen,
      listAccessOpen: args.listAccessOpen,
      dependenciesOpen: args.dependenciesOpen,
    }),
    [
      args.dependenciesOpen,
      args.generalEditOpen,
      args.identityOpen,
      args.listAccessOpen,
      args.recordPoliciesOpen,
    ],
  );

  const openFromUrl = useCallback((token: string) => {
    if (token === DATA_STUDIO_MODELER_OVERLAY_DIALOG_GENERAL) {
      args.setGeneralEditOpen(true);
      return;
    }
    if (token === DATA_STUDIO_MODELER_OVERLAY_DIALOG_IDENTITY) {
      args.setIdentityOpen(true);
      return;
    }
    if (token === DATA_STUDIO_MODELER_OVERLAY_DIALOG_RECORD_POLICIES) {
      args.setRecordPoliciesOpen(true);
      return;
    }
    if (token === DATA_STUDIO_MODELER_OVERLAY_DIALOG_LIST_ACCESS) {
      args.setListAccessOpen(true);
      return;
    }
    if (token === DATA_STUDIO_MODELER_OVERLAY_DIALOG_DEPENDENCIES) {
      args.setDependenciesOpen(true);
    }
  }, [args]);

  useWorkspaceOverlayDeepLink({ enabled: args.enabled, activeToken, openFromUrl });
}
