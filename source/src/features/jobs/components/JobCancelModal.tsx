import React from 'react';
import { Ban } from 'lucide-react';
import { ConfirmDialogShell } from '../../../shared/ui';
import type { JobGridRow } from '../../../shared/api/contracts/jobs/types';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { interpolateOperationsTemplate } from '../../operations/operationsI18n';

export type JobCancelModalProps = {
  job: JobGridRow | null;
  cancelError: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export const JobCancelModal: React.FC<JobCancelModalProps> = ({
  job,
  cancelError,
  onCancel,
  onConfirm,
}) => {
  const t = useCultureT();

  if (!job) return null;

  return (
    <ConfirmDialogShell
      size="md"
      title={t(operationsKey('jobs.cancel.title'))}
      icon={<Ban className="h-4 w-4" />}
      onClose={onCancel}
      onConfirm={onConfirm}
      cancelLabel={t(operationsKey('common.dismiss'))}
      confirmLabel={t(operationsKey('jobs.cancel.confirm'))}
      error={cancelError}
    >
      <>
        {interpolateOperationsTemplate(t(operationsKey('jobs.cancel.message')), {
          id: `#${job.id}`,
          title: job.title,
        })}
        {job.status === 'running' ? ` ${t(operationsKey('jobs.cancel.runningNote'))}` : null}
      </>
    </ConfirmDialogShell>
  );
};
