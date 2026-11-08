import { useCallback, useEffect, useState } from 'react';
import { useOptionalShellExperience } from '../../contexts/ShellExperienceContext';
import {
  persistSidebarCollapsed,
  readStoredSidebarCollapsed,
} from './adminLayoutPreferences';

export function useAdminShellSidebarState() {
  const shellExperience = useOptionalShellExperience();
  const [localCollapsed, setLocalCollapsed] = useState(
    () => readStoredSidebarCollapsed() ?? false,
  );

  const isSidebarCollapsed = shellExperience ? shellExperience.sidebarCollapsed : localCollapsed;
  const sidebarCollapsePolicy = shellExperience?.sidebarCollapsePolicy ?? 'rail';

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    if (shellExperience) {
      shellExperience.setSidebarCollapsed(collapsed);
      return;
    }
    setLocalCollapsed(collapsed);
    persistSidebarCollapsed(collapsed);
  }, [shellExperience]);

  useEffect(() => {
    if (!shellExperience) {
      persistSidebarCollapsed(localCollapsed);
    }
  }, [localCollapsed, shellExperience]);

  return {
    isSidebarCollapsed,
    sidebarCollapsePolicy,
    setSidebarCollapsed,
  };
}
