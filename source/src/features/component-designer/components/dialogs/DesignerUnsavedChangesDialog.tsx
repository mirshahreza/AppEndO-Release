import * as React from 'react';
import { AlertTriangle, Save, Trash2, X } from 'lucide-react';
import { AppButton } from '../../../../shared/ui';
import { DesignerDialog, DESIGNER_DIALOG_BODY_CLASS } from './DesignerDialog';

export type DesignerUnsavedChangesDialogProps = {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
};

export const DesignerUnsavedChangesDialog: React.FC<DesignerUnsavedChangesDialogProps> = ({
  open,
  busy,
  onCancel,
  onDiscard,
  onSave,
}) => (
  <DesignerDialog
    title="Unsaved Changes"
    open={open}
    onClose={onCancel}
    surfaceClassName="max-w-md"
    bodyClassName={DESIGNER_DIALOG_BODY_CLASS}
    footer={(
      <div className="flex items-center justify-end gap-2">
        <AppButton type="button" intent="cancel" onClick={onCancel} disabled={busy}>
          <X className="h-3.5 w-3.5" />
          Cancel
        </AppButton>
        <AppButton type="button" intent="destructive-soft" onClick={onDiscard} disabled={busy}>
          <Trash2 className="h-3.5 w-3.5" />
          Don&apos;t Save
        </AppButton>
        <AppButton type="button" intent="primary" onClick={onSave} disabled={busy}>
          <Save className="h-3.5 w-3.5" />
          {busy ? 'Saving...' : 'Save'}
        </AppButton>
      </div>
    )}
  >
    <div className="flex items-start gap-2 bg-white p-[15px]">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <p className="text-xs text-slate-600">
        You have unsaved changes. Save before continuing, or discard them to reload from disk.
      </p>
    </div>
  </DesignerDialog>
);
