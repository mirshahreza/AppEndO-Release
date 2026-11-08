import React, { createContext, useContext, useLayoutEffect, useMemo } from 'react';
import type {
  MountExperienceCalendar,
  PlatformMount,
} from '../../shared/api/contracts/platform/types';
import { STUDIO_MOUNT_ID } from '../../shared/api/contracts/platform/mountConstants';
import { acquireStudioNoSelectDocument } from '../../shared/ui/shell/studioNoSelect';
import {
  buildMountAbsolutePath,
  resolveMountCalendar,
} from './platformConfigHelpers';

type PlatformMountContextValue = {
  mount: PlatformMount;
  toMountPath: (relativePath: string) => string;
};

const PlatformMountContext = createContext<PlatformMountContextValue | null>(null);

export const PlatformMountProvider: React.FC<{
  mount: PlatformMount;
  children: React.ReactNode;
}> = ({ mount, children }) => {
  const value = useMemo<PlatformMountContextValue>(
    () => ({
      mount,
      toMountPath: (relativePath: string) => buildMountAbsolutePath(mount.pathPrefix, relativePath),
    }),
    [mount],
  );

  useLayoutEffect(() => {
    if (typeof document === 'undefined' || mount.id !== STUDIO_MOUNT_ID) {
      return undefined;
    }
    return acquireStudioNoSelectDocument(document.documentElement);
  }, [mount.id]);

  return (
    <PlatformMountContext.Provider value={value}>{children}</PlatformMountContext.Provider>
  );
};

export function useOptionalPlatformMount(): PlatformMount | null {
  const context = useContext(PlatformMountContext);
  return context?.mount ?? null;
}

export function usePlatformMount(): {
  mountId: string;
  pathPrefix: string;
  experienceConfig: PlatformMount['experienceConfig'];
  calendar: MountExperienceCalendar;
  toMountPath: (relativePath: string) => string;
} {
  const context = useContext(PlatformMountContext);
  if (!context) {
    throw new Error('usePlatformMount must be used within PlatformMountProvider.');
  }

  return {
    mountId: context.mount.id,
    pathPrefix: context.mount.pathPrefix,
    experienceConfig: context.mount.experienceConfig,
    calendar: resolveMountCalendar(context.mount),
    toMountPath: context.toMountPath,
  };
}
