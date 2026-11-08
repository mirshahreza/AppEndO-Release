import React, { useMemo, useRef, useState } from 'react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  FormField,
  FormSection,
  UiSelect,
  UiSpreadsheet,
  applySpreadsheetGridLines,
  createDemoSpreadsheetSheets,
  isSpreadsheetFillHeight,
  resolveUiSpreadsheetWorkbookSettings,
  type UiSpreadsheetCurrency,
  type UiSpreadsheetDirection,
  type UiSpreadsheetHandle,
  type UiSpreadsheetLang,
  type UiSpreadsheetMenuPreset,
  type UiSpreadsheetPixelRatio,
  type UiSpreadsheetSheet,
  type UiSpreadsheetSheetMenuPreset,
  type UiSpreadsheetStatBar,
  type UiSpreadsheetToolbarPreset,
} from '../../../shared/ui';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsConfigToolbarControls, BaseComponentsResetButton } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import { BaseComponentsPreviewFrame, BASE_COMPONENTS_WORKSPACE_INSET_CLASS } from '../components/BaseComponentsWorkspacePanel';
import {
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';

export type SpreadsheetBaseComponentsConfig = {
  showToolbar: boolean;
  toolbarPreset: UiSpreadsheetToolbarPreset;
  showFormulaBar: boolean;
  showSheetTabs: boolean;
  statBar: UiSpreadsheetStatBar;
  allowEdit: boolean;
  height: 320 | 420 | 520 | 'full';
  lang: UiSpreadsheetLang;
  direction: UiSpreadsheetDirection;
  currency: UiSpreadsheetCurrency;
  row: 36 | 84 | 120 | 200;
  column: 18 | 26 | 50 | 60;
  addRows: 0 | 10 | 50 | 100;
  showAddColumns: boolean;
  defaultFontSize: 9 | 10 | 11 | 12 | 14;
  defaultRowHeight: 19 | 24 | 32;
  defaultColWidth: 73 | 100 | 140;
  showRowHeader: boolean;
  showColumnHeader: boolean;
  showGridLines: boolean;
  devicePixelRatio: UiSpreadsheetPixelRatio;
  forceCalculation: boolean;
  cellMenuPreset: UiSpreadsheetMenuPreset;
  headerMenuPreset: UiSpreadsheetMenuPreset;
  sheetTabMenuPreset: UiSpreadsheetSheetMenuPreset;
  filterMenuPreset: UiSpreadsheetSheetMenuPreset;
};

const DEFAULT_CONFIG: SpreadsheetBaseComponentsConfig = {
  showToolbar: true,
  toolbarPreset: 'full',
  showFormulaBar: true,
  showSheetTabs: true,
  statBar: 'tabs',
  allowEdit: true,
  height: 'full',
  lang: 'en',
  direction: 'ltr',
  currency: 'USD',
  row: 200,
  column: 50,
  addRows: 0,
  showAddColumns: true,
  defaultFontSize: 11,
  defaultRowHeight: 19,
  defaultColWidth: 73,
  showRowHeader: true,
  showColumnHeader: true,
  showGridLines: true,
  devicePixelRatio: 'auto',
  forceCalculation: false,
  cellMenuPreset: 'full',
  headerMenuPreset: 'full',
  sheetTabMenuPreset: 'full',
  filterMenuPreset: 'full',
};

const ALWAYS_VISIBLE = [
  'showToolbar', 'showFormulaBar', 'showSheetTabs', 'statBar', 'allowEdit', 'height',
  'lang', 'direction', 'currency', 'row', 'column', 'addRows', 'showAddColumns', 'defaultFontSize',
  'defaultRowHeight', 'defaultColWidth', 'showRowHeader', 'showColumnHeader',
  'showGridLines', 'devicePixelRatio', 'forceCalculation',
  'cellMenuPreset', 'headerMenuPreset', 'sheetTabMenuPreset', 'filterMenuPreset',
] as const;

export const resolveSpreadsheetOptionLiveness = (config: SpreadsheetBaseComponentsConfig) => {
  const workbook = resolveUiSpreadsheetWorkbookSettings(config);
  return {
    visibleOptions: [
      ...ALWAYS_VISIBLE,
      ...(config.showToolbar ? ['toolbarPreset'] : []),
    ],
    spreadsheetProps: {
      ...workbook,
      height: config.height,
      direction: config.direction,
      showGridLines: config.showGridLines,
      toolbarPreset: config.toolbarPreset,
      cellMenuPreset: config.cellMenuPreset,
      headerMenuPreset: config.headerMenuPreset,
      sheetTabMenuPreset: config.sheetTabMenuPreset,
      filterMenuPreset: config.filterMenuPreset,
    },
  };
};

import { BaseComponentsConfigBoolField } from '../components/BaseComponentsConfigBoolField';

export const SpreadsheetBaseComponentsWorkspace: React.FC = () => {
  const sheetRef = useRef<UiSpreadsheetHandle>(null);
  const [config, setConfig] = useState<SpreadsheetBaseComponentsConfig>(DEFAULT_CONFIG);
  const [sheets, setSheets] = useState<UiSpreadsheetSheet[]>(createDemoSpreadsheetSheets);
  const [status, setStatus] = useState('Ready. Use the actions to drive the workbook.');
  const [hostGeneration, setHostGeneration] = useState(0);
  const liveness = resolveSpreadsheetOptionLiveness(config);
  const configJson = useMemo(() => JSON.stringify(liveness.spreadsheetProps, null, 2), [liveness.spreadsheetProps]);
  const hostKey = `${hostGeneration}:${JSON.stringify({
    ...liveness.spreadsheetProps,
    height: undefined,
  })}`;
  const patch = (next: Partial<SpreadsheetBaseComponentsConfig>) =>
    setConfig((current) => ({ ...current, ...next }));

  const runAction = (label: string, action: (api: UiSpreadsheetHandle) => string | void) => {
    const api = sheetRef.current;
    if (!api) {
      setStatus('Spreadsheet is not ready.');
      return;
    }
    try {
      const result = action(api);
      setStatus(result ?? `${label}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label} failed.`);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="spreadsheet" json={configJson}>
          <BaseComponentsResetButton
            onClick={() => {
              setConfig(DEFAULT_CONFIG);
              setSheets(createDemoSpreadsheetSheets());
              setHostGeneration((current) => current + 1);
              setStatus('Reset to the demo workbook.');
            }}
          />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Chrome" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <BaseComponentsConfigBoolField label="Toolbar" checked={config.showToolbar} ariaLabel="Show toolbar" onChange={(showToolbar) => patch({ showToolbar })} />
                {liveness.visibleOptions.includes('toolbarPreset') ? (
                  <FormField label="Toolbar items" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.toolbarPreset} onChange={(event) => patch({ toolbarPreset: event.target.value as UiSpreadsheetToolbarPreset })} ariaLabel="Toolbar preset">
                      <option value="full">full</option>
                      <option value="compact">compact</option>
                      <option value="format">format</option>
                      <option value="none">none</option>
                    </UiSelect>
                  </FormField>
                ) : null}
                <BaseComponentsConfigBoolField label="Formula bar" checked={config.showFormulaBar} ariaLabel="Show formula bar" onChange={(showFormulaBar) => patch({ showFormulaBar })} />
                <BaseComponentsConfigBoolField label="Sheet tabs" checked={config.showSheetTabs} ariaLabel="Show sheet tabs" onChange={(showSheetTabs) => patch({ showSheetTabs })} />
                <FormField label="Stat bar" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.statBar} onChange={(event) => patch({ statBar: event.target.value as UiSpreadsheetStatBar })} ariaLabel="Stat bar">
                    <option value="tabs">tabs</option>
                    <option value="footer">footer</option>
                    <option value="hidden">hidden</option>
                  </UiSelect>
                </FormField>
                <BaseComponentsConfigBoolField label="Allow edit" checked={config.allowEdit} ariaLabel="Allow edit" onChange={(allowEdit) => patch({ allowEdit })} />
                <FormField label="Height" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={String(config.height)}
                    onChange={(event) => {
                      const next = event.target.value;
                      patch({ height: next === 'full' ? 'full' : Number(next) as Exclude<SpreadsheetBaseComponentsConfig['height'], 'full'> });
                    }}
                    ariaLabel="Spreadsheet height"
                  >
                    <option value="320">320</option>
                    <option value="420">420</option>
                    <option value="520">520</option>
                    <option value="full">100%</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
            <FormSection title="Locale" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE} divided>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Language" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.lang} onChange={(event) => patch({ lang: event.target.value as UiSpreadsheetLang })} ariaLabel="Language">
                    <option value="en">en</option>
                    <option value="zh">zh</option>
                    <option value="zh_tw">zh_tw</option>
                    <option value="es">es</option>
                    <option value="hi">hi</option>
                    <option value="ru">ru</option>
                  </UiSelect>
                </FormField>
                <FormField label="Direction" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false} hint="Sheet chrome only. Toolbar and formula bar stay left to right. The grid canvas does not mirror.">
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.direction} onChange={(event) => patch({ direction: event.target.value as UiSpreadsheetDirection })} ariaLabel="Sheet direction">
                    <option value="ltr">ltr</option>
                    <option value="rtl">rtl</option>
                  </UiSelect>
                </FormField>
                <FormField label="Currency" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.currency} onChange={(event) => patch({ currency: event.target.value as UiSpreadsheetCurrency })} ariaLabel="Currency">
                    <option value="USD">USD $</option>
                    <option value="EUR">EUR €</option>
                    <option value="CNY">CNY ¥</option>
                    <option value="GBP">GBP £</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
            <FormSection title="Grid" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE} divided>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Rows" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={String(config.row)} onChange={(event) => patch({ row: Number(event.target.value) as SpreadsheetBaseComponentsConfig['row'] })} ariaLabel="Row count">
                    <option value="36">36</option>
                    <option value="84">84</option>
                    <option value="120">120</option>
                    <option value="200">200</option>
                  </UiSelect>
                </FormField>
                <FormField label="Columns" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={String(config.column)} onChange={(event) => patch({ column: Number(event.target.value) as SpreadsheetBaseComponentsConfig['column'] })} ariaLabel="Column count">
                    <option value="18">18</option>
                    <option value="26">26</option>
                    <option value="50">50</option>
                    <option value="60">60</option>
                  </UiSelect>
                </FormField>
                <FormField label="Add rows" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={String(config.addRows)} onChange={(event) => patch({ addRows: Number(event.target.value) as SpreadsheetBaseComponentsConfig['addRows'] })} ariaLabel="Add rows">
                    <option value="0">0 (auto-grow)</option>
                    <option value="10">10</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </UiSelect>
                </FormField>
                <BaseComponentsConfigBoolField label="Add columns" checked={config.showAddColumns} ariaLabel="Show add columns" onChange={(showAddColumns) => patch({ showAddColumns })} />
                <FormField label="Font size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={String(config.defaultFontSize)} onChange={(event) => patch({ defaultFontSize: Number(event.target.value) as SpreadsheetBaseComponentsConfig['defaultFontSize'] })} ariaLabel="Default font size">
                    <option value="9">9</option>
                    <option value="10">10</option>
                    <option value="11">11</option>
                    <option value="12">12</option>
                    <option value="14">14</option>
                  </UiSelect>
                </FormField>
                <FormField label="Row height" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={String(config.defaultRowHeight)} onChange={(event) => patch({ defaultRowHeight: Number(event.target.value) as SpreadsheetBaseComponentsConfig['defaultRowHeight'] })} ariaLabel="Default row height">
                    <option value="19">19</option>
                    <option value="24">24</option>
                    <option value="32">32</option>
                  </UiSelect>
                </FormField>
                <FormField label="Column width" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={String(config.defaultColWidth)} onChange={(event) => patch({ defaultColWidth: Number(event.target.value) as SpreadsheetBaseComponentsConfig['defaultColWidth'] })} ariaLabel="Default column width">
                    <option value="73">73</option>
                    <option value="100">100</option>
                    <option value="140">140</option>
                  </UiSelect>
                </FormField>
                <BaseComponentsConfigBoolField label="Row header" checked={config.showRowHeader} ariaLabel="Show row header" onChange={(showRowHeader) => patch({ showRowHeader })} />
                <BaseComponentsConfigBoolField label="Column header" checked={config.showColumnHeader} ariaLabel="Show column header" onChange={(showColumnHeader) => patch({ showColumnHeader })} />
                <BaseComponentsConfigBoolField label="Grid lines" checked={config.showGridLines} ariaLabel="Show grid lines" onChange={(showGridLines) => patch({ showGridLines })} />
                <FormField label="Pixel ratio" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={String(config.devicePixelRatio)} onChange={(event) => patch({ devicePixelRatio: event.target.value === 'auto' ? 'auto' : Number(event.target.value) as 1 | 2 })} ariaLabel="Device pixel ratio">
                    <option value="auto">auto</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </UiSelect>
                </FormField>
                <BaseComponentsConfigBoolField label="Force calc" checked={config.forceCalculation} ariaLabel="Force calculation" onChange={(forceCalculation) => patch({ forceCalculation })} />
              </div>
            </FormSection>
            <FormSection title="Menus" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE} divided>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Cell menu" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.cellMenuPreset} onChange={(event) => patch({ cellMenuPreset: event.target.value as UiSpreadsheetMenuPreset })} ariaLabel="Cell context menu">
                    <option value="full">full</option>
                    <option value="edit">edit</option>
                    <option value="none">none</option>
                  </UiSelect>
                </FormField>
                <FormField label="Header menu" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.headerMenuPreset} onChange={(event) => patch({ headerMenuPreset: event.target.value as UiSpreadsheetMenuPreset })} ariaLabel="Header context menu">
                    <option value="full">full</option>
                    <option value="edit">edit</option>
                    <option value="none">none</option>
                  </UiSelect>
                </FormField>
                <FormField label="Sheet tab menu" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.sheetTabMenuPreset} onChange={(event) => patch({ sheetTabMenuPreset: event.target.value as UiSpreadsheetSheetMenuPreset })} ariaLabel="Sheet tab context menu">
                    <option value="full">full</option>
                    <option value="none">none</option>
                  </UiSelect>
                </FormField>
                <FormField label="Filter menu" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.filterMenuPreset} onChange={(event) => patch({ filterMenuPreset: event.target.value as UiSpreadsheetSheetMenuPreset })} ariaLabel="Filter context menu">
                    <option value="full">full</option>
                    <option value="none">none</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
            <FormSection title="Actions" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE} divided>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <AppButton size="sm" intent="utility" onClick={() => runAction('Undo', (api) => { api.undo(); return 'Undo'; })}>Undo</AppButton>
                  <AppButton size="sm" intent="utility" onClick={() => runAction('Redo', (api) => { api.redo(); return 'Redo'; })}>Redo</AppButton>
                  <AppButton size="sm" intent="utility" disabled={!config.allowEdit} onClick={() => runAction('Set A1', (api) => { api.setCellValue(0, 0, 'AppEndO'); return 'Set A1 to AppEndO'; })}>Set A1</AppButton>
                  <AppButton size="sm" intent="utility" onClick={() => runAction('Read A1', (api) => `A1 = ${String(api.getCellValue(0, 0) ?? '')}`)}>Read A1</AppButton>
                  <AppButton size="sm" intent="utility" disabled={!config.allowEdit} onClick={() => runAction('Clear A1', (api) => { api.clearCell(0, 0); return 'Cleared A1'; })}>Clear A1</AppButton>
                  <AppButton size="sm" intent="utility" disabled={!config.allowEdit} onClick={() => runAction('Bold A1', (api) => { api.setCellFormat(0, 0, 'bl', 1); return 'Bold A1'; })}>Bold A1</AppButton>
                  <AppButton size="sm" intent="utility" disabled={!config.allowEdit} onClick={() => runAction('Add sheet', (api) => { api.addSheet(); return `Sheets: ${api.getSheets().map((sheet) => sheet.name).join(', ') || 'added'}`; })}>Add sheet</AppButton>
                  <AppButton size="sm" intent="destructive-soft" disabled={!config.allowEdit} onClick={() => runAction('Delete sheet', (api) => { api.deleteSheet(); return 'Deleted the active sheet'; })}>Delete sheet</AppButton>
                  <AppButton size="sm" intent="utility" disabled={!config.allowEdit} onClick={() => runAction('Insert row', (api) => { api.insertRows(1, 1); return 'Inserted a row at index 1'; })}>Insert row</AppButton>
                  <AppButton size="sm" intent="utility" disabled={!config.allowEdit} onClick={() => runAction('Insert column', (api) => { api.insertColumns(1, 1); return 'Inserted a column at index 1'; })}>Insert column</AppButton>
                  <AppButton size="sm" intent="utility" disabled={!config.allowEdit} onClick={() => runAction('Hide row 1', (api) => { api.hideRows([0]); return 'Hid row 1'; })}>Hide row</AppButton>
                  <AppButton size="sm" intent="utility" disabled={!config.allowEdit} onClick={() => runAction('Show row 1', (api) => { api.showRows([0]); return 'Showed row 1'; })}>Show row</AppButton>
                  <AppButton size="sm" intent="utility" disabled={!config.allowEdit} onClick={() => runAction('Col B width', (api) => { api.setColumnWidth(1, 140); return 'Set column B width to 140'; })}>Widen B</AppButton>
                  <AppButton size="sm" intent="utility" disabled={!config.allowEdit} onClick={() => runAction('Freeze row', (api) => { api.freeze('row', 0, 0); return 'Froze the first row'; })}>Freeze row</AppButton>
                  <AppButton size="sm" intent="utility" disabled={!config.allowEdit} onClick={() => runAction('Merge A1:B1', (api) => { api.setSelection(0, 0, 0, 1); api.mergeCells('merge-all'); return 'Merged A1:B1'; })}>Merge A1:B1</AppButton>
                  <AppButton size="sm" intent="utility" disabled={!config.allowEdit} onClick={() => runAction('Unmerge', (api) => { api.unmergeCells(); return 'Unmerged the selection'; })}>Unmerge</AppButton>
                  <AppButton size="sm" intent="utility" onClick={() => runAction('Scroll E5', (api) => { api.scrollTo(4, 4); return 'Scrolled to E5'; })}>Scroll E5</AppButton>
                  <AppButton size="sm" intent="utility" onClick={() => runAction('Selection', (api) => { const coords = api.getSelectionCoordinates(); return coords.length > 0 ? `Selection: ${coords.join(', ')}` : 'No selection'; })}>Selection</AppButton>
                  <AppButton size="sm" intent="utility" onClick={() => runAction('Calculate', (api) => { api.calculateFormula(); return 'Recalculated formulas'; })}>Calculate</AppButton>
                  <AppButton size="sm" intent="secondary" onClick={() => runAction('List sheets', (api) => { const names = api.getSheets().map((sheet) => sheet.name); return names.length > 0 ? `Sheets: ${names.join(', ')}` : 'No sheets'; })}>List sheets</AppButton>
                </div>
                <p className="text-xs leading-relaxed text-slate-500" data-spreadsheet-status="">
                  {status}
                </p>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="spreadsheet" fill>
          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col',
              isSpreadsheetFillHeight(config.height) ? 'h-full' : 'h-auto',
            )}
          >
            <UiSpreadsheet
              key={hostKey}
              ref={sheetRef}
              data={applySpreadsheetGridLines(sheets, config.showGridLines)}
              onChange={setSheets}
              showToolbar={config.showToolbar}
              toolbarPreset={config.toolbarPreset}
              showFormulaBar={config.showFormulaBar}
              showSheetTabs={config.showSheetTabs}
              statBar={config.statBar}
              allowEdit={config.allowEdit}
              height={config.height}
              lang={config.lang}
              direction={config.direction}
              currency={config.currency}
              row={config.row}
              column={config.column}
              addRows={config.addRows}
              showAddColumns={config.showAddColumns}
              defaultFontSize={config.defaultFontSize}
              defaultRowHeight={config.defaultRowHeight}
              defaultColWidth={config.defaultColWidth}
              showRowHeader={config.showRowHeader}
              showColumnHeader={config.showColumnHeader}
              showGridLines={config.showGridLines}
              devicePixelRatio={config.devicePixelRatio}
              forceCalculation={config.forceCalculation}
              cellMenuPreset={config.cellMenuPreset}
              headerMenuPreset={config.headerMenuPreset}
              sheetTabMenuPreset={config.sheetTabMenuPreset}
              filterMenuPreset={config.filterMenuPreset}
            />
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
