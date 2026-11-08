import React, { useMemo } from 'react';
import {
  CRUD_SET_ACTIONS_ALIGN_LABELS,
  CRUD_SET_ACTIONS_ALIGNS,
  CRUD_SET_GRID_CHROME_LABELS,
  CRUD_SET_GRID_CHROMES,
  CRUD_SET_GRID_DENSITY_LABELS,
  CRUD_SET_GRID_DENSITIES,
  applyCrudSetGridChrome,
  crudSetActionsAlign,
  crudSetActionsMaxVisible,
  crudSetGridEffectiveBorderWidth,
  crudSetGridEffectiveMargin,
  crudSetGridCardBelow,
  crudSetGridChrome,
  crudSetGridColumnLayoutEnabled,
  crudSetGridDensity,
  crudSetGridEmptyMessage,
  crudSetGridFillHeight,
  crudSetGridLoadingMessage,
  crudSetGridPresentation,
  crudSetGridSelection,
  crudSetGridShowColumnLayoutControl,
  crudSetGridStickyHeader,
  isCrudSetActionsAlign,
  isCrudSetGridChrome,
  isCrudSetGridDensity,
  isCrudSetGridSelectionMode,
  isCrudSetMaxVisibleActions,
  CRUD_SET_GRID_SELECTION_MODE_LABELS,
  CRUD_SET_GRID_SELECTION_MODES,
  type CrudSetActionsConfig,
  type CrudSetGridConfig,
  type CrudSetListBodyKind,
} from '../../domain/component-designer/crudSetSpec';
import {
  crudSetGridPatchFromPresentationFields,
  gridPresentationFieldsFromCrudSetGrid,
} from '../lib/gridPresentationConfigBridge';
import { GridPresentationFields, GridRowActionsFields } from './GridPresentationFields';
import { FormField } from './FormSection';
import { CrudSetConfigCheckbox } from './CrudSetConfigCheckbox';
import { UiSelect } from './HeroFieldControls';
import { UiInput } from './ai-field-assist/AiAssistInput';

export type CrudSetGridFieldsProps = {
  grid: CrudSetGridConfig;
  actions: CrudSetActionsConfig;
  listBody: CrudSetListBodyKind;
  onGridChange: (next: CrudSetGridConfig) => void;
  onActionsChange: (next: CrudSetActionsConfig) => void;
  fieldClassName?: string;
  selectClassName?: string;
};

/** AppTableGrid + AppGridRowActions chrome for the CRUD Set wizard and living sample. */
export const CrudSetGridFields: React.FC<CrudSetGridFieldsProps> = ({
  grid,
  actions,
  listBody,
  onGridChange,
  onActionsChange,
  fieldClassName,
  selectClassName,
}) => {
  const spec = { listBody, grid, actions };
  const tree = listBody === 'tree-grid';
  const patchGrid = (partial: Partial<CrudSetGridConfig>) => onGridChange({ ...grid, ...partial });
  const patchActions = (partial: Partial<CrudSetActionsConfig>) => (
    onActionsChange({ ...actions, ...partial })
  );
  const presentationConfig = useMemo(
    () => gridPresentationFieldsFromCrudSetGrid(grid, {
      presentation: crudSetGridPresentation(spec),
      cardBelow: crudSetGridCardBelow(spec),
    }),
    [grid, spec],
  );

  return (
    <>
      <FormField label="Grid chrome" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetGridChrome(spec)}
          onChange={(event) => {
            if (isCrudSetGridChrome(event.target.value)) {
              onGridChange(applyCrudSetGridChrome(grid, event.target.value));
            }
          }}
          ariaLabel="CRUD Set grid chrome"
        >
          {CRUD_SET_GRID_CHROMES.map((item) => (
            <option key={item} value={item}>{CRUD_SET_GRID_CHROME_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Density" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetGridDensity(spec)}
          onChange={(event) => {
            if (isCrudSetGridDensity(event.target.value)) {
              patchGrid({ density: event.target.value });
            }
          }}
          ariaLabel="CRUD Set grid density"
        >
          {CRUD_SET_GRID_DENSITIES.map((item) => (
            <option key={item} value={item}>{CRUD_SET_GRID_DENSITY_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <CrudSetConfigCheckbox
        label="Fill height"
        checked={crudSetGridFillHeight(spec)}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patchGrid({ fillHeight: checked })}
      />
      <CrudSetConfigCheckbox
        label="Sticky header"
        checked={crudSetGridStickyHeader(spec)}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patchGrid({ stickyHeader: checked })}
      />
      <GridPresentationFields
        variant={tree ? 'tree' : 'grid'}
        config={presentationConfig}
        onChange={(patch) => patchGrid(crudSetGridPatchFromPresentationFields(patch, grid))}
        chrome={{
          fieldClassName,
          selectClassName,
          useSections: false,
        }}
      />
      <FormField label="Selection" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetGridSelection(spec)}
          onChange={(event) => {
            if (isCrudSetGridSelectionMode(event.target.value)) {
              patchGrid({ selection: event.target.value });
            }
          }}
          ariaLabel="CRUD Set grid selection"
        >
          {CRUD_SET_GRID_SELECTION_MODES.map((item) => (
            <option key={item} value={item}>{CRUD_SET_GRID_SELECTION_MODE_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <CrudSetConfigCheckbox
        label="Column layout"
        checked={crudSetGridColumnLayoutEnabled(spec)}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patchGrid({
          enableColumnLayout: checked,
          showColumnLayoutControl: checked
            ? (grid.showColumnLayoutControl ?? false)
            : false,
        })}
      />
      {crudSetGridColumnLayoutEnabled(spec) ? (
        <CrudSetConfigCheckbox
          label="Layout control"
          checked={crudSetGridShowColumnLayoutControl(spec)}
          fieldClassName={fieldClassName}
          selectClassName={selectClassName}
          onChange={(checked) => patchGrid({ showColumnLayoutControl: checked })}
        />
      ) : null}
      <FormField label="Empty message" className={fieldClassName} reserveHintSlot={false}>
        <UiInput
          size="sm"
          autoDir={false}
          value={grid.emptyMessage ?? crudSetGridEmptyMessage(spec)}
          onChange={(event) => patchGrid({ emptyMessage: event.target.value })}
          ariaLabel="CRUD Set empty message"
        />
      </FormField>
      <FormField label="Loading message" className={fieldClassName} reserveHintSlot={false}>
        <UiInput
          size="sm"
          autoDir={false}
          value={grid.loadingMessage ?? crudSetGridLoadingMessage(spec)}
          onChange={(event) => patchGrid({ loadingMessage: event.target.value })}
          ariaLabel="CRUD Set loading message"
        />
      </FormField>
      <FormField label="Accessible name" className={fieldClassName} reserveHintSlot={false}>
        <UiInput
          size="sm"
          autoDir={false}
          value={grid.ariaLabel ?? ''}
          onChange={(event) => patchGrid({ ariaLabel: event.target.value })}
          ariaLabel="CRUD Set grid aria label"
        />
      </FormField>
      <FormField label="Margin (px)" className={fieldClassName} reserveHintSlot={false}>
        <UiInput
          size="sm"
          autoDir={false}
          value={grid.margin != null && Number.isFinite(grid.margin)
            ? String(grid.margin)
            : String(crudSetGridEffectiveMargin(spec))}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            patchGrid({ margin: Number.isFinite(parsed) ? parsed : 0 });
          }}
          ariaLabel="CRUD Set grid margin"
        />
      </FormField>
      <FormField label="Border width (px)" className={fieldClassName} reserveHintSlot={false}>
        <UiInput
          size="sm"
          autoDir={false}
          value={grid.borderWidth != null && Number.isFinite(grid.borderWidth)
            ? String(grid.borderWidth)
            : String(crudSetGridEffectiveBorderWidth(spec))}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            patchGrid({ borderWidth: Number.isFinite(parsed) ? parsed : 0 });
          }}
          ariaLabel="CRUD Set grid border width"
        />
      </FormField>
      <GridRowActionsFields
        config={{
          rowActions: true,
          maxVisibleActions: crudSetActionsMaxVisible(spec),
        }}
        onChange={(patch) => {
          if (patch.maxVisibleActions != null && isCrudSetMaxVisibleActions(patch.maxVisibleActions)) {
            patchActions({ maxVisible: patch.maxVisibleActions });
          }
        }}
        chrome={{ fieldClassName, selectClassName, useSections: false }}
      />
      <FormField label="Actions align" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetActionsAlign(spec)}
          onChange={(event) => {
            if (isCrudSetActionsAlign(event.target.value)) {
              patchActions({ align: event.target.value });
            }
          }}
          ariaLabel="CRUD Set actions align"
        >
          {CRUD_SET_ACTIONS_ALIGNS.map((item) => (
            <option key={item} value={item}>{CRUD_SET_ACTIONS_ALIGN_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
    </>
  );
};
