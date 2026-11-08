import React, { useEffect, useState } from 'react';
import { Check, Loader2, Shield } from 'lucide-react';
import {
  FK_REFERENTIAL_ACTIONS,
  type FkReferentialAction,
} from '../../../shared/api/contracts/data-sources/foreignKeyConstraint';
import type { SchemaRelationEdge } from '../../../shared/api/contracts/data-sources/schemaRelations';
import {
  useAddForeignKeyConstraintMutation,
  useDropForeignKeyConstraintMutation,
} from '../../../shared/api/queries/data-sources';
import {
  AppButton,
  CreateEditModalShell,
  FormField,
  UiSelect,
} from '../../../shared/ui';

type RelationsPhysicalRulesDialogProps = {
  open: boolean;
  relation: SchemaRelationEdge | null;
  dataSourceId: string;
  elevated?: boolean;
  onClose: () => void;
  onSaved: (next: {
    onDelete?: FkReferentialAction;
    onUpdate?: FkReferentialAction;
  }) => void;
};

const toAction = (value: string | null | undefined): '' | FkReferentialAction => {
  const trimmed = value?.trim().toUpperCase().replace(/_/g, ' ') ?? '';
  if ((FK_REFERENTIAL_ACTIONS as readonly string[]).includes(trimmed)) {
    return trimmed as FkReferentialAction;
  }
  return '';
};

export const RelationsPhysicalRulesDialog: React.FC<RelationsPhysicalRulesDialogProps> = ({
  open,
  relation,
  dataSourceId,
  elevated = false,
  onClose,
  onSaved,
}) => {
  const dropMutation = useDropForeignKeyConstraintMutation();
  const addMutation = useAddForeignKeyConstraintMutation();
  const [onDelete, setOnDelete] = useState<'' | FkReferentialAction>('');
  const [onUpdate, setOnUpdate] = useState<'' | FkReferentialAction>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !relation) {
      return;
    }
    setOnDelete(toAction(relation.onDelete));
    setOnUpdate(toAction(relation.onUpdate));
    setError(null);
  }, [open, relation]);

  if (!open || !relation) {
    return null;
  }

  const constraintName = relation.constraintName?.trim() || '';
  const isSubmitting = dropMutation.isPending || addMutation.isPending;
  const name = constraintName || `${relation.fromColumn} → ${relation.toColumn}`;

  const handleSave = async () => {
    setError(null);
    if (!constraintName) {
      setError('This physical relation has no constraint name to update.');
      return;
    }

    try {
      await dropMutation.mutateAsync({
        dataSourceId,
        tableName: relation.fromTable,
        constraintName,
      });
      await addMutation.mutateAsync({
        dataSourceId,
        tableName: relation.fromTable,
        columnName: relation.fromColumn,
        referencedTable: relation.toTable,
        referencedColumn: relation.toColumn,
        constraintName,
        ...(onDelete ? { onDelete } : {}),
        ...(onUpdate ? { onUpdate } : {}),
      });
      onSaved({
        ...(onDelete ? { onDelete } : {}),
        ...(onUpdate ? { onUpdate } : {}),
      });
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to update foreign-key rules.',
      );
    }
  };

  return (
    <CreateEditModalShell
      size="md"
      title="Edit relation rules"
      subtitle={name}
      subtitleTone="muted"
      onClose={isSubmitting ? () => undefined : onClose}
      onBackdropClick={isSubmitting ? () => undefined : onClose}
      closeOnEscape={!isSubmitting}
      showCloseButton
      backdropClassName={elevated ? '!z-[540]' : undefined}
      footer={(
        <AppButton
          intent="primary"
          size="sm"
          disabled={isSubmitting || !constraintName}
          onClick={() => { void handleSave(); }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              Save rules
            </>
          )}
        </AppButton>
      )}
    >
      <div className="flex flex-col gap-3">
        <p className="ps-[4px] text-[11px] text-slate-500">
          Updates ON DELETE / ON UPDATE by recreating the database foreign-key constraint.
        </p>

        <div className="rounded-md border border-violet-100 bg-violet-50/60 px-3 py-2 font-mono text-[11px] text-violet-900">
          <div className="flex items-center gap-1.5 font-sans text-xs font-semibold">
            <Shield className="h-3.5 w-3.5" />
            Mapping
          </div>
          <div className="mt-1">
            {relation.fromTable}
            .
            {relation.fromColumn}
            {' → '}
            {relation.toTable}
            .
            {relation.toColumn}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FormField label="On delete" hint="Referential action when the parent row is deleted.">
            <UiSelect
              size="sm"
              value={onDelete}
              placeholder="Database default"
              disabled={isSubmitting}
              className="h-8 min-w-0 w-full text-[11px]"
              onChange={(event) => {
                setOnDelete(event.target.value as '' | FkReferentialAction);
                setError(null);
              }}
            >
              {FK_REFERENTIAL_ACTIONS.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </UiSelect>
          </FormField>
          <FormField label="On update" hint="Referential action when the parent key changes.">
            <UiSelect
              size="sm"
              value={onUpdate}
              placeholder="Database default"
              disabled={isSubmitting}
              className="h-8 min-w-0 w-full text-[11px]"
              onChange={(event) => {
                setOnUpdate(event.target.value as '' | FkReferentialAction);
                setError(null);
              }}
            >
              {FK_REFERENTIAL_ACTIONS.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </UiSelect>
          </FormField>
        </div>

        {error ? <p className="ps-[4px] text-xs font-semibold text-rose-600">{error}</p> : null}
      </div>
    </CreateEditModalShell>
  );
};
