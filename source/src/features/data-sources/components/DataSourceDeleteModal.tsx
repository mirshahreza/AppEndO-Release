import React from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDialogShell, DestructiveConfirmBody } from '../../../shared/ui';
import type { DataSourceRecord } from '../../../shared/api/contracts/data-sources/types';

type DataSourceDeleteModalProps = {
  target: DataSourceRecord;
  onCancel: () => void;
  onConfirm: () => void;
};

export const DataSourceDeleteModal: React.FC<DataSourceDeleteModalProps> = ({
  target,
  onCancel,
  onConfirm,
}) => (
  <ConfirmDialogShell
    size="md"
    title="Delete Data Source"
    icon={<Trash2 className="h-4 w-4" />}
    onClose={onCancel}
    onConfirm={onConfirm}
    confirmLabel="Delete"
  >
    <DestructiveConfirmBody
      question="Are you sure you want to delete this data source?"
      entityName={target.name}
    />
  </ConfirmDialogShell>
);
