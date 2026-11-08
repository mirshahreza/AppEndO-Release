import * as React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { AppButton, DestructiveConfirmBody } from '../../../../shared/ui';
import { useDesignerComponentUsageQuery } from '../../../../shared/api/queries/component-designer';
import type { DesignerComponentUsageReport } from '../../../../shared/api/contracts/component-designer/usage';
import { DesignerDialog, DESIGNER_DIALOG_BODY_CLASS } from './DesignerDialog';

export type DesignerDeleteComponentDialogProps = {
  open: boolean;
  busy: boolean;
  error: string | null;
  componentName: string;
  draftId: string | null;
  hasUnsavedChanges: boolean;
  onClose: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

/** PDK-9 — static registry-only usage warning, shown before the operator confirms delete. Never blocks. */
const DesignerDeleteUsageWarning: React.FC<{ draftId: string | null; open: boolean }> = ({ draftId, open }) => {
  const usageQuery = useDesignerComponentUsageQuery(draftId, { enabled: open });
  const usage = usageQuery.data as DesignerComponentUsageReport | undefined;
  const pages = usage?.pages ?? [];

  if (usageQuery.isLoading || pages.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-start">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Used on {pages.length} page{pages.length === 1 ? '' : 's'} — deleting will break {pages.length === 1 ? 'it' : 'them'}
      </p>
      <ul className="mt-1.5 space-y-1">
        {pages.map((page) => (
          <li key={page.pageKey} className="text-xs text-amber-700">
            <span className="font-mono">{page.pageKey}</span>
            {page.mounts.length > 0 ? ` — ${page.mounts.join(', ')}` : ''}
            {page.loaderKindInvariantWarning ? (
              <span className="ms-1 rounded bg-amber-200 px-1 py-0.5 text-[10px] font-bold text-amber-900">
                owned by package but loaderKind=core
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const DesignerDeleteComponentDialog: React.FC<DesignerDeleteComponentDialogProps> = ({
  open,
  busy,
  error,
  componentName,
  draftId,
  hasUnsavedChanges,
  onClose,
  onCancel,
  onConfirm,
}) => (
  <DesignerDialog
    title="Delete Component"
    titleIcon={<Trash2 className="h-4 w-4 text-rose-600" />}
    open={open}
    onClose={onClose}
    tone="danger"
    surfaceClassName="max-w-md"
    bodyClassName={DESIGNER_DIALOG_BODY_CLASS}
    footer={(
      <div className="flex items-center justify-end gap-2">
        <AppButton type="button" intent="cancel" size="sm" onClick={onCancel} disabled={busy}>
          <X className="h-3.5 w-3.5" />
          Cancel
        </AppButton>
        <AppButton type="button" intent="destructive" size="sm" onClick={onConfirm} disabled={busy}>
          <Trash2 className="h-3.5 w-3.5" />
          {busy ? 'Deleting...' : 'Delete'}
        </AppButton>
      </div>
    )}
  >
    <div className="bg-white p-[15px]" dir="ltr">
      <DestructiveConfirmBody
        question="Are you sure you want to delete this component?"
        entityName={componentName}
        extra={hasUnsavedChanges ? (
          <p className="text-start text-xs text-slate-600">
            Unsaved changes in the current workspace will also be lost.
          </p>
        ) : null}
      />
      <DesignerDeleteUsageWarning draftId={draftId} open={open} />
      {error ? <p className="mt-2 text-start text-xs font-semibold text-rose-600">{error}</p> : null}
    </div>
  </DesignerDialog>
);
