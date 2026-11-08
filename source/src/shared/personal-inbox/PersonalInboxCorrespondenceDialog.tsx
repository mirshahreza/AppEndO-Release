import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import type {
  PersonalInboxItem,
  PersonalInboxPresetTitleOption,
  PersonalInboxTagOption,
} from '../api/contracts/personal-inbox/types';
import {
  AppButton,
  CreateEditModalShell,
  FormField,
  UiInput,
  UiTextarea,
} from '../ui';
import { useCultureT } from '../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../core/culture/cultureShellKeys';
import { directMessagesApi, type DirectMessageRecipient } from '../api/directMessagesApi';
import {
  notifyPersonalInboxChangedWithFallback,
  personalInboxApi,
} from '../api/personalInboxApi';
import { useAppBootQuery } from '../api/queries/boot';
import { uploadDirectMessageAttachments } from '../lib/directMessageAttachmentUpload';
import { uploadFeedbackAttachments } from '../lib/feedbackAttachmentUpload';
import { getDirectMessageSessionKey } from '../lib/directMessageSessionKey';
import { getFeedbackSessionKey } from '../lib/feedbackSessionKey';
import { cn } from '../../lib/utils';

type StagedCorrespondenceAttachment = {
  id: string;
  fileName: string;
};

export type PersonalInboxCorrespondenceMode = 'reply' | 'forward';

export type PersonalInboxCorrespondenceDialogProps = {
  open: boolean;
  mode: PersonalInboxCorrespondenceMode;
  item: PersonalInboxItem | null;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

export const PersonalInboxCorrespondenceDialog: React.FC<PersonalInboxCorrespondenceDialogProps> = ({
  open,
  mode,
  item,
  onOpenChange,
  onCompleted,
}) => {
  const t = useCultureT();
  const title = mode === 'reply'
    ? resolveCultureLabel(t, 'shell.inbox.correspondence.replyTitle', 'Reply')
    : resolveCultureLabel(t, 'shell.inbox.correspondence.forwardTitle', 'Forward');
  const bodyLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.body', 'Message');
  const noteLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.forwardNote', 'Optional note');
  const recipientLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.recipient', 'Recipient');
  const recipientPlaceholder = resolveCultureLabel(
    t,
    'shell.inbox.directMessage.recipientPlaceholder',
    'Search by username…',
  );
  const sendLabel = mode === 'reply'
    ? resolveCultureLabel(t, 'shell.inbox.correspondence.sendReply', 'Send reply')
    : resolveCultureLabel(t, 'shell.inbox.correspondence.sendForward', 'Forward copy');
  const failedLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.failed', 'Action failed.');
  const keepCopyHint = resolveCultureLabel(
    t,
    'shell.inbox.correspondence.forwardKeepCopyHint',
    'A copy stays in your inbox. The recipient gets a new notification or message.',
  );
  const attachLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.attachFiles', 'Attach files');
  const removeAttachmentLabel = resolveCultureLabel(t, 'feedback.submit.removeAttachment', 'Remove attachment');
  const uploadFailedLabel = resolveCultureLabel(t, 'feedback.submit.uploadError', 'Upload failed.');
  const messageOrAttachmentLabel = resolveCultureLabel(
    t,
    'shell.inbox.correspondence.messageOrAttachmentRequired',
    'Enter a message or attach at least one file.',
  );
  const messageBundleLabel = resolveCultureLabel(
    t,
    'shell.inbox.correspondence.messageBundle',
    'Message and attachments',
  );
  const presetSectionLabel = resolveCultureLabel(
    t,
    'shell.inbox.correspondence.presetTitles',
    'Preset titles',
  );
  const presetTagFilterAllLabel = resolveCultureLabel(
    t,
    'shell.inbox.correspondence.presetTagFilterAll',
    'All tags',
  );

  const bootQuery = useAppBootQuery();
  const allowAttachments = bootQuery.data?.feedbackPolicy?.allowAttachments ?? false;

  const [body, setBody] = useState('');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [recipients, setRecipients] = useState<DirectMessageRecipient[]>([]);
  const [selected, setSelected] = useState<DirectMessageRecipient | null>(null);
  const [attachments, setAttachments] = useState<StagedCorrespondenceAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [presetTitles, setPresetTitles] = useState<PersonalInboxPresetTitleOption[]>([]);
  const [inboxTags, setInboxTags] = useState<PersonalInboxTagOption[]>([]);
  const [tagFilterId, setTagFilterId] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');

  const canAttachFiles = allowAttachments && item != null && (
    mode === 'forward'
    || item.kind === 'feedback'
    || (mode === 'reply' && item.kind === 'direct_message')
  );

  const tagById = useMemo(
    () => new Map(inboxTags.map((tag) => [tag.id, tag])),
    [inboxTags],
  );

  const visiblePresets = useMemo(() => {
    if (!tagFilterId) {
      return presetTitles;
    }
    return presetTitles.filter((preset) => preset.tagIds.includes(tagFilterId));
  }, [presetTitles, tagFilterId]);

  const selectedPreset = useMemo(
    () => presetTitles.find((preset) => preset.id === selectedPresetId) ?? null,
    [presetTitles, selectedPresetId],
  );

  const applyPreset = useCallback((preset: PersonalInboxPresetTitleOption) => {
    setSelectedPresetId(preset.id);
    const text = preset.defaultBody ?? '';
    if (mode === 'reply') {
      setBody(text);
    } else {
      setNote(text);
    }
  }, [mode]);

  useEffect(() => {
    if (!open) {
      setBody('');
      setNote('');
      setSearch('');
      setRecipients([]);
      setSelected(null);
      setAttachments([]);
      setPresetTitles([]);
      setInboxTags([]);
      setTagFilterId('');
      setSelectedPresetId('');
      setError(null);
      return;
    }
    void personalInboxApi.correspondenceVocab()
      .then(({ presetTitles: presets, tags }) => {
        setPresetTitles(presets);
        setInboxTags(tags);
      })
      .catch(() => {
        setPresetTitles([]);
        setInboxTags([]);
      });
  }, [open]);

  useEffect(() => {
    if (!open || mode !== 'forward') {
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
  }, [mode, open, search]);

  const handlePickFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length || !canAttachFiles) {
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const uploaded = item?.kind === 'direct_message' && mode === 'reply'
        ? await uploadDirectMessageAttachments([...files])
        : await uploadFeedbackAttachments([...files]);
      setAttachments((current) => [
        ...current,
        ...uploaded.map((row) => ({ id: row.id, fileName: row.fileName })),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : uploadFailedLabel);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [canAttachFiles, item?.kind, mode, uploadFailedLabel]);

  const handleSubmit = useCallback(async () => {
    if (!item) {
      return;
    }
    if (mode === 'forward' && !selected) {
      setError(recipientLabel);
      return;
    }
    const message = body.trim();
    const attachmentIds = attachments.map((row) => row.id);
    if (mode === 'reply' && !message && attachmentIds.length === 0) {
      setError(messageOrAttachmentLabel);
      return;
    }
    setBusy(true);
    setError(null);
    const stagedSessionKey = mode === 'reply' && item.kind === 'direct_message'
      ? getDirectMessageSessionKey()
      : getFeedbackSessionKey();
    try {
      if (mode === 'reply') {
        const { summary } = await personalInboxApi.replyToItem(item.id, message, {
          stagedSessionKey,
          attachmentIds,
        });
        await notifyPersonalInboxChangedWithFallback(summary);
      } else {
        const { summary } = await personalInboxApi.forwardItem(
          item.id,
          selected!.id,
          note.trim() || message || undefined,
          { stagedSessionKey, attachmentIds },
        );
        await notifyPersonalInboxChangedWithFallback(summary);
      }
      onOpenChange(false);
      onCompleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : failedLabel);
    } finally {
      setBusy(false);
    }
  }, [
    attachments,
    body,
    failedLabel,
    item,
    messageOrAttachmentLabel,
    mode,
    note,
    onCompleted,
    onOpenChange,
    recipientLabel,
    selected,
  ]);

  if (!open || !item) {
    return null;
  }

  return (
    <CreateEditModalShell
      onClose={() => onOpenChange(false)}
      title={title}
      subtitle={item.title}
      size="md"
      footer={(
        <>
          <AppButton type="button" intent="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {resolveCultureLabel(t, 'common.cancel', 'Cancel')}
          </AppButton>
          <AppButton
            type="button"
            intent="primary"
            disabled={busy || isUploading}
            onClick={() => void handleSubmit()}
          >
            {sendLabel}
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-3">
        {mode === 'forward' ? (
          <>
            <p className="m-0 text-xs text-slate-600">{keepCopyHint}</p>
            <FormField label={recipientLabel}>
              <UiInput
                size="sm"
                aiAssist={false}
                autoDir={false}
                placeholder={recipientPlaceholder}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSelected(null);
                }}
              />
            </FormField>
            {recipients.length > 0 && !selected ? (
              <ul className="max-h-32 overflow-y-auto rounded-md border border-slate-200 p-1">
                {recipients.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={cn(
                        'w-full rounded px-2 py-1.5 text-start text-sm text-slate-800 hover:bg-slate-50',
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
          </>
        ) : null}
        {presetTitles.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <p className="m-0 text-xs font-semibold text-slate-700">{presetSectionLabel}</p>
            {inboxTags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    !tagFilterId
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100',
                  )}
                  onClick={() => setTagFilterId('')}
                >
                  {presetTagFilterAllLabel}
                </button>
                {inboxTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      tagFilterId === tag.id ? 'text-white' : 'bg-white hover:bg-slate-100',
                    )}
                    style={
                      tagFilterId === tag.id
                        ? { borderColor: tag.color ?? '#475569', backgroundColor: tag.color ?? '#475569' }
                        : { borderColor: tag.color ?? '#cbd5e1', color: tag.color ?? '#475569' }
                    }
                    onClick={() => setTagFilterId(tag.id)}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {visiblePresets.map((preset) => (
                <AppButton
                  key={preset.id}
                  type="button"
                  size="sm"
                  intent={selectedPresetId === preset.id ? 'primary' : 'utility'}
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </AppButton>
              ))}
            </div>
            {selectedPreset && selectedPreset.tagIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1 border-t border-slate-200/80 pt-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {resolveCultureLabel(t, 'shell.inbox.correspondence.presetLinkedTags', 'Tags')}
                </span>
                {selectedPreset.tagIds.map((tagId) => {
                  const tag = tagById.get(tagId);
                  if (!tag) {
                    return null;
                  }
                  return (
                    <span
                      key={tagId}
                      className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                      style={{ borderColor: tag.color ?? '#94a3b8', color: tag.color ?? '#475569' }}
                    >
                      {tag.label}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
        <div
          className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
          aria-label={messageBundleLabel}
        >
          <div className="border-b border-slate-100 bg-slate-50/90 px-3 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {messageBundleLabel}
            </span>
          </div>
          <div className="flex flex-col">
            {mode === 'reply' ? (
              <FormField label={bodyLabel} className="mb-0 border-0 px-3 pt-3">
                <UiTextarea
                  size="sm"
                  rows={4}
                  className="border-slate-200/80"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              </FormField>
            ) : (
              <FormField label={noteLabel} className="mb-0 border-0 px-3 pt-3">
                <UiTextarea
                  size="sm"
                  rows={3}
                  className="border-slate-200/80"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </FormField>
            )}
            {canAttachFiles ? (
              <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-2.5">
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
          </div>
        </div>
        {error ? <p className="m-0 text-xs text-rose-600">{error}</p> : null}
      </div>
    </CreateEditModalShell>
  );
};
