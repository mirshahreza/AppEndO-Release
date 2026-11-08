import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { AppTableGrid } from '../../../shared/ui/AppTableGrid';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { useCultureT } from '../../../core/culture/CultureContext';
import { createPackageGridColumns, createPackageCardRowActions, packageRowKey } from '../packageGridColumns';
import type { PackageRow } from '../types';

export type PluginsGridProps = {
  error: string | null;
  isLoading: boolean;
  visibleRows: PackageRow[];
  footer?: React.ReactNode;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  onOpenInstall: (row: PackageRow) => void;
  onOpenUninstall: (row: PackageRow) => void;
  onOpenDelete: (row: PackageRow) => void;
  onOpenDetail: (row: PackageRow) => void;
  onDownload: (row: PackageRow) => void;
  onOpenDeployment: (row: PackageRow) => void;
  onOpenRepair?: (row: PackageRow) => void;
  onOpenRepack?: (row: PackageRow) => void;
};

export const PackagesGrid: React.FC<PluginsGridProps> = ({
  error,
  isLoading,
  visibleRows,
  footer,
  onScroll,
  onOpenInstall,
  onOpenUninstall,
  onOpenDelete,
  onOpenDetail,
  onDownload,
  onOpenDeployment,
  onOpenRepair,
  onOpenRepack,
}) => {
  const t = useCultureT();
  const handlers = useMemo(() => ({
    onOpenInstall,
    onOpenUninstall,
    onOpenDelete,
    onOpenDetail,
    onDownload,
    onOpenDeployment,
    onOpenRepair,
    onOpenRepack,
  }), [
    onOpenInstall,
    onOpenUninstall,
    onOpenDelete,
    onOpenDetail,
    onDownload,
    onOpenDeployment,
    onOpenRepair,
    onOpenRepack,
  ]);
  const columns = useMemo(
    () => createPackageGridColumns(handlers, t),
    [handlers, t],
  );

  return (
    <AppTableGrid
      presentation="auto"
      compact={{ tablet: { cardsPerRow: 2 } }}
      persistListKey={APP_LIST_PREFERENCE_KEYS.packages}
      scrollClassName="bg-white"
      onScroll={onScroll}
      footer={footer}
      columns={columns}
      rows={visibleRows}
      getRowKey={packageRowKey}
      getCardRowActions={(row) => createPackageCardRowActions(row, handlers, t)}
      errorContent={error ? <div className="p-4 text-sm text-rose-700">{error}</div> : undefined}
      isLoading={isLoading}
      loadingContent={(
        <div className="flex h-full min-h-36 items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('packages.loading')}
        </div>
      )}
      isEmpty={!isLoading && !error && visibleRows.length === 0}
      emptyMessage={t('packages.empty')}
    />
  );
};
