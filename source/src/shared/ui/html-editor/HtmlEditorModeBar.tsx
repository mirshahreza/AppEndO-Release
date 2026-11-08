import React from 'react';
import {
  Code2,
  Columns2,
  Copy,
  Eye,
  Maximize2,
  Monitor,
  PencilLine,
  Smartphone,
  Tablet,
  WandSparkles,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { HtmlEditorStats } from '../../lib/htmlEditorStats';
import { AppButton } from '../AppButton';
import type { HtmlEditorMode, HtmlEditorPreviewDevice } from './types';

const MODE_BUTTONS: Array<{
  mode: HtmlEditorMode;
  label: string;
  icon: React.ReactNode;
}> = [
  { mode: 'visual', label: 'Visual', icon: <PencilLine className="h-3.5 w-3.5" /> },
  { mode: 'source', label: 'Source', icon: <Code2 className="h-3.5 w-3.5" /> },
  { mode: 'split', label: 'Split', icon: <Columns2 className="h-3.5 w-3.5" /> },
  { mode: 'preview', label: 'Preview', icon: <Eye className="h-3.5 w-3.5" /> },
];

const DEVICE_BUTTONS: Array<{
  device: HtmlEditorPreviewDevice;
  label: string;
  icon: React.ReactNode;
}> = [
  { device: 'fluid', label: 'Fluid', icon: <Maximize2 className="h-3.5 w-3.5" /> },
  { device: 'desktop', label: 'Desktop', icon: <Monitor className="h-3.5 w-3.5" /> },
  { device: 'tablet', label: 'Tablet', icon: <Tablet className="h-3.5 w-3.5" /> },
  { device: 'mobile', label: 'Mobile', icon: <Smartphone className="h-3.5 w-3.5" /> },
];

export type HtmlEditorModeBarProps = {
  mode: HtmlEditorMode;
  onModeChange: (mode: HtmlEditorMode) => void;
  previewDevice: HtmlEditorPreviewDevice;
  onPreviewDeviceChange: (device: HtmlEditorPreviewDevice) => void;
  stats: HtmlEditorStats;
  readOnly?: boolean;
  formatting?: boolean;
  showStats?: boolean;
  onFormat?: () => void;
  onCopy?: () => void;
  className?: string;
};

export const HtmlEditorModeBar: React.FC<HtmlEditorModeBarProps> = ({
  mode,
  onModeChange,
  previewDevice,
  onPreviewDeviceChange,
  stats,
  readOnly = false,
  formatting = false,
  showStats = true,
  onFormat,
  onCopy,
  className,
}) => {
  const showDeviceControls = mode === 'preview' || mode === 'split';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-2 py-1.5',
        className,
      )}
      data-html-editor-mode-bar="true"
    >
      <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Editor mode">
        {MODE_BUTTONS.map((item) => (
          <AppButton
            key={item.mode}
            type="button"
            intent={mode === item.mode ? 'toggle-on' : 'toggle-off'}
            size="sm"
            aria-label={item.label}
            title={item.label}
            onClick={() => onModeChange(item.mode)}
          >
            {item.icon}
            {item.label}
          </AppButton>
        ))}
      </div>

      <span className="mx-0.5 hidden h-5 w-px shrink-0 bg-slate-200 sm:block" aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-1">
        {!readOnly && onFormat ? (
          <AppButton
            type="button"
            intent="utility"
            size="sm"
            disabled={formatting || (mode !== 'source' && mode !== 'split')}
            title="Format HTML (Ctrl+Shift+F)"
            aria-label="Format HTML"
            onClick={onFormat}
          >
            <WandSparkles className="h-3.5 w-3.5" />
            Format
          </AppButton>
        ) : null}
        {onCopy ? (
          <AppButton
            type="button"
            intent="utility"
            size="sm"
            title="Copy HTML"
            aria-label="Copy HTML"
            onClick={onCopy}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </AppButton>
        ) : null}
      </div>

      {showDeviceControls ? (
        <>
          <span className="mx-0.5 hidden h-5 w-px shrink-0 bg-slate-200 sm:block" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Preview width">
            {DEVICE_BUTTONS.map((item) => (
              <AppButton
                key={item.device}
                type="button"
                intent={previewDevice === item.device ? 'toggle-on' : 'toggle-off'}
                size="icon-sm"
                className="h-7 w-7 min-h-7 min-w-7 p-0"
                aria-label={item.label}
                title={item.label}
                onClick={() => onPreviewDeviceChange(item.device)}
              >
                {item.icon}
              </AppButton>
            ))}
          </div>
        </>
      ) : null}

      {showStats ? (
        <div className="ms-auto flex items-center gap-2 ps-[4px] text-[11px] tabular-nums text-slate-500">
          <span title="Characters including markup">{stats.characters} chars</span>
          <span aria-hidden="true">·</span>
          <span title="Plaintext words">{stats.words} words</span>
        </div>
      ) : null}
    </div>
  );
};
