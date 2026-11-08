import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { STUDIO_MOUNT_ID, toPortalRoutePattern } from '../../api/contracts/platform/mountConstants';
import { useOptionalPlatformMount } from '../../../app/platform/PlatformMountContext';
import { buildMountAbsolutePath } from '../../../app/platform/platformConfigHelpers';
import { useAiSettingsQuery } from '../../api/queries/aiModels';
import { hasConfiguredAiProvider, isAiGloballyEnabled } from '../../lib/aiAccess';
import type { AppToastType } from '../AppToast';

export const APPENDOO_SETUP_TOAST =
  'Set up at least one AI provider API key in Settings → AI Models before using AppEndoo.';

const buildAiModelsSettingsRelativePath = (mountId: string) => {
  const sectionPath = 'settings/ai-models';
  if (mountId === STUDIO_MOUNT_ID) {
    return sectionPath;
  }
  return toPortalRoutePattern(sectionPath);
};

export function useAppEndooShell(
  isOpen: boolean,
  onOpenChange: (open: boolean) => void,
  options?: { enabled?: boolean },
) {
  const navigate = useNavigate();
  const mount = useOptionalPlatformMount();
  const mountId = mount?.id ?? STUDIO_MOUNT_ID;
  const toMountPath = useCallback((relativePath: string) => (
    buildMountAbsolutePath(mount?.pathPrefix ?? '', relativePath)
  ), [mount?.pathPrefix]);
  const settingsQuery = useAiSettingsQuery({ enabled: options?.enabled ?? true });
  const [toast, setToast] = useState<{ type: AppToastType; text: string } | null>(null);

  const aiEnabled = isAiGloballyEnabled(settingsQuery.data?.enabled);
  const hasProvider = hasConfiguredAiProvider(
    settingsQuery.data?.providers,
    settingsQuery.data?.models,
  );
  const settingsResolved = settingsQuery.isFetched;

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!settingsResolved || aiEnabled || !isOpen) return;
    onOpenChange(false);
  }, [aiEnabled, isOpen, onOpenChange, settingsResolved]);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) {
      onOpenChange(false);
      return;
    }

    if (!hasProvider) {
      navigate(toMountPath(buildAiModelsSettingsRelativePath(mountId)));
      setToast({ type: 'warning', text: APPENDOO_SETUP_TOAST });
      return;
    }

    onOpenChange(true);
  }, [hasProvider, mountId, navigate, onOpenChange, toMountPath]);

  return {
    aiEnabled,
    handleOpenChange,
    toast,
  };
}
