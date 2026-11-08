import React from 'react';
import { Paperclip, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

export type FeedbackAttachmentBadgeTone = 'default' | 'staff' | 'internal';

const BADGE_TONE_CLASS: Record<FeedbackAttachmentBadgeTone, string> = {
  default: 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100',
  staff: 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:border-indigo-300 hover:bg-indigo-100',
  internal: 'border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100',
};

export type FeedbackAttachmentBadgeProps = {
  fileName: string;
  href?: string;
  tone?: FeedbackAttachmentBadgeTone;
  onRemove?: () => void;
  removeAriaLabel?: string;
};

export const FeedbackAttachmentBadge: React.FC<FeedbackAttachmentBadgeProps> = ({
  fileName,
  href,
  tone = 'default',
  onRemove,
  removeAriaLabel,
}) => {
  const className = cn(
    'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight transition-colors',
    BADGE_TONE_CLASS[tone],
    href ? 'hover:underline' : null,
  );

  const content = (
    <>
      <Paperclip className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      <span className="max-w-[11rem] truncate" title={fileName}>
        {fileName}
      </span>
      {onRemove ? (
        <button
          type="button"
          className="-me-0.5 rounded-full p-0.5 text-current/50 transition-colors hover:bg-black/5 hover:text-rose-600"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove();
          }}
          aria-label={removeAriaLabel ?? 'Remove attachment'}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className} title={fileName}>
        {content}
      </a>
    );
  }

  return (
    <span className={className} title={fileName}>
      {content}
    </span>
  );
};
