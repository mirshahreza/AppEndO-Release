import React from 'react';
import { FolderPlus, Loader2, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { AppButton, UiInput } from '../../../shared/ui';
import {
  NAVIGATION_EDITOR_ID_CLASS,
  NAVIGATION_EDITOR_SIDE_PANEL_CLASS,
} from '../constants';
import { getNavigationItemAtPath } from '../lib/navigationTreeRows';
import type { NavigationEditorMode, NavigationManifestEditorModel } from '../hooks/useNavigationManifestEditor';
import { NavigationItemEditorPanel } from './NavigationItemEditorPanel';
import { NavigationManifestJsonEditor } from './NavigationManifestJsonEditor';
import { NavigationTreeEditor } from './NavigationTreeEditor';

const FIELD_CLASS = 'flex flex-col gap-[2px]';
const LABEL_CLASS = 'ps-[4px] text-xs font-semibold text-slate-600';
const PANEL_SECTION_LABEL_CLASS =
  'ps-[4px] text-[10px] font-bold uppercase tracking-wider text-slate-500';

const EDITOR_MODE_OPTIONS: Array<{ value: NavigationEditorMode; label: string }> = [
  { value: 'tree', label: 'Tree' },
  { value: 'json', label: 'JSON' },
];

const TOOLBAR_SEPARATOR_CLASS = 'mx-2 h-4 shrink-0 border-l border-slate-200';

type NavigationManifestEditorContentProps = {
  editor: NavigationManifestEditorModel;
  footerActions?: React.ReactNode;
  /** Replaces the default navigation id display (e.g. portal identity bar). */
  navigationIdentity?: React.ReactNode;
  toolbarTrailing?: React.ReactNode;
};

export const NavigationManifestEditorContent: React.FC<NavigationManifestEditorContentProps> = ({
  editor,
  footerActions,
  navigationIdentity,
  toolbarTrailing,
}) => {
  const selectedRow = editor.selection;
  const selectedItem =
    selectedRow?.nodeKind === 'item' && editor.workingManifest
      ? getNavigationItemAtPath(
        editor.workingManifest.groups[selectedRow.groupIndex]!,
        selectedRow.itemPath,
      )
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {editor.formError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {editor.formError}
        </div>
      ) : null}

      {editor.isEditorBuiltIn ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Built-in navigation manifests cannot be deleted, but items can be edited here.
        </div>
      ) : null}

      {editor.detailQuery.isLoading || !editor.workingManifest ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          Loading navigation tree…
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="flex shrink-0 items-center gap-2">
            {navigationIdentity ?? (
              <div className={NAVIGATION_EDITOR_ID_CLASS}>
                {editor.workingManifest.id}
              </div>
            )}

            <div className="flex shrink-0 items-center gap-2">
              <AppButton
                intent="create"
                size="sm"
                disabled={editor.editorMode !== 'tree'}
                onClick={editor.editorActions.addGroup}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Add group
              </AppButton>

              <AppButton
                intent="create"
                size="sm"
                disabled={editor.editorMode !== 'tree'}
                onClick={editor.editorActions.addItemAtSelection}
              >
                <Plus className="h-3.5 w-3.5" />
                Add item
              </AppButton>
            </div>

            <span className={TOOLBAR_SEPARATOR_CLASS} aria-hidden="true" />

            <div
              role="tablist"
              aria-label="Navigation editor mode"
              className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white p-1"
            >
              {EDITOR_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={editor.editorMode === option.value}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none ${
                    editor.editorMode === option.value
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-500 hover:text-indigo-700'
                  }`}
                  onClick={() => editor.setEditorMode(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {toolbarTrailing ? (
              <div className="ms-auto flex shrink-0 items-center gap-2">
                {toolbarTrailing}
              </div>
            ) : null}

            {footerActions ? (
              <div className="ms-auto flex shrink-0 items-center gap-2">
                {footerActions}
              </div>
            ) : null}
          </div>

          {editor.jsonError && editor.editorMode === 'json' ? (
            <div className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 whitespace-pre-wrap">
              {editor.jsonError}
            </div>
          ) : null}

          {editor.editorMode === 'json' ? (
            <NavigationManifestJsonEditor
              value={editor.jsonText}
              readOnly={editor.isEditorReadOnly}
              onChange={editor.handleJsonTextChange}
            />
          ) : (
            <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <NavigationTreeEditor
                page={editor}
                manifest={editor.workingManifest}
              />

              {selectedRow ? (
                <aside className={NAVIGATION_EDITOR_SIDE_PANEL_CLASS}>
                  <p className={PANEL_SECTION_LABEL_CLASS}>
                    {selectedRow.nodeKind === 'group'
                      ? 'Group'
                      : selectedRow.nodeKind === 'separator'
                        ? 'Separator'
                        : 'Item'}
                  </p>

                  {selectedRow.nodeKind === 'group' ? (
                    <>
                      <div className={FIELD_CLASS}>
                        <label className={LABEL_CLASS}>Group heading</label>
                        <UiInput
                          size="sm"
                          value={
                            editor.workingManifest.groups[selectedRow.groupIndex]?.heading ?? ''
                          }
                          onChange={(event) => {
                            editor.editorActions.updateGroupHeading(
                              selectedRow.groupIndex,
                              event.target.value.trim() || null,
                            );
                          }}
                        />
                      </div>

                      <div className={FIELD_CLASS}>
                        <label className={LABEL_CLASS}>Collapsed label</label>
                        <UiInput
                          size="sm"
                          value={
                            editor.workingManifest.groups[selectedRow.groupIndex]?.collapsedLabel ?? ''
                          }
                          placeholder="Optional rail label (max 6 visible)"
                          ariaLabel="Collapsed sidebar label"
                          onChange={(event) => {
                            editor.editorActions.updateGroupCollapsedLabel(
                              selectedRow.groupIndex,
                              event.target.value.trim() || null,
                            );
                          }}
                        />
                      </div>

                      <AppButton
                        intent="danger"
                        size="sm"
                        className="self-start"
                        onClick={() => editor.editorActions.removeGroup(selectedRow.groupIndex)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove group
                      </AppButton>
                    </>
                  ) : null}

                  {selectedRow.nodeKind === 'item'
                  && selectedItem
                  && selectedItem.type !== 'separator' ? (
                    <NavigationItemEditorPanel
                      page={editor}
                      groupIndex={selectedRow.groupIndex}
                      itemPath={selectedRow.itemPath}
                      item={selectedItem}
                    />
                  ) : null}

                  {selectedRow.nodeKind === 'separator' ? (
                    <p className="ps-[4px] text-xs text-slate-500">
                      Visual separator in the navigation tree.
                    </p>
                  ) : null}
                </aside>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const NavigationManifestEditorFooterActions: React.FC<{
  editor: NavigationManifestEditorModel;
  onCancel?: () => void;
  hideReset?: boolean;
  onSaveClose?: () => void;
  onSave?: () => Promise<void>;
  canSave?: boolean;
  isSaving?: boolean;
}> = ({
  editor,
  onCancel,
  hideReset = false,
  onSaveClose,
  onSave,
  canSave,
  isSaving,
}) => {
  const effectiveCanSave = canSave ?? editor.canSaveEditor;
  const effectiveIsSaving = isSaving ?? editor.isSaving;

  const handleSave = async () => {
    if (onSave) {
      await onSave();
      return;
    }
    await editor.saveEditor();
  };

  const handleSaveClose = async () => {
    if (effectiveCanSave) {
      try {
        await handleSave();
      } catch {
        return;
      }
    }
    onSaveClose?.();
  };

  return (
    <>
      {onCancel ? (
        <AppButton intent="cancel" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
          Cancel
        </AppButton>
      ) : null}
      {!editor.isEditorReadOnly ? (
        <>
          {!hideReset ? (
            <AppButton
              intent="utility"
              onClick={editor.editorActions.resetDraft}
              disabled={!editor.isEditorDirty}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </AppButton>
          ) : null}
          {onSaveClose ? (
            <>
              <AppButton
                intent="secondary"
                onClick={() => { void handleSave(); }}
                disabled={!effectiveCanSave}
              >
                {effectiveIsSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </AppButton>
              <AppButton
                intent="primary"
                onClick={() => { void handleSaveClose(); }}
                disabled={effectiveIsSaving}
              >
                {effectiveIsSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save & Close
              </AppButton>
            </>
          ) : (
            <AppButton
              intent="primary"
              onClick={() => { void handleSave(); }}
              disabled={!effectiveCanSave}
            >
              {effectiveIsSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </AppButton>
          )}
        </>
      ) : null}
    </>
  );
};
