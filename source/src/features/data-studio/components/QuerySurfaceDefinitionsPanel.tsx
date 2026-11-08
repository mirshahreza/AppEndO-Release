import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type {
  ColumnFilterRole,
  EdgeModelDefinition,
  QueryPresetDefinition,
} from '../../../shared/api/contracts/data-api';
import {
  COLUMN_FILTER_ROLE_OPTIONS,
  DEFAULT_COLUMN_FILTER_ROLE,
} from '../../../shared/api/contracts/data-api';
import { humanizeColumnFieldName } from '../lib/resolveColumnDisplayName';
import {
  AppButton,
  FormSection,
  UiSelect,
} from '../../../shared/ui';
import { MODELER_CAPTION_CLASS } from '../lib/modelerChipStyles';
import type { WhereField } from '../../../shared/ui/where-builder/whereBuilderModel';
import { QuerySurfacePresetEditDialog } from './QuerySurfacePresetEditDialog';

type QuerySurfaceDefinitionsPanelProps = {
  model: EdgeModelDefinition;
  presets: QueryPresetDefinition[];
  onPresetsChange: (next: QueryPresetDefinition[]) => void;
  columnFilterRoles: Record<string, ColumnFilterRole>;
  onUpdateColumnFilterRole: (columnName: string, role: ColumnFilterRole) => void;
  whereFields: readonly WhereField[];
};

const resolveFilterRole = (
  columnName: string,
  roles: Record<string, ColumnFilterRole>,
): ColumnFilterRole => roles[columnName] ?? DEFAULT_COLUMN_FILTER_ROLE;

export const QuerySurfaceDefinitionsPanel: React.FC<QuerySurfaceDefinitionsPanelProps> = ({
  model,
  presets,
  onPresetsChange,
  columnFilterRoles,
  onUpdateColumnFilterRole,
  whereFields,
}) => {
  const [editingPreset, setEditingPreset] = useState<QueryPresetDefinition | null | 'new'>(null);

  const sortedPresets = useMemo(
    () => [...presets].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label)),
    [presets],
  );

  const listFilterColumns = useMemo(
    () => model.columns.map((column) => ({
      name: column.name,
      label: humanizeColumnFieldName(column.name),
      role: resolveFilterRole(column.name, columnFilterRoles),
    })),
    [columnFilterRoles, model.columns],
  );

  const filterRoleOptions = COLUMN_FILTER_ROLE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700">
        <p className="font-medium text-slate-800">Where query surfaces live on this model</p>
        <ul className="mt-1.5 list-inside list-disc space-y-1 text-[13px] text-slate-600">
          <li>
            <strong>Quick search</strong> — column properties → Search role (`basic` / `advanced` / `none`).
          </li>
          <li>
            <strong>List filter fields</strong> — table below (or Columns → List filter). Drives List Where builder.
          </li>
          <li>
            <strong>Named presets</strong> — saved on this model as <code className="text-xs">extensions.querySurfaces</code> (chips on grids).
          </li>
        </ul>
      </div>

      <FormSection
        title="Named query presets"
        ink="indigo"
        count={sortedPresets.length}
        headerExtra={(
          <AppButton
            type="button"
            intent="create"
            size="sm"
            onClick={() => setEditingPreset('new')}
          >
            <Plus className="h-3.5 w-3.5" />
            Add preset
          </AppButton>
        )}
      >
        {sortedPresets.length === 0 ? (
          <p className={MODELER_CAPTION_CLASS}>
            No named presets yet. Add one for lifecycle views (Published, Drafts) or domain slices (Active members).
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-start">Label</th>
                  <th className="px-3 py-2 text-start">Id</th>
                  <th className="px-3 py-2 text-start">Application</th>
                  <th className="px-3 py-2 text-start">Visibility</th>
                  <th className="px-3 py-2 text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPresets.map((preset) => (
                  <tr key={preset.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{preset.label}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{preset.id}</td>
                    <td className="px-3 py-2 text-slate-600">{preset.application}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {preset.visibility === 'restricted' ? (
                        <span className="text-amber-800">Restricted</span>
                      ) : (
                        'Public'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <AppButton
                          type="button"
                          intent="utility"
                          size="sm"
                          ariaLabel={`Edit ${preset.label}`}
                          onClick={() => setEditingPreset(preset)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </AppButton>
                        <AppButton
                          type="button"
                          intent="danger"
                          size="sm"
                          ariaLabel={`Delete ${preset.label}`}
                          onClick={() => {
                            onPresetsChange(presets.filter((row) => row.id !== preset.id));
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </AppButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>

      <FormSection title="List filter columns" ink="slate" count={listFilterColumns.length}>
        <p className={MODELER_CAPTION_CLASS}>
          Controls which columns appear in List Where. Restricted columns are configured under Role access.
        </p>
        <div
          className="overflow-auto rounded-lg border border-slate-200"
          style={{ maxHeight: 'min(40vh, 20rem)' }}
        >
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2 text-start">Column</th>
                <th className="px-3 py-2 text-start">List filter</th>
              </tr>
            </thead>
            <tbody>
              {listFilterColumns.map((row) => (
                <tr key={row.name} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-800">{row.label}</span>
                    <span className="ms-2 font-mono text-xs text-slate-500">{row.name}</span>
                  </td>
                  <td className="px-3 py-2">
                    <UiSelect
                      value={row.role}
                      options={filterRoleOptions}
                      onChange={(event) => {
                        onUpdateColumnFilterRole(row.name, event.target.value as ColumnFilterRole);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={MODELER_CAPTION_CLASS}>
          List filter column changes are part of the model draft — use <strong>Sync Model</strong> on the modeler toolbar to persist.
        </p>
      </FormSection>

      <QuerySurfacePresetEditDialog
        open={editingPreset !== null}
        initial={editingPreset === 'new' ? null : editingPreset}
        existingIds={presets.map((preset) => preset.id)}
        whereFields={whereFields}
        onClose={() => setEditingPreset(null)}
        onSave={(preset) => {
          const without = presets.filter((row) => row.id !== preset.id);
          onPresetsChange([...without, { ...preset, sortOrder: preset.sortOrder ?? (without.length + 1) * 10 }]);
        }}
      />
    </div>
  );
};
