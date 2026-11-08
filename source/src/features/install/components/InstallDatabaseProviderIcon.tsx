import React from 'react';
import type { ControlPlaneProviderId } from '../../../shared/api/contracts/install/controlPlaneProviders';
import { cn } from '../../../lib/utils';
import iconData from '../installDatabaseBrandIconData.json';
import { INSTALL_DATABASE_PROVIDER_VISUAL } from '../installWizardSteps';

const PROVIDER_ICON_KEY: Record<ControlPlaneProviderId, keyof typeof iconData> = {
  postgresql: 'postgresql',
  mysql: 'mysql',
  sqlserver: 'microsoftsqlserver',
  sqlite: 'sqlite',
};

export type InstallDatabaseProviderIconProps = {
  provider: ControlPlaneProviderId;
  className?: string;
};

export const InstallDatabaseProviderIcon: React.FC<InstallDatabaseProviderIconProps> = ({
  provider,
  className,
}) => {
  const iconKey = PROVIDER_ICON_KEY[provider];
  const iconBody = iconData[iconKey]?.body;
  const visual = INSTALL_DATABASE_PROVIDER_VISUAL[provider];

  if (!iconBody) {
    return null;
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('h-4 w-4 shrink-0', visual.iconClassName, className)}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: iconBody }}
    />
  );
};
