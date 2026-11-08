import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquarePlus, Monitor, Paperclip, Send } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useCulture, useCultureT } from '../../../core/culture/CultureContext';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { useOptionalPlatformMount } from '../../../app/platform/PlatformMountContext';
import { cn } from '../../../lib/utils';
import { isImageFile } from '../../../shared/lib/fileFieldUtils';
import { markdownToolbarProps } from '../../../shared/lib/markdownEditorToolbar';
import {
  AppButton,
  DesignerMarkdownEditorField,
  FloatingPanelShell,
  ImageEditorSaveDialog,
  UiCombobox,
  UiInput,
} from '../../../shared/ui';
import { feedbackApi, FeedbackApiError } from '../api/feedbackApi';
import { SessionExpiredError } from '../../../shared/api/authSession';
import { useFeedbackPolicy } from '../hooks/useFeedbackPolicy';
import { resolveFeedbackSubmitContext } from '../feedbackSubmitContext';
import { resolveFeedbackSubjectLabel } from '../feedbackSubjectLabel';
import {
  FeedbackSubmitAttachmentsPreview,
  type FeedbackStagedAttachment,
} from './FeedbackSubmitAttachmentsPreview';
import {
  captureFeedbackScreenshotFile,
  FeedbackScreenshotError,
} from '../lib/captureFeedbackScreenshot';

const revokeAttachmentPreview = (previewUrl?: string) => {
  if (previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl);
  }
};

const revokeAllAttachmentPreviews = (items: FeedbackStagedAttachment[]) => {
  items.forEach((item) => revokeAttachmentPreview(item.previewUrl));
};

const FEEDBACK_PANEL_BOUNDS = { minWidth: 420, maxWidth: 880, minHeight: 400, maximizeInset: 24 };

/** Attachment strip — neutral chrome, matches shell body. */
const FEEDBACK_ATTACH_FOOTER_CLASS = 'border-t border-b border-slate-200/80 bg-white';

export type FeedbackSubmitDialogProps = {
  open: boolean;
  onClose: () => void;
  pageKey?: string | null;
  onSubmitted?: () => void;
};

/**
 * Split out of FeedbackSubmitDialog.tsx and lazy-loaded from there — floating submit panel
 * (and its shared/ui + lucide-react dependencies), only mounted once a user opens it.
 * FeedbackEntryButton (the trigger, kept in the original file) is statically imported by
 * AppShellHeader, which renders on every authenticated page.
 */
export const FeedbackSubmitDialog: React.FC<FeedbackSubmitDialogProps> = ({
  open,
  onClose,
  pageKey,
  onSubmitted,
}) => {
  const t = useCultureT();
  const { direction } = useCulture();
  const { currentUser } = useAuth();
  const portal = useOptionalPortal();
  const pathPrefix = useOptionalPlatformMount()?.pathPrefix ?? '';
  const { policy } = useFeedbackPolicy(pageKey);

  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [attachments, setAttachments] = useState<FeedbackStagedAttachment[]>([]);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [hidePanelForCapture, setHidePanelForCapture] = useState(false);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [imageEditorSrc, setImageEditorSrc] = useState<string | null>(null);
  const [imageEditorFileName, setImageEditorFileName] = useState('image.jpg');
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const attachFileInputRef = useRef<HTMLInputElement>(null);
  const attachBusy = isUploading || isCapturingScreenshot;

  const feedbackSource = useMemo(
    () => resolveFeedbackSubmitContext({ pageKey, pathPrefix }),
    [pageKey, pathPrefix],
  );

  const isAnonymous = !currentUser;
  const showContact = isAnonymous && policy.showContactFieldsForAnonymous;
  const canSubmitAnonymous = policy.allowAnonymous;
  const canSubmitAuth = policy.allowAuthenticated && Boolean(currentUser);

  const subjectItems = useMemo(
    () => policy.subjects.map((option) => ({
      id: option.id,
      textValue: resolveFeedbackSubjectLabel(t, option.id, option.label),
    })),
    [policy.subjects, t],
  );

  const subjectInvalid = !subjectId.trim();
  const titleInvalid = !title.trim();

  const resetForm = useCallback(() => {
    setSubjectId('');
    setTitle('');
    setBody('');
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setAttachments((current) => {
      revokeAllAttachmentPreviews(current);
      return [];
    });
    setError(null);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((current) => {
      const removed = current.find((item) => item.id === id);
      revokeAttachmentPreview(removed?.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  useEffect(
    () => () => revokeAllAttachmentPreviews(attachmentsRef.current),
    [],
  );

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const stageUploadedFiles = useCallback(async (files: File[]) => {
    if (!files.length || !policy.allowAttachments) {
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const uploaded = await feedbackApi.uploadAttachments(files);
      const staged: FeedbackStagedAttachment[] = uploaded.map((dto, index) => ({
        ...dto,
        previewUrl: isImageFile(files[index]) ? URL.createObjectURL(files[index]) : undefined,
      }));
      setAttachments((current) => [...current, ...staged]);
    } catch (err) {
      setError(err instanceof FeedbackApiError ? err.message : t('feedback.submit.uploadError'));
    } finally {
      setIsUploading(false);
    }
  }, [policy.allowAttachments, t]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    await stageUploadedFiles(files);
  };

  const handleEditAttachmentImage = useCallback((id: string) => {
    const item = attachmentsRef.current.find((entry) => entry.id === id);
    if (!item?.previewUrl) {
      return;
    }
    setEditingAttachmentId(id);
    setImageEditorSrc(item.previewUrl);
    setImageEditorFileName(item.fileName);
    setImageEditorOpen(true);
  }, []);

  const handleImageEditorClose = useCallback(() => {
    setImageEditorOpen(false);
    setEditingAttachmentId(null);
    setImageEditorSrc(null);
  }, []);

  const handleImageEditorSave = useCallback(async (file: File) => {
    const replaceId = editingAttachmentId;
    if (!replaceId) {
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const uploaded = await feedbackApi.uploadAttachments([file]);
      const dto = uploaded[0];
      if (!dto) {
        throw new FeedbackApiError({ success: false, code: 'FEEDBACK_UPLOAD_EMPTY', error: 'Upload failed.' });
      }
      setAttachments((current) => current.map((item) => {
        if (item.id !== replaceId) {
          return item;
        }
        revokeAttachmentPreview(item.previewUrl);
        return {
          ...dto,
          previewUrl: URL.createObjectURL(file),
        };
      }));
      setImageEditorOpen(false);
      setEditingAttachmentId(null);
      setImageEditorSrc(null);
    } catch (err) {
      setError(err instanceof FeedbackApiError ? err.message : t('feedback.submit.editImageError'));
      throw err instanceof Error ? err : new Error(t('feedback.submit.editImageError'));
    } finally {
      setIsUploading(false);
    }
  }, [editingAttachmentId, t]);

  const handleScreenshot = async () => {
    if (!policy.allowAttachments || isUploading || isCapturingScreenshot) {
      return;
    }
    setIsCapturingScreenshot(true);
    setError(null);
    try {
      const file = await captureFeedbackScreenshotFile({
        beforeFrameCapture: async () => {
          setHidePanelForCapture(true);
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          });
        },
      });
      await stageUploadedFiles([file]);
    } catch (err) {
      if (err instanceof FeedbackScreenshotError) {
        if (err.code === 'cancelled') {
          return;
        }
        if (err.code === 'unsupported') {
          setError(t('feedback.submit.screenshotUnsupported'));
        } else {
          setError(t('feedback.submit.screenshotError'));
        }
      } else {
        setError(t('feedback.submit.screenshotError'));
      }
    } finally {
      setHidePanelForCapture(false);
      setIsCapturingScreenshot(false);
    }
  };

  const handleSubmit = async () => {
    if (!policy.enabled) {
      setError(t('feedback.submit.error'));
      return;
    }
    if (!canSubmitAuth && !canSubmitAnonymous) {
      setError(t('feedback.submit.notAllowed'));
      return;
    }
    if (!subjectId.trim()) {
      setError(t('feedback.submit.subjectRequired'));
      return;
    }
    if (!title.trim()) {
      setError(t('feedback.submit.titleRequired'));
      return;
    }
    if (!body.trim()) {
      setError(t('feedback.submit.messageRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const source = resolveFeedbackSubmitContext({ pageKey, pathPrefix });
      await feedbackApi.submit({
        subjectId,
        title: title.trim(),
        body: body.trim(),
        attachmentIds: attachments.map((item) => item.id),
        anonymousContact: showContact
          ? {
              name: contactName.trim() || undefined,
              email: contactEmail.trim() || undefined,
              phone: contactPhone.trim() || undefined,
            }
          : undefined,
        portalSlug: portal?.portalSlug ?? null,
        pageKey: source.pageKey,
        route: source.route,
        metadata: source.metadata,
        honeypot: '',
      });
      onSubmitted?.();
      handleClose();
    } catch (err) {
      if (err instanceof FeedbackApiError) {
        setError(err.message || t('feedback.submit.error'));
      } else if (err instanceof SessionExpiredError) {
        setError(t('feedback.submit.sessionExpired'));
      } else {
        setError(t('feedback.submit.error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <>
    <FloatingPanelShell
      open={open}
      onClose={handleClose}
      title={t('feedback.submit.title')}
      titleIcon={<MessageSquarePlus className="h-4 w-4 text-primary-600" />}
      showStudioToolsMenu={false}
      showFeedbackButton={false}
      bounds={FEEDBACK_PANEL_BOUNDS}
      defaultWidth={680}
      defaultHeight={520}
      initialPosition="center"
      dragFromHeaderOnly
      enableDrag
      enableResize
      enableMaximize
      zIndexClassName="z-[105]"
      stackLayer={2}
      shellMarker="feedback-submit"
      shellClassName={hidePanelForCapture ? 'pointer-events-none invisible' : undefined}
      headerBand={(
        <div className="flex items-center gap-2 px-4 py-3" dir={direction}>
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[minmax(7.375rem,36%)_minmax(0,1fr)]">
            <UiCombobox
              size="sm"
              className="min-w-0 w-full"
              value={subjectId}
              items={subjectItems}
              onChange={(event) => setSubjectId(event.target.value)}
              placeholder={t('feedback.field.subjectPlaceholder')}
              ariaLabel={t('feedback.field.subject')}
              isInvalid={subjectInvalid}
              dir={direction}
            />
            <UiInput
              size="sm"
              className="min-w-0 w-full"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('feedback.field.title')}
              ariaLabel={t('feedback.field.title')}
              isRequired
              isInvalid={titleInvalid}
              dir={direction}
            />
          </div>
          {policy.allowAttachments ? (
            <>
              <input
                ref={attachFileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,application/pdf"
                disabled={attachBusy}
                onChange={(event) => void handleUpload(event)}
              />
              <div className="flex shrink-0 items-center gap-1" data-floating-panel-drag-exclude>
                <AppButton
                  type="button"
                  size="icon-sm"
                  intent="secondary"
                  disabled={attachBusy}
                  title={t('feedback.submit.attachFiles')}
                  aria-label={t('feedback.submit.attachFiles')}
                  onClick={() => attachFileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5" aria-hidden />
                  )}
                </AppButton>
                <AppButton
                  type="button"
                  size="icon-sm"
                  intent="secondary"
                  disabled={attachBusy}
                  title={t('feedback.submit.captureScreenshot')}
                  aria-label={t('feedback.submit.captureScreenshot')}
                  onClick={() => void handleScreenshot()}
                >
                  {isCapturingScreenshot ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Monitor className="h-3.5 w-3.5" aria-hidden />
                  )}
                </AppButton>
              </div>
            </>
          ) : null}
        </div>
      )}
      bodyClassName="flex h-full min-h-0 flex-1 flex-col overflow-hidden !p-0"
      footer={(
        <div className="flex w-full flex-col" dir={direction}>
          {policy.allowAttachments && attachments.length > 0 ? (
            <div className={cn('flex flex-col gap-2 px-4 py-2.5', FEEDBACK_ATTACH_FOOTER_CLASS)}>
              <FeedbackSubmitAttachmentsPreview
                attachments={attachments}
                onRemove={handleRemoveAttachment}
                removeAriaLabel={t('feedback.submit.removeAttachment')}
                onEditImage={handleEditAttachmentImage}
                editImageAriaLabel={t('feedback.submit.editAttachmentImage')}
                editImageDisabled={attachBusy}
              />
            </div>
          ) : null}
          <div className="flex w-full justify-center px-4 py-4">
            <AppButton
              type="button"
              intent="primary"
              disabled={isSubmitting || attachBusy}
              className="h-10 min-w-[12rem] max-w-full px-8 text-sm"
              onClick={() => void handleSubmit()}
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? t('feedback.submit.sending') : t('feedback.submit.send')}
            </AppButton>
          </div>
        </div>
      )}
    >
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden" dir={direction}>
        <input
          type="hidden"
          name="feedbackSourcePath"
          value={feedbackSource.sourcePath}
          readOnly
          tabIndex={-1}
          aria-hidden
        />
        {error ? (
          <div className="shrink-0 px-4 pt-3">
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          </div>
        ) : null}

        {showContact ? (
          <div className="grid shrink-0 grid-cols-1 gap-3 px-4 pt-3 md:grid-cols-3">
            <UiInput
              size="sm"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder={t('feedback.field.name')}
              ariaLabel={t('feedback.field.name')}
              dir={direction}
            />
            <UiInput
              size="sm"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder={t('feedback.field.email')}
              ariaLabel={t('feedback.field.email')}
            />
            <UiInput
              size="sm"
              inputMode="tel"
              autoComplete="tel"
              phoneContactActions
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              placeholder={t('feedback.field.phone')}
              ariaLabel={t('feedback.field.phone')}
            />
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1 basis-0">
          <div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden">
            <DesignerMarkdownEditorField
              value={body}
              onChange={setBody}
              placeholder={t('feedback.field.message')}
              ariaLabel={t('feedback.field.message')}
              fieldLabel={t('feedback.field.message')}
              dir={direction}
              chromeVariant="flush"
              editorHeight="100%"
              className="min-h-0 flex-1"
              aiAssist={false}
              {...markdownToolbarProps('standard')}
            />
          </div>
        </div>

        {!currentUser && !canSubmitAnonymous ? (
          <p className="shrink-0 px-4 pb-2 pt-1 text-xs text-amber-700">{t('feedback.submit.loginRequired')}</p>
        ) : null}
      </div>
    </FloatingPanelShell>
    {imageEditorOpen && imageEditorSrc ? (
      <ImageEditorSaveDialog
        open={imageEditorOpen}
        title={t('feedback.submit.editImageTitle')}
        initialSrc={imageEditorSrc}
        initialFileName={imageEditorFileName}
        enableAiPanel={false}
        exportFormat="image/png"
        onClose={handleImageEditorClose}
        onSave={handleImageEditorSave}
        onReplaceImage={(src, fileName) => {
          setImageEditorSrc(src);
          setImageEditorFileName(fileName);
        }}
      />
    ) : null}
    </>
  );
};
