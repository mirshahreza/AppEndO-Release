import React from 'react';
import { Link2, Settings2, Trash2 } from 'lucide-react';
import type { SchemaRelationEdge } from '../../../shared/api/contracts/data-sources/schemaRelations';
import {
  AppButton,
  CreateEditModalShell,
} from '../../../shared/ui';
import { formatReferentialActionLabel } from '../lib/relationNatureConversion';
import { RelationsConvertHeaderAction } from './RelationsConvertHeaderAction';

type RelationsPhysicalRelationDialogProps = {
  open: boolean;
  relation: SchemaRelationEdge | null;
  onClose: () => void;
  canDrop?: boolean;
  canEditRules?: boolean;
  canConvertToLogical?: boolean;
  elevated?: boolean;
  onDrop?: () => void;
  onEditRules?: () => void;
  onConvertToLogical?: () => void;
};

export const RelationsPhysicalRelationDialog: React.FC<RelationsPhysicalRelationDialogProps> = ({
  open,
  relation,
  onClose,
  canDrop = false,
  canEditRules = false,
  canConvertToLogical = false,
  elevated = false,
  onDrop,
  onEditRules,
  onConvertToLogical,
}) => {
  if (!open || !relation) {
    return null;
  }

  const name = relation.constraintName?.trim()
    || `${relation.fromColumn} → ${relation.toColumn}`;
  const cascadeLabel = formatReferentialActionLabel(relation.onDelete, relation.onUpdate);

  return (
    <CreateEditModalShell
      size="md"
      title="Physical relation"
      subtitle={(
        <div className="flex w-full min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate font-medium text-slate-700">{name}</span>
          {canConvertToLogical && onConvertToLogical ? (
            <RelationsConvertHeaderAction
              label="Convert to logical"
              onClick={onConvertToLogical}
            />
          ) : null}
        </div>
      )}
      subtitleTone="muted"
      subtitleClassName="!py-1"
      onClose={onClose}
      onBackdropClick={onClose}
      closeOnEscape
      showCloseButton
      backdropClassName={elevated ? '!z-[500]' : undefined}
      footer={
        (canDrop && onDrop) || (canEditRules && onEditRules) ? (
          <>
            {canDrop && onDrop ? (
              <AppButton
                intent="cancel"
                size="sm"
                className="me-auto !border-transparent !bg-transparent !text-slate-500 hover:!border-rose-200 hover:!bg-rose-50 hover:!text-rose-600"
                onClick={onDrop}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </AppButton>
            ) : null}
            {canEditRules && onEditRules ? (
              <AppButton intent="secondary" size="sm" onClick={onEditRules}>
                <Settings2 className="h-3.5 w-3.5" />
                Edit rules
              </AppButton>
            ) : null}
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <p className="ps-[4px] text-[11px] text-slate-500">
          This relation is a database foreign-key constraint.
        </p>

        <div className="rounded-md border border-violet-100 bg-violet-50/60 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-900">
            <Link2 className="h-3.5 w-3.5" />
            {name}
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px] text-violet-950/90">
            <dt className="text-violet-700/80">From</dt>
            <dd>
              {relation.fromTable}
              .
              {relation.fromColumn}
            </dd>
            <dt className="text-violet-700/80">To</dt>
            <dd>
              {relation.toTable}
              .
              {relation.toColumn}
            </dd>
            <dt className="text-violet-700/80">Cascade</dt>
            <dd>{cascadeLabel ?? 'Database default'}</dd>
          </dl>
        </div>
      </div>
    </CreateEditModalShell>
  );
};
