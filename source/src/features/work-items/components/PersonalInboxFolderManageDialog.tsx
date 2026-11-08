import React, { useCallback, useEffect, useState } from 'react';
import { FolderOpen, Trash2 } from 'lucide-react';
import {
  AppButton,
  ConfirmDialogShell,
  DestructiveConfirmBody,
  FormField,
  UiInput,
} from '../../../shared/ui';
import { ShellResponsiveDrawer } from '../../../shared/ui/shell-foundation/ShellResponsiveDrawer';
import type { PersonalInboxUserFolder } from '../../../shared/api/contracts/personal-inbox/types';
import { personalInboxApi } from '../../../shared/api/personalInboxApi';
import { showAppFeedbackToast } from '../../../shared/ui/appFeedbackToast';
import { useCulture, useCultureT } from '../../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../../core/culture/cultureShellKeys';
import { cn } from '../../../lib/utils';

export type PersonalInboxFolderManageDialogProps = {
  open: boolean;
  onClose: () => void;
  folders: PersonalInboxUserFolder[];
  onFoldersChange: (folders: PersonalInboxUserFolder[]) => void;
  activeFolderToken: string;
  onActiveFolderChange: (token: string) => void;
};

export const PersonalInboxFolderManageDialog: React.FC<PersonalInboxFolderManageDialogProps> = ({
  open,
  onClose,
  folders,
  onFoldersChange,
  activeFolderToken,
  onActiveFolderChange,
}) => {
  const t = useCultureT();
  const culture = useCulture();
  const drawerSide = culture.direction === 'rtl' ? 'start' : 'end';
  const closeDrawerLabel = resolveCultureLabel(t, 'actions.close', 'Close');
  const title = resolveCultureLabel(t, 'shell.inbox.folder.manageTitle', 'My inbox folders');
  const createLabel = resolveCultureLabel(t, 'shell.inbox.folder.create', 'New folder');
  const myFoldersHeading = resolveCultureLabel(t, 'shell.inbox.folder.myFoldersHeading', 'My folders');
  const emptyLabel = resolveCultureLabel(t, 'shell.inbox.folder.manageEmpty', 'You have no personal folders yet.');
  const namePlaceholder = resolveCultureLabel(t, 'shell.inbox.folder.createPrompt', 'Folder name');
  const saveFailed = resolveCultureLabel(t, 'shell.inbox.folder.saveFailed', 'Could not update folders.');
  const deleteConfirmTitle = resolveCultureLabel(t, 'shell.inbox.folder.deleteTitle', 'Delete folder');
  const deleteConfirmQuestion = resolveCultureLabel(
    t,
    'shell.inbox.folder.deleteQuestion',
    'Delete this folder? Items keep their other tags; this folder tag is removed from all items.',
  );
  const cancelLabel = resolveCultureLabel(t, 'common.cancel', 'Cancel');
  const deleteLabel = resolveCultureLabel(t, 'common.delete', 'Delete');

  const [newFolderName, setNewFolderName] = useState('');
  const [renameDrafts, setRenameDrafts] = useState<Record<number, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<PersonalInboxUserFolder | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const next: Record<number, string> = {};
    for (const folder of folders) {
      next[folder.id] = folder.name;
    }
    setRenameDrafts(next);
    setNewFolderName('');
  }, [folders, open]);

  const reload = useCallback(async () => {
    const next = await personalInboxApi.listFolders();
    onFoldersChange(next);
  }, [onFoldersChange]);

  const handleCreate = async () => {
    const name = newFolderName.trim();
    if (!name) {
      return;
    }
    setBusy(true);
    try {
      await personalInboxApi.createFolder(name);
      setNewFolderName('');
      await reload();
    } catch (err) {
      showAppFeedbackToast(err instanceof Error ? err.message : saveFailed, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleRenameBlur = async (folder: PersonalInboxUserFolder) => {
    const draft = renameDrafts[folder.id]?.trim() ?? '';
    if (!draft || draft === folder.name) {
      return;
    }
    setBusy(true);
    try {
      await personalInboxApi.renameFolder(folder.id, draft);
      await reload();
    } catch (err) {
      showAppFeedbackToast(err instanceof Error ? err.message : saveFailed, { type: 'error' });
      setRenameDrafts((prev) => ({ ...prev, [folder.id]: folder.name }));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setBusy(true);
    try {
      await personalInboxApi.deleteFolder(deleteTarget.id);
      if (activeFolderToken === `u:${deleteTarget.id}`) {
        onActiveFolderChange('');
      }
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      showAppFeedbackToast(err instanceof Error ? err.message : saveFailed, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleDrawerOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  };

  return (
    <>
      <ShellResponsiveDrawer
        open={open}
        onOpenChange={handleDrawerOpenChange}
        side={drawerSide}
        title={title}
        ariaLabel={title}
        closeLabel={closeDrawerLabel}
        className="w-[min(24rem,92vw)]"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 pt-1 text-sm text-slate-700">
          <FormField label={createLabel} className="shrink-0" labelClassName="normal-case tracking-normal">
            <div className="flex flex-col gap-2">
              <UiInput
                size="sm"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder={namePlaceholder}
                aria-label={namePlaceholder}
                className="min-w-0 w-full"
                disabled={busy}
              />
              <AppButton
                size="sm"
                intent="primary"
                className="w-full shrink-0"
                disabled={busy || !newFolderName.trim()}
                onClick={() => void handleCreate()}
              >
                {createLabel}
              </AppButton>
            </div>
          </FormField>

          <section className="flex min-h-0 flex-1 flex-col">
            <p className="mb-2 shrink-0 text-xs font-semibold text-slate-600">
              {myFoldersHeading}
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg bg-slate-50/50 p-1">
              {folders.length === 0 ? (
                <div className="flex min-h-[10rem] flex-col items-center justify-center px-4 py-8 text-center">
                  <FolderOpen className="mb-2 h-5 w-5 text-slate-300" aria-hidden />
                  <p className="m-0 max-w-[16rem] text-xs leading-relaxed text-slate-500">{emptyLabel}</p>
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {folders.map((folder) => (
                    <li key={folder.id}>
                      <div
                        className={cn(
                          'flex items-center gap-1.5 rounded-md px-1.5 py-0.5',
                          'hover:bg-white/80',
                          busy && 'opacity-70',
                        )}
                      >
                        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary-600/70" aria-hidden />
                        <UiInput
                          size="sm"
                          value={renameDrafts[folder.id] ?? folder.name}
                          onChange={(event) => setRenameDrafts((prev) => ({
                            ...prev,
                            [folder.id]: event.target.value,
                          }))}
                          onBlur={() => void handleRenameBlur(folder)}
                          aria-label={folder.name}
                          className="min-w-0 flex-1 bg-white/80"
                          disabled={busy}
                          dir="auto"
                        />
                        <AppButton
                          size="icon-sm"
                          intent="ghost"
                          aria-label={deleteLabel}
                          title={deleteLabel}
                          disabled={busy}
                          onClick={() => setDeleteTarget(folder)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" aria-hidden />
                        </AppButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </ShellResponsiveDrawer>

      {deleteTarget ? (
        <ConfirmDialogShell
          title={deleteConfirmTitle}
          subtitle={deleteTarget.name}
          onClose={() => {
            if (!busy) {
              setDeleteTarget(null);
            }
          }}
          cancelLabel={cancelLabel}
          confirmLabel={deleteLabel}
          confirmIntent="destructive"
          onConfirm={() => void confirmDelete()}
          isConfirming={busy}
        >
          <DestructiveConfirmBody question={deleteConfirmQuestion} />
        </ConfirmDialogShell>
      ) : null}
    </>
  );
};
