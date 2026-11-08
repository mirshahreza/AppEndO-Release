import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ConfirmDialogShell } from '../../../shared/ui';
import type { GitPageModel } from '../hooks/useGitPage';

type GitProtectedBranchConfirmModalProps = {
  page: GitPageModel;
};

export const GitProtectedBranchConfirmModal: React.FC<GitProtectedBranchConfirmModalProps> = ({ page }) => {
  if (!page.protectedBranchConfirm) {
    return null;
  }

  const actionLabel = page.protectedBranchConfirm.action === 'sync' ? 'Sync' : 'Push';

  return (
    <ConfirmDialogShell
      size="md"
      title={`${actionLabel} to protected branch`}
      icon={<AlertTriangle className="h-4 w-4" />}
      iconToneClassName="text-amber-600"
      confirmIntent="warning"
      onClose={page.closeProtectedBranchConfirm}
      onConfirm={() => void page.executeProtectedBranchAction()}
      confirmLabel={actionLabel}
    >
      <>
        You are about to
        {' '}
        {actionLabel.toLowerCase()}
        {' '}
        to
        {' '}
        <span className="font-semibold text-slate-800">{page.protectedBranchConfirm.branch}</span>
        . Continue?
      </>
    </ConfirmDialogShell>
  );
};
