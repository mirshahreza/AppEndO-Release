import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Check } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { AiChatSessionAdminDetail } from '@/src/shared/api/contracts/ai/chatHistoryTypes';
import { AppButton } from '@/src/shared/ui';
import { CreateEditModalShell } from '@/src/shared/ui/CreateEditModalShell';
import { ChatMessageAttachments } from '@/src/shared/ui/ChatMessageAttachments';
import { ChatMessageContent } from '@/src/shared/ui/ChatMessageContent';
import { collectChatImageGallery } from '@/src/shared/ui/chatImageGallery';
import { formatChatSessionTokenTotals, formatDateYmd } from '../utils';

export type ChatHistoryViewModalProps = {
  sessionId: number | null;
  session: AiChatSessionAdminDetail | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
};

const roleStyles: Record<string, string> = {
  user: 'bg-indigo-50 border-indigo-100 text-indigo-900',
  assistant: 'bg-slate-50 border-slate-200 text-slate-800',
  system: 'bg-amber-50 border-amber-100 text-amber-900',
};

const MESSAGE_ESTIMATE_PX = 96;

type VirtualizedMessageListProps = {
  messages: AiChatSessionAdminDetail['messages'];
};

const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({ messages }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const galleryImages = useMemo(() => collectChatImageGallery(messages), [messages]);
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => MESSAGE_ESTIMATE_PX,
    overscan: 8,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
    : 0;

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/40 p-3">
      <div style={{ paddingTop, paddingBottom }}>
        {virtualRows.map((virtualRow) => {
          const message = messages[virtualRow.index];
          return (
            <div
              key={`${message.role}-${virtualRow.index}`}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              className={cn(
                'mb-3 rounded-lg border px-3 py-2 text-sm whitespace-pre-wrap break-words',
                roleStyles[message.role] ?? roleStyles.assistant,
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide opacity-70">
                <span>{message.role}</span>
                {message.role === 'assistant' && message.tokenUsage ? (
                  <span className="font-mono normal-case tracking-normal">
                    In {message.tokenUsage.inputTokens.toLocaleString()}
                    {' · '}
                    Out {message.tokenUsage.outputTokens.toLocaleString()}
                  </span>
                ) : null}
              </div>
              {message.attachments && message.attachments.length > 0 ? (
                <ChatMessageAttachments
                  attachments={message.attachments}
                  variant={message.role === 'user' ? 'user' : 'assistant'}
                  galleryImages={galleryImages}
                />
              ) : null}
              {message.content || message.attachments?.length ? (
                <ChatMessageContent
                  content={message.content}
                  attachments={message.attachments}
                  tone={message.role === 'user' ? 'user' : 'assistant'}
                  galleryImages={galleryImages}
                />
              ) : !message.attachments?.length ? (
                <span className="text-slate-400">(empty)</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ChatHistoryViewModal: React.FC<ChatHistoryViewModalProps> = ({
  sessionId,
  session,
  isLoading,
  error,
  onClose,
}) => {
  if (sessionId === null) return null;

  return (
    <CreateEditModalShell
      size="maximized"
      bodyOuterClassName="flex min-h-0 flex-1 flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-3"
      title={session?.title ?? `Chat Session #${sessionId}`}
      onClose={onClose}
      footer={(
        <AppButton intent="cancel" onClick={onClose}>Close</AppButton>
      )}
    >
      {isLoading ? (
        <div className="text-sm text-slate-500">Loading chat session...</div>
      ) : error ? (
        <div className="text-sm font-semibold text-rose-600">{error}</div>
      ) : session ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex shrink-0 flex-wrap gap-2 text-xs">
            <span className="rounded border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-cyan-700">
              User: {session.username}
            </span>
            <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-700">
              Model: {session.modelId ?? '-'}
            </span>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
              Messages: {session.messageCount}
            </span>
            <span className="rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-violet-700">
              Tokens (est.): {formatChatSessionTokenTotals(session)}
            </span>
            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
              Created: {formatDateYmd(session.createdAt)}
            </span>
            <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
              Updated: {formatDateYmd(session.updatedAt)}
            </span>
            {session.userDeleted ? (
              <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-500">
                Deleted by user
                <Check className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              </span>
            ) : null}
          </div>

          {session.messages.length === 0 ? (
            <div className="text-sm text-slate-500">No messages in this session.</div>
          ) : (
            <VirtualizedMessageList messages={session.messages} />
          )}
        </div>
      ) : null}
    </CreateEditModalShell>
  );
};
