import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import {
  resolveSettingsCulturesOverlayToken,
  SETTINGS_CULTURES_OVERLAY_DIALOG_FORM,
  SETTINGS_CULTURES_OVERLAY_DIALOG_TRANSLATIONS,
} from '../lib/settingsCulturesOverlay';

type Args = {
  formOpen: boolean;
  openCreateModal: () => void;
  translationsOpen: boolean;
  openTranslationsModal: () => void;
};

export function useSettingsCulturesOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => resolveSettingsCulturesOverlayToken({
      formOpen: args.formOpen,
      translationsOpen: args.translationsOpen,
    }),
    [args.formOpen, args.translationsOpen],
  );

  const openFromUrl = useCallback((token: string) => {
    if (token === SETTINGS_CULTURES_OVERLAY_DIALOG_FORM) {
      args.openCreateModal();
      return;
    }
    if (token === SETTINGS_CULTURES_OVERLAY_DIALOG_TRANSLATIONS) {
      args.openTranslationsModal();
    }
  }, [args]);

  useWorkspaceOverlayDeepLink({ enabled: true, activeToken, openFromUrl });
}
