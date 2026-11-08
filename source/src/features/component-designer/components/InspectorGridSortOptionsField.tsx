import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DesignerAction, DesignerNode } from '../../../domain/component-designer/types';
import {
  DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS,
  parseDesignerAppTableGridColumns,
  parseDesignerGridSortOptions,
  serializeDesignerGridSortOptions,
  type DesignerGridSortOption,
} from '../../../domain/component-designer/designerDataGridColumns';
import { AppButton, UiInput } from '../../../shared/ui';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { DesignerFieldRow } from './DesignerFieldRow';
import { preventInspectorDetailsToggle } from './inspectorDetailsGuard';
import {
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';
import { InspectorMicroLabel, InspectorSectionValueBadge } from './inspectorFieldPrimitives';

type InspectorGridSortOptionsFieldProps = {
  node: DesignerNode;
  dispatch: React.Dispatch<DesignerAction>;
};

const readSortOptions = (node: DesignerNode): DesignerGridSortOption[] => {
  const parsed = parseDesignerGridSortOptions(node.props.sortOptions);
  return parsed.length > 0 ? parsed : [...DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS];
};

export const InspectorGridSortOptionsField: React.FC<InspectorGridSortOptionsFieldProps> = ({
  node,
  dispatch,
}) => {
  const [options, setOptions] = React.useState<DesignerGridSortOption[]>(() => readSortOptions(node));
  const skipPropSyncRef = React.useRef(false);

  React.useEffect(() => {
    if (skipPropSyncRef.current) {
      skipPropSyncRef.current = false;
      return;
    }

    setOptions(readSortOptions(node));
  }, [node.id, node.props.sortOptions]);

  const persistOptions = React.useCallback((nextOptions: DesignerGridSortOption[]) => {
    const safeOptions = nextOptions.length > 0 ? nextOptions : [...DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS];
    skipPropSyncRef.current = true;
    setOptions(safeOptions);
    dispatch({
      type: 'set-node-prop',
      nodeId: node.id,
      key: 'sortOptions',
      value: serializeDesignerGridSortOptions(safeOptions),
    });
  }, [dispatch, node.id]);

  const updateOption = React.useCallback((index: number, patch: Partial<DesignerGridSortOption>) => {
    persistOptions(options.map((option, optionIndex) => (
      optionIndex === index ? { ...option, ...patch } : option
    )));
  }, [options, persistOptions]);

  const addOption = React.useCallback(() => {
    const sortableColumns = parseDesignerAppTableGridColumns(node.props.columns)
      .filter((column) => column.sort && !String(column.key).startsWith('__action_'));
    const nextUnusedColumn = sortableColumns.find((column) => (
      !options.some((option) => option.value === column.key)
    ));

    persistOptions([
      ...options,
      {
        value: nextUnusedColumn?.key ?? `sort_field_${options.length + 1}`,
        label: typeof nextUnusedColumn?.label === 'string'
          ? nextUnusedColumn.label
          : `Sort Option ${options.length + 1}`,
      },
    ]);
  }, [node.props.columns, options, persistOptions]);

  const removeOption = React.useCallback((index: number) => {
    const nextOptions = options.filter((_, optionIndex) => optionIndex !== index);
    persistOptions(nextOptions);
  }, [options, persistOptions]);

  const availableSortableColumns = React.useMemo(
    () => parseDesignerAppTableGridColumns(node.props.columns)
      .filter((column) => column.sort && !String(column.key).startsWith('__action_')),
    [node.props.columns],
  );
  const unusedSortableColumns = availableSortableColumns.filter((column) => (
    !options.some((option) => option.value === column.key)
  ));

  return (
    <DesignerFieldRow label="Sort Options" layout="stack" align="start">
      <div className="flex w-full flex-col gap-2" {...preventInspectorDetailsToggle}>
        <AppSurfaceBox
          tone="cyan"
          title="Sort options"
          layout="panel"
          collapsible
          defaultOpen
          headerExtra={(
            <InspectorSectionValueBadge
              count={options.length}
              label={`${options.length} option${options.length === 1 ? '' : 's'}`}
              active={options.length > 0}
            />
          )}
        >
          <div className="space-y-2">
            {options.map((option, index) => (
              <div
                key={`${node.id}:sort-option:${index}`}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_28px] items-center gap-2"
              >
                <UiInput
                  size="sm"
                  nested
                  placeholder="Field key"
                  value={option.value}
                  onChange={(event) => updateOption(index, { value: event.target.value })}
                />
                <UiInput
                  size="sm"
                  nested
                  placeholder="Label"
                  value={option.label}
                  onChange={(event) => updateOption(index, { label: event.target.value })}
                />
                <AppButton
                  type="button"
                  size="icon-sm"
                  intent="destructive-soft"
                  aria-label={`Remove sort option ${index + 1}`}
                  onClick={() => removeOption(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </AppButton>
              </div>
            ))}

            <AppButton type="button" size="sm" intent="secondary" className="w-full" onClick={addOption}>
              <Plus className="h-3.5 w-3.5" />
              Add sort option
            </AppButton>

            {unusedSortableColumns.length > 0 ? (
              <div className={`rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50 px-2.5 py-2`}>
                <InspectorMicroLabel className="uppercase tracking-[0.08em] text-slate-600">
                  Add from sortable columns
                </InspectorMicroLabel>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {unusedSortableColumns.map((column) => (
                    <AppButton
                      key={column.key}
                      type="button"
                      size="sm"
                      intent="secondary"
                      className={`h-7 px-2 font-mono ${INSPECTOR_TEXT_XS}`}
                      onClick={() => persistOptions([
                        ...options,
                        { value: column.key, label: typeof column.label === 'string' ? column.label : column.key },
                      ])}
                    >
                      <Plus className="h-3 w-3" />
                      {column.key}
                    </AppButton>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </AppSurfaceBox>
      </div>
    </DesignerFieldRow>
  );
};
