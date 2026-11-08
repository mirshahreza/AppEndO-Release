import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import {
  AppButton,
  ConfirmDialogShell,
  DestructiveConfirmBody,
} from '../../../shared/ui';
import type { PersonalInboxItem } from '../../../shared/api/contracts/personal-inbox/types';
import {
  notifyPersonalInboxChangedWithFallback,
  personalInboxApi,
} from '../../../shared/api/personalInboxApi';
import { showAppFeedbackToast } from '../../../shared/ui/appFeedbackToast';
import { useCultureT } from '../../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../../core/culture/cultureShellKeys';
import { cn } from '../../../lib/utils';
import {
  itemHasInboxSoftDeletedFolderTag,
  PERSONAL_INBOX_SYSTEM_FOLDER_DELETED,
} from '../../../shared/personal-inbox/personalInboxFolderRefs';

export type PersonalInboxItemDeleteButtonProps = {
  item: PersonalInboxItem;
  activeFolderToken: string;
  onItemUpdated: (item: PersonalInboxItem) => void;
  onItemRemovedFromList?: (itemKey: string) => void;
  buttonClassName?: string;
  /** Card compact actions — run delete flow once on mount. */
  autoActivate?: boolean;
  onAutoActivateDone?: () => void;
};

export const PersonalInboxItemDeleteButton: React.FC<PersonalInboxItemDeleteButtonProps> = ({
  item,
  activeFolderToken,
  onItemUpdated,
  onItemRemovedFromList,
  buttonClassName,
  autoActivate = false,
  onAutoActivateDone,
}) => {
  const t = useCultureT();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const moveToDeletedLabel = resolveCultureLabel(
    t,
    'shell.inbox.delete.moveToDeleted',
    'Move to Deleted',
  );
  const permanentDeleteLabel = resolveCultureLabel(
    t,
    'shell.inbox.delete.permanent',
    'Delete permanently',
  );
  const workItemPermanentBlockedLabel = resolveCultureLabel(
    t,
    'shell.inbox.delete.workItemPermanentBlocked',
    'Work items cannot be permanently deleted.',
  );
  const confirmTitle = resolveCultureLabel(
    t,
    'shell.inbox.delete.permanentConfirmTitle',
    'Delete permanently?',
  );
  const confirmQuestion = resolveCultureLabel(
    t,
    'shell.inbox.delete.permanentConfirmQuestion',
    'This cannot be undone. The item will be removed from your inbox for good.',
  );
  const saveFailedLabel = resolveCultureLabel(t, 'shell.inbox.folder.saveFailed', 'Could not update folders.');
  const permanentFailedLabel = resolveCultureLabel(
    t,
    'shell.inbox.delete.permanentFailed',
    'Could not delete this item permanently.',
  );

  const softDeleted = itemHasInboxSoftDeletedFolderTag(item.folderRefs ?? []);
  const isWorkItem = item.kind === 'work_item';
  const permanentAllowed = softDeleted && !isWorkItem;

  const removeFromListIfNeeded = useCallback((updated: PersonalInboxItem) => {
    const token = activeFolderToken.trim().toLowerCase();
    const refs = updated.folderRefs ?? [];
    const stillInFilter = token === 'deleted'
      ? refs.includes(PERSONAL_INBOX_SYSTEM_FOLDER_DELETED)
      : !token || token === 'inbox'
        ? !refs.includes(PERSONAL_INBOX_SYSTEM_FOLDER_DELETED)
        : true;
    if (!stillInFilter) {
      onItemRemovedFromList?.(item.id);
    }
  }, [activeFolderToken, item.id, onItemRemovedFromList]);

  const softDelete = useCallback(async () => {
    if (softDeleted || busy) {
      return;
    }
    setBusy(true);
    try {
      const nextRefs = [...new Set([...(item.folderRefs ?? []), PERSONAL_INBOX_SYSTEM_FOLDER_DELETED])];
      const { folderRefs, summary } = await personalInboxApi.setItemFolderRefs(item.id, nextRefs);
      const updated = { ...item, folderRefs };
      onItemUpdated(updated);
      await notifyPersonalInboxChangedWithFallback(summary);
      removeFromListIfNeeded(updated);
    } catch (err) {
      showAppFeedbackToast(err instanceof Error ? err.message : saveFailedLabel, { type: 'error' });
    } finally {
      setBusy(false);
    }
  }, [busy, item, onItemUpdated, removeFromListIfNeeded, saveFailedLabel, softDeleted]);

  const submitPermanentDelete = useCallback(async () => {
    if (!permanentAllowed || busy) {
      return;
    }
    setBusy(true);
    try {
      const { summary } = await personalInboxApi.permanentDeleteItem(item.id);
      setConfirmOpen(false);
      onItemRemovedFromList?.(item.id);
      await notifyPersonalInboxChangedWithFallback(summary);
      onAutoActivateDone?.();
    } catch (err) {
      showAppFeedbackToast(err instanceof Error ? err.message : permanentFailedLabel, { type: 'error' });
    } finally {
      setBusy(false);
    }
  }, [busy, item.id, onItemRemovedFromList, permanentAllowed, permanentFailedLabel]);

  const handleClick = useCallback(() => {
    if (busy) {
      return;
    }
    if (softDeleted) {
      if (isWorkItem) {
        return;
      }
      setConfirmOpen(true);
      return;
    }
    void softDelete();
  }, [busy, isWorkItem, softDelete, softDeleted]);

  const autoActivatedRef = useRef(false);
  useEffect(() => {
    if (!autoActivate || autoActivatedRef.current) {
      return;
    }
    autoActivatedRef.current = true;
    if (softDeleted) {
      if (!isWorkItem) {
        setConfirmOpen(true);
      } else {
        onAutoActivateDone?.();
      }
      return;
    }
    void softDelete().finally(() => onAutoActivateDone?.());
  }, [autoActivate, isWorkItem, onAutoActivateDone, softDelete, softDeleted]);

  const ariaLabel = softDeleted
    ? (isWorkItem ? workItemPermanentBlockedLabel : permanentDeleteLabel)
    : moveToDeletedLabel;

  const iconClass = softDeleted
    ? (isWorkItem ? 'text-slate-300' : 'text-rose-600')
    : 'text-slate-500 group-hover:text-rose-600';

  return (
    <>
      <AppButton
        type="button"
        size="sm"
        intent="ghost"
        aria-label={ariaLabel}
        title={ariaLabel}
        disabled={busy || (softDeleted && isWorkItem)}
        className={cn(
          buttonClassName,
          'personal-inbox-grid-delete-btn group',
          softDeleted && !isWorkItem && 'personal-inbox-grid-delete-btn--permanent',
        )}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          handleClick();
        }}
      >
        <Trash2
          className={cn(
            'h-4 w-4 shrink-0 transition-colors',
            iconClass,
            softDeleted && !isWorkItem && 'fill-rose-100 stroke-rose-700',
          )}
          strokeWidth={softDeleted && !isWorkItem ? 2.25 : 1.75}
          aria-hidden
        />
      </AppButton>
      {confirmOpen ? (
        <ConfirmDialogShell
          size="md"
          title={confirmTitle}
          icon={<Trash2 className="h-4 w-4 text-rose-600" aria-hidden />}
          onClose={() => {
            setConfirmOpen(false);
            onAutoActivateDone?.();
          }}
          footer={(
            <>
              <AppButton intent="cancel" size="sm" onClick={() => setConfirmOpen(false)} disabled={busy}>
                <X className="h-3.5 w-3.5" aria-hidden />
                {resolveCultureLabel(t, 'actions.cancel', 'Cancel')}
              </AppButton>
              <AppButton
                intent="destructive"
                size="sm"
                onClick={() => void submitPermanentDelete()}
                disabled={busy}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                {permanentDeleteLabel}
              </AppButton>
            </>
          )}
        >
          <DestructiveConfirmBody
            question={confirmQuestion}
            entityName={item.title}
            entityDetail={item.id}
          />
        </ConfirmDialogShell>
      ) : null}
    </>
  );
};
