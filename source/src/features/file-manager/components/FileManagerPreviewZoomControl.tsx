import React from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useCultureT } from '../../../core/culture/CultureContext';
import { AppButton } from '../../../shared/ui';
import {
  clampFileManagerPreviewZoom,
  FILE_MANAGER_PREVIEW_ZOOM_DEFAULT,
  FILE_MANAGER_PREVIEW_ZOOM_MAX,
  FILE_MANAGER_PREVIEW_ZOOM_MIN,
  FILE_MANAGER_PREVIEW_ZOOM_STEP,
} from '../previewZoom';

type FileManagerPreviewZoomControlProps = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
};

export const FileManagerPreviewZoomControl: React.FC<FileManagerPreviewZoomControlProps> = ({
  value,
  onChange,
  className,
}) => {
  const t = useCultureT();
  const canZoomOut = value > FILE_MANAGER_PREVIEW_ZOOM_MIN;
  const canZoomIn = value < FILE_MANAGER_PREVIEW_ZOOM_MAX;
  const isDefault = value === FILE_MANAGER_PREVIEW_ZOOM_DEFAULT;

  return (
    <div
      className={cn('inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5', className)}
      role="group"
      aria-label={t('fileManager.zoom.label')}
    >
      <AppButton
        type="button"
        intent="utility"
        size="compact"
        className="!h-6 !min-h-6 !px-1"
        disabled={!canZoomOut}
        aria-label={t('fileManager.zoom.out')}
        title={t('fileManager.zoom.out')}
        onClick={() => onChange(clampFileManagerPreviewZoom(value - FILE_MANAGER_PREVIEW_ZOOM_STEP))}
      >
        <ZoomOut className="h-3 w-3" />
      </AppButton>
      <span className="min-w-[2.75rem] text-center text-[10px] font-semibold tabular-nums text-slate-600">
        {value}%
      </span>
      <AppButton
        type="button"
        intent="utility"
        size="compact"
        className="!h-6 !min-h-6 !px-1"
        disabled={!canZoomIn}
        aria-label={t('fileManager.zoom.in')}
        title={t('fileManager.zoom.in')}
        onClick={() => onChange(clampFileManagerPreviewZoom(value + FILE_MANAGER_PREVIEW_ZOOM_STEP))}
      >
        <ZoomIn className="h-3 w-3" />
      </AppButton>
      <AppButton
        type="button"
        intent={isDefault ? 'toggle-off' : 'toggle-on'}
        size="compact"
        className="!h-6 !min-h-6 !px-1"
        disabled={isDefault}
        aria-label={t('fileManager.zoom.reset')}
        title={t('fileManager.zoom.reset')}
        onClick={() => onChange(FILE_MANAGER_PREVIEW_ZOOM_DEFAULT)}
      >
        <RotateCcw className="h-3 w-3" />
      </AppButton>
    </div>
  );
};
