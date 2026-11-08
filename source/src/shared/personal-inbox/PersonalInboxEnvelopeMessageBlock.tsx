import React from 'react';
import { MarkdownPreview } from '../ui';
import type {
  PersonalInboxEnvelopeMessage,
  PersonalInboxEnvelopeMessageRole,
} from '../api/contracts/personal-inbox/envelopeTypes';
import { cn } from '../../lib/utils';

export type PersonalInboxEnvelopeMessageBlockProps = {
  messages: PersonalInboxEnvelopeMessage[];
  className?: string;
};

const messageSurfaceClass = (role: PersonalInboxEnvelopeMessageRole): string => {
  switch (role) {
    case 'internal':
      return 'border-amber-200/90 bg-amber-50/80';
    case 'staff':
      return 'border-indigo-200/90 bg-indigo-50/60';
    case 'submitter':
      return 'border-slate-200 bg-white';
    case 'system':
      return 'border-slate-200 bg-slate-50/70';
    default:
      return 'border-slate-200 bg-white';
  }
};

/** Renders envelope messages for inbox detail surfaces (full-width friendly). */
export const PersonalInboxEnvelopeMessageBlock: React.FC<PersonalInboxEnvelopeMessageBlockProps> = ({
  messages,
  className,
}) => {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-4 text-sm text-slate-700', className)}>
      {messages.map((message) => (
        <article
          key={message.id}
          className={cn(
            'w-full min-w-0 rounded-lg border px-4 py-3 shadow-sm shadow-slate-200/40',
            messageSurfaceClass(message.role),
          )}
        >
          <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="text-sm font-semibold text-slate-800">{message.authorDisplayName ?? '—'}</span>
            <time dateTime={message.createdAt} className="font-mono text-[11px] tabular-nums text-slate-500">
              {message.createdAt.slice(0, 19).replace('T', ' ')}
            </time>
          </header>
          {message.body.trim() ? (
            <MarkdownPreview
              content={message.body}
              dir="auto"
              tone="user"
              contentClassName="text-sm leading-relaxed text-slate-800"
            />
          ) : null}
          {message.attachments.length > 0 ? (
            <ul
              className={cn(
                'mt-3 flex flex-wrap gap-2 text-xs text-slate-600',
                message.body.trim() ? 'border-t border-slate-200/70 pt-3' : '',
              )}
            >
              {message.attachments.map((file) => (
                <li
                  key={file.id}
                  className="max-w-full truncate rounded-md bg-white/80 px-2 py-1 ring-1 ring-inset ring-slate-200/80"
                >
                  {file.fileName}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  );
};
