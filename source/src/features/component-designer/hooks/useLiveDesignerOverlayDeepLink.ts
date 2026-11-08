import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import {
  LIVE_DESIGNER_OVERLAY_PANEL_AI,
  LIVE_DESIGNER_OVERLAY_PANEL_CODE,
  LIVE_DESIGNER_OVERLAY_PANEL_OUTLINE,
  LIVE_DESIGNER_OVERLAY_PANEL_PROPERTIES,
  resolveLiveDesignerOverlayToken,
} from '../lib/liveDesignerWorkspaceOverlay';

type Args = {
  enabled: boolean;
  outlineOpen: boolean;
  setOutlineOpen: (open: boolean) => void;
  propertiesOpen: boolean;
  setPropertiesOpen: (open: boolean) => void;
  codeOpen: boolean;
  setCodeOpen: (open: boolean) => void;
  aiOpen: boolean;
  setAiOpen: (open: boolean) => void;
};

export function useLiveDesignerOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => resolveLiveDesignerOverlayToken({
      outlineOpen: args.outlineOpen,
      propertiesOpen: args.propertiesOpen,
      codeOpen: args.codeOpen,
      aiOpen: args.aiOpen,
    }),
    [args.aiOpen, args.codeOpen, args.outlineOpen, args.propertiesOpen],
  );

  const openFromUrl = useCallback((token: string) => {
    if (token === LIVE_DESIGNER_OVERLAY_PANEL_OUTLINE) {
      args.setOutlineOpen(true);
      return;
    }
    if (token === LIVE_DESIGNER_OVERLAY_PANEL_PROPERTIES) {
      args.setPropertiesOpen(true);
      return;
    }
    if (token === LIVE_DESIGNER_OVERLAY_PANEL_CODE) {
      args.setCodeOpen(true);
      return;
    }
    if (token === LIVE_DESIGNER_OVERLAY_PANEL_AI) {
      args.setAiOpen(true);
    }
  }, [args]);

  useWorkspaceOverlayDeepLink({ enabled: args.enabled, activeToken, openFromUrl });
}
