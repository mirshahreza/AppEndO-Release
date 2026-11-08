import React, { useMemo, useState } from 'react';
import { Copy, Download, Filter, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  AppButton,
  AppSplitButton,
  FormField,
  FormSection,
  SplitButtonMenuItem,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  UiSelect,
} from '../../../shared/ui';
import type { ButtonIntent } from '../../../shared/ui/buttonSemantics';
import {
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_DELETE_CLASS,
  ICON_ACTION_DUPLICATE_CLASS,
  ICON_ACTION_EDIT_CLASS,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
} from '../../../shared/ui/surfaceClasses';
import { cn } from '../../../lib/utils';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import {
  BASE_COMPONENTS_CAPTION_CLASS,
} from '../baseComponentsVisualTokens';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
} from '../baseComponentsConfiguratorLayout';

const INTENT_OPTIONS: ButtonIntent[] = [
  'primary',
  'create',
  'cancel',
  'destructive',
  'destructive-soft',
  'confirm',
  'secondary',
  'utility',
  'warning',
  'toggle-on',
  'toggle-off',
];

export type ToolbarBaseComponentsConfig = {
  preset: 'page' | 'editor' | 'selection' | 'formatting';
  orientation: 'horizontal' | 'vertical';
  density: 'compact' | 'default';
  presentation: 'attached' | 'floating';
  viewport: 'desktop' | 'tablet' | 'phone';
  state: 'default' | 'disabled' | 'pending' | 'pressed';
  labeledIntent: ButtonIntent;
  showSearch: boolean;
  showFilters: boolean;
  showExport: boolean;
  showIconActions: boolean;
  showSplitButton: boolean;
  splitIntent: ButtonIntent;
  showSeparator: boolean;
  showRefresh: boolean;
  priorityOverflow: boolean;
};

export const DEFAULT_TOOLBAR_BASE_COMPONENTS_CONFIG: ToolbarBaseComponentsConfig = {
  preset: 'page',
  orientation: 'horizontal',
  density: 'default',
  presentation: 'attached',
  viewport: 'desktop',
  state: 'default',
  labeledIntent: 'create',
  showSearch: true,
  showFilters: false,
  showExport: false,
  showIconActions: true,
  showSplitButton: false,
  splitIntent: 'utility',
  showSeparator: true,
  showRefresh: true,
  priorityOverflow: true,
};

export function resolveToolbarPreviewModel(config: ToolbarBaseComponentsConfig) {
  const disabled = config.state === 'disabled' || config.state === 'pending';
  const trailing = config.showIconActions || config.showSplitButton || config.showExport || config.showRefresh;
  return {
    root: 'toolbar',
    preset: config.preset,
    primaryLabel: config.preset === 'selection' ? 'Apply to 3' : config.preset === 'editor' ? 'Save' : 'Create',
    primaryIntent: config.state === 'pressed' ? 'toggle-on' as const : config.labeledIntent,
    disabled,
    pending: config.state === 'pending',
    orientation: config.orientation,
    compact: config.density === 'compact',
    floating: config.presentation === 'floating',
    viewport: config.viewport,
    overflow: { enabled: config.priorityOverflow },
    collapseTrailing: config.priorityOverflow && config.viewport !== 'desktop',
    slots: {
      search: config.showSearch,
      filters: config.showFilters,
      iconActions: config.showIconActions,
      splitButton: config.showSplitButton,
      export: config.showExport,
      refresh: config.showRefresh,
      separator: config.showSeparator && trailing,
    },
    splitIntent: config.showSplitButton ? config.splitIntent : null,
    showSeparatorControl: trailing,
  };
}

export function applyToolbarPreset(
  config: ToolbarBaseComponentsConfig,
  preset: ToolbarBaseComponentsConfig['preset'],
): ToolbarBaseComponentsConfig {
  const recipe: Record<ToolbarBaseComponentsConfig['preset'], Partial<ToolbarBaseComponentsConfig>> = {
    page: { showSearch: true, showFilters: false, showExport: false, showIconActions: true },
    editor: { showSearch: false, showFilters: false, showExport: true, showIconActions: false },
    selection: { showSearch: false, showFilters: false, showExport: true, showIconActions: true },
    formatting: { showSearch: false, showFilters: true, showExport: false, showIconActions: true, density: 'compact' },
  };
  return { ...config, preset, ...recipe[preset] };
}

type ToolbarBaseComponentsPreviewProps = {
  config: ToolbarBaseComponentsConfig;
};

const ToolbarBaseComponentsPreview: React.FC<ToolbarBaseComponentsPreviewProps> = ({ config }) => {
  const [splitOpen, setSplitOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastAction, setLastAction] = useState('No toolbar action selected.');
  const model = resolveToolbarPreviewModel(config);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setLastAction('Refreshing records…');
    window.setTimeout(() => setIsRefreshing(false), 900);
    window.setTimeout(() => setLastAction('Records refreshed.'), 900);
  };
  const isUnavailable = model.disabled;
  const hasTrailingActions = model.showSeparatorControl;

  return (
    <div data-bc-preview-root="toolbar" className={cn(
      'flex min-h-0 flex-1 flex-col',
      config.viewport === 'tablet' && 'mx-auto w-full max-w-3xl',
      config.viewport === 'phone' && 'mx-auto w-full max-w-sm',
    )}>
      <div className={cn(
        PAGE_TOOLBAR_SINGLE_ROW_CLASS,
        'justify-between',
        config.density === 'compact' && '!min-h-10 !py-1',
        config.presentation === 'floating' && 'm-3 rounded-xl border border-slate-200 bg-white shadow-md',
        config.orientation === 'vertical' && '!h-auto w-fit flex-col !items-stretch gap-2',
        config.viewport === 'phone' && '!h-auto flex-col !items-stretch gap-2',
      )}>
        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          {config.showSearch ? (
            <ToolbarSearchInput
              value={search}
              onChange={setSearch}
              placeholder="records…"
              ariaLabel="Search records"
            />
          ) : null}
          {config.showFilters ? (
            <AppButton intent="utility" size="sm" disabled={isUnavailable} onClick={() => setLastAction('Filters opened.')}>
              <Filter className="h-3.5 w-3.5" /> Filters
            </AppButton>
          ) : null}
        </div>

        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <AppButton
            intent={model.primaryIntent}
            size="sm"
            disabled={isUnavailable}
            onClick={() => setLastAction(config.preset === 'selection' ? 'Applied to 3 records.' : config.preset === 'editor' ? 'Changes saved.' : 'Record created.')}
          >
            {config.state === 'pending'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Plus className="h-3.5 w-3.5" />}
            {model.primaryLabel}
          </AppButton>

          {model.slots.separator ? (
            <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
          ) : null}

          {config.showIconActions && model.collapseTrailing ? (
            <AppButton
              size="icon-sm"
              disabled={isUnavailable}
              onClick={() => setLastAction('Overflow menu opened for lower-priority actions.')}
              className={ICON_ACTION_BUTTON_BASE_CLASS}
              title="More actions"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </AppButton>
          ) : null}

          {config.showIconActions && !model.collapseTrailing ? (
            <div className="flex items-center gap-1">
              <AppButton size="icon-sm" disabled={isUnavailable} onClick={() => setLastAction('Edit selected.')} className={cn(ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_EDIT_CLASS)} title="Edit">
                <Pencil className="h-4 w-4" />
              </AppButton>
              <AppButton size="icon-sm" disabled={isUnavailable} onClick={() => setLastAction('Record duplicated.')} className={cn(ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_DUPLICATE_CLASS)} title="Duplicate">
                <Copy className="h-4 w-4" />
              </AppButton>
              <AppButton size="icon-sm" disabled={isUnavailable} onClick={() => setLastAction('Delete requested.')} className={cn(ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_DELETE_CLASS)} title="Delete">
                <Trash2 className="h-4 w-4" />
              </AppButton>
            </div>
          ) : null}

          {config.showSplitButton ? (
            <AppSplitButton
              intent={config.splitIntent}
              size="sm"
              label="Export"
              isOpen={splitOpen}
              onOpenChange={setSplitOpen}
              menuAriaLabel="Export options"
              triggerAriaLabel="Export"
              disabled={isUnavailable}
            >
              <SplitButtonMenuItem onClick={() => { setSplitOpen(false); setLastAction('CSV export selected.'); }}>CSV</SplitButtonMenuItem>
              <SplitButtonMenuItem onClick={() => { setSplitOpen(false); setLastAction('JSON export selected.'); }}>JSON</SplitButtonMenuItem>
            </AppSplitButton>
          ) : null}
          {config.showExport ? (
            <AppButton intent="utility" size="sm" disabled={isUnavailable} onClick={() => setLastAction('Export started.')}>
              <Download className="h-3.5 w-3.5" /> Export
            </AppButton>
          ) : null}

          {config.showRefresh ? (
            <ToolbarActionGroupWithRefresh
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              refreshDisabled={isUnavailable}
              actions={[]}
            />
          ) : null}
        </div>
      </div>

      <div className={cn("flex flex-1 items-start justify-start p-3", BASE_COMPONENTS_CAPTION_CLASS)}>
        <span>{lastAction}</span>
        <span className="ms-2">Toolbar uses <code className="mx-1 rounded bg-slate-100 px-1">h-8</code> controls.</span>
      </div>
    </div>
  );
};

export const ToolbarBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<ToolbarBaseComponentsConfig>(DEFAULT_TOOLBAR_BASE_COMPONENTS_CONFIG);
  const configJson = useMemo(() => JSON.stringify({
    public: { orientation: config.orientation, density: config.density },
    composition: {
      preset: config.preset,
      presentation: config.presentation,
      overflow: { enabled: config.priorityOverflow },
      slots: {
        search: config.showSearch,
        filters: config.showFilters,
        iconActions: config.showIconActions,
        separator: config.showSeparator && (config.showIconActions || config.showSplitButton || config.showExport || config.showRefresh),
        splitButton: config.showSplitButton,
        export: config.showExport,
        refresh: config.showRefresh,
      },
      labeledIntent: config.labeledIntent,
      splitIntent: config.showSplitButton ? config.splitIntent : null,
    },
    demo: {
      fixtures: { actions: config.preset },
      scenarios: { state: config.state, viewport: config.viewport },
    },
  }, null, 2), [config]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="toolbar" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_TOOLBAR_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Recipe" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Preset" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.preset}
                    onChange={(event) => {
                      const preset = event.target.value as ToolbarBaseComponentsConfig['preset'];
                      setConfig((current) => applyToolbarPreset(current, preset));
                    }}
                    ariaLabel="Toolbar preset"
                  >
                    {['page', 'editor', 'selection', 'formatting'].map((value) => <option key={value} value={value}>{value}</option>)}
                  </UiSelect>
                </FormField>
                <FormField label="Density" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.density} onChange={(event) => setConfig((current) => ({ ...current, density: event.target.value as ToolbarBaseComponentsConfig['density'] }))} ariaLabel="Toolbar density">
                    <option value="default">default</option><option value="compact">compact</option>
                  </UiSelect>
                </FormField>
                <FormField label="Orientation" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.orientation} onChange={(event) => setConfig((current) => ({ ...current, orientation: event.target.value as ToolbarBaseComponentsConfig['orientation'] }))} ariaLabel="Toolbar orientation">
                    <option value="horizontal">horizontal</option><option value="vertical">vertical</option>
                  </UiSelect>
                </FormField>
                <FormField label="Presentation" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.presentation} onChange={(event) => setConfig((current) => ({ ...current, presentation: event.target.value as ToolbarBaseComponentsConfig['presentation'] }))} ariaLabel="Toolbar presentation">
                    <option value="attached">attached</option><option value="floating">floating</option>
                  </UiSelect>
                </FormField>
                <FormField label="Priority overflow" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.priorityOverflow ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, priorityOverflow: event.target.value === 'yes' }))} ariaLabel="Toolbar priority overflow">
                    <option value="yes">on</option><option value="no">off</option>
                  </UiSelect>
                </FormField>
                <FormField label="Intent" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.labeledIntent}
                    onChange={(event) => {
                      const value = event.target.value as ButtonIntent;
                      if (INTENT_OPTIONS.includes(value)) {
                        setConfig((current) => ({ ...current, labeledIntent: value }));
                      }
                    }}
                    ariaLabel="Button intent"
                  >
                    {INTENT_OPTIONS.map((intent) => (
                      <option key={intent} value={intent}>{intent}</option>
                    ))}
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Toolbar row" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Search filter" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showSearch ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showSearch: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Search filter"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField>
                <FormField label="Filter action" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.showFilters ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, showFilters: event.target.value === 'yes' }))} ariaLabel="Filter action">
                    <option value="no">hide</option><option value="yes">show</option>
                  </UiSelect>
                </FormField>
                <FormField label="Export action" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.showExport ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, showExport: event.target.value === 'yes' }))} ariaLabel="Export action">
                    <option value="no">hide</option><option value="yes">show</option>
                  </UiSelect>
                </FormField>

                <FormField label="Icon actions" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showIconActions ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showIconActions: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Icon actions"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField>

                {config.showIconActions || config.showSplitButton || config.showExport || config.showRefresh ? <FormField label="Separator" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showSeparator ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showSeparator: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Separator"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField> : null}

                <FormField label="Split button" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showSplitButton ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showSplitButton: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Split button"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField>

                {config.showSplitButton ? (
                  <FormField label="Split intent" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.splitIntent}
                      onChange={(event) => {
                        const value = event.target.value as ButtonIntent;
                        if (INTENT_OPTIONS.includes(value)) {
                          setConfig((current) => ({ ...current, splitIntent: value }));
                        }
                      }}
                      ariaLabel="Split intent"
                    >
                      {INTENT_OPTIONS.map((intent) => (
                        <option key={intent} value={intent}>{intent}</option>
                      ))}
                    </UiSelect>
                  </FormField>
                ) : null}

                <FormField label="Refresh (rightmost)" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showRefresh ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showRefresh: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Refresh button"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField>
                <FormField label="State" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.state} onChange={(event) => setConfig((current) => ({ ...current, state: event.target.value as ToolbarBaseComponentsConfig['state'] }))} ariaLabel="Toolbar state">
                    {['default', 'disabled', 'pending', 'pressed'].map((value) => <option key={value} value={value}>{value}</option>)}
                  </UiSelect>
                </FormField>
                <FormField label="Viewport" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.viewport} onChange={(event) => setConfig((current) => ({ ...current, viewport: event.target.value as ToolbarBaseComponentsConfig['viewport'] }))} ariaLabel="Toolbar viewport">
                    {['desktop', 'tablet', 'phone'].map((value) => <option key={value} value={value}>{value}</option>)}
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="toolbar">
          <ToolbarBaseComponentsPreview config={config} />
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
