import React from 'react';
import { Database } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { DataSourceType } from '../../../shared/api/contracts/data-sources/types';
import { controlPlaneProviderFromDataSourceType } from '../../../shared/api/contracts/install/controlPlaneProviders';
import { InstallDatabaseProviderIcon } from '../../install/components/InstallDatabaseProviderIcon';

const EXTENDED_TYPE_ICON: Partial<Record<DataSourceType, { Icon: typeof Database; className: string }>> = {
  [DataSourceType.ORACLE]: { Icon: Database, className: 'text-[#F80000]' },
};

export type DataSourceTypeIconProps = {
  type: DataSourceType;
  className?: string;
};

export const DataSourceTypeIcon: React.FC<DataSourceTypeIconProps> = ({ type, className }) => {
  const provider = controlPlaneProviderFromDataSourceType(type);

  if (provider) {
    return (
      <InstallDatabaseProviderIcon
        provider={provider}
        className={cn('h-10 w-10', className)}
      />
    );
  }

  const fallback = EXTENDED_TYPE_ICON[type];
  if (!fallback) {
    return <Database className={cn('h-10 w-10 text-slate-500', className)} aria-hidden />;
  }

  const { Icon, className: iconClassName } = fallback;
  return <Icon className={cn('h-10 w-10', iconClassName, className)} aria-hidden />;
};
