import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ConfirmDialogShell } from '../../../shared/ui';
import type { GitPageModel } from '../hooks/useGitPage';

type GitWorkflowTemplateApplyConfirmModalProps = {
  page: GitPageModel;
};

export const GitWorkflowTemplateApplyConfirmModal: React.FC<GitWorkflowTemplateApplyConfirmModalProps> = ({
  page,
}) => {
  if (!page.workflowTemplateApplyConfirm) {
    return null;
  }

  const { template } = page.workflowTemplateApplyConfirm;

  return (
    <ConfirmDialogShell
      size="md"
      title="Replace workflow file"
      icon={<AlertTriangle className="h-4 w-4" />}
      iconToneClassName="text-amber-600"
      confirmIntent="warning"
      onClose={page.closeWorkflowTemplateApplyConfirm}
      onConfirm={() => void page.executeWorkflowTemplateApply(true)}
      confirmLabel="Replace"
      isConfirming={page.isApplyingWorkflowTemplate}
      confirmingLabel="Replacing…"
    >
      <>
        Apply
        {' '}
        <span className="font-semibold text-slate-800">{template.name}</span>
        {' '}
        to
        {' '}
        <span className="font-mono text-slate-800">{template.defaultTargetPath}</span>
        ? The existing file will be overwritten.
      </>
    </ConfirmDialogShell>
  );
};
