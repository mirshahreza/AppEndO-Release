import React from 'react';
import { cn } from '../../lib/utils';
import { AppButton } from './AppButton';

export type UiDocumentViewerKind = 'pdf' | 'office';

export type UiDocumentViewerProps = {
  src?: string;
  title?: string;
  kind?: UiDocumentViewerKind;
  height?: number;
  className?: string;
};

/** In-app document preview — PDF in a frame, Office as open/download chrome. */
export const UiDocumentViewer: React.FC<UiDocumentViewerProps> = ({
  src,
  title = 'Document',
  kind = 'pdf',
  height = 320,
  className,
}) => {
  const href = src?.trim() ?? '';
  const canFrame = kind === 'pdf' && href.length > 0;

  return (
    <div className={cn('w-full max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{title}</p>
          <p className="text-[11px] uppercase tracking-wide text-indigo-600">{kind === 'office' ? 'Office' : 'PDF'}</p>
        </div>
        {href ? (
          <AppButton type="button" intent="utility" size="sm" onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}>
            Open
          </AppButton>
        ) : null}
      </div>
      {canFrame ? (
        <iframe
          src={href}
          title={title}
          className="w-full border-0 bg-slate-50"
          style={{ height }}
        />
      ) : (
        <div className="flex items-center justify-center bg-slate-50 px-4 text-sm text-slate-500" style={{ height }}>
          {href
            ? 'Office files open in a new tab. In-app preview is available for PDF URLs.'
            : 'Set a document URL to preview a PDF here.'}
        </div>
      )}
    </div>
  );
};
