import React, { useMemo, useState } from 'react';
import { Languages, Plus, Trash2, X } from 'lucide-react';
import type { EdgeModelColumn, EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import {
  AppButton,
  AppTableGrid,
  CreateEditModalShell,
  FieldHintTooltip,
  FormField,
  FormSection,
  UiCombobox,
  UiInput,
  type AppTableGridColumnDef,
} from '../../../shared/ui';
import {
  APP_TABLE_GRID_ACTION_CELL_CLASS,
  APP_TABLE_GRID_ACTION_HEADER_CLASS,
  DIALOG_NESTED_BACKDROP_Z_CLASS,
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_DELETE_CLASS,
} from '../../../shared/ui/surfaceClasses';
import {
  buildLocalizedFieldFamilies,
  columnBelongsToLocalizedFamily,
  localeCodeLabel,
  parseLocalizedColumn,
  suggestAttachedFieldAsName,
  toggleAttachedColumnSelection,
  validateRelationAttachedFields,
  type LocalizedFieldFamily,
  type RelationAttachedField,
} from '../lib/belongsToAttachedFields';

const META_MONO_CLASS = 'font-mono text-[10px] text-emerald-800';

export type EdgeModelBelongsToAttachedFieldsEditorProps = {
  foreignKey: string;
  associationAs: string;
  targetModel: Pick<EdgeModelDefinition, 'objectName' | 'labels' | 'columns' | 'primaryKey'>;
  value: ReadonlyArray<RelationAttachedField>;
  onChange: (next: RelationAttachedField[]) => void;
  error?: string | null;
  /** Match sibling FormSection spacing in Column Properties. */
  divided?: boolean;
};

type AttachCatalogRow = {
  sourceColumn: string;
  dataType: string;
  group: string;
  variant: 'culture' | 'locale' | 'plain';
  variantLabel: string;
};

const formatTargetLabel = (
  model: Pick<EdgeModelDefinition, 'objectName' | 'labels'>,
): string => {
  const objectName = model.objectName.trim();
  const title = model.labels.title?.trim() || '';
  if (title && title !== objectName) {
    return `${title} (${objectName})`;
  }
  return objectName || title || 'Target model';
};

const isPrimaryKeyColumn = (
  column: EdgeModelColumn,
  primaryKey: EdgeModelDefinition['primaryKey'],
): boolean => {
  if (column.isPrimaryKey) {
    return true;
  }
  const keys = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
  return keys.includes(column.name);
};

const buildAttachCatalog = (
  columns: ReadonlyArray<EdgeModelColumn>,
  families: ReadonlyArray<LocalizedFieldFamily>,
): AttachCatalogRow[] => {
  const byName = new Map(columns.map((column) => [column.name, column]));
  const rows: AttachCatalogRow[] = [];

  for (const family of families) {
    if (family.cultureColumn) {
      const column = byName.get(family.cultureColumn);
      if (column) {
        rows.push({
          sourceColumn: column.name,
          dataType: column.dataType,
          group: family.label,
          variant: 'culture',
          variantLabel: 'By culture',
        });
      }
    }
    for (const name of family.fixedColumns) {
      const column = byName.get(name);
      if (!column) {
        continue;
      }
      const parsed = parseLocalizedColumn(name);
      rows.push({
        sourceColumn: column.name,
        dataType: column.dataType,
        group: family.label,
        variant: 'locale',
        variantLabel: parsed ? localeCodeLabel(parsed.locale) : 'Locale',
      });
    }
  }

  for (const column of columns) {
    if (columnBelongsToLocalizedFamily(column.name, families)) {
      continue;
    }
    rows.push({
      sourceColumn: column.name,
      dataType: column.dataType,
      group: 'Other',
      variant: 'plain',
      variantLabel: '—',
    });
  }

  return rows;
};

const formatOptionLabel = (row: AttachCatalogRow): string => {
  if (row.variant === 'culture') {
    return `${row.sourceColumn} · ${row.group} (by culture)`;
  }
  if (row.variant === 'locale') {
    return `${row.sourceColumn} · ${row.group} · ${row.variantLabel}`;
  }
  return `${row.sourceColumn} · ${row.dataType}`;
};

const VariantCell: React.FC<{ row: AttachCatalogRow }> = ({ row }) => {
  if (row.variant === 'culture') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-700">
        <Languages className="h-3 w-3 shrink-0" aria-hidden="true" />
        By culture
      </span>
    );
  }
  if (row.variant === 'locale') {
    return (
      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
        {row.variantLabel}
      </span>
    );
  }
  return <span className="text-[11px] text-slate-400">—</span>;
};

export const EdgeModelBelongsToAttachedFieldsEditor: React.FC<
  EdgeModelBelongsToAttachedFieldsEditorProps
> = ({
  foreignKey,
  associationAs,
  targetModel,
  value,
  onChange,
  error = null,
  divided = false,
}) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [draftSource, setDraftSource] = useState('');
  const [draftAs, setDraftAs] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);

  const attachableColumns = useMemo(() => (
    targetModel.columns
      .filter((column) => !isPrimaryKeyColumn(column, targetModel.primaryKey))
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
  ), [targetModel]);

  const localizedFamilies = useMemo(
    () => buildLocalizedFieldFamilies(attachableColumns.map((column) => column.name)),
    [attachableColumns],
  );

  const catalog = useMemo(
    () => buildAttachCatalog(attachableColumns, localizedFamilies),
    [attachableColumns, localizedFamilies],
  );
  const catalogByName = useMemo(
    () => new Map(catalog.map((row) => [row.sourceColumn, row])),
    [catalog],
  );

  const selected = useMemo(() => [...value], [value]);
  const selectedSet = useMemo(
    () => new Set(selected.map((item) => item.sourceColumn)),
    [selected],
  );

  const selectedRows = useMemo(
    () => selected
      .map((item) => catalogByName.get(item.sourceColumn))
      .filter((row): row is AttachCatalogRow => Boolean(row)),
    [catalogByName, selected],
  );

  const remainingRows = useMemo(
    () => catalog.filter((row) => !selectedSet.has(row.sourceColumn)),
    [catalog, selectedSet],
  );

  const remainingItems = useMemo(
    () => remainingRows.map((row) => ({
      id: row.sourceColumn,
      textValue: formatOptionLabel(row),
    })),
    [remainingRows],
  );

  const asBySource = useMemo(
    () => new Map(selected.map((item) => [item.sourceColumn, item.as])),
    [selected],
  );

  const removeColumn = (columnName: string) => {
    onChange(selected.filter((item) => item.sourceColumn !== columnName));
  };

  const updateAsName = (sourceColumn: string, nextAs: string) => {
    onChange(selected.map((item) => (
      item.sourceColumn === sourceColumn
        ? { ...item, as: nextAs }
        : item
    )));
  };

  const openAddDialog = () => {
    if (remainingRows.length === 0) {
      return;
    }
    const first = remainingRows[0];
    setDraftSource(first.sourceColumn);
    setDraftAs(suggestAttachedFieldAsName(foreignKey, first.sourceColumn));
    setDraftError(null);
    setAddDialogOpen(true);
  };

  const closeAddDialog = () => {
    setAddDialogOpen(false);
    setDraftSource('');
    setDraftAs('');
    setDraftError(null);
  };

  const commitDraft = () => {
    const source = draftSource.trim();
    if (!source || !catalogByName.has(source)) {
      setDraftError('Choose a source column.');
      return;
    }
    const asName = draftAs.trim() || suggestAttachedFieldAsName(foreignKey, source);
    const nextNames = toggleAttachedColumnSelection(
      selected.map((item) => item.sourceColumn),
      source,
      true,
      { families: localizedFamilies },
    );
    const prevBySource = new Map(selected.map((item) => [item.sourceColumn, item]));
    const nextFields = nextNames.map((name) => (
      name === source
        ? { sourceColumn: name, as: asName }
        : (prevBySource.get(name) ?? {
          sourceColumn: name,
          as: suggestAttachedFieldAsName(foreignKey, name),
        })
    ));
    const validationError = validateRelationAttachedFields(nextFields, foreignKey);
    if (validationError) {
      setDraftError(validationError);
      return;
    }
    onChange(nextFields);
    closeAddDialog();
  };

  const canAdd = remainingRows.length > 0 && catalog.length > 0 && !addDialogOpen;

  const columns = useMemo((): AppTableGridColumnDef<AttachCatalogRow>[] => [
    {
      id: 'sourceColumn',
      label: 'Source column',
      isRowHeader: true,
      sort: false,
      renderCell: (row) => (
        <span className="font-mono text-[12px] font-medium text-slate-800">{row.sourceColumn}</span>
      ),
    },
    {
      id: 'variant',
      label: 'Variant',
      width: 120,
      sort: false,
      renderCell: (row) => <VariantCell row={row} />,
    },
    {
      id: 'as',
      label: (
        <span className="inline-flex items-center gap-0.5">
          As name
          <FieldHintTooltip
            label="As name"
            hint="Output field name used in generated interfaces and enrichment. Default is foreignKey_selectedField."
          />
        </span>
      ),
      sort: false,
      renderCell: (row) => (
        <UiInput
          size="sm"
          autoDir={false}
          value={asBySource.get(row.sourceColumn) ?? ''}
          className="w-full min-w-0 font-mono"
          placeholder={suggestAttachedFieldAsName(foreignKey, row.sourceColumn)}
          ariaLabel={`As name for ${row.sourceColumn}`}
          onChange={(event) => updateAsName(row.sourceColumn, event.target.value)}
        />
      ),
    },
    {
      id: 'actions',
      label: '',
      width: 44,
      headerClassName: APP_TABLE_GRID_ACTION_HEADER_CLASS,
      cellClassName: APP_TABLE_GRID_ACTION_CELL_CLASS,
      sort: false,
      filter: false,
      renderCell: (row) => (
        <button
          type="button"
          className={`${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_DELETE_CLASS}`}
          aria-label={`Remove ${row.sourceColumn}`}
          onClick={() => removeColumn(row.sourceColumn)}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ),
    },
  ], [asBySource, foreignKey]);

  return (
    <FormSection
      title="Fields"
      ink="complement"
      divided={divided}
      headerExtra={(
        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          className="translate-y-[11px]"
          disabled={!canAdd}
          onClick={openAddDialog}
        >
          <Plus className="h-3.5 w-3.5" />
          Add field
        </AppButton>
      )}
    >
      <div className="flex flex-col gap-2">
        <p className="ps-[4px] text-[11px] text-slate-500">
          Extra columns from
          {' '}
          <span className={META_MONO_CLASS}>{formatTargetLabel(targetModel)}</span>
          {' '}
          (
          <span className={META_MONO_CLASS}>{foreignKey}</span>
          {' → '}
          <span className={META_MONO_CLASS}>{associationAs}</span>
          ).
          Add only what you need; culture and fixed locale columns in the same group stay mutually exclusive.
        </p>

        {selectedRows.length > 0 ? (
          <AppTableGrid
            chrome="hero"
            size="xs"
            ariaLabel="Attached fields"
            scrollOwner="panel"
            stickyHeader={false}
            columns={columns}
            rows={selectedRows}
            getRowKey={(row) => row.sourceColumn}
          />
        ) : (
          <p className="ps-[4px] text-xs text-slate-500">
            {catalog.length === 0
              ? 'No attachable columns were found on the related model.'
              : 'No attached fields yet. Use Add field to attach one.'}
          </p>
        )}

        {error ? (
          <p className="ps-[4px] text-xs font-semibold text-rose-600">{error}</p>
        ) : null}
      </div>

      {addDialogOpen ? (
        <CreateEditModalShell
          size="sm"
          title="Add attached field"
          subtitle={`${foreignKey} → ${associationAs}`}
          onClose={closeAddDialog}
          onBackdropClick={closeAddDialog}
          backdropClassName={DIALOG_NESTED_BACKDROP_Z_CLASS}
          footer={(
            <div className="flex w-full items-center justify-end gap-2">
              <AppButton intent="secondary" size="sm" onClick={closeAddDialog}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </AppButton>
              <AppButton
                intent="primary"
                size="sm"
                disabled={!draftSource.trim()}
                onClick={commitDraft}
              >
                <Plus className="h-3.5 w-3.5" />
                Add field
              </AppButton>
            </div>
          )}
        >
          <div className="flex flex-col gap-3">
            <FormField
              label="Source column"
              hint="Column from the related table to attach."
              error={draftError && !draftSource.trim() ? draftError : null}
            >
              <UiCombobox
                size="sm"
                autoDir={false}
                value={draftSource}
                items={remainingItems}
                ariaLabel="Choose source column to attach"
                placeholder="Choose a column…"
                onChange={(event) => {
                  const next = event.target.value;
                  setDraftSource(next);
                  setDraftError(null);
                  if (next) {
                    setDraftAs(suggestAttachedFieldAsName(foreignKey, next));
                  }
                }}
              />
            </FormField>
            <FormField
              label="As name"
              hint="Output field name used in generated interfaces and enrichment."
              error={draftError && draftSource.trim() ? draftError : null}
            >
              <UiInput
                size="sm"
                autoDir={false}
                value={draftAs}
                className="w-full min-w-0 font-mono"
                placeholder={draftSource
                  ? suggestAttachedFieldAsName(foreignKey, draftSource)
                  : 'output_name'}
                ariaLabel="As name for new attached field"
                onChange={(event) => {
                  setDraftAs(event.target.value);
                  setDraftError(null);
                }}
              />
            </FormField>
          </div>
        </CreateEditModalShell>
      ) : null}
    </FormSection>
  );
};
