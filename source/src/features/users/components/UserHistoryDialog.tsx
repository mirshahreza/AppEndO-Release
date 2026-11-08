import React from 'react';
import { RecordEventHistoryDialog } from '../../../shared/ui';
import { USER_PROFILE_HISTORY_FIELD_MAP } from '../../../shared/lib/recordEventHistoryFields';
import { restoreUserHistoryEvent } from '../restoreUserHistoryEvent';

export type UserHistoryDialogProps = {
  userId: number | null;
  title?: string;
  open: boolean;
  onClose: () => void;
};

export const UserHistoryDialog: React.FC<UserHistoryDialogProps> = ({
  userId,
  title = 'History',
  open,
  onClose,
}) => (
  <RecordEventHistoryDialog
    open={open && userId != null}
    title={title}
    subjectKind="base_users"
    subjectId={userId}
    fieldMap={USER_PROFILE_HISTORY_FIELD_MAP}
    onClose={onClose}
    onRestore={userId == null ? undefined : (item) => restoreUserHistoryEvent(userId, item)}
  />
);
