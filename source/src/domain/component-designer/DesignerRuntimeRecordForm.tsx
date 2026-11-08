import * as React from 'react';
import { RecordForm, defaultRecordFormFieldValue } from '../../shared/ui/RecordForm';
import {
  CRUD_SET_DEFAULT_SIDE_PANEL_TITLE,
  RECORD_FORM_PALETTE_ITEM_ID,
  crudSetColumnCellKind,
  isRecordFormMode,
  isRecordFormSidePanelBackground,
  isRecordFormSidePanelPlacement,
  parseRecordFormColumns,
} from './crudSetSpec';
import { mergeClassNames, readString } from './runtimeShared';
import type { DesignerNode } from './types';
import type { RuntimeRenderOptions } from './runtimeTypes';

const demoValuesForColumns = (columns: ReturnType<typeof parseRecordFormColumns>): Record<string, unknown> => (
  Object.fromEntries(columns.map((column) => [
    column.field,
    defaultRecordFormFieldValue(column.field, crudSetColumnCellKind(column)),
  ]))
);

export const DesignerRuntimeRecordForm: React.FC<{
  node: DesignerNode;
  options: RuntimeRenderOptions & { className?: string };
}> = ({ node, options }) => {
  const specKey = typeof node.props.spec === 'string'
    ? node.props.spec
    : JSON.stringify(node.props.spec ?? '');
  const columns = React.useMemo(() => parseRecordFormColumns(specKey), [specKey]);
  const mode = isRecordFormMode(node.props.mode) ? node.props.mode : 'edit';
  const sidePanelTitle = readString(node.props.sidePanelTitle, CRUD_SET_DEFAULT_SIDE_PANEL_TITLE)
    || CRUD_SET_DEFAULT_SIDE_PANEL_TITLE;
  const sidePanelPlacement = isRecordFormSidePanelPlacement(node.props.sidePanelPlacement)
    ? node.props.sidePanelPlacement
    : 'end';
  const sidePanelPinnable = node.props.sidePanelPinnable === true || node.props.sidePanelPinnable === 'true';
  const sidePanelSplitter = node.props.sidePanelSplitter !== false && node.props.sidePanelSplitter !== 'false';
  const sidePanelShowTitle = node.props.sidePanelShowTitle !== false && node.props.sidePanelShowTitle !== 'false';
  const sidePanelTitleInHeader = node.props.sidePanelTitleInHeader === true
    || node.props.sidePanelTitleInHeader === 'true';
  const sidePanelBackground = isRecordFormSidePanelBackground(node.props.sidePanelBackground)
    ? node.props.sidePanelBackground
    : 'theme';
  const sidePanelBackgroundColor = readString(node.props.sidePanelBackgroundColor, '#F1F5F9')
    || '#F1F5F9';
  const fields = columns.map((column) => column.field);
  const [values, setValues] = React.useState(() => demoValuesForColumns(columns));
  const className = mergeClassNames(
    options.className,
    options.mode === 'design' ? 'pointer-events-none' : undefined,
  );

  React.useEffect(() => {
    setValues(demoValuesForColumns(columns));
  }, [specKey]);

  if (columns.length === 0) {
    return (
      <div
        className={mergeClassNames(
          'flex min-h-[120px] w-full items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-sm text-slate-600',
          className,
        )}
        style={options.style}
        data-designer-component={RECORD_FORM_PALETTE_ITEM_ID}
      >
        {readString(node.props.label, 'Edit / View needs columns')}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={options.style}
      data-designer-component={RECORD_FORM_PALETTE_ITEM_ID}
    >
      <RecordForm
        mode={mode}
        columns={columns}
        fields={fields}
        values={values}
        onChange={options.mode === 'runtime' ? setValues : undefined}
        sidePanelTitle={sidePanelTitle}
        sidePanelPlacement={sidePanelPlacement}
        sidePanelPinnable={sidePanelPinnable}
        sidePanelSplitter={sidePanelSplitter}
        sidePanelShowTitle={sidePanelShowTitle}
        sidePanelTitleInHeader={sidePanelTitleInHeader}
        sidePanelBackground={sidePanelBackground}
        sidePanelBackgroundColor={sidePanelBackgroundColor}
      />
    </div>
  );
};
