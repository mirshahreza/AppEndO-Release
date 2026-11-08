import React from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDialogShell, DestructiveConfirmBody } from '../../../shared/ui';
import type { GitPageModel } from '../hooks/useGitPage';

type GitDiscardConfirmModalProps = {
  page: GitPageModel;
};

export const GitDiscardConfirmModal: React.FC<GitDiscardConfirmModalProps> = ({ page }) => {
  if (!page.discardConfirm) {
    return null;
  }

  return (
    <ConfirmDialogShell
      size="md"
      title="Discard changes"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={page.closeDiscardConfirm}
      onConfirm={() => void page.executeDiscard()}
      confirmLabel="Discard"
    >
      <DestructiveConfirmBody
        question="Are you sure you want to discard these changes?"
        warning="This cannot be undone."
        entityName={page.discardConfirm.label}
      />
    </ConfirmDialogShell>
  );
};
