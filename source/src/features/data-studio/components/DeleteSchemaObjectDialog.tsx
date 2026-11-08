import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Loader2, Trash2, Waypoints, X } from 'lucide-react';
import type { SchemaObjectDeletePreview } from '../../../shared/api/contracts/data-sources/deleteSchemaObjectPreview';
import {
  AppButton,
  ConfirmDialogShell,
  DestructiveConfirmBody,
  UiInput,
} from '../../../shared/ui';
import { useSchemaObjectDeletePreviewQuery } from '../../../shared/api/queries/data-sources';
import {
  DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS,
  resolveExplorerSchemaQuery,
} from '../lib/explorerObjectKinds';
import type { DataStudioExplorerObjectRow } from '../types';

export type DeleteSchemaObjectDialogProps = {
  target: DataStudioExplorerObjectRow | null;
  dataSourceId: string | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const formatCount = (value: number): string => value.toLocaleString('en-US');

const DELETE_PREVIEW_PANEL_MIN_HEIGHT_CLASS = 'min-h-[240px]';

const relationKindLabel = (kind: string): string => {
  switch (kind) {
    case 'belongsTo':
      return 'Belongs to';
    case 'hasOne':
      return 'Has one';
    case 'hasMany':
      return 'Has many';
    case 'belongsToMany':
      return 'Belongs to many';
    default:
      return kind;
  }
};

const DeleteRelationImpactDetails: React.FC<{
  objectName: string;
  impact: NonNullable<SchemaObjectDeletePreview['relationImpact']>;
}> = ({ objectName, impact }) => {
  const inboundCount = impact.inboundRefs.length;
  const hasAny = impact.outboundLogicalCount > 0
    || inboundCount > 0
    || impact.willParkStudioMeta
    || Boolean(impact.edgeModelId);

  if (!hasAny) {
    return null;
  }

  const remainingOutbound = Math.max(0, impact.outboundLogicalCount - impact.outboundAliases.length);
  const inboundPreview = impact.inboundRefs.slice(0, 6);
  const remainingInbound = Math.max(0, inboundCount - inboundPreview.length);

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/70 px-3 py-2.5 text-xs text-teal-950">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-800">
        <Waypoints className="h-3 w-3" aria-hidden="true" />
        Relations cleanup
      </div>
      <ul className="flex flex-col gap-1 text-start font-medium leading-snug">
        {impact.edgeModelId ? (
          <li>
            Edge model for
            {' '}
            <span className="font-mono font-semibold">{objectName}</span>
            {' '}
            will be removed
            {impact.willParkStudioMeta ? '. Studio Story, tags, and column groups stay with this table name and reattach if you import it again' : ''}
            .
          </li>
        ) : null}
        {impact.outboundLogicalCount > 0 ? (
          <li>
            {formatCount(impact.outboundLogicalCount)}
            {' '}
            logical relation
            {impact.outboundLogicalCount === 1 ? '' : 's'}
            {' '}
            defined on this model will be deleted
            {impact.outboundAliases.length > 0 ? (
              <>
                {' '}
                (
                <span className="font-mono">
                  {impact.outboundAliases.join(', ')}
                  {remainingOutbound > 0 ? `, … +${remainingOutbound}` : ''}
                </span>
                )
              </>
            ) : null}
            .
          </li>
        ) : null}
        {inboundCount > 0 ? (
          <li>
            {formatCount(inboundCount)}
            {' '}
            logical relation
            {inboundCount === 1 ? '' : 's'}
            {' '}
            on other models that reference this table will be removed:
            <ul className="mt-1 flex flex-col gap-0.5 ps-3 font-normal">
              {inboundPreview.map((ref) => (
                <li key={`${ref.peerObjectName}:${ref.as}:${ref.role}`} className="font-mono text-[11px]">
                  <span className="font-semibold">{ref.peerObjectName}</span>
                  {'.'}
                  {ref.as}
                  <span className="text-teal-800/80">
                    {' '}
                    (
                    {relationKindLabel(ref.kind)}
                    {ref.role === 'through' ? ' · through' : ''}
                    )
                  </span>
                </li>
              ))}
              {remainingInbound > 0 ? (
                <li className="text-teal-800/70">
                  … and
                  {' '}
                  {remainingInbound}
                  {' '}
                  more
                </li>
              ) : null}
            </ul>
          </li>
        ) : null}
      </ul>
      <p className="mt-2 text-start text-[11px] font-medium text-teal-900/90">
        Confirming delete will apply this cleanup automatically.
      </p>
    </div>
  );
};

const DeletePreviewDetails: React.FC<{
  target: DataStudioExplorerObjectRow;
  preview: SchemaObjectDeletePreview;
}> = ({ target, preview }) => {
  const isTable = target.objectKind === 'TABLE';
  const isView = target.objectKind === 'VIEW';
  const fieldLabel = target.objectKind === 'STORED_PROCEDURE' || target.objectKind === 'SCALAR_FUNCTION' || target.objectKind === 'TABLE_VALUED_FUNCTION'
    ? 'Parameters'
    : 'Columns';
  const remainingFieldCount = Math.max(0, preview.totalFieldCount - preview.fields.length);

  return (
    <div className="flex flex-col gap-3 text-xs text-slate-600">
      {isTable && preview.rowCount !== null ? (
        <div className="flex flex-col gap-1 text-start font-medium text-rose-700">
          <p>
            This table contains {formatCount(preview.rowCount)} row{preview.rowCount === 1 ? '' : 's'}.
          </p>
          <p>All data will be permanently removed.</p>
        </div>
      ) : null}

      {isView && preview.rowCount !== null ? (
        <p className="text-start font-medium text-rose-700">
          This view currently resolves to {formatCount(preview.rowCount)} row{preview.rowCount === 1 ? '' : 's'}.
        </p>
      ) : null}

      {preview.relationImpact ? (
        <DeleteRelationImpactDetails
          objectName={target.name}
          impact={preview.relationImpact}
        />
      ) : null}

      {preview.totalFieldCount > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-start text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {fieldLabel} ({preview.totalFieldCount})
          </p>
          <ul className="flex flex-col gap-1">
            {preview.fields.map((field) => (
              <li
                key={field.name}
                className="flex items-center gap-2 font-mono text-[11px] text-slate-700"
              >
                <span className="min-w-0 truncate font-semibold">{field.name}</span>
                <span className="shrink-0 text-slate-400">·</span>
                <span className="min-w-0 truncate text-slate-500">{field.dataType}</span>
                {field.isPrimaryKey ? (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                    <KeyRound className="h-2.5 w-2.5" />
                    PK
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {remainingFieldCount > 0 ? (
            <p className="text-start font-mono text-[11px] text-slate-400">
              … and {remainingFieldCount} more
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-start text-slate-500">No fields were found for this object.</p>
      )}
    </div>
  );
};

const DeletePreviewPanel: React.FC<{
  target: DataStudioExplorerObjectRow;
  isLoading: boolean;
  preview: SchemaObjectDeletePreview | null;
  previewError: string | null;
}> = ({ target, isLoading, preview, previewError }) => (
  <div className={`flex flex-col gap-3 ${DELETE_PREVIEW_PANEL_MIN_HEIGHT_CLASS}`}>
    {isLoading ? (
      <p className="text-start text-xs text-slate-500">Loading object details…</p>
    ) : null}

    {!isLoading && previewError ? (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <p>Could not load row count and column preview. You can still confirm deletion by typing the object name below.</p>
        <p className="mt-1">{previewError}</p>
      </div>
    ) : null}

    {!isLoading && !previewError && preview ? (
      <DeletePreviewDetails target={target} preview={preview} />
    ) : null}
  </div>
);

export const DeleteSchemaObjectDialog: React.FC<DeleteSchemaObjectDialogProps> = ({
  target,
  dataSourceId,
  isSubmitting,
  onCancel,
  onConfirm,
}) => {
  const [confirmName, setConfirmName] = useState('');

  const schemaQuery = useMemo(
    () => (target ? resolveExplorerSchemaQuery(target.objectKind) : null),
    [target],
  );

  const previewQuery = useSchemaObjectDeletePreviewQuery(
    dataSourceId,
    schemaQuery?.objectType ?? null,
    target?.name ?? null,
    schemaQuery?.functionKind,
    Boolean(target),
  );

  useEffect(() => {
    setConfirmName('');
  }, [target?.id]);

  if (!target) {
    return null;
  }

  const objectKindSingularLabel = DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS[target.objectKind];
  const nameMatches = confirmName.trim() === target.name;
  const isLoadingPreview = previewQuery.isLoading && !previewQuery.data;
  const preview = previewQuery.data?.preview ?? null;
  const previewError = previewQuery.data?.error
    ?? (previewQuery.error instanceof Error ? previewQuery.error.message : null);
  const canConfirmDelete = nameMatches && !isSubmitting;

  return (
    <ConfirmDialogShell
      size="maximized"
      title={`Delete ${objectKindSingularLabel.toLowerCase()}`}
      icon={<Trash2 className="h-4 w-4" />}
      confirmIntent="destructive"
      showCloseButton={!isSubmitting}
      closeOnEscape={!isSubmitting}
      onClose={isSubmitting ? () => undefined : onCancel}
      onBackdropClick={isSubmitting ? () => undefined : onCancel}
      subtitle={(
        <div className="flex w-full min-w-0 flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700/80">
            {objectKindSingularLabel}
            {' '}
            to delete
          </span>
          <span className="truncate font-mono text-base font-bold leading-tight text-rose-600">
            {target.name}
          </span>
        </div>
      )}
      subtitleTone="muted"
      auxiliaryFooter={(
        <div className="flex w-full min-w-0 flex-col gap-[2px]">
          <label className="block ps-[4px] text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {target.objectKind === 'TABLE'
              ? 'Type the table name to confirm'
              : `Type the ${objectKindSingularLabel.toLowerCase()} name to confirm`}
          </label>
          <UiInput
            size="sm"
            aiAssist={false}
            autoDir={false}
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            placeholder={target.name}
            ariaLabel={`Type ${objectKindSingularLabel.toLowerCase()} name to confirm deletion`}
            className="font-mono"
            autoFocus
            disabled={isSubmitting}
          />
          <p className="ps-[4px] text-[10px] font-medium text-slate-500">
            Enter
            {' '}
            <span className="font-mono font-semibold text-slate-700">{target.name}</span>
            {' '}
            exactly.
          </p>
        </div>
      )}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" disabled={isSubmitting} onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="destructive"
            size="sm"
            disabled={isSubmitting || !canConfirmDelete}
            onClick={() => { void onConfirm(); }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </>
            )}
          </AppButton>
        </>
      )}
    >
      <DestructiveConfirmBody
        question={`Permanently delete this ${objectKindSingularLabel.toLowerCase()}?`}
        warning="This removes the object from the database, its Edge model, and related logical relations (including references from other models). This action cannot be undone."
        extra={(
          <DeletePreviewPanel
            target={target}
            isLoading={isLoadingPreview}
            preview={preview}
            previewError={previewError}
          />
        )}
      />
    </ConfirmDialogShell>
  );
};
