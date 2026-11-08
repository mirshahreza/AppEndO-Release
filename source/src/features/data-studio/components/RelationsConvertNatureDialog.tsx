import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Check, Loader2 } from 'lucide-react';
import type { EdgeModelAssociation, EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import type { SchemaRelationEdge } from '../../../shared/api/contracts/data-sources/schemaRelations';
import {
  useAddForeignKeyConstraintMutation,
  useDropForeignKeyConstraintMutation,
} from '../../../shared/api/queries/data-sources';
import {
  AppButton,
  CreateEditModalShell,
} from '../../../shared/ui';
import { associationKindLabel } from '../lib/edgeModelAssociations';
import {
  buildAddForeignKeyFromPlan,
  ensureUniqueAssociationAlias,
  findAssociationForPhysicalRelation,
  planLogicalToPhysical,
  planPhysicalToLogical,
} from '../lib/relationNatureConversion';

export type RelationsConvertNatureRequest =
  | {
    direction: 'logical-to-physical';
    association: EdgeModelAssociation;
  }
  | {
    direction: 'physical-to-logical';
    relation: SchemaRelationEdge;
  };

type RelationsConvertNatureDialogProps = {
  open: boolean;
  request: RelationsConvertNatureRequest | null;
  onClose: () => void;
  dataSourceId: string;
  focusModel: EdgeModelDefinition;
  peerModels: ReadonlyArray<EdgeModelDefinition>;
  associations: ReadonlyArray<EdgeModelAssociation>;
  elevated?: boolean;
  onLogicalAdded: (association: EdgeModelAssociation) => Promise<void> | void;
  onPhysicalChanged: () => void;
};

export const RelationsConvertNatureDialog: React.FC<RelationsConvertNatureDialogProps> = ({
  open,
  request,
  onClose,
  dataSourceId,
  focusModel,
  peerModels,
  associations,
  elevated = false,
  onLogicalAdded,
  onPhysicalChanged,
}) => {
  const addMutation = useAddForeignKeyConstraintMutation();
  const dropMutation = useDropForeignKeyConstraintMutation();
  const [error, setError] = useState<string | null>(null);

  const modelById = useMemo(() => {
    const map = new Map<string, EdgeModelDefinition>();
    map.set(focusModel.id, focusModel);
    for (const model of peerModels) {
      map.set(model.id, model);
    }
    return map;
  }, [focusModel, peerModels]);

  const logicalPlan = useMemo(() => {
    if (!request || request.direction !== 'logical-to-physical') {
      return null;
    }
    const targetModel = modelById.get(request.association.targetModelId);
    if (!targetModel) {
      return { error: 'Target Edge model was not found for this logical relation.' } as const;
    }
    return planLogicalToPhysical({
      association: request.association,
      focusModel,
      targetModel,
    });
  }, [focusModel, modelById, request]);

  const existingLogical = useMemo(() => {
    if (!request || request.direction !== 'physical-to-logical') {
      return null;
    }
    return findAssociationForPhysicalRelation({
      relation: request.relation,
      focusObjectName: focusModel.objectName,
      associations,
      models: [focusModel, ...peerModels],
    });
  }, [associations, focusModel, peerModels, request]);

  const physicalPlan = useMemo(() => {
    if (!request || request.direction !== 'physical-to-logical') {
      return null;
    }
    if (existingLogical) {
      return { association: existingLogical, alreadyPresent: true as const };
    }
    return planPhysicalToLogical({
      focusObjectName: focusModel.objectName,
      relation: request.relation,
      models: [focusModel, ...peerModels],
      dataSourceId,
      existing: associations,
    });
  }, [associations, dataSourceId, existingLogical, focusModel, peerModels, request]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
  }, [open, request]);

  if (!open || !request) {
    return null;
  }

  const isSubmitting = addMutation.isPending || dropMutation.isPending;
  const title = request.direction === 'logical-to-physical'
    ? 'Convert to physical'
    : 'Convert to logical';

  const handleConfirm = async () => {
    setError(null);
    try {
      if (request.direction === 'logical-to-physical') {
        if (!logicalPlan || 'error' in logicalPlan) {
          setError(logicalPlan && 'error' in logicalPlan ? logicalPlan.error : 'Conversion is not available.');
          return;
        }
        const payload = buildAddForeignKeyFromPlan({
          dataSourceId,
          plan: logicalPlan,
        });
        await addMutation.mutateAsync(payload);
        // Physical FK must stay reflected on the Edge model — keep the association.
        onPhysicalChanged();
        onClose();
        return;
      }

      if (!physicalPlan || 'error' in physicalPlan) {
        setError(physicalPlan && 'error' in physicalPlan ? physicalPlan.error : 'Conversion is not available.');
        return;
      }

      const constraintName = request.relation.constraintName?.trim();
      if (!constraintName) {
        setError('This physical relation has no constraint name to drop.');
        return;
      }

      if (!('alreadyPresent' in physicalPlan && physicalPlan.alreadyPresent)) {
        const peerName = physicalPlan.kind === 'belongsTo'
          ? physicalPlan.toTable
          : physicalPlan.fromTable;
        const association = ensureUniqueAssociationAlias(
          physicalPlan.association,
          associations,
          peerName,
        );
        await onLogicalAdded(association);
      }

      await dropMutation.mutateAsync({
        dataSourceId,
        tableName: request.relation.fromTable,
        constraintName,
      });
      onPhysicalChanged();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to convert relation.');
    }
  };

  const body = (() => {
    if (request.direction === 'logical-to-physical') {
      if (!logicalPlan || 'error' in logicalPlan) {
        return (
          <p className="text-sm text-rose-600">
            {logicalPlan && 'error' in logicalPlan ? logicalPlan.error : 'Conversion is not available.'}
          </p>
        );
      }
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-700">
            Create the database foreign-key for
            {' '}
            <span className="font-semibold">{request.association.as}</span>
            {' '}
            (
            {associationKindLabel(request.association.kind)}
            ). Cascade rules can be adjusted later.
          </p>
          <div className="rounded-md border border-violet-100 bg-violet-50/60 px-3 py-2 font-mono text-[11px] text-violet-900">
            {logicalPlan.tableName}
            .
            {logicalPlan.columnName}
            {' → '}
            {logicalPlan.referencedTable}
            .
            {logicalPlan.referencedColumn}
          </div>
          <p className="text-[11px] text-slate-500">
            Constraint
            {' '}
            <span className="font-mono text-slate-700">{logicalPlan.suggestedConstraintName}</span>
            {' '}
            · Edge model association is kept.
          </p>
          {logicalPlan.altersPeerTable ? (
            <p className="text-xs text-amber-800">
              The foreign-key column lives on
              {' '}
              {logicalPlan.tableName}
              . Creating the physical constraint will alter that peer table.
            </p>
          ) : null}
        </div>
      );
    }

    if (!physicalPlan || 'error' in physicalPlan) {
      return (
        <p className="text-sm text-rose-600">
          {physicalPlan && 'error' in physicalPlan ? physicalPlan.error : 'Conversion is not available.'}
        </p>
      );
    }

    const association = physicalPlan.association;
    const alreadyPresent = 'alreadyPresent' in physicalPlan && physicalPlan.alreadyPresent;

    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-700">
          Remove the database foreign-key and keep this relation as Edge model metadata only.
        </p>
        <div className="rounded-md border border-teal-100 bg-teal-50/60 px-3 py-2 text-[11px] text-teal-900">
          <div className="font-semibold">{association.as}</div>
          <div className="mt-0.5">
            {associationKindLabel(association.kind)}
            {' · FK '}
            <span className="font-mono">{association.foreignKey}</span>
          </div>
          <div className="mt-0.5 font-mono text-[10px] opacity-80">
            {request.relation.fromTable}
            .
            {request.relation.fromColumn}
            {' → '}
            {request.relation.toTable}
            .
            {request.relation.toColumn}
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Constraint
          {' '}
          <span className="font-mono text-slate-700">
            {request.relation.constraintName || '(unnamed)'}
          </span>
          {' '}
          will be dropped
          {alreadyPresent ? ' · existing association is kept.' : ' · association will be created.'}
        </p>
      </div>
    );
  })();

  const canConfirm = request.direction === 'logical-to-physical'
    ? Boolean(logicalPlan && !('error' in logicalPlan))
    : Boolean(
      physicalPlan
      && !('error' in physicalPlan)
      && request.relation.constraintName?.trim(),
    );

  return (
    <CreateEditModalShell
      size="md"
      title={title}
      subtitle={focusModel.objectName}
      subtitleTone="muted"
      onClose={isSubmitting ? () => undefined : onClose}
      onBackdropClick={isSubmitting ? () => undefined : onClose}
      closeOnEscape={!isSubmitting}
      showCloseButton
      backdropClassName={elevated ? '!z-[520]' : undefined}
      footer={(
        <AppButton
          intent="primary"
          size="sm"
          disabled={isSubmitting || !canConfirm}
          onClick={() => { void handleConfirm(); }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Converting…
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              Convert
            </>
          )}
        </AppButton>
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Relation nature
        </div>
        {body}
        {error ? <p className="ps-[4px] text-xs font-semibold text-rose-600">{error}</p> : null}
      </div>
    </CreateEditModalShell>
  );
};
