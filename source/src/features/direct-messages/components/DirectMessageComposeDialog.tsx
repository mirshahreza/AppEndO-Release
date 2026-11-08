import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import {
  AppButton,
  CreateEditModalShell,
  FormField,
  UiInput,
  UiTextarea,
} from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../../core/culture/cultureShellKeys';
import {
  directMessagesApi,
  type DirectMessageRecipient,
} from '../../../shared/api/directMessagesApi';
import {
  notifyPersonalInboxChangedWithFallback,
  personalInboxApi,
} from '../../../shared/api/personalInboxApi';
import { useAppBootQuery } from '../../../shared/api/queries/boot';
import { uploadDirectMessageAttachments } from '../../../shared/lib/directMessageAttachmentUpload';
import { getDirectMessageSessionKey } from '../../../shared/lib/directMessageSessionKey';
import { cn } from '../../../lib/utils';

export type DirectMessageComposeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: (threadId: number) => void;
};

type StagedAttachment = {
  id: string;
  fileName: string;
};

export const DirectMessageComposeDialog: React.FC<DirectMessageComposeDialogProps> = ({
  open,
  onOpenChange,
  onSent,
}) => {
  const t = useCultureT();
  const title = resolveCultureLabel(t, 'shell.inbox.directMessage.composeTitle', 'Send a direct message');
  const recipientLabel = resolveCultureLabel(t, 'shell.inbox.directMessage.recipient', 'Recipient');
  const recipientPlaceholder = resolveCultureLabel(
    t,
    'shell.inbox.directMessage.recipientPlaceholder',
    'Search by username…',
  );
  const bodyLabel = resolveCultureLabel(t, 'shell.inbox.directMessage.body', 'Message');
  const sendLabel = resolveCultureLabel(t, 'shell.inbox.directMessage.send', 'Send');
  const sendFailedLabel = resolveCultureLabel(t, 'shell.inbox.directMessage.sendFailed', 'Could not send the message.');
  const attachLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.attachFiles', 'Attach files');
  const messageOrAttachmentLabel = resolveCultureLabel(
    t,
    'shell.inbox.correspondence.messageOrAttachmentRequired',
    'Enter a message or attach at least one file.',
  );
  const removeAttachmentLabel = resolveCultureLabel(t, 'feedback.submit.removeAttachment', 'Remove attachment');
  const uploadFailedLabel = resolveCultureLabel(t, 'feedback.submit.uploadError', 'Upload failed.');

  const bootQuery = useAppBootQuery();
  const allowAttachments = bootQuery.data?.feedbackPolicy?.allowAttachments ?? false;

  const [search, setSearch] = useState('');
  const [recipients, setRecipients] = useState<DirectMessageRecipient[]>([]);
  const [selected, setSelected] = useState<DirectMessageRecipient | null>(null);
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setRecipients([]);
      setSelected(null);
      setBody('');
      setAttachments([]);
      setError(null);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const term = search.trim();
    if (term.length < 1) {
      setRecipients([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void directMessagesApi.searchRecipients(term).then(setRecipients).catch(() => setRecipients([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [open, search]);

  const handlePickFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length || !allowAttachments) {
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const uploaded = await uploadDirectMessageAttachments([...files]);
      setAttachments((current) => [
        ...current,
        ...uploaded.map((file) => ({ id: file.id, fileName: file.fileName })),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : uploadFailedLabel);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [allowAttachments, uploadFailedLabel]);

  const handleSend = useCallback(async () => {
    if (!selected) {
      setError(recipientLabel);
      return;
    }
    const trimmed = body.trim();
    const attachmentIds = attachments.map((row) => row.id);
    if (!trimmed && attachmentIds.length === 0) {
      setError(messageOrAttachmentLabel);
      return;
    }
    setBusy(true);
    setError(null);
    const stagedSessionKey = getDirectMessageSessionKey();
    try {
      const { thread } = await directMessagesApi.createThread({
        recipientUserId: selected.id,
        body: trimmed || undefined,
        attachmentIds: attachmentIds.length ? attachmentIds : undefined,
        stagedSessionKey: attachmentIds.length ? stagedSessionKey : undefined,
      });
      const summary = await personalInboxApi.summary();
      await notifyPersonalInboxChangedWithFallback(summary);
      onOpenChange(false);
      onSent?.(thread.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : sendFailedLabel);
    } finally {
      setBusy(false);
    }
  }, [
    attachments,
    body,
    messageOrAttachmentLabel,
    onOpenChange,
    onSent,
    recipientLabel,
    selected,
    sendFailedLabel,
  ]);

  const canSend = Boolean(selected) && (body.trim().length > 0 || attachments.length > 0);

  if (!open) {
    return null;
  }

  return (
    <CreateEditModalShell
      onClose={() => onOpenChange(false)}
      title={title}
      size="md"
      footer={(
        <>
          <AppButton intent="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </AppButton>
          <AppButton
            intent="primary"
            onClick={() => void handleSend()}
            disabled={busy || isUploading || !canSend}
          >
            {sendLabel}
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <FormField label={recipientLabel}>
          <UiInput
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelected(null);
            }}
            placeholder={recipientPlaceholder}
            disabled={busy}
            aria-label={recipientLabel}
          />
          {selected ? (
            <p className="mt-1 text-xs text-slate-600">
              To:
              {' '}
              <span className="font-medium text-slate-800">{selected.username}</span>
            </p>
          ) : null}
          {!selected && recipients.length > 0 ? (
            <ul className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/80 p-1">
              {recipients.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full rounded-md px-2 py-1.5 text-start text-sm text-slate-800 hover:bg-white',
                    )}
                    onClick={() => {
                      setSelected(row);
                      setSearch(row.username);
                      setRecipients([]);
                    }}
                  >
                    {row.username}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </FormField>
        <FormField label={bodyLabel}>
          <UiTextarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={5}
            disabled={busy}
            aria-label={bodyLabel}
          />
          {allowAttachments ? (
            <div className="mt-2 rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-2.5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="sr-only"
                onChange={(event) => void handlePickFiles(event.target.files)}
              />
              <div className="flex flex-col gap-2">
                <div className="flex justify-end">
                  <AppButton
                    type="button"
                    size="sm"
                    intent="utility"
                    disabled={busy || isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {attachLabel}
                  </AppButton>
                </div>
                {attachments.length > 0 ? (
                  <ul className="flex flex-col gap-1 rounded-md border border-slate-200/80 bg-white p-2">
                    {attachments.map((file) => (
                      <li
                        key={file.id}
                        className="flex items-center justify-between gap-2 text-xs text-slate-700"
                      >
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <Paperclip className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                          <span className="truncate">{file.fileName}</span>
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          aria-label={removeAttachmentLabel}
                          title={removeAttachmentLabel}
                          onClick={() => setAttachments((current) => current.filter((row) => row.id !== file.id))}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}
        </FormField>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      </div>
    </CreateEditModalShell>
  );
};
