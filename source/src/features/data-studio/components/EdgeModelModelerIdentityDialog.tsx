import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  CreateEditModalShell,
  DirectionalText,
  FORM_FIELD_LABEL_CLASS,
} from '../../../shared/ui';
import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';

const FIELD_LABEL_CLASS = cn(
  FORM_FIELD_LABEL_CLASS,
  'normal-case tracking-normal text-[11px] text-slate-500',
);

const MetaField: React.FC<{
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}> = ({ label, value, mono = false }) => (
  <div className="min-w-0 flex flex-col gap-[2px] ps-[4px]">
    <div className={FIELD_LABEL_CLASS}>{label}</div>
    <div
      className={cn(
        'break-words text-sm font-medium text-slate-800',
        mono && 'font-mono text-[12px]',
      )}
    >
      {typeof value === 'string' ? <DirectionalText as="span" text={value} /> : value}
    </div>
  </div>
);

export type EdgeModelModelerIdentityDialogProps = {
  open: boolean;
  onClose: () => void;
  model: EdgeModelDefinition;
};

export const EdgeModelModelerIdentityDialog: React.FC<EdgeModelModelerIdentityDialogProps> = ({
  open,
  onClose,
  model,
}) => {
  if (!open) {
    return null;
  }

  const primaryKeyLabel = Array.isArray(model.primaryKey)
    ? model.primaryKey.join(', ')
    : model.primaryKey;
  const schemaLabel = model.sequelize.schema ?? model.schema;

  return (
    <CreateEditModalShell
      size="sm"
      title="Identity"
      subtitle={model.objectName}
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <div className="flex justify-end">
          <AppButton intent="secondary" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Close
          </AppButton>
        </div>
      )}
    >
      <div className="flex flex-col gap-2.5">
        <MetaField label="Model" value={model.sequelize.modelName} mono />
        <MetaField label="Table" value={model.sequelize.tableName} mono />
        {schemaLabel ? (
          <MetaField label="Schema" value={schemaLabel} mono />
        ) : null}
        <MetaField label="Primary key" value={primaryKeyLabel} mono />
        <MetaField label="Fingerprint" value={model.schemaFingerprint} mono />
      </div>
    </CreateEditModalShell>
  );
};
