import * as React from 'react';
import { UiInput } from '../../shared/ui';
import type { DesignerDataGridColumn } from './designerDataGridColumns';
import {
  executeGridCellChangeActions,
  type GridCellChangePayload,
} from './designerGridSelectionRuntime';
import type { DynamicActionRuntimeContext } from './bindingDynamicActionsRuntime';
import type { DesignerBindingDefinitions } from './types';

type DesignerGridInlineEditCellProps = {
  column: DesignerDataGridColumn;
  row: Record<string, unknown>;
  rowKey: string;
  mode: 'design' | 'runtime';
  bindingDefinitions?: DesignerBindingDefinitions;
  runtime?: DynamicActionRuntimeContext;
  /** Optional optimistic local value override after commit. */
  onLocalValueChange?: (nextValue: unknown) => void;
};

/**
 * Minimal inline cell editor (Phase 35). Uses UiInput for text-like fields; `cellEditorPaletteItemId`
 * is recorded for future richer editors but today maps to the same text control for parity.
 */
export const DesignerGridInlineEditCell: React.FC<DesignerGridInlineEditCellProps> = ({
  column,
  row,
  rowKey,
  mode,
  bindingDefinitions,
  runtime,
  onLocalValueChange,
}) => {
  const field = column.key;
  const initial = row[field];
  const [draft, setDraft] = React.useState(() => (
    initial === null || initial === undefined ? '' : String(initial)
  ));
  const [committed, setCommitted] = React.useState(draft);

  React.useEffect(() => {
    const next = initial === null || initial === undefined ? '' : String(initial);
    setDraft(next);
    setCommitted(next);
  }, [initial, rowKey, field]);

  if (mode === 'design' || !column.editable) {
    return <span className="truncate">{committed || String(initial ?? '')}</span>;
  }

  const commit = async (nextRaw: string) => {
    if (nextRaw === committed) {
      return;
    }
    setCommitted(nextRaw);
    onLocalValueChange?.(nextRaw);
    if (!bindingDefinitions || !runtime || !column.onCellChangeActions?.length) {
      return;
    }
    const payload: GridCellChangePayload = {
      rowKey,
      field,
      value: nextRaw,
      row: { ...row, [field]: nextRaw },
    };
    await executeGridCellChangeActions(column.onCellChangeActions, payload, {
      bindingDefinitions,
      runtime,
    });
  };

  return (
    <UiInput
      size="sm"
      autoDir={false}
      ariaLabel={`Edit ${column.label || field}`}
      data-designer-inline-edit={field}
      data-row-key={rowKey}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        void commit(draft);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          (event.currentTarget as HTMLInputElement).blur();
        }
        if (event.key === 'Escape') {
          setDraft(committed);
          (event.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
};
