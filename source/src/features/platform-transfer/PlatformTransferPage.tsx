import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlatformMount } from '../../app/platform/PlatformMountContext';
import { AppRouteLoading } from '../../components/AppRouteLoading';
import { STUDIO_MOUNT_ID, toPortalRoutePattern } from '../../shared/api/contracts/platform/mountConstants';

export const PlatformTransferPage: React.FC = () => {
  const navigate = useNavigate();
  const { mountId, toMountPath } = usePlatformMount();

  useEffect(() => {
    const relativePath = mountId === STUDIO_MOUNT_ID
      ? 'settings/platform-transfer'
      : toPortalRoutePattern('settings/platform-transfer');
    navigate(toMountPath(relativePath), { replace: true });
  }, [mountId, navigate, toMountPath]);

  return <AppRouteLoading />;
};
