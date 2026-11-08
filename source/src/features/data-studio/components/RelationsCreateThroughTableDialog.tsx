import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Table2 } from 'lucide-react';
import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import { useImportEdgeModelMutation, usePatchEdgeModelMutation } from '../../../shared/api/queries/data-api';
import {
  useAddForeignKeyConstraintMutation,
  useCreateSchemaObjectMutation,
} from '../../../shared/api/queries/data-sources';
import { canMutatePhysicalForeignKeys, suggestForeignKeyConstraintName } from '../../../shared/lib/schemaObjectForeignKey';
import { sanitizeSchemaObjectNameInput, validateSchemaObjectName } from '../../../shared/lib/schemaObjectName';
import {
  AppButton,
  CreateEditModalShell,
  FormField,
  UiCheckbox,
  UiInput,
} from '../../../shared/ui';
import { createEdgeModelColumnFromNativeType } from '../lib/edgeModelColumnUtils';
import {
  preferredForeignKeyColumnName,
  resolveModelPrimaryKey,
  suggestThroughTableName,
} from '../lib/edgeModelAssociations';

export type CreatedThroughTableResult = {
  throughModelId: string;
  throughObjectName: string;
  foreignKey: string;
  otherKey: string;
};

type RelationsCreateThroughTableDialogProps = {
  open: boolean;
  onClose: () => void;
  dataSourceId: string;
  dataSourceType: string | null;
  sourceModel: Pick<EdgeModelDefinition, 'id' | 'objectName' | 'primaryKey' | 'columns'>;
  targetModel: Pick<EdgeModelDefinition, 'id' | 'objectName' | 'primaryKey' | 'columns'>;
  existingObjectNames: ReadonlySet<string>;
  elevated?: boolean;
  onCreated: (result: CreatedThroughTableResult) => void;
};

export const RelationsCreateThroughTableDialog: React.FC<RelationsCreateThroughTableDialogProps> = ({
  open,
  onClose,
  dataSourceId,
  dataSourceType,
  sourceModel,
  targetModel,
  existingObjectNames,
  elevated = false,
  onCreated,
}) => {
  const createTableMutation = useCreateSchemaObjectMutation();
  const importModelMutation = useImportEdgeModelMutation();
  const patchModelMutation = usePatchEdgeModelMutation();
  const addFkMutation = useAddForeignKeyConstraintMutation();

  const sourcePk = useMemo(() => resolveModelPrimaryKey(sourceModel), [sourceModel]);
  const targetPk = useMemo(() => resolveModelPrimaryKey(targetModel), [targetModel]);
  const canCreatePhysicalFks = canMutatePhysicalForeignKeys(
    dataSourceType,
    'TABLE',
    'junction_table',
  );

  const [tableName, setTableName] = useState('');
  const [foreignKey, setForeignKey] = useState('');
  const [otherKey, setOtherKey] = useState('');
  const [createPhysicalFks, setCreatePhysicalFks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTableName(suggestThroughTableName(
      sourceModel.objectName,
      targetModel.objectName,
      existingObjectNames,
    ));
    setForeignKey(preferredForeignKeyColumnName(sourceModel.objectName));
    setOtherKey(preferredForeignKeyColumnName(targetModel.objectName));
    setCreatePhysicalFks(canCreatePhysicalFks);
    setError(null);
  }, [
    canCreatePhysicalFks,
    existingObjectNames,
    open,
    sourceModel.objectName,
    targetModel.objectName,
  ]);

  if (!open) {
    return null;
  }

  const isSubmitting = createTableMutation.isPending
    || importModelMutation.isPending
    || patchModelMutation.isPending
    || addFkMutation.isPending;

  const tableNameError = validateSchemaObjectName(tableName);
  const foreignKeyError = validateSchemaObjectName(foreignKey, { fieldLabel: 'Foreign key' });
  const otherKeyError = validateSchemaObjectName(otherKey, { fieldLabel: 'Other key' });

  const handleConfirm = async () => {
    setError(null);

    if (!sourcePk) {
      setError(`Source model ${sourceModel.objectName} has no primary key.`);
      return;
    }
    if (!targetPk) {
      setError(`Target model ${targetModel.objectName} has no primary key.`);
      return;
    }
    if (tableNameError || foreignKeyError || otherKeyError) {
      setError(tableNameError || foreignKeyError || otherKeyError);
      return;
    }
    if (existingObjectNames.has(tableName.trim())) {
      setError(`A table or Edge model named "${tableName.trim()}" already exists.`);
      return;
    }
    if (foreignKey.trim() === otherKey.trim()) {
      setError('Foreign key and other key must be different columns.');
      return;
    }

    try {
      const objectName = tableName.trim();
      await createTableMutation.mutateAsync({
        dataSourceId,
        objectName,
        objectType: 'TABLE',
      });

      const imported = await importModelMutation.mutateAsync({
        dataSourceId,
        objectName,
        objectType: 'TABLE',
      });

      const sourceFkColumn = createEdgeModelColumnFromNativeType(
        foreignKey.trim(),
        sourcePk.dataType,
        { nullable: false },
      );
      const targetFkColumn = createEdgeModelColumnFromNativeType(
        otherKey.trim(),
        targetPk.dataType,
        { nullable: false },
      );

      const patched = await patchModelMutation.mutateAsync({
        modelId: imported.id,
        patch: {
          columns: [...imported.columns, sourceFkColumn, targetFkColumn],
        },
      });

      if (createPhysicalFks && canCreatePhysicalFks) {
        await addFkMutation.mutateAsync({
          dataSourceId,
          tableName: objectName,
          columnName: foreignKey.trim(),
          referencedTable: sourceModel.objectName,
          referencedColumn: sourcePk.columnName,
          constraintName: suggestForeignKeyConstraintName(objectName, foreignKey.trim()),
        });
        await addFkMutation.mutateAsync({
          dataSourceId,
          tableName: objectName,
          columnName: otherKey.trim(),
          referencedTable: targetModel.objectName,
          referencedColumn: targetPk.columnName,
          constraintName: suggestForeignKeyConstraintName(objectName, otherKey.trim()),
        });
      }

      onCreated({
        throughModelId: patched.id,
        throughObjectName: patched.objectName,
        foreignKey: foreignKey.trim(),
        otherKey: otherKey.trim(),
      });
      onClose();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Failed to create the through table.',
      );
    }
  };

  return (
    <CreateEditModalShell
      size="lg"
      title="Create through table"
      subtitle={`${sourceModel.objectName} ↔ ${targetModel.objectName}`}
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
          disabled={isSubmitting || Boolean(tableNameError || foreignKeyError || otherKeyError)}
          onClick={() => { void handleConfirm(); }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              Create table
            </>
          )}
        </AppButton>
      )}
    >
      <div className="flex flex-col gap-4">
        <p className="ps-[4px] text-[11px] text-slate-500">
          Create a junction table for this Belongs to many relation. Review the suggested names,
          change them if needed, then confirm. After the table is created, the relation form is
          filled so you can review and add the logical relation.
        </p>

        <FormField
          label="Table name"
          hint="New database table / Edge model for the junction."
          invalid={Boolean(tableNameError)}
          error={tableNameError ?? undefined}
        >
          <UiInput
            size="sm"
            autoDir={false}
            value={tableName}
            disabled={isSubmitting}
            className="w-full min-w-0 font-mono"
            onChange={(event) => setTableName(sanitizeSchemaObjectNameInput(event.target.value))}
          />
        </FormField>

        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            label="Foreign key (source side)"
            hint={`Points at ${sourceModel.objectName}.${sourcePk?.columnName ?? 'id'} (${sourcePk?.dataType ?? '…'})`}
            invalid={Boolean(foreignKeyError)}
            error={foreignKeyError ?? undefined}
          >
            <UiInput
              size="sm"
              autoDir={false}
              value={foreignKey}
              disabled={isSubmitting}
              className="w-full min-w-0 font-mono"
              onChange={(event) => setForeignKey(sanitizeSchemaObjectNameInput(event.target.value))}
            />
          </FormField>
          <FormField
            label="Other key (target side)"
            hint={`Points at ${targetModel.objectName}.${targetPk?.columnName ?? 'id'} (${targetPk?.dataType ?? '…'})`}
            invalid={Boolean(otherKeyError)}
            error={otherKeyError ?? undefined}
          >
            <UiInput
              size="sm"
              autoDir={false}
              value={otherKey}
              disabled={isSubmitting}
              className="w-full min-w-0 font-mono"
              onChange={(event) => setOtherKey(sanitizeSchemaObjectNameInput(event.target.value))}
            />
          </FormField>
        </div>

        {canCreatePhysicalFks ? (
          <UiCheckbox
            size="sm"
            checked={createPhysicalFks}
            disabled={isSubmitting}
            onChange={(event) => setCreatePhysicalFks(event.target.checked)}
          >
            Also create physical foreign-key constraints on the through table
          </UiCheckbox>
        ) : (
          <p className="inline-flex items-center gap-1.5 ps-[4px] text-[11px] text-slate-500">
            <Table2 className="h-3.5 w-3.5" />
            Physical foreign-key constraints are not available on this data source; columns only will be created.
          </p>
        )}

        {error ? <p className="ps-[4px] text-xs font-semibold text-rose-600">{error}</p> : null}
      </div>
    </CreateEditModalShell>
  );
};
