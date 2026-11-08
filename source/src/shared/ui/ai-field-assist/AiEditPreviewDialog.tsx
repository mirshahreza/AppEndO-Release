import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { formatUnifiedDiffPreview } from '../../lib/changeSetPreview';
import { getChatTextDirection } from '../../lib/chatTextDirection';
import { ConfirmDialogShell } from '../ConfirmDialogShell';

export type AiEditPreviewDialogProps = {
  open: boolean;
  title: string;
  beforeText: string;
  afterText: string;
  isApplying?: boolean;
  error?: string;
  onClose: () => void;
  onApply: () => void;
};

const renderDiffLine = (line: string, index: number) => {
  const toneClass = line.startsWith('+')
    ? 'text-emerald-700 bg-emerald-50'
    : line.startsWith('-')
      ? 'text-rose-700 bg-rose-50'
      : 'text-slate-600';

  return (
    <div key={`${index}-${line}`} className={cn('px-2 py-0.5 font-mono text-[11px] leading-relaxed', toneClass)}>
      {line}
    </div>
  );
};

export const AiEditPreviewDialog: React.FC<AiEditPreviewDialogProps> = ({
  open,
  title,
  beforeText,
  afterText,
  isApplying = false,
  error,
  onClose,
  onApply,
}) => {
  const beforeDir = React.useMemo(() => getChatTextDirection(beforeText), [beforeText]);
  const afterDir = React.useMemo(() => getChatTextDirection(afterText), [afterText]);
  const diffPreview = React.useMemo(
    () => (beforeText === afterText ? '' : formatUnifiedDiffPreview(beforeText, afterText)),
    [afterText, beforeText],
  );
  const diffDir = React.useMemo(() => getChatTextDirection(diffPreview), [diffPreview]);
  const canApply = Boolean(afterText.trim()) && beforeText !== afterText && !error;

  return (
    <ConfirmDialogShell
      open={open}
      title={(
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600" aria-hidden />
          {title}
        </span>
      )}
      size="lg"
      onClose={onClose}
      onConfirm={onApply}
      confirmIntent="confirm"
      confirmLabel="Apply"
      cancelLabel="Cancel"
      isConfirming={isApplying}
      confirmingLabel="Applying…"
      confirmDisabled={!canApply}
      error={error}
      bodyClassName="flex flex-col gap-3"
    >
      {diffPreview ? (
        <div className="flex flex-col gap-[2px]">
          <span className="ps-[4px] text-[11px] font-semibold uppercase tracking-wide text-slate-500">Changes</span>
          <pre
            dir={diffDir}
            className="max-h-40 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-1 text-start"
          >
            {diffPreview.split('\n').map(renderDiffLine)}
          </pre>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-[2px]">
          <span className="ps-[4px] text-[11px] font-semibold uppercase tracking-wide text-slate-500">Before</span>
          <pre
            dir={beforeDir}
            className="max-h-48 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs whitespace-pre-wrap text-slate-700"
          >
            {beforeText || '—'}
          </pre>
        </div>
        <div className="flex flex-col gap-[2px]">
          <span className="ps-[4px] text-[11px] font-semibold uppercase tracking-wide text-slate-500">After</span>
          <pre
            dir={afterDir}
            className="max-h-48 overflow-auto rounded-md border border-emerald-200 bg-emerald-50/50 p-3 text-xs whitespace-pre-wrap text-slate-800"
          >
            {afterText || '—'}
          </pre>
        </div>
      </div>
    </ConfirmDialogShell>
  );
};
