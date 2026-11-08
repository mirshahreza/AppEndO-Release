import * as React from 'react';
import type { GridColumnWizardRow } from '../../../domain/component-designer/designerDataGridColumns';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { UiCheckbox, UiInput } from '../../../shared/ui';
import { NESTED_LAYER_DIVIDER_CLASS } from '../../../shared/ui/surfaceClasses';

type BindingGridColumnConfigStepProps = {
  rows: GridColumnWizardRow[];
  onRowsChange: (rows: GridColumnWizardRow[]) => void;
};

export const BindingGridColumnConfigStep: React.FC<BindingGridColumnConfigStepProps> = ({
  rows,
  onRowsChange,
}) => {
  const enabledDataColumnCount = rows.filter((row) => row.enabled && !row.isAction).length;

  const updateRow = (index: number, patch: Partial<GridColumnWizardRow>) => {
    onRowsChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  if (rows.length === 0) {
    return (
      <AppSurfaceBox tone="amber" title="No columns yet">
        <p className="text-xs text-slate-600">
          Connect a list API with a documented response schema — fields appear here for column setup.
        </p>
      </AppSurfaceBox>
    );
  }

  return (
    <AppSurfaceBox
      tone="cyan"
      title="Grid columns"
      headerExtra={(
        <span className="text-[10px] font-medium text-slate-500">
          {enabledDataColumnCount} visible
        </span>
      )}
      fill
      bodyClassName="!p-0"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="grid shrink-0 grid-cols-[2.5rem_minmax(0,0.9fr)_minmax(0,1fr)_3.5rem_3.5rem] gap-2 border-b border-slate-200 bg-slate-50/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">
          <span>Show</span>
          <span>Field key</span>
          <span>Header</span>
          <span className="text-center">Sort</span>
          <span className="text-center">Filter</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="space-y-2">
            {rows.map((row, index) => (
              <div
                key={`${row.isAction ? 'action' : 'field'}:${index}:${row.key}`}
                className={`grid grid-cols-[2.5rem_minmax(0,0.9fr)_minmax(0,1fr)_3.5rem_3.5rem] items-center gap-2 rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-white px-2 py-2`}
              >
                <UiCheckbox
                  checked={row.enabled}
                  disabled={row.isAction}
                  onChange={(event) => updateRow(index, { enabled: event.target.checked })}
                  aria-label={`Show column ${row.label || row.key}`}
                />
                <span className={`truncate font-mono text-[11px] ${row.enabled ? 'text-slate-700' : 'text-slate-400'}`}>
                  {row.key}
                  {row.isAction ? (
                    <span className="ms-1 rounded bg-violet-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700">
                      Action
                    </span>
                  ) : null}
                </span>
                <UiInput
                  size="sm"
                  nested
                  className="min-w-0"
                  value={row.label}
                  disabled={!row.enabled || row.isAction}
                  onChange={(event) => updateRow(index, { label: event.target.value })}
                  ariaLabel={`Header for ${row.key}`}
                />
                <div className="flex justify-center">
                  <UiCheckbox
                    checked={row.sort === true}
                    disabled={!row.enabled || row.isAction}
                    onChange={(event) => updateRow(index, { sort: event.target.checked ? true : undefined })}
                    aria-label={`Sort column ${row.label || row.key}`}
                  />
                </div>
                <div className="flex justify-center">
                  <UiCheckbox
                    checked={row.filter === true}
                    disabled={!row.enabled || row.isAction}
                    onChange={(event) => updateRow(index, { filter: event.target.checked ? true : undefined })}
                    aria-label={`Filter column ${row.label || row.key}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppSurfaceBox>
  );
};
