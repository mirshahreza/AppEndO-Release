import { useMemo } from 'react';
import { usePlatformConfig } from '../../../app/platform/PlatformConfigProvider';
import { useOptionalPlatformMount } from '../../../app/platform/PlatformMountContext';
import { STUDIO_MOUNT_ID } from '../../../shared/api/contracts/platform/mountConstants';
import { useAuth } from '../../../contexts/AuthContext';
import { useAdminShellNav } from '../../../layouts/adminShell/useAdminShellNav';
import { listDashboardShortcutTargets, type DashboardShortcutTarget } from '../dashboardShortcutPicker';

export const useDashboardShortcutTargets = (): DashboardShortcutTarget[] => {
  const { currentUser } = useAuth();
  const { config } = usePlatformConfig();
  const mount = useOptionalPlatformMount();
  const mountId = mount?.id ?? STUDIO_MOUNT_ID;
  const pathPrefix = mount?.pathPrefix ?? '';
  const navGroups = useAdminShellNav(currentUser);

  return useMemo(
    () => listDashboardShortcutTargets({
      navGroups,
      config,
      mountId,
      pathPrefix,
      currentUser,
    }),
    [config, currentUser, mountId, navGroups, pathPrefix],
  );
};
