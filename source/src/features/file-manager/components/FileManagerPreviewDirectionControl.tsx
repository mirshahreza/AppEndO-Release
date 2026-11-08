import React from 'react';
import { cn } from '../../../lib/utils';
import { AppButton } from '../../../shared/ui';
import type { FileManagerPreviewDirectionOverride } from '../textPreview';

type FileManagerPreviewDirectionControlProps = {
  value: FileManagerPreviewDirectionOverride;
  onChange: (value: FileManagerPreviewDirectionOverride) => void;
  className?: string;
};

const OPTIONS: Array<{ value: FileManagerPreviewDirectionOverride; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'ltr', label: 'LTR' },
  { value: 'rtl', label: 'RTL' },
];

export const FileManagerPreviewDirectionControl: React.FC<FileManagerPreviewDirectionControlProps> = ({
  value,
  onChange,
  className,
}) => (
  <div
    className={cn('inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5', className)}
    role="group"
    aria-label="Preview text direction"
  >
    {OPTIONS.map((option) => (
      <AppButton
        key={option.value}
        type="button"
        intent={value === option.value ? 'toggle-on' : 'toggle-off'}
        size="compact"
        className="!h-6 !min-h-6 px-2 text-[10px] font-semibold"
        aria-pressed={value === option.value}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </AppButton>
    ))}
  </div>
);
