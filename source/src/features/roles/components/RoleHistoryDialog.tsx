import React from 'react';
import { RECORD_CHANGE_REASON_REVERTED } from '../../../shared/api/contracts/record-events';
import { apiPut } from '../../../shared/api/client';
import { RecordEventHistoryDialog } from '../../../shared/ui';
import { restoreRecordEventValue } from '../../../shared/lib/useRecordSubjectHistory';
import type { RoleRecord } from '../types';

export type RoleHistoryDialogProps = {
  role: RoleRecord | null;
  open: boolean;
  onClose: () => void;
};

export const RoleHistoryDialog: React.FC<RoleHistoryDialogProps> = ({
  role,
  open,
  onClose,
}) => (
  <RecordEventHistoryDialog
    open={open && Boolean(role)}
    title={role ? `History · ${role.name}` : 'History'}
    subjectKind="base_roles"
    subjectId={role?.id}
    onClose={onClose}
    onRestore={role ? async (item) => {
      if (item.field !== 'note') return;
      const value = restoreRecordEventValue(item.fromValue);
      if (value === undefined) return;
      await apiPut(`/api/roles/${role.id}`, {
        note: value == null ? null : String(value),
        __changeReasonCode: RECORD_CHANGE_REASON_REVERTED,
        __changeReasonText: 'Restored previous value',
        __revertedFromSeq: item.subjectSeq,
        __revertedFromEventId: item.id,
      });
    } : undefined}
  />
);
