import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CircleDot,
  GitBranchPlus,
  Layers,
  Link2,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react';
import type {
  EdgeModelAssociation,
  EdgeModelColumn,
  EdgeModelDefinition,
} from '../../../shared/api/contracts/data-api';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  CreateEditModalShell,
  FormField,
  UiCombobox,
  UiInput,
  UiSelect,
  UiTooltip,
} from '../../../shared/ui';
import {
  ASSOCIATION_KIND_OPTIONS,
  buildManualAssociation,
  foreignKeyOwnerForKind,
  isBelongsToManyAssociation,
  resolveForeignKeyColumnOptions,
  resolveAssociationTargetModelId,
  suggestAssociationAlias,
  suggestForeignKeyColumn,
  supportsPhysicalNatureConversion,
  validateAssociationDraft,
  type AssociationDraftInput,
  type AssociationKind,
} from '../lib/edgeModelAssociations';
import { RelationsConvertHeaderAction } from './RelationsConvertHeaderAction';
import {
  RelationsCreateThroughTableDialog,
  type CreatedThroughTableResult,
} from './RelationsCreateThroughTableDialog';

const KIND_BUTTON_ICONS: Record<AssociationKind, React.ReactNode> = {
  belongsTo: <Link2 className="h-3.5 w-3.5" />,
  hasOne: <CircleDot className="h-3.5 w-3.5" />,
  hasMany: <Layers className="h-3.5 w-3.5" />,
  belongsToMany: <Share2 className="h-3.5 w-3.5" />,
};

const formatPeerModelLabel = (
  model: Pick<EdgeModelDefinition, 'objectName' | 'labels'>,
): string => {
  const objectName = model.objectName.trim();
  const title = model.labels?.title?.trim() || '';
  if (title && title !== objectName) {
    return `${title} (${objectName})`;
  }
  return objectName || title || 'Unknown model';
};

type EdgeModelAssociationDialogProps = {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  dataSourceId: string;
  dataSourceType: string | null;
  sourceModelId: string;
  sourceObjectName: string;
  sourcePrimaryKey: EdgeModelDefinition['primaryKey'];
  sourceColumns: ReadonlyArray<Pick<EdgeModelColumn, 'name' | 'dataType' | 'isPrimaryKey'>>;
  peerModels: ReadonlyArray<Pick<EdgeModelDefinition, 'id' | 'objectName' | 'labels' | 'columns' | 'primaryKey'>>;
  existing: ReadonlyArray<EdgeModelAssociation>;
  initial?: EdgeModelAssociation | null;
  /** Prefill for create mode (e.g. from diagram connect). */
  initialDraft?: Partial<AssociationDraftInput> | null;
  /** Create from diagram connect — target model is fixed. */
  lockTarget?: boolean;
  /** Explicit label for a locked target (preferred over resolving by id). */
  targetDisplayName?: string | null;
  /** Platform-protected association — no delete/convert. */
  locked?: boolean;
  /** Raise above floating Relations panels. */
  elevated?: boolean;
  onSave: (association: EdgeModelAssociation) => void;
  onDelete?: () => void;
  /** Edit mode: offer conversion to a database foreign-key constraint. */
  onConvertToPhysical?: () => void;
  /** Edit mode: drop matching physical FK and keep this association. */
  onConvertToLogical?: () => void;
  /** After a through table is created (invalidate/refetch peers in parent). */
  onThroughTableCreated?: (result: CreatedThroughTableResult) => void;
};

const emptyDraft = (): AssociationDraftInput => ({
  kind: 'belongsTo',
  targetModelId: '',
  foreignKey: '',
  as: '',
  throughModelId: '',
  otherKey: '',
});

const draftFromAssociation = (association: EdgeModelAssociation): AssociationDraftInput => ({
  kind: association.kind,
  targetModelId: association.targetModelId,
  foreignKey: association.foreignKey,
  as: association.as,
  throughModelId: isBelongsToManyAssociation(association) ? association.throughModelId : '',
  otherKey: isBelongsToManyAssociation(association) ? association.otherKey : '',
});

export const EdgeModelAssociationDialog: React.FC<EdgeModelAssociationDialogProps> = ({
  open,
  onClose,
  mode,
  dataSourceId,
  dataSourceType,
  sourceModelId,
  sourceObjectName,
  sourcePrimaryKey,
  sourceColumns,
  peerModels,
  existing,
  initial = null,
  initialDraft = null,
  lockTarget = false,
  targetDisplayName = null,
  locked = false,
  elevated = false,
  onSave,
  onDelete,
  onConvertToPhysical,
  onConvertToLogical,
  onThroughTableCreated,
}) => {
  const [draft, setDraft] = useState<AssociationDraftInput>(() => emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdThroughLabel, setCreatedThroughLabel] = useState<string | null>(null);
  const [createThroughOpen, setCreateThroughOpen] = useState(false);
  const wasOpenRef = useRef(false);
  /** Once the user edits Include alias, stop auto-refilling from FK/target. */
  const aliasManuallyEditedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      setCreateThroughOpen(false);
      return;
    }

    // Initialize only when the dialog opens — not when peerModels refresh after creating a through table.
    if (wasOpenRef.current) {
      return;
    }
    wasOpenRef.current = true;
    // Edit mode keeps the saved alias; create mode may auto-suggest until the user types.
    aliasManuallyEditedRef.current = Boolean(initial);

    if (initial) {
      setDraft(draftFromAssociation(initial));
    } else {
      const rawTargetId = initialDraft?.targetModelId ?? '';
      const resolvedId = resolveAssociationTargetModelId({
        targetModelId: rawTargetId,
        targetObjectName: targetDisplayName,
        peers: peerModels,
        sourceModelId,
      }) ?? rawTargetId;
      const kind = initialDraft?.kind ?? 'belongsTo';
      const foreignKey = initialDraft?.foreignKey ?? '';
      const peer = peerModels.find((model) => model.id === resolvedId) ?? null;
      const existingAliases = new Set(existing.map((item) => item.as));
      const suggestedAs = peer
        ? suggestAssociationAlias(kind, peer.objectName, existingAliases, foreignKey)
        : '';
      setDraft({
        ...emptyDraft(),
        ...initialDraft,
        kind,
        targetModelId: resolvedId,
        foreignKey,
        as: initialDraft?.as?.trim() ? initialDraft.as : suggestedAs,
        throughModelId: initialDraft?.throughModelId ?? '',
        otherKey: initialDraft?.otherKey ?? '',
      });
    }
    setError(null);
    setNotice(null);
    setCreatedThroughLabel(null);
  }, [existing, initial, initialDraft, open, peerModels, sourceModelId, targetDisplayName]);

  const selectablePeers = useMemo(() => {
    const byObjectName = new Map<string, (typeof peerModels)[number]>();
    for (const model of peerModels) {
      if (model.id === sourceModelId) {
        continue;
      }
      const key = model.objectName.trim().toLowerCase();
      if (!key || byObjectName.has(key)) {
        continue;
      }
      byObjectName.set(key, model);
    }
    return [...byObjectName.values()].sort((left, right) => (
      formatPeerModelLabel(left).localeCompare(formatPeerModelLabel(right))
    ));
  }, [peerModels, sourceModelId]);

  const targetModelItems = useMemo(
    () => selectablePeers.map((model) => ({
      id: model.id,
      textValue: formatPeerModelLabel(model),
    })),
    [selectablePeers],
  );

  const resolvedTargetModelId = useMemo(
    () => resolveAssociationTargetModelId({
      targetModelId: draft.targetModelId,
      targetObjectName: targetDisplayName,
      peers: peerModels,
      sourceModelId,
    }),
    [draft.targetModelId, peerModels, sourceModelId, targetDisplayName],
  );

  const targetModel = useMemo(
    () => (
      peerModels.find((model) => model.id === resolvedTargetModelId)
      ?? peerModels.find((model) => model.id === draft.targetModelId)
      ?? null
    ),
    [draft.targetModelId, peerModels, resolvedTargetModelId],
  );

  const throughModel = useMemo(
    () => peerModels.find((model) => model.id === draft.throughModelId) ?? null,
    [draft.throughModelId, peerModels],
  );

  const throughModelItems = useMemo(() => {
    const exclude = new Set([sourceModelId, resolvedTargetModelId ?? '', draft.targetModelId]);
    const items = selectablePeers
      .filter((model) => !exclude.has(model.id))
      .map((model) => ({
        id: model.id,
        textValue: formatPeerModelLabel(model),
      }));
    if (
      draft.throughModelId
      && createdThroughLabel
      && !items.some((item) => item.id === draft.throughModelId)
    ) {
      items.unshift({
        id: draft.throughModelId,
        textValue: createdThroughLabel,
      });
    }
    return items;
  }, [
    createdThroughLabel,
    draft.targetModelId,
    draft.throughModelId,
    resolvedTargetModelId,
    selectablePeers,
    sourceModelId,
  ]);

  const existingObjectNames = useMemo(() => {
    const names = new Set<string>([sourceObjectName]);
    for (const model of peerModels) {
      names.add(model.objectName);
    }
    return names;
  }, [peerModels, sourceObjectName]);

  const resolvedTargetLabel = useMemo(() => {
    if (targetModel) {
      return formatPeerModelLabel(targetModel);
    }
    const explicit = targetDisplayName?.trim();
    if (explicit) {
      return explicit;
    }
    return '';
  }, [targetDisplayName, targetModel]);

  const resolvedThroughLabel = useMemo(() => (
    throughModel ? formatPeerModelLabel(throughModel) : ''
  ), [throughModel]);

  const isManyToMany = draft.kind === 'belongsToMany';

  const foreignKeyOptions = useMemo(() => {
    const options = resolveForeignKeyColumnOptions({
      kind: draft.kind,
      sourceColumns,
      targetColumns: targetModel?.columns ?? [],
      throughColumns: throughModel?.columns ?? [],
    });
    // Keep freshly created through-key values selectable before peerModels refetch lands.
    if (draft.foreignKey.trim() && !options.includes(draft.foreignKey.trim())) {
      return [draft.foreignKey.trim(), ...options];
    }
    return options;
  }, [draft.foreignKey, draft.kind, sourceColumns, targetModel?.columns, throughModel?.columns]);

  const otherKeyOptions = useMemo(() => {
    const options = (throughModel?.columns ?? []).map((column) => column.name);
    const otherKey = draft.otherKey?.trim() ?? '';
    if (otherKey && !options.includes(otherKey)) {
      return [otherKey, ...options];
    }
    return options;
  }, [draft.otherKey, throughModel?.columns]);

  const targetModelIds = useMemo(() => {
    const ids = new Set(
      peerModels
        .filter((model) => model.id !== sourceModelId)
        .map((model) => model.id),
    );
    if (resolvedTargetModelId) {
      ids.add(resolvedTargetModelId);
    }
    return ids;
  }, [peerModels, resolvedTargetModelId, sourceModelId]);

  const throughModelIds = useMemo(() => {
    const ids = new Set(
      peerModels
        .filter((model) => model.id !== sourceModelId)
        .map((model) => model.id),
    );
    if (draft.throughModelId) {
      ids.add(draft.throughModelId);
    }
    return ids;
  }, [draft.throughModelId, peerModels, sourceModelId]);

  const selectedKindOption = ASSOCIATION_KIND_OPTIONS.find((option) => option.value === draft.kind)
    ?? ASSOCIATION_KIND_OPTIONS[0];

  const fkOwner = foreignKeyOwnerForKind(draft.kind);
  const fkOwnerLabel = fkOwner === 'source'
    ? `Column on ${sourceObjectName}`
    : fkOwner === 'target'
      ? `Column on ${targetModel?.objectName ?? 'target model'}`
      : `Through column pointing at ${sourceObjectName}`;

  // Edit opens as a read-only summary — only convert / delete (or platform lock).
  const fieldsReadOnly = mode === 'edit' || locked;
  const showFixedTarget = lockTarget || mode === 'edit';
  const canConvertNature = supportsPhysicalNatureConversion(draft.kind);
  const showConvertToPhysical = mode === 'edit'
    && canConvertNature
    && Boolean(onConvertToPhysical)
    && !locked;
  const showConvertToLogical = mode === 'edit'
    && canConvertNature
    && Boolean(onConvertToLogical)
    && !locked;
  const showCreateThroughAction = mode === 'create' && !fieldsReadOnly && isManyToMany;
  const canOpenCreateThrough = showCreateThroughAction && Boolean(targetModel);

  const handleOpenCreateThrough = () => {
    if (!targetModel) {
      setError('Select a target model first, then create the through table.');
      return;
    }
    setError(null);
    setCreateThroughOpen(true);
  };

  const handleThroughTableCreated = (result: CreatedThroughTableResult) => {
    setDraft((current) => ({
      ...current,
      kind: 'belongsToMany',
      throughModelId: result.throughModelId,
      foreignKey: result.foreignKey,
      otherKey: result.otherKey,
    }));
    setCreatedThroughLabel(result.throughObjectName);
    setNotice(
      `Through table "${result.throughObjectName}" created. Review the fields below, then click Add relation.`,
    );
    setError(null);
    onThroughTableCreated?.(result);
  };

  const usedAliasesExcludingCurrent = (): Set<string> => (
    new Set(existing.filter((item) => item.id !== initial?.id).map((item) => item.as))
  );

  const handleKindChange = (kind: AssociationKind) => {
    if (fieldsReadOnly) {
      return;
    }
    setDraft((current) => {
      const nextTarget = peerModels.find((model) => model.id === current.targetModelId) ?? null;
      const nextThrough = peerModels.find((model) => model.id === current.throughModelId) ?? null;
      const existingAliases = usedAliasesExcludingCurrent();
      const nextFkOptions = resolveForeignKeyColumnOptions({
        kind,
        sourceColumns,
        targetColumns: nextTarget?.columns ?? [],
        throughColumns: nextThrough?.columns ?? [],
      });
      const referencedName = kind === 'belongsTo'
        ? (nextTarget?.objectName ?? '')
        : sourceObjectName;
      const nextForeignKey = kind === 'belongsToMany'
        ? suggestForeignKeyColumn(nextFkOptions, sourceObjectName)
        : lockTarget
          ? suggestForeignKeyColumn(nextFkOptions, referencedName)
          : '';
      return {
        ...current,
        kind,
        foreignKey: nextForeignKey,
        throughModelId: kind === 'belongsToMany' ? current.throughModelId : '',
        otherKey: kind === 'belongsToMany'
          ? suggestForeignKeyColumn(
            (nextThrough?.columns ?? []).map((column) => column.name),
            nextTarget?.objectName ?? '',
          )
          : '',
        as: aliasManuallyEditedRef.current && current.as.trim()
          ? current.as
          : (nextTarget
            ? suggestAssociationAlias(kind, nextTarget.objectName, existingAliases, nextForeignKey)
            : ''),
      };
    });
    setError(null);
  };

  const handleTargetChange = (targetModelId: string) => {
    if (fieldsReadOnly || lockTarget) {
      return;
    }
    const nextTarget = peerModels.find((model) => model.id === targetModelId) ?? null;
    // Target change is a reshape — allow FK-driven alias suggestions again in create mode.
    if (!initial) {
      aliasManuallyEditedRef.current = false;
    }
    setDraft((current) => {
      const existingAliases = usedAliasesExcludingCurrent();
      const throughStillValid = current.throughModelId
        && current.throughModelId !== sourceModelId
        && current.throughModelId !== targetModelId;
      const nextThrough = throughStillValid
        ? peerModels.find((model) => model.id === current.throughModelId) ?? null
        : null;
      const nextForeignKey = current.kind === 'belongsToMany'
        ? suggestForeignKeyColumn(
          (nextThrough?.columns ?? []).map((column) => column.name),
          sourceObjectName,
        )
        : '';
      return {
        ...current,
        targetModelId,
        throughModelId: throughStillValid ? current.throughModelId : '',
        foreignKey: nextForeignKey,
        otherKey: current.kind === 'belongsToMany'
          ? suggestForeignKeyColumn(
            (nextThrough?.columns ?? []).map((column) => column.name),
            nextTarget?.objectName ?? '',
          )
          : '',
        as: aliasManuallyEditedRef.current && current.as.trim()
          ? current.as
          : (nextTarget
            ? suggestAssociationAlias(
              current.kind,
              nextTarget.objectName,
              existingAliases,
              nextForeignKey,
            )
            : current.as),
      };
    });
    setError(null);
  };

  const handleForeignKeyChange = (foreignKey: string) => {
    if (fieldsReadOnly) {
      return;
    }
    setDraft((current) => {
      const nextTarget = peerModels.find((model) => model.id === current.targetModelId) ?? null;
      const existingAliases = usedAliasesExcludingCurrent();
      return {
        ...current,
        foreignKey,
        as: aliasManuallyEditedRef.current && current.as.trim()
          ? current.as
          : (nextTarget
            ? suggestAssociationAlias(
              current.kind,
              nextTarget.objectName,
              existingAliases,
              foreignKey,
            )
            : current.as),
      };
    });
    setError(null);
  };

  const handleThroughChange = (throughModelId: string) => {
    if (fieldsReadOnly) {
      return;
    }
    const nextThrough = peerModels.find((model) => model.id === throughModelId) ?? null;
    const throughColumns = (nextThrough?.columns ?? []).map((column) => column.name);
    setDraft((current) => ({
      ...current,
      throughModelId,
      foreignKey: suggestForeignKeyColumn(throughColumns, sourceObjectName),
      otherKey: suggestForeignKeyColumn(throughColumns, targetModel?.objectName ?? ''),
    }));
    setError(null);
  };

  const handleSave = () => {
    if (fieldsReadOnly) {
      return;
    }

    const targetModelId = resolvedTargetModelId || draft.targetModelId.trim();
    if (!targetModelId) {
      setError('Select a target model.');
      return;
    }

    const normalizedDraft: AssociationDraftInput = {
      ...draft,
      targetModelId,
      throughModelId: draft.kind === 'belongsToMany' ? draft.throughModelId : undefined,
      otherKey: draft.kind === 'belongsToMany' ? draft.otherKey : undefined,
    };

    const validationError = validateAssociationDraft(normalizedDraft, {
      sourceModelId,
      existing,
      editingId: initial?.id,
      foreignKeyOptions,
      otherKeyOptions,
      targetModelIds,
      throughModelIds,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    onSave(buildManualAssociation(normalizedDraft, initial?.id));
    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <>
    <CreateEditModalShell
      size="3xl"
      title={mode === 'edit' ? 'Logical relation' : 'Add logical relation'}
      subtitle={(
        <div className="flex w-full min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate font-medium text-slate-700">{sourceObjectName}</span>
          {showConvertToLogical && onConvertToLogical ? (
            <RelationsConvertHeaderAction
              label="Convert to logical"
              onClick={onConvertToLogical}
            />
          ) : null}
          {showConvertToPhysical && onConvertToPhysical ? (
            <RelationsConvertHeaderAction
              label="Convert to physical"
              onClick={onConvertToPhysical}
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
        mode === 'create' ? (
          <AppButton intent="primary" size="sm" onClick={handleSave}>
            <Check className="h-3.5 w-3.5" />
            Add relation
          </AppButton>
        ) : onDelete && !locked ? (
          <AppButton
            intent="cancel"
            size="sm"
            className="me-auto !border-transparent !bg-transparent !text-slate-500 hover:!border-rose-200 hover:!bg-rose-50 hover:!text-rose-600"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </AppButton>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <p className="ps-[4px] text-[11px] text-slate-500">
          {mode === 'edit'
            ? (isManyToMany
              ? 'Logical many-to-many details. Nature convert is not available for junction relations in this version.'
              : 'Logical relation details. Use convert to change nature, or delete to remove the association.')
            : 'Logical relations are stored in Edge model metadata only. They power Data API includes and do not create database foreign-key constraints.'}
        </p>

        {notice ? (
          <p className="rounded-md border border-teal-100 bg-teal-50/70 px-3 py-2 text-[11px] font-medium text-teal-900">
            {notice}
          </p>
        ) : null}

        <FormField
          label="Relation kind"
          hint={selectedKindOption.description}
        >
          <div
            className={cn(
              'flex min-h-8 w-full min-w-0 flex-wrap overflow-hidden rounded-[6px] border border-slate-300 bg-white shadow-sm',
              fieldsReadOnly && 'bg-slate-50',
            )}
            role="group"
            aria-label="Relation kind"
          >
            {ASSOCIATION_KIND_OPTIONS.map((option, index) => {
              const selected = draft.kind === option.value;
              return (
                <UiTooltip
                  key={option.value}
                  className="min-w-[25%] flex-1 outline-none"
                  placement="top"
                  contentClassName="z-[9999] max-w-[18rem] px-3 py-2 text-start text-[11px] font-medium leading-snug"
                  content={option.description}
                >
                    <AppButton
                      type="button"
                      size="sm"
                      intent={selected ? 'secondary' : 'cancel'}
                      disabled={fieldsReadOnly}
                      aria-pressed={selected}
                      className={cn(
                        'w-full min-w-0 justify-start !h-8 !rounded-none !border-y-0 !border-e-0',
                        index === 0 ? '!border-s-0' : '!border-s !border-slate-200',
                        fieldsReadOnly && 'disabled:!cursor-default disabled:!opacity-100',
                        selected
                          ? fieldsReadOnly
                            ? '!bg-slate-100 !text-slate-800 disabled:!bg-slate-100 disabled:!text-slate-800'
                            : undefined
                          : fieldsReadOnly
                            ? '!bg-transparent !text-slate-600 disabled:!bg-transparent disabled:!text-slate-600'
                            : '!bg-transparent !text-slate-400 hover:!bg-slate-50 hover:!text-slate-500',
                      )}
                      onClick={() => handleKindChange(option.value)}
                    >
                      {KIND_BUTTON_ICONS[option.value]}
                      <span className="min-w-0 truncate">{option.label}</span>
                      {selected ? (
                        <Check
                          className={cn(
                            'ms-auto h-3.5 w-3.5 shrink-0',
                            fieldsReadOnly ? 'text-emerald-700' : 'text-emerald-600',
                          )}
                          aria-hidden
                        />
                      ) : null}
                    </AppButton>
                </UiTooltip>
              );
            })}
          </div>
        </FormField>

        <FormField
          label="Target model"
          hint={
            showFixedTarget
              ? (lockTarget ? 'Set from the diagram connection.' : 'Target model for this relation.')
              : 'Type to filter Edge models on the same data source.'
          }
        >
          {showFixedTarget ? (
            <UiInput
              size="sm"
              autoDir={false}
              value={resolvedTargetLabel || 'Unknown model'}
              readOnly
              className="w-full min-w-0 !bg-slate-50 !text-slate-800"
            />
          ) : selectablePeers.length === 0 ? (
            <p className="ps-[4px] text-[11px] text-slate-500">
              No other Edge models are available on this data source. Import or sync models first.
            </p>
          ) : fieldsReadOnly ? (
            <UiInput
              size="sm"
              autoDir={false}
              value={resolvedTargetLabel || draft.targetModelId}
              readOnly
              className="w-full min-w-0 !bg-slate-50 !text-slate-800"
            />
          ) : (
            <UiCombobox
              size="sm"
              value={draft.targetModelId}
              items={targetModelItems}
              autoDir={false}
              placeholder="Type to filter target model…"
              menuTrigger="focus"
              className="min-w-0 w-full text-[11px]"
              onChange={(event) => handleTargetChange(event.target.value)}
            />
          )}
        </FormField>

        {isManyToMany ? (
          <FormField
            label="Through model"
            hint="Junction Edge model that stores both foreign-key columns. Use Create through table to generate it automatically."
          >
            <div className="flex flex-col gap-2">
              {fieldsReadOnly ? (
                <UiInput
                  size="sm"
                  autoDir={false}
                  value={resolvedThroughLabel || draft.throughModelId || '—'}
                  readOnly
                  className="w-full min-w-0 !bg-slate-50 !text-slate-800"
                />
              ) : (
                <>
                  {throughModelItems.length > 0 ? (
                    <UiCombobox
                      size="sm"
                      value={draft.throughModelId ?? ''}
                      items={throughModelItems}
                      autoDir={false}
                      placeholder="Type to filter through model…"
                      menuTrigger="focus"
                      className="min-w-0 w-full text-[11px]"
                      onChange={(event) => handleThroughChange(event.target.value)}
                    />
                  ) : (
                    <p className="ps-[4px] text-[11px] text-slate-500">
                      No junction table yet. Select a target model, then create the through table — names and key columns are suggested for you.
                    </p>
                  )}
                  {showCreateThroughAction ? (
                    <AppButton
                      type="button"
                      intent="primary"
                      size="sm"
                      className="self-start"
                      onClick={handleOpenCreateThrough}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create through table…
                    </AppButton>
                  ) : null}
                  {showCreateThroughAction && !canOpenCreateThrough ? (
                    <p className="ps-[4px] text-[10px] text-slate-500">
                      Select a target model first to unlock automatic through-table creation.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </FormField>
        ) : null}

        <FormField
          label={isManyToMany ? 'Foreign key (source side)' : 'Foreign-key column'}
          hint={fkOwnerLabel}
        >
          {fieldsReadOnly ? (
            <UiInput
              size="sm"
              autoDir={false}
              value={draft.foreignKey}
              readOnly
              className="w-full min-w-0 font-mono !bg-slate-50 !text-slate-800"
            />
          ) : (
            <UiSelect
              size="sm"
              value={draft.foreignKey}
              disabled={foreignKeyOptions.length === 0}
              placeholder={
                foreignKeyOptions.length === 0
                  ? (isManyToMany
                    ? (throughModel ? 'No columns available…' : 'Select a through model first…')
                    : (targetModel ? 'No columns available…' : 'Select a target model first…'))
                  : 'Select column…'
              }
              className="h-8 min-w-0 w-full text-[11px]"
              onChange={(event) => handleForeignKeyChange(event.target.value)}
            >
              {foreignKeyOptions.map((columnName) => (
                <option key={columnName} value={columnName}>
                  {columnName}
                </option>
              ))}
            </UiSelect>
          )}
        </FormField>

        {isManyToMany ? (
          <FormField
            label="Other key (target side)"
            hint={`Through column pointing at ${targetModel?.objectName ?? 'target model'}`}
          >
            {fieldsReadOnly ? (
              <UiInput
                size="sm"
                autoDir={false}
                value={draft.otherKey ?? ''}
                readOnly
                className="w-full min-w-0 font-mono !bg-slate-50 !text-slate-800"
              />
            ) : (
              <UiSelect
                size="sm"
                value={draft.otherKey ?? ''}
                disabled={otherKeyOptions.length === 0}
                placeholder={
                  otherKeyOptions.length === 0
                    ? (throughModel ? 'No columns available…' : 'Select a through model first…')
                    : 'Select column…'
                }
                className="h-8 min-w-0 w-full text-[11px]"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, otherKey: event.target.value }));
                  setError(null);
                }}
              >
                {otherKeyOptions.map((columnName) => (
                  <option key={columnName} value={columnName}>
                    {columnName}
                  </option>
                ))}
              </UiSelect>
            )}
          </FormField>
        ) : null}

        <FormField
          label="Include alias"
          hint="Name used in Data API includes and association registration."
          invalid={Boolean(error && error.toLowerCase().includes('alias'))}
          error={error && error.toLowerCase().includes('alias') ? error : undefined}
        >
          <UiInput
            size="sm"
            autoDir={false}
            value={draft.as}
            readOnly={fieldsReadOnly}
            className={cn(
              'w-full min-w-0 font-mono',
              fieldsReadOnly && '!bg-slate-50 !text-slate-800',
            )}
            onChange={(event) => {
              aliasManuallyEditedRef.current = true;
              setDraft((current) => ({ ...current, as: event.target.value }));
              setError(null);
            }}
          />
        </FormField>

        {error && !error.toLowerCase().includes('alias') ? (
          <p className="ps-[4px] text-xs font-semibold text-rose-600">{error}</p>
        ) : null}

        {locked ? (
          <p className="inline-flex items-center gap-1.5 ps-[4px] text-[11px] font-medium text-amber-700">
            <GitBranchPlus className="h-3.5 w-3.5" />
            Platform relations cannot be reshaped.
          </p>
        ) : null}
      </div>
    </CreateEditModalShell>

    {showCreateThroughAction && targetModel ? (
      <RelationsCreateThroughTableDialog
        open={createThroughOpen}
        onClose={() => setCreateThroughOpen(false)}
        dataSourceId={dataSourceId}
        dataSourceType={dataSourceType}
        sourceModel={{
          id: sourceModelId,
          objectName: sourceObjectName,
          primaryKey: sourcePrimaryKey,
          columns: sourceColumns as EdgeModelDefinition['columns'],
        }}
        targetModel={targetModel}
        existingObjectNames={existingObjectNames}
        elevated={elevated}
        onCreated={handleThroughTableCreated}
      />
    ) : null}
    </>
  );
};
