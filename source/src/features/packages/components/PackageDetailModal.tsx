import React from 'react';
import { Loader2, Package } from 'lucide-react';
import {
  AppDialogShell,
  DialogBand,
  DialogPrimaryHeader,
  WorkspaceVerticalSplitHandle,
  WORKSPACE_SPLIT_PANEL_KEYS,
  useInspectorRailSplit,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import type { PackageDetail } from '../types';
import { PackageDetailMetadataSidePanel } from './PackageDetailMetadataSidePanel';
import { PackageDetailWizardPane } from './PackageDetailWizardPane';

export type PackageDetailModalProps = {
  open: boolean;
  isLoading: boolean;
  detailData: PackageDetail | null;
  step: number;
  onStepChange: (step: number) => void;
  onClose: () => void;
};

export const PackageDetailModal: React.FC<PackageDetailModalProps> = ({
  open,
  isLoading,
  detailData,
  step,
  onStepChange,
  onClose,
}) => {
  const { containerRef, split } = useInspectorRailSplit(WORKSPACE_SPLIT_PANEL_KEYS.packageDetailInspector);

  if (!open) return null;

  return (
    <AppDialogShell
      size="maximized"
      onClose={onClose}
      onBackdropClick={onClose}
      ariaLabel="Package Details"
    >
      <DialogPrimaryHeader
        title={(
          <span className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <Package className="h-4 w-4" aria-hidden />
            </span>
            Package Details
          </span>
        )}
        onClose={onClose}
      />
      {detailData?.displayName ? (
        <DialogBand
          tone="elevated"
          className="min-w-0 overflow-hidden py-2.5 text-[13px] text-slate-600"
        >
          <span className="font-semibold text-slate-800">{detailData.displayName}</span>
        </DialogBand>
      ) : null}
      {isLoading ? (
        <div className="flex h-24 flex-1 items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading details...
        </div>
      ) : detailData ? (
        <div
          ref={containerRef}
          className={cn(
            '-mx-[15px] -mb-[15px] flex min-h-0 flex-1 overflow-hidden',
            split.isResizing && 'select-none',
          )}
        >
          <PackageDetailWizardPane
            detailData={detailData}
            step={step}
            onStepChange={onStepChange}
          />
          <WorkspaceVerticalSplitHandle {...split.splitHandleProps} appearance="ghost" />
          <PackageDetailMetadataSidePanel detailData={detailData} widthPx={split.size} />
        </div>
      ) : (
        <div className="p-4 text-sm text-slate-500">No details available.</div>
      )}
    </AppDialogShell>
  );
};
