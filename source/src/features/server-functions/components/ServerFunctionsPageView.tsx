import React from 'react';
import { Pencil, Plus, Save, Settings, X } from 'lucide-react';
import { AccessControlModal, AppButton, AppToast, CatalogTagsField, CreateEditModalShell, ServerFunctionHooksModal, ServerFunctionSettingsForm, UiInput, UiSelect } from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import { cn } from '../../../lib/utils';
import type { ServerFunctionsPageState } from '../hooks/useServerFunctionsPage';
import { buildServerFunctionCatalogPath } from '../lib/duplicateServerFunctionIdentity';
import { sanitizeLatinSlugInput } from '../../../shared/lib/latinSlug';
import { ServerFunctionsLayout } from './ServerFunctionsLayout';
import { SandboxEditorPanel } from './ServerFunctionWorkspacePanel';
import { isPackageServerFunction } from '../../../shared/api/contracts/server-functions/packageFunctions';
import type { ServerFunctionMetadataJson } from '../../../shared/api/contracts/server-functions/types';
import { resolvePackageBadgeLabel } from '../../../shared/packages/packageBadgeLabel';
import { ServerFunctionDeleteModal } from './ServerFunctionDeleteModal';
import { ServerFunctionUnusedDialog } from './ServerFunctionUnusedDialog';
import { useServerFunctionEditorShellHeader } from '../hooks/useServerFunctionEditorShellHeader';

function renderServerFunctionWorkspace(page: ServerFunctionsPageState) {
  return <SandboxEditorPanel page={page} />;
}

export function ServerFunctionsPageView({ page }: { page: ServerFunctionsPageState }) {
  const t = useCultureT();
  const {
    functions,
    activeId, setActiveId, activeFn, draftFn, setDraftFn,
    persistEdgeState, updateActiveFunction,
    isCreateOpen, setIsCreateOpen, isSettingsOpen, settingsTarget, closeSettingsDialog, updateSettingsTarget, saveSettingsFromList, isSavingSettings,
    isAccessOpen, accessTarget, closeAccessDialog, updateAccessTargetControl, saveAccessFromList, isSavingAccess,
    isHooksOpen, setIsHooksOpen,
    newFuncName, setNewFuncName, newFuncTags, setNewFuncTags, newFuncMethod, setNewFuncMethod, handleCreateFunction,
    globalDefaultVMMode, globalDefaultRAM, globalDefaultTimeout,
    idToDelete, setIdToDelete, confirmDelete,
    toast,
    isDuplicateOpen, duplicateSource,
    duplicateName, setDuplicateName, duplicateTags, setDuplicateTags, duplicateError,
    closeDuplicateDialog, confirmDuplicateToDraft, isDuplicating,
    isRenameOpen, renameSource, renameName, setRenameName, renameTags, setRenameTags, renameError,
    closeRenameDialog, confirmRenameFromList, isRenaming,
    editSlugFromUrl, isNewDraftRoute,
  } = page;

  useServerFunctionEditorShellHeader({
    enabled: Boolean(editSlugFromUrl),
  });

  return (
    <div className="w-full h-full flex flex-col bg-white" id="server-functions-page-wrapper">
      {toast ? <AppToast type={toast.type} text={toast.text} /> : null}

      <ServerFunctionsLayout
        page={page}
        workspace={renderServerFunctionWorkspace(page)}
        onOpenUnusedFunctions={() => page.setIsUnusedFunctionsDialogOpen(true)}
      />

      <ServerFunctionUnusedDialog
        open={page.isUnusedFunctionsDialogOpen}
        onClose={() => page.setIsUnusedFunctionsDialogOpen(false)}
        onDeleteFunction={page.handleDeleteFunction}
        isDeleteBusy={Boolean(page.idToDelete)}
      />

      {isCreateOpen ? (
        <CreateEditModalShell
          size="md"
          title={t('serverFunctions.create.title')}
          onClose={() => setIsCreateOpen(false)}
          onBackdropClick={() => setIsCreateOpen(false)}
          footer={(
            <>
              <AppButton intent="cancel" onClick={() => setIsCreateOpen(false)}>
                <X className="h-3.5 w-3.5" />
                {t('actions.cancel')}
              </AppButton>
              <AppButton intent="primary" onClick={handleCreateFunction} disabled={!newFuncName.trim()}>
                <Plus className="h-3.5 w-3.5" />
                {t('serverFunctions.create.submit')}
              </AppButton>
            </>
          )}
        >
          <div className="space-y-4">
              <div className="space-y-[2px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block ps-[4px]">{t('serverFunctions.httpMethod')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['GET', 'POST', 'PUT', 'DELETE'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setNewFuncMethod(m)}
                      className={cn(
                        "py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                        newFuncMethod === m 
                          ? m === 'GET' ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                            : m === 'POST' ? "bg-amber-50 border-amber-300 text-amber-700"
                            : m === 'PUT' ? "bg-blue-50 border-blue-300 text-blue-700"
                            : "bg-red-50 border-red-300 text-red-700"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-[2px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block ps-[4px]">{t('serverFunctions.routeName.label')}</label>
                <UiInput
                  size="sm"
                  aiAssist={false}
                  autoDir={false}
                  placeholder={t('serverFunctions.routeName.placeholder')}
                  value={newFuncName}
                  onChange={(e) => setNewFuncName(sanitizeLatinSlugInput(e.target.value))}
                  ariaLabel={t('serverFunctions.routeName.label')}
                  className="font-mono font-medium"
                />
              </div>

              <CatalogTagsField
                value={newFuncTags}
                onChange={setNewFuncTags}
                placeholder="Type a tag and press Enter"
              />

              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">{t('serverFunctions.previewEndpoint')}</span>
                <span className="text-xs font-mono font-semibold text-slate-700">
                  {newFuncMethod} {buildServerFunctionCatalogPath(newFuncName || t('serverFunctions.actionName'))}
                </span>
              </div>
            </div>
        </CreateEditModalShell>
      ) : null}

      {isDuplicateOpen && duplicateSource ? (
        <CreateEditModalShell
          size="md"
          title={t('serverFunctions.duplicate.title')}
          onClose={closeDuplicateDialog}
          closeOnEscape={false}
          footer={(
            <>
              <AppButton intent="cancel" onClick={closeDuplicateDialog}>
                <X className="h-3.5 w-3.5" />
                {t('actions.cancel')}
              </AppButton>
              <AppButton
                intent="primary"
                onClick={confirmDuplicateToDraft}
                disabled={!duplicateName.trim() || isDuplicating}
              >
                {isDuplicating ? t('serverFunctions.duplicate.duplicating') : t('serverFunctions.duplicate.submit')}
              </AppButton>
            </>
          )}
        >
          <div className="space-y-4">
            {duplicateError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {duplicateError}
              </div>
            ) : null}

            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">{t('serverFunctions.source')}</span>
              <span className="text-xs font-mono font-semibold text-slate-700">
                {duplicateSource.method} {duplicateSource.path}
              </span>
            </div>

            <div className="space-y-[2px]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block ps-[4px]">Name</label>
              <UiInput
                size="sm"
                aiAssist={false}
                autoDir={false}
                placeholder="e.g. get-by-id, process-refund"
                value={duplicateName}
                onChange={(e) => setDuplicateName(sanitizeLatinSlugInput(e.target.value))}
                ariaLabel="Name"
                className="font-mono font-medium"
              />
            </div>

            <CatalogTagsField
              value={duplicateTags}
              onChange={setDuplicateTags}
            />

            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">{t('serverFunctions.previewEndpoint')}</span>
              <span className="text-xs font-mono font-semibold text-slate-700">
                {duplicateSource.method} {buildServerFunctionCatalogPath(duplicateName)}
              </span>
            </div>
          </div>
        </CreateEditModalShell>
      ) : null}

      {isRenameOpen && renameSource ? (
        <CreateEditModalShell
          size="md"
          title="Rename API"
          onClose={closeRenameDialog}
          closeOnEscape={false}
          footer={(
            <>
              <AppButton intent="cancel" onClick={closeRenameDialog}>
                <X className="h-3.5 w-3.5" />
                {t('actions.cancel')}
              </AppButton>
              <AppButton
                intent="primary"
                onClick={confirmRenameFromList}
                disabled={!renameName.trim() || isRenaming}
              >
                <Pencil className="h-3.5 w-3.5" />
                {isRenaming ? 'Saving…' : 'Save'}
              </AppButton>
            </>
          )}
        >
          <div className="space-y-4">
            {renameError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {renameError}
              </div>
            ) : null}

            <div className="space-y-[2px]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block ps-[4px]">Name</label>
              <UiInput
                size="sm"
                aiAssist={false}
                autoDir={false}
                value={renameName}
                onChange={(e) => setRenameName(sanitizeLatinSlugInput(e.target.value))}
                ariaLabel="Name"
                className="font-mono font-medium"
              />
            </div>

            <CatalogTagsField
              value={renameTags}
              onChange={setRenameTags}
            />

            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">{t('serverFunctions.previewEndpoint')}</span>
              <span className="text-xs font-mono font-semibold text-slate-700">
                {renameSource.method} {buildServerFunctionCatalogPath(renameName)}
              </span>
            </div>
          </div>
        </CreateEditModalShell>
      ) : null}

      {/* ⚙️ FLOATING SETTINGS MODAL */}
      {isSettingsOpen && (() => {
        const targetFn = settingsTarget || activeFn || draftFn;
        const isListSettingsTarget = Boolean(settingsTarget)
          && (!editSlugFromUrl || !activeId || settingsTarget?.id !== activeId);
        const isBuiltInTarget = Boolean(
          settingsTarget?.isBuiltIn
          || (activeId && activeFn?.isBuiltIn && (!settingsTarget || settingsTarget.id === activeId)),
        );
        const isPackageTarget = Boolean(
          (settingsTarget && isPackageServerFunction(settingsTarget))
          || (activeId && activeFn && isPackageServerFunction(activeFn) && (!settingsTarget || settingsTarget.id === activeId)),
        );
        const packageSourceLabel = isPackageTarget
          ? resolvePackageBadgeLabel(settingsTarget ?? activeFn!)
          : null;
        const updateTarget = (updates: Partial<typeof targetFn>) => {
          if (settingsTarget) {
            updateSettingsTarget(updates);
          }
          if (activeId && (!settingsTarget || settingsTarget.id === activeId)) {
            updateActiveFunction(updates);
            return;
          }
          if (!activeId && !settingsTarget) {
            setDraftFn((prev) => ({ ...prev, ...updates }));
          }
        };
        const titlePath = settingsTarget?.path
          ?? (activeId
            ? (activeFn?.path ?? '')
            : `/api/${draftFn.folder ? `${draftFn.folder.trim().toLowerCase()}/` : ''}${draftFn.name ? draftFn.name.trim().toLowerCase().replace(/\s+/g, '-') : t('serverFunctions.unnamed')}`);

        return (
        <CreateEditModalShell
          size="3xl"
          shellClassName="min-h-[600px]"
          title={(
            <span className="inline-flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary-500" />
              <span>{t('serverFunctions.settings.title').replace('{path}', titlePath)}</span>
            </span>
          )}
          onClose={closeSettingsDialog}
          onBackdropClick={closeSettingsDialog}
          bodyClassName="space-y-6 overflow-y-auto max-h-[70vh]"
          footer={(
            <>
              <AppButton intent="cancel" onClick={closeSettingsDialog} disabled={isListSettingsTarget && isSavingSettings}>
                <X className="h-3.5 w-3.5" />
                {t('actions.cancel')}
              </AppButton>
              <AppButton
                intent="primary"
                disabled={isListSettingsTarget && isSavingSettings}
                onClick={async () => {
                  if (isListSettingsTarget) {
                    const saved = await saveSettingsFromList();
                    if (saved) {
                      closeSettingsDialog();
                    }
                    return;
                  }
                  const saved = await persistEdgeState();
                  if (saved) {
                    closeSettingsDialog();
                  }
                }}
              >
                <Save className="h-3.5 w-3.5" />
                {t('serverFunctions.settings.save')}
              </AppButton>
            </>
          )}
        >

              <ServerFunctionSettingsForm
                targetFn={targetFn}
                updateTarget={(updates) => updateTarget(updates)}
                globalDefaultVMMode={globalDefaultVMMode}
                globalDefaultRAM={globalDefaultRAM}
                globalDefaultTimeout={globalDefaultTimeout}
                isBuiltInTarget={isBuiltInTarget}
                isPackageTarget={isPackageTarget}
                packageSourceLabel={packageSourceLabel}
                canToggleBuiltIn={!activeId && !settingsTarget}
                isBuiltInChecked={!!(settingsTarget?.isBuiltIn ?? (activeId ? activeFn?.isBuiltIn : draftFn.isBuiltIn))}
              />
        </CreateEditModalShell>
        );
      })()}

      {isAccessOpen && (() => {
        const targetFn = accessTarget || activeFn || draftFn;
        const isListAccessTarget = Boolean(accessTarget)
          && (!editSlugFromUrl || !activeId || accessTarget?.id !== activeId);
        const updateTarget = (updates: Partial<typeof targetFn>) => {
          if (accessTarget && updates.accessControl) {
            updateAccessTargetControl(updates.accessControl);
          }
          if (activeId && (!accessTarget || accessTarget.id === activeId)) {
            updateActiveFunction(updates);
            return;
          }
          if (!activeId && !accessTarget) {
            setDraftFn((prev) => ({ ...prev, ...updates }));
          }
        };
        const titlePath = accessTarget?.path
          ?? (activeId
            ? (activeFn?.path ?? '')
            : `/api/${draftFn.folder ? `${draftFn.folder.trim().toLowerCase()}/` : ''}${draftFn.name ? draftFn.name.trim().toLowerCase().replace(/\s+/g, '-') : t('serverFunctions.unnamed')}`);

        return (
          <AccessControlModal
            open
            titlePath={titlePath}
            accessControl={targetFn.accessControl}
            disabled={isListAccessTarget ? isSavingAccess : false}
            onClose={closeAccessDialog}
            onChange={(accessControl) => updateTarget({ accessControl })}
            onSave={async () => {
              if (isListAccessTarget) {
                const saved = await saveAccessFromList();
                if (saved) {
                  closeAccessDialog();
                }
                return;
              }
              const saved = await persistEdgeState();
              if (saved) {
                closeAccessDialog();
              }
            }}
          />
        );
      })()}

      {isHooksOpen && (() => {
        const targetFn = activeFn || draftFn;
        const updateTarget = (updates: Partial<typeof targetFn>) => {
          if (activeId) {
            updateActiveFunction(updates);
            return;
          }
          setDraftFn((prev) => ({ ...prev, ...updates }));
        };
        const titlePath = activeId
          ? (activeFn?.path ?? '')
          : `/api/${draftFn.folder ? `${draftFn.folder.trim().toLowerCase()}/` : ''}${draftFn.name ? draftFn.name.trim().toLowerCase().replace(/\s+/g, '-') : t('serverFunctions.unnamed')}`;

        return (
          <ServerFunctionHooksModal
            open
            titlePath={titlePath}
            hooks={targetFn.hooks ?? {}}
            metadataJson={targetFn.metadataJson as ServerFunctionMetadataJson | null}
            onClose={() => setIsHooksOpen(false)}
            onChange={(hooks) => updateTarget({ hooks })}
            onSave={async () => {
              const saved = await persistEdgeState();
              if (saved) {
                setIsHooksOpen(false);
              }
            }}
          />
        );
      })()}

      <ServerFunctionDeleteModal
        target={functions.find((f) => f.id === idToDelete) ?? null}
        onCancel={() => setIdToDelete(null)}
        onConfirm={() => void confirmDelete()}
      />

    </div>
  );
}
