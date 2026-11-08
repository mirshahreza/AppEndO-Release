import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import type { RelationFormWidget } from '../../api/contracts/data-api';
import { AppButton } from '../AppButton';
import { UiCheckbox, UiSelect } from '../HeroFieldControls';
import {
  RelationButtonGroupControl,
  RelationCardListControl,
  RelationCheckboxListControl,
  RelationDropdownButtonControl,
  RelationDualListControl,
  RelationHiddenControl,
  RelationLookupControl,
  RelationTagsListControl,
  RelationNestedCardControl,
  RelationNestedFormControl,
  RelationRadioListControl,
  RelationRelatedGridControl,
  RelationRepeaterControl,
  RelationSelectControl,
  RelationTagsControl,
  RelationTypeaheadControl,
} from './RelationFormWidgetControls';
import {
  RELATION_FORM_WIDGET_DEFAULT_MULTI_VALUES,
  RELATION_FORM_WIDGET_DEFAULT_SINGLE_VALUE,
  RELATION_FORM_WIDGET_SAMPLE_OPTIONS,
  RELATION_FORM_WIDGET_SAMPLE_ROWS,
  RELATION_LOOKUP_SAMPLE_COLUMNS,
  RELATION_LOOKUP_SAMPLE_RECORDS,
} from './relationFormWidgetSampleData';
import {
  RELATION_GRID_EDIT_MODE_OPTIONS,
  RELATION_TAGS_LIST_SELECT_PLACEMENT_OPTIONS,
  type RelationChoiceOrientation,
  type RelationCollectionAddApi,
  type RelationFormWidgetComponentMap,
  type RelationFormWidgetDemoProps,
  type RelationFormWidgetRow,
  type RelationGridEditMode,
  type RelationLookupDialogSize,
  type RelationLookupResultsLayout,
  type RelationTagsListSelectPlacement,
} from './relationFormWidgetTypes';

const options = RELATION_FORM_WIDGET_SAMPLE_OPTIONS;

const LOOKUP_DIALOG_SIZE_OPTIONS: readonly RelationLookupDialogSize[] = [
  'md',
  '2xl',
  'maximized',
  'full',
];

const useDemoTitleExtra = (
  setTitleExtra: RelationFormWidgetDemoProps['setTitleExtra'],
  extra: React.ReactNode,
  deps: React.DependencyList,
) => {
  useLayoutEffect(() => {
    if (!setTitleExtra) return;
    setTitleExtra(extra);
    return () => setTitleExtra(null);
  }, deps);
};

/** Hoist collection Add into the gallery card title row when hosted there. */
const useCollectionDemoAddChrome = (
  setTitleExtra: RelationFormWidgetDemoProps['setTitleExtra'],
  buildLeading?: () => React.ReactNode,
  leadingDeps: React.DependencyList = [],
) => {
  const [addApi, setAddApi] = useState<RelationCollectionAddApi | null>(null);
  const onRegisterAdd = useCallback((api: RelationCollectionAddApi | null) => {
    setAddApi((current) => {
      if (current === api) return current;
      if (
        current
        && api
        && current.add === api.add
        && current.disabled === api.disabled
        && current.label === api.label
      ) {
        return current;
      }
      return api;
    });
  }, []);

  useLayoutEffect(() => {
    if (!setTitleExtra) return;
    setTitleExtra(
      <>
        {buildLeading?.()}
        {addApi ? (
          <AppButton
            type="button"
            intent="secondary"
            size="sm"
            disabled={addApi.disabled}
            onClick={addApi.add}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {addApi.label}
          </AppButton>
        ) : null}
      </>,
    );
    return () => setTitleExtra(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leadingDeps supplied by caller
  }, [setTitleExtra, addApi, buildLeading, ...leadingDeps]);

  return {
    showAddButton: !setTitleExtra,
    onRegisterAdd: setTitleExtra ? onRegisterAdd : undefined,
  };
};

const LookupDemo: React.FC<RelationFormWidgetDemoProps> = ({ size, disabled }) => {
  const [value, setValue] = useState(RELATION_FORM_WIDGET_DEFAULT_SINGLE_VALUE);
  const [dialogSize, setDialogSize] = useState<RelationLookupDialogSize>('maximized');
  const [resultsLayout, setResultsLayout] = useState<RelationLookupResultsLayout>('grid');
  const [columnsMode, setColumnsMode] = useState<'rich' | 'title'>('rich');
  const [showClear, setShowClear] = useState(true);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex w-full min-w-0 flex-nowrap items-center gap-2 overflow-x-auto"
        aria-label="Lookup demo options"
      >
        <div className="w-[8.75rem] shrink-0">
          <UiSelect
            size="sm"
            ariaLabel="Lookup dialog size"
            value={dialogSize}
            onChange={(event) => {
              const next = event.target.value as RelationLookupDialogSize;
              if (LOOKUP_DIALOG_SIZE_OPTIONS.includes(next)) {
                setDialogSize(next);
              }
            }}
          >
            {LOOKUP_DIALOG_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Dialog · {option}
              </option>
            ))}
          </UiSelect>
        </div>
        <div className="w-[8.75rem] shrink-0">
          <UiSelect
            size="sm"
            ariaLabel="Lookup results layout"
            value={resultsLayout}
            onChange={(event) => {
              const next = event.target.value;
              if (next === 'grid' || next === 'list') {
                setResultsLayout(next);
              }
            }}
          >
            <option value="grid">Results · grid</option>
            <option value="list">Results · list</option>
          </UiSelect>
        </div>
        <div className="w-[9.5rem] shrink-0">
          <UiSelect
            size="sm"
            ariaLabel="Lookup grid columns"
            value={columnsMode}
            isDisabled={resultsLayout !== 'grid'}
            onChange={(event) => {
              const next = event.target.value;
              if (next === 'rich' || next === 'title') {
                setColumnsMode(next);
              }
            }}
          >
            <option value="rich">Columns · rich</option>
            <option value="title">Columns · title only</option>
          </UiSelect>
        </div>
        <div className="shrink-0 whitespace-nowrap">
          <UiCheckbox
            size="sm"
            checked={showClear}
            disabled={disabled}
            onChange={(event) => setShowClear(event.target.checked)}
          >
            <span className="text-xs font-medium text-slate-700">Show clear</span>
          </UiCheckbox>
        </div>
      </div>
      <RelationLookupControl
        records={RELATION_LOOKUP_SAMPLE_RECORDS}
        columns={columnsMode === 'rich' ? RELATION_LOOKUP_SAMPLE_COLUMNS : undefined}
        value={value}
        onChange={setValue}
        size={size}
        disabled={disabled}
        dialogSize={dialogSize}
        resultsLayout={resultsLayout}
        showClear={showClear}
        dialogTitle="Look up related record"
      />
    </div>
  );
};

const SelectDemo: React.FC<RelationFormWidgetDemoProps> = ({ size, disabled }) => {
  const [value, setValue] = useState(RELATION_FORM_WIDGET_DEFAULT_SINGLE_VALUE);
  return (
    <RelationSelectControl
      options={options}
      value={value}
      onChange={setValue}
      size={size}
      disabled={disabled}
    />
  );
};

const DropdownButtonDemo: React.FC<RelationFormWidgetDemoProps> = ({ size, disabled }) => {
  const [value, setValue] = useState(RELATION_FORM_WIDGET_DEFAULT_SINGLE_VALUE);
  return (
    <RelationDropdownButtonControl
      options={options}
      value={value}
      onChange={setValue}
      size={size}
      disabled={disabled}
    />
  );
};

const RadioListDemo: React.FC<RelationFormWidgetDemoProps> = ({ size, disabled, setTitleExtra }) => {
  const [value, setValue] = useState(RELATION_FORM_WIDGET_DEFAULT_SINGLE_VALUE);
  const [orientation, setOrientation] = useState<RelationChoiceOrientation>('horizontal');

  useDemoTitleExtra(
    setTitleExtra,
    (
      <div className="w-[9rem] shrink-0">
        <UiSelect
          size="sm"
          ariaLabel="Radio list orientation"
          value={orientation}
          onChange={(event) => {
            const next = event.target.value;
            if (next === 'horizontal' || next === 'vertical') {
              setOrientation(next);
            }
          }}
        >
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
        </UiSelect>
      </div>
    ),
    [setTitleExtra, orientation],
  );

  return (
    <RelationRadioListControl
      options={options}
      value={value}
      onChange={setValue}
      size={size}
      disabled={disabled}
      orientation={orientation}
    />
  );
};

const ButtonGroupDemo: React.FC<RelationFormWidgetDemoProps> = ({ disabled, setTitleExtra }) => {
  const [value, setValue] = useState(RELATION_FORM_WIDGET_DEFAULT_SINGLE_VALUE);
  const [orientation, setOrientation] = useState<RelationChoiceOrientation>('horizontal');

  useDemoTitleExtra(
    setTitleExtra,
    (
      <div className="w-[9rem] shrink-0">
        <UiSelect
          size="sm"
          ariaLabel="Button group orientation"
          value={orientation}
          onChange={(event) => {
            const next = event.target.value;
            if (next === 'horizontal' || next === 'vertical') {
              setOrientation(next);
            }
          }}
        >
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
        </UiSelect>
      </div>
    ),
    [setTitleExtra, orientation],
  );

  return (
    <RelationButtonGroupControl
      options={options}
      value={value}
      onChange={setValue}
      disabled={disabled}
      orientation={orientation}
    />
  );
};

const TypeaheadDemo: React.FC<RelationFormWidgetDemoProps> = ({ size, disabled }) => {
  const [value, setValue] = useState(RELATION_FORM_WIDGET_DEFAULT_SINGLE_VALUE);
  return (
    <RelationTypeaheadControl
      options={options}
      value={value}
      onChange={setValue}
      size={size}
      disabled={disabled}
    />
  );
};

const NestedCardDemo: React.FC<RelationFormWidgetDemoProps> = ({ size, disabled }) => {
  const [row, setRow] = useState<RelationFormWidgetRow | null>(
    RELATION_FORM_WIDGET_SAMPLE_ROWS[0] ?? null,
  );
  return (
    <RelationNestedCardControl
      row={row}
      onRowChange={setRow}
      size={size}
      disabled={disabled}
    />
  );
};

const NestedFormDemo: React.FC<RelationFormWidgetDemoProps> = ({ size, disabled }) => {
  const [row, setRow] = useState<RelationFormWidgetRow | null>(
    RELATION_FORM_WIDGET_SAMPLE_ROWS[0] ?? null,
  );
  return (
    <RelationNestedFormControl
      row={row}
      onRowChange={setRow}
      size={size}
      disabled={disabled}
    />
  );
};

const CheckboxListDemo: React.FC<RelationFormWidgetDemoProps> = ({
  size,
  disabled,
  setTitleExtra,
}) => {
  const [values, setValues] = useState<string[]>([...RELATION_FORM_WIDGET_DEFAULT_MULTI_VALUES]);
  const [orientation, setOrientation] = useState<RelationChoiceOrientation>('horizontal');

  useDemoTitleExtra(
    setTitleExtra,
    (
      <div className="w-[9rem] shrink-0">
        <UiSelect
          size="sm"
          ariaLabel="Checkbox list orientation"
          value={orientation}
          onChange={(event) => {
            const next = event.target.value;
            if (next === 'horizontal' || next === 'vertical') {
              setOrientation(next);
            }
          }}
        >
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
        </UiSelect>
      </div>
    ),
    [setTitleExtra, orientation],
  );

  return (
    <RelationCheckboxListControl
      options={options}
      values={values}
      onChange={setValues}
      size={size}
      disabled={disabled}
      orientation={orientation}
    />
  );
};

const TagsListDemo: React.FC<RelationFormWidgetDemoProps> = ({
  size,
  disabled,
  setTitleExtra,
}) => {
  const [values, setValues] = useState<string[]>([...RELATION_FORM_WIDGET_DEFAULT_MULTI_VALUES]);
  const [selectPlacement, setSelectPlacement] = useState<RelationTagsListSelectPlacement>('inline');

  useDemoTitleExtra(
    setTitleExtra,
    (
      <div className="w-[8.5rem] shrink-0">
        <UiSelect
          size="sm"
          ariaLabel="Tags list select placement"
          value={selectPlacement}
          onChange={(event) => {
            const next = event.target.value as RelationTagsListSelectPlacement;
            if (RELATION_TAGS_LIST_SELECT_PLACEMENT_OPTIONS.some((option) => option.value === next)) {
              setSelectPlacement(next);
            }
          }}
        >
          {RELATION_TAGS_LIST_SELECT_PLACEMENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </UiSelect>
      </div>
    ),
    [setTitleExtra, selectPlacement],
  );

  return (
    <RelationTagsListControl
      options={options}
      values={values}
      onChange={setValues}
      size={size}
      disabled={disabled}
      selectPlacement={selectPlacement}
    />
  );
};

const TagsDemo: React.FC<RelationFormWidgetDemoProps> = ({ disabled }) => {
  const [values, setValues] = useState<string[]>([...RELATION_FORM_WIDGET_DEFAULT_MULTI_VALUES]);
  return (
    <RelationTagsControl
      options={options}
      values={values}
      onChange={setValues}
      disabled={disabled}
    />
  );
};

const DualListDemo: React.FC<RelationFormWidgetDemoProps> = ({ disabled }) => {
  const [values, setValues] = useState<string[]>([...RELATION_FORM_WIDGET_DEFAULT_MULTI_VALUES]);
  return (
    <RelationDualListControl
      options={options}
      values={values}
      onChange={setValues}
      disabled={disabled}
    />
  );
};

const useCollectionEditModeDemoChrome = (
  setTitleExtra: RelationFormWidgetDemoProps['setTitleExtra'],
  disabled?: boolean,
) => {
  const [editMode, setEditMode] = useState<RelationGridEditMode>('row');
  const buildEditModeSelect = useCallback(() => (
    <div className="w-[9.75rem] shrink-0">
      <UiSelect
        size="sm"
        value={editMode}
        isDisabled={disabled}
        ariaLabel="Edit mode"
        onChange={(event) => {
          const next = event.target.value as RelationGridEditMode;
          if (RELATION_GRID_EDIT_MODE_OPTIONS.some((option) => option.value === next)) {
            setEditMode(next);
          }
        }}
      >
        {RELATION_GRID_EDIT_MODE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </UiSelect>
    </div>
  ), [disabled, editMode]);
  const addChrome = useCollectionDemoAddChrome(
    setTitleExtra,
    buildEditModeSelect,
    [disabled, editMode],
  );
  return {
    editMode,
    setEditMode,
    showEditModeSelect: !setTitleExtra,
    showAddButton: addChrome.showAddButton,
    onRegisterAdd: addChrome.onRegisterAdd,
  };
};

const RelatedGridDemo: React.FC<RelationFormWidgetDemoProps> = ({
  size,
  disabled,
  setTitleExtra,
}) => {
  const [rows, setRows] = useState([...RELATION_FORM_WIDGET_SAMPLE_ROWS]);
  const chrome = useCollectionEditModeDemoChrome(setTitleExtra, disabled);
  return (
    <RelationRelatedGridControl
      rows={rows}
      onRowsChange={setRows}
      size={size}
      disabled={disabled}
      editMode={chrome.editMode}
      onEditModeChange={chrome.setEditMode}
      showEditModeSelect={chrome.showEditModeSelect}
      showAddButton={chrome.showAddButton}
      onRegisterAdd={chrome.onRegisterAdd}
    />
  );
};

const CardListDemo: React.FC<RelationFormWidgetDemoProps> = ({ size, disabled, setTitleExtra }) => {
  const [rows, setRows] = useState([...RELATION_FORM_WIDGET_SAMPLE_ROWS]);
  const chrome = useCollectionEditModeDemoChrome(setTitleExtra, disabled);
  return (
    <RelationCardListControl
      rows={rows}
      onRowsChange={setRows}
      size={size}
      disabled={disabled}
      editMode={chrome.editMode}
      onEditModeChange={chrome.setEditMode}
      showEditModeSelect={chrome.showEditModeSelect}
      showAddButton={chrome.showAddButton}
      onRegisterAdd={chrome.onRegisterAdd}
    />
  );
};

const RepeaterDemo: React.FC<RelationFormWidgetDemoProps> = ({ size, disabled, setTitleExtra }) => {
  const [rows, setRows] = useState([...RELATION_FORM_WIDGET_SAMPLE_ROWS]);
  const chrome = useCollectionEditModeDemoChrome(setTitleExtra, disabled);
  return (
    <RelationRepeaterControl
      rows={rows}
      onRowsChange={setRows}
      size={size}
      disabled={disabled}
      editMode={chrome.editMode}
      onEditModeChange={chrome.setEditMode}
      showEditModeSelect={chrome.showEditModeSelect}
      showAddButton={chrome.showAddButton}
      onRegisterAdd={chrome.onRegisterAdd}
    />
  );
};

const HiddenDemo: React.FC<RelationFormWidgetDemoProps> = () => (
  <RelationHiddenControl />
);

/**
 * Internal catalog: every Relation Properties FORM WIDGET value → demo component.
 * Sandbox and future generated forms should resolve widgets through this map.
 */
export const RELATION_FORM_WIDGET_COMPONENTS: RelationFormWidgetComponentMap = {
  lookup: LookupDemo,
  select: SelectDemo,
  dropdownButton: DropdownButtonDemo,
  radio: RadioListDemo,
  buttonGroup: ButtonGroupDemo,
  typeahead: TypeaheadDemo,
  nestedCard: NestedCardDemo,
  nestedForm: NestedFormDemo,
  relatedGrid: RelatedGridDemo,
  cardList: CardListDemo,
  repeater: RepeaterDemo,
  checkboxList: CheckboxListDemo,
  tagsList: TagsListDemo,
  tags: TagsDemo,
  dualList: DualListDemo,
  hidden: HiddenDemo,
};

export const getRelationFormWidgetComponent = (
  widget: RelationFormWidget,
): RelationFormWidgetComponentMap[RelationFormWidget] => (
  RELATION_FORM_WIDGET_COMPONENTS[widget]
);
