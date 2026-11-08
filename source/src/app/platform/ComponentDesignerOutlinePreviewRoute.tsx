import React from 'react';
import { Route } from 'react-router-dom';
import { LazyRoute } from '../routes/LazyRoute';
import { ComponentDesignerOutlinePreviewPage } from '../routes/lazyPages';
import { MountAuthGate } from './MountAuthGate';
import { getMountById } from './platformConfigHelpers';
import { usePlatformConfig } from './PlatformConfigProvider';
import { PlatformMountProvider } from './PlatformMountContext';
import { STUDIO_MOUNT_ID } from '../../shared/api/contracts/platform/mountConstants';

export const ComponentDesignerOutlinePreviewRoute: React.FC = () => {
  const { config } = usePlatformConfig();
  const studioMount = getMountById(config, STUDIO_MOUNT_ID);

  if (!studioMount?.enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-loading p-6">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700">
          Studio mount is unavailable.
        </div>
      </div>
    );
  }

  return (
    <MountAuthGate mount={studioMount}>
      <PlatformMountProvider mount={studioMount}>
        <LazyRoute>
          <ComponentDesignerOutlinePreviewPage />
        </LazyRoute>
      </PlatformMountProvider>
    </MountAuthGate>
  );
};
