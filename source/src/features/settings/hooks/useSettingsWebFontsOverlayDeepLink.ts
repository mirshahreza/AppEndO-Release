import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import {
  parseWebFontDeleteOverlayToken,
  resolveSettingsWebFontsOverlayToken,
} from '../lib/settingsWebFontsOverlay';

type Args = {
  deleteTargetId: string | null;
  setDeleteTargetId: (id: string | null) => void;
  fontIds: string[];
};

export function useSettingsWebFontsOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => resolveSettingsWebFontsOverlayToken({ deleteTargetId: args.deleteTargetId }),
    [args.deleteTargetId],
  );

  const openFromUrl = useCallback((token: string) => {
    const fontId = parseWebFontDeleteOverlayToken(token);
    if (fontId && args.fontIds.includes(fontId)) {
      args.setDeleteTargetId(fontId);
    }
  }, [args.fontIds, args.setDeleteTargetId]);

  useWorkspaceOverlayDeepLink({ enabled: true, activeToken, openFromUrl });
}
