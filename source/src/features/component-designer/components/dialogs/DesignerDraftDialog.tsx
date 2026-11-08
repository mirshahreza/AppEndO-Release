import * as React from 'react';
import { Copy, Pencil, Save, X } from 'lucide-react';
import { DesignerDialog, DESIGNER_DIALOG_BODY_CLASS } from './DesignerDialog';
import { AppButton, UiInput } from '../../../../shared/ui';
import type { DesignerDialogMode } from '../../dialogs/types';
import { sanitizeDesignerComponentNameInput } from '../../utils/componentName';
import { DesignerRenameRoutesWarning } from '../DesignerComponentPortalRoutes';
import { DesignerFieldRow } from '../DesignerFieldRow';

export type DesignerDraftDialogProps = {
  mode: DesignerDialogMode;
  busy: boolean;
  error: string | null;
  activeDraftId: string | null;
  activeComponentName: string;
  /** Public pageKey for the active draft — used to show route registration warning on rename. */
  activePageKey?: string | null;
  draftNameInput: string;
  onDraftNameInputChange: (value: string) => void;
  onClose: () => void;
  onCancel: () => void;
  onSave: () => void;
};

export const DesignerDraftDialog: React.FC<DesignerDraftDialogProps> = ({
  mode,
  busy,
  error,
  activeDraftId,
  activeComponentName,
  activePageKey,
  draftNameInput,
  onDraftNameInputChange,
  onClose,
  onCancel,
  onSave,
}) => {
  const isSaveMode = mode === 'save';
  const isDuplicateMode = mode === 'duplicate';
  const isEditMode = mode === 'edit';
  const isOpen = isSaveMode || isDuplicateMode || isEditMode;

  const dialogTitle = isEditMode
    ? 'Rename Component'
    : isDuplicateMode
      ? 'Duplicate Component'
      : 'Save Component';

  const dialogTitleIcon = isEditMode
    ? <Pencil className="h-4 w-4 text-indigo-600" />
    : isDuplicateMode
      ? <Copy className="h-4 w-4 text-indigo-600" />
      : undefined;

  const primaryActionLabel = busy
    ? (isEditMode ? 'Saving...' : isDuplicateMode ? 'Duplicating...' : 'Saving...')
    : (isEditMode ? 'Save' : isDuplicateMode ? 'Duplicate' : 'Save');

  const canEditSaveName = isDuplicateMode || isEditMode || activeDraftId === null;
  const preventImplicitClose = isSaveMode || isDuplicateMode;

  const isNameInvalid = canEditSaveName && draftNameInput.trim() === '';
  const isSaveDisabled = busy || isNameInvalid;

  return (
    <DesignerDialog
      title={dialogTitle}
      titleIcon={dialogTitleIcon}
      open={isOpen}
      onClose={onClose}
      closeOnBackdrop={!preventImplicitClose}
      closeOnEscape={!preventImplicitClose}
      bodyClassName={DESIGNER_DIALOG_BODY_CLASS}
      footer={(
        <div className="flex items-center justify-end gap-2">
          <AppButton type="button" intent="cancel" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton type="button" intent="primary" onClick={onSave} disabled={isSaveDisabled}>
            {isDuplicateMode ? <Copy className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {primaryActionLabel}
          </AppButton>
        </div>
      )}
    >
      {isOpen ? (
        <div className="space-y-3 bg-white p-[15px]">
          <DesignerFieldRow label="Component Name">
            <UiInput
              size="sm"
              autoDir={false}
              value={canEditSaveName ? draftNameInput : activeComponentName}
              onChange={(event) => onDraftNameInputChange(sanitizeDesignerComponentNameInput(event.target.value))}
              ariaLabel="Component name"
              isDisabled={!canEditSaveName}
              isInvalid={isNameInvalid}
              errorMessage={isNameInvalid ? 'Component name is required.' : undefined}
            />
          </DesignerFieldRow>
          {isEditMode && activePageKey ? (
            <DesignerRenameRoutesWarning pageKey={activePageKey} className="mt-1" />
          ) : null}
          {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
        </div>
      ) : null}
    </DesignerDialog>
  );
};
