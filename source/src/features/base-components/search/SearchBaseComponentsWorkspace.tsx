import React, { useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import {
  AppSearchBox,
  FormField,
  FormSection,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
  ToolbarSearchInput,
  UiCheckboxChoice,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
} from '../baseComponentsConfiguratorLayout';

type SearchVariant = 'panel' | 'toolbar' | 'command';

export type SearchBaseComponentsConfig = {
  variant: SearchVariant;
  placeholder: string;
  initialValue: string;
  showLeading: boolean;
  clearable: boolean;
  debounceMs: 0 | 150 | 300;
  submitOnEnter: boolean;
  shortcut: 'none' | 'ctrl-k' | 'slash';
  width: 'fit' | 'full';
  state: 'default' | 'loading' | 'no-results' | 'disabled';
  direction: 'ltr' | 'rtl' | 'mixed';
};

export const DEFAULT_SEARCH_BASE_COMPONENTS_CONFIG: SearchBaseComponentsConfig = {
  variant: 'panel',
  placeholder: 'functions…',
  initialValue: '',
  showLeading: false,
  clearable: true,
  debounceMs: 150,
  submitOnEnter: true,
  shortcut: 'ctrl-k',
  width: 'full',
  state: 'default',
  direction: 'ltr',
};

export function resolveSearchPreviewModel(config: SearchBaseComponentsConfig) {
  return {
    root: 'search',
    component: config.variant === 'panel' ? 'AppSearchBox' : config.variant === 'toolbar' ? 'ToolbarSearchInput' : 'UiInput',
    direction: config.direction === 'mixed' ? 'auto' as const : config.direction,
    disabled: config.state === 'disabled',
    status: config.state,
    placeholder: config.placeholder,
    initialValue: config.initialValue,
    showClear: config.clearable,
    debounceMs: config.debounceMs,
    widthClass: config.width === 'fit' ? (config.variant === 'toolbar' ? 'max-w-[200px]' : 'max-w-md') : null,
    showLeadingIcon: config.showLeading,
    showLeading: config.variant === 'panel' && config.showLeading,
    showSubmitControl: config.variant === 'command',
    submitOnEnter: config.variant === 'command' && config.submitOnEnter,
    shortcut: config.variant === 'command' ? config.shortcut : 'none',
  };
}

type SearchBaseComponentsPreviewProps = {
  config: SearchBaseComponentsConfig;
};

const SearchBaseComponentsPreview: React.FC<SearchBaseComponentsPreviewProps> = ({ config }) => {
  const model = resolveSearchPreviewModel(config);
  const [value, setValue] = useState(config.initialValue);
  const [builtinLeading, setBuiltinLeading] = useState(true);
  const [submittedValue, setSubmittedValue] = useState('');
  const [debouncedValue, setDebouncedValue] = useState(config.initialValue);

  React.useEffect(() => {
    setValue(config.initialValue);
  }, [config.initialValue]);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), config.debounceMs);
    return () => window.clearTimeout(timer);
  }, [config.debounceMs, value]);
  React.useEffect(() => {
    if (config.variant !== 'command' || config.shortcut === 'none' || config.state === 'disabled') return;
    const focusShortcut = (event: KeyboardEvent) => {
      const matches = config.shortcut === 'ctrl-k'
        ? event.ctrlKey && event.key.toLowerCase() === 'k'
        : !event.ctrlKey && !event.metaKey && event.key === '/';
      if (!matches) return;
      event.preventDefault();
      document.querySelector<HTMLInputElement>('[aria-label="Command search"]')?.focus();
    };
    window.addEventListener('keydown', focusShortcut);
    return () => window.removeEventListener('keydown', focusShortcut);
  }, [config.shortcut, config.state, config.variant]);

  const previewDirection = model.direction;

  if (config.variant === 'toolbar') {
    return (
      <div data-bc-preview-root="search" className={BASE_COMPONENTS_PREVIEW_BODY_CLASS} dir={previewDirection}>
        <div className={PAGE_TOOLBAR_SINGLE_ROW_CLASS}>
          <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
            <ToolbarSearchInput
              value={value}
              onChange={setValue}
              placeholder={config.placeholder}
              ariaLabel="Toolbar search"
              showClear={model.showClear}
              disabled={model.disabled}
              className={cn(
                config.width === 'fit' && 'max-w-[200px]',
              )}
            />
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          {config.state === 'loading'
            ? 'Searching toolbar records…'
            : config.state === 'no-results'
              ? 'No toolbar records match this query.'
              : `Toolbar filter value: “${debouncedValue || 'empty'}” · ${config.debounceMs} ms debounce`}
        </p>
      </div>
    );
  }

  if (config.variant === 'command') {
    return (
      <div data-bc-preview-root="search" className={BASE_COMPONENTS_PREVIEW_BODY_CLASS} dir={previewDirection}>
        <div className={cn('relative', config.width === 'fit' ? 'max-w-md' : 'w-full')}>
          <Search className="pointer-events-none absolute start-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <UiInput
            size="sm"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (config.submitOnEnter && event.key === 'Enter') setSubmittedValue(value);
            }}
            placeholder={config.placeholder}
            ariaLabel="Command search"
            disabled={model.disabled}
            className="ps-9 pe-16"
          />
          {config.shortcut !== 'none' ? (
            <kbd className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {config.shortcut === 'ctrl-k' ? 'Ctrl K' : '/'}
            </kbd>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {config.state === 'loading'
            ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…</span>
            : config.state === 'no-results'
              ? 'No commands match this query.'
              : submittedValue
                ? `Submitted “${submittedValue}”`
                : 'Command presentation supports an optional keyboard shortcut.'}
        </p>
      </div>
    );
  }

  return (
    <div data-bc-preview-root="search" className={BASE_COMPONENTS_PREVIEW_BODY_CLASS} dir={previewDirection}>
      <AppSearchBox
        value={value}
        onChange={setValue}
        placeholder={config.placeholder}
        ariaLabel="Panel search"
        disabled={model.disabled}
        showClear={model.showClear}
        className={cn(
          config.width === 'fit' && 'max-w-md',
        )}
        leading={config.showLeading ? (
          <UiCheckboxChoice
            id="search-baseComponents-builtin"
            checked={builtinLeading}
            onChange={setBuiltinLeading}
            className="me-1 shrink-0 text-xs"
          >
            Built-in
          </UiCheckboxChoice>
        ) : undefined}
      />
      <p className="mt-4 text-xs text-slate-500">
        {config.state === 'loading'
          ? 'Searching panel content…'
          : config.state === 'no-results'
            ? 'No panel results match this query.'
          : `Panel result value: “${debouncedValue || 'empty'}” · ${config.debounceMs} ms debounce · ${config.showLeading ? `built-in ${builtinLeading ? 'on' : 'off'}` : 'all sources'}`}
      </p>
    </div>
  );
};

export const SearchBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<SearchBaseComponentsConfig>(DEFAULT_SEARCH_BASE_COMPONENTS_CONFIG);
  const configJson = useMemo(() => JSON.stringify({
    public: {
      presentation: config.variant,
      isClearable: config.clearable,
      debounceMs: config.debounceMs,
      width: config.width,
      ...(config.variant === 'command' ? { submitOnEnter: config.submitOnEnter } : {}),
    },
    composition: {
      ...(config.variant === 'command' ? { shortcutLabel: config.shortcut === 'none' ? null : config.shortcut } : {}),
      ...(config.variant === 'panel' ? { leadingFilter: config.showLeading } : {}),
    },
    demo: {
      fixtures: { initialValue: config.initialValue, placeholder: config.placeholder },
      scenarios: { state: config.state, direction: config.direction },
    },
  }, null, 2), [config]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="search" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_SEARCH_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Variant" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Pattern" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.variant}
                    onChange={(event) => {
                      const value = event.target.value as SearchVariant;
                      if (value === 'panel' || value === 'toolbar' || value === 'command') {
                        setConfig((current) => ({ ...current, variant: value }));
                      }
                    }}
                    ariaLabel="Search variant"
                  >
                    <option value="panel">AppSearchBox (panel)</option>
                    <option value="toolbar">ToolbarSearchInput</option>
                    <option value="command">Command composition</option>
                  </UiSelect>
                </FormField>

                <FormField label="Placeholder" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                    value={config.placeholder}
                    onChange={(event) => setConfig((current) => ({ ...current, placeholder: event.target.value }))}
                  />
                </FormField>

                <FormField label="Initial value" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                    value={config.initialValue}
                    onChange={(event) => setConfig((current) => ({ ...current, initialValue: event.target.value }))}
                  />
                </FormField>

                {config.variant === 'panel' ? (
                  <FormField label="Leading slot" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.showLeading ? 'yes' : 'no'}
                      onChange={(event) => {
                        setConfig((current) => ({
                          ...current,
                          showLeading: event.target.value === 'yes',
                        }));
                      }}
                      ariaLabel="Leading slot"
                    >
                      <option value="no">hide</option>
                      <option value="yes">show</option>
                    </UiSelect>
                  </FormField>
                ) : null}
                <FormField label="Clear button" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.clearable ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, clearable: event.target.value === 'yes' }))} ariaLabel="Clear button">
                    <option value="yes">show</option><option value="no">hide</option>
                  </UiSelect>
                </FormField>
                <FormField label="Debounce" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={String(config.debounceMs)} onChange={(event) => setConfig((current) => ({ ...current, debounceMs: Number(event.target.value) as 0 | 150 | 300 }))} ariaLabel="Search debounce">
                    <option value="0">0 ms</option><option value="150">150 ms</option><option value="300">300 ms</option>
                  </UiSelect>
                </FormField>
                {config.variant === 'command' ? <FormField label="Submit on Enter" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.submitOnEnter ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, submitOnEnter: event.target.value === 'yes' }))} ariaLabel="Submit on Enter">
                    <option value="yes">enabled</option><option value="no">disabled</option>
                  </UiSelect>
                </FormField> : null}
                {config.variant === 'command' ? <FormField label="Shortcut" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.shortcut} onChange={(event) => setConfig((current) => ({ ...current, shortcut: event.target.value as SearchBaseComponentsConfig['shortcut'] }))} ariaLabel="Search shortcut">
                    <option value="none">none</option><option value="ctrl-k">Ctrl K</option><option value="slash">/</option>
                  </UiSelect>
                </FormField> : null}
                <FormField label="Width" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.width} onChange={(event) => setConfig((current) => ({ ...current, width: event.target.value as SearchBaseComponentsConfig['width'] }))} ariaLabel="Search width">
                    <option value="full">full</option><option value="fit">fit</option>
                  </UiSelect>
                </FormField>
                <FormField label="State" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.state} onChange={(event) => setConfig((current) => ({ ...current, state: event.target.value as SearchBaseComponentsConfig['state'] }))} ariaLabel="Search state">
                    {['default', 'loading', 'no-results', 'disabled'].map((value) => <option key={value} value={value}>{value}</option>)}
                  </UiSelect>
                </FormField>
                <FormField label="Direction" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.direction} onChange={(event) => setConfig((current) => ({ ...current, direction: event.target.value as SearchBaseComponentsConfig['direction'] }))} ariaLabel="Search direction">
                    <option value="ltr">LTR</option><option value="rtl">RTL</option><option value="mixed">mixed text</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="search">
          <SearchBaseComponentsPreview config={config} />
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
