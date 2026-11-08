import React from 'react';
import { CreateEditModalShell } from '../../../shared/ui';
import { WorkItemInboxPanel } from './WorkItemInboxPanel';

export type PersonalInboxWorkItemDetailDialogProps = {
  workItemId: number | null;
  onClose: () => void;
};

export const PersonalInboxWorkItemDetailDialog: React.FC<PersonalInboxWorkItemDetailDialogProps> = ({
  workItemId,
  onClose,
}) => {
  if (workItemId == null || workItemId <= 0) {
    return null;
  }

  return (
    <CreateEditModalShell
      showHeader={false}
      size="lg"
      onClose={onClose}
      title=""
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
      bodyOuterClassName="flex min-h-[min(80dvh,720px)] flex-col p-0"
    >
      <WorkItemInboxPanel initialWorkItemId={workItemId} onBackToInbox={onClose} />
    </CreateEditModalShell>
  );
};
