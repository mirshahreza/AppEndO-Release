import React from 'react';
import { Save, X } from 'lucide-react';
import { RECORD_CHANGE_REASON_REVERTED, type RecordEventPublicRow } from '../../../shared/api/contracts/record-events';
import { apiPut } from '../../../shared/api/client';
import {
  AppButton,
  CreateEditModalShell,
  RecordEventHistoryDialog,
  recordEventHistoryFieldChromeToggle,
  RecordForm,
  useRecordSubjectTimelineCopy,
} from '../../../shared/ui';
import {
  restoreRecordEventValue,
  useRecordSubjectHistory,
} from '../../../shared/lib/useRecordSubjectHistory';
import type { CrudSetGridColumn } from '../../../domain/component-designer/crudSetSpec';
import type { RoleFormState, RoleRecord } from '../types';
import { RoleEditAuditFooter } from './RoleEditAuditFooter';

export type RoleEditModalProps = {
  role: RoleRecord | null;
  form: RoleFormState;
  onFormChange: (form: RoleFormState) => void;
  editError: string | null;
  isUpdating: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

const ROLE_FORM_COLUMNS: CrudSetGridColumn[] = [
  { field: 'name', label: 'Name', formPlacement: 'main' },
  { field: 'note', label: 'Note', formPlacement: 'main' },
];

const ROLE_TRACKED_FIELDS = ['name', 'note'] as const;

export const RoleEditModal: React.FC<RoleEditModalProps> = ({
  role,
  form,
  onFormChange,
  editError,
  isUpdating,
  onClose,
  onSubmit,
}) => {
  const timelineCopy = useRecordSubjectTimelineCopy();
  const history = useRecordSubjectHistory({
    subjectKind: 'base_roles',
    subjectId: role?.id,
    trackedFields: ROLE_TRACKED_FIELDS,
    enabled: Boolean(role),
  });

  if (!role) return null;

  const restoreHistoryField = async (event: RecordEventPublicRow) => {
    if (event.field !== 'note') return;
    const value = restoreRecordEventValue(event.fromValue);
    if (value === undefined) return;
    await apiPut(`/api/roles/${role.id}`, {
      note: value == null ? null : String(value),
      __changeReasonCode: RECORD_CHANGE_REASON_REVERTED,
      __changeReasonText: 'Restored previous value',
      __revertedFromSeq: event.subjectSeq,
      __revertedFromEventId: event.id,
    });
    onFormChange({
      ...form,
      note: value == null ? '' : String(value),
    });
  };

  return (
    <>
      <CreateEditModalShell
        size="lg"
        title={`Edit Role ${role.name}`}
        onClose={onClose}
        headerExtra={recordEventHistoryFieldChromeToggle(history)}
        auxiliaryFooter={<RoleEditAuditFooter role={role} />}
        auxiliaryFooterClassName="!mt-0 border-t border-slate-200 bg-slate-50/90 px-3"
        footer={(
          <>
            <AppButton intent="cancel" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </AppButton>
            <AppButton intent="primary" onClick={onSubmit} disabled={isUpdating}>
              <Save className="h-3.5 w-3.5" />
              {isUpdating ? 'Saving...' : 'Save'}
            </AppButton>
          </>
        )}
      >
        <div className="flex flex-col gap-1">
          {editError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {editError}
            </div>
          ) : null}
          <RecordForm
            mode="edit"
            columns={ROLE_FORM_COLUMNS}
            fields={['name', 'note']}
            values={form}
            onChange={(next) => onFormChange({
              name: String(next.name ?? form.name),
              note: String(next.note ?? ''),
            })}
            lockedFields={['name']}
            historyTrackedFields={ROLE_TRACKED_FIELDS}
            onOpenFieldHistory={history.available && history.fieldIconsVisible ? history.openHistory : undefined}
          />
        </div>
      </CreateEditModalShell>
      <RecordEventHistoryDialog
        open={history.dialogOpen}
        title={history.dialogField ? `${timelineCopy.title} · ${history.dialogField}` : timelineCopy.title}
        subjectKind="base_roles"
        subjectId={role.id}
        field={history.dialogField}
        onClose={history.closeHistory}
        onRestore={(item) => void restoreHistoryField(item)}
      />
    </>
  );
};
