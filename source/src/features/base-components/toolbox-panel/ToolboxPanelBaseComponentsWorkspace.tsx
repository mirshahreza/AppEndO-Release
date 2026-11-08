import React, { useMemo, useState } from 'react';
import {
  Bell,
  Blocks,
  Bot,
  Clock,
  GitBranch,
  Mail,
  Loader2,
  Play,
  Sparkles,
  ToggleLeft,
  XCircle,
} from 'lucide-react';
import {
  AppButton,
  FormField,
  FormSection,
  ToolboxPanelEmptyState,
  ToolboxPanelItem,
  ToolboxPanelScrollBody,
  ToolboxPanelSection,
  ToolboxPanelShell,
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
  BASE_COMPONENTS_SURFACE_CHROME_DEFAULT,
  BaseComponentsSurfaceChromeSection,
  type BaseComponentsSurfaceChromeConfig,
} from '../components/BaseComponentsSurfaceChromeFields';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
} from '../baseComponentsConfiguratorLayout';

type DemoSectionId = 'structure' | 'data' | 'communication' | 'ai';

const DEMO_SECTIONS: Array<{ id: DemoSectionId; label: string }> = [
  { id: 'structure', label: 'Structure' },
  { id: 'data', label: 'Data' },
  { id: 'communication', label: 'Communication' },
  { id: 'ai', label: 'AI' },
];

const DEMO_ITEMS: Record<DemoSectionId, Array<{ key: string; label: string; color: string; icon: React.ReactNode }>> = {
  structure: [
    { key: 'action', label: 'Action', color: '#2563eb', icon: <Play className="h-3.5 w-3.5" /> },
    { key: 'decision', label: 'Decision', color: '#ea580c', icon: <GitBranch className="h-3.5 w-3.5" /> },
    { key: 'switch', label: 'Switch', color: '#ca8a04', icon: <ToggleLeft className="h-3.5 w-3.5" /> },
    { key: 'end', label: 'End', color: '#16a34a', icon: <Sparkles className="h-3.5 w-3.5" /> },
    { key: 'fail', label: 'Fail', color: '#dc2626', icon: <XCircle className="h-3.5 w-3.5" /> },
    { key: 'delay', label: 'Delay', color: '#0d9488', icon: <Clock className="h-3.5 w-3.5" /> },
    { key: 'wait', label: 'Wait for event', color: '#0284c7', icon: <Bell className="h-3.5 w-3.5" /> },
  ],
  data: [
    { key: 'query', label: 'Query records', color: '#2563eb', icon: <Blocks className="h-3.5 w-3.5" /> },
    { key: 'transform', label: 'Transform JSON', color: '#7c3aed', icon: <Sparkles className="h-3.5 w-3.5" /> },
  ],
  communication: [
    { key: 'email', label: 'Send email', color: '#0284c7', icon: <Mail className="h-3.5 w-3.5" /> },
    { key: 'notify', label: 'Push notification', color: '#0d9488', icon: <Bell className="h-3.5 w-3.5" /> },
  ],
  ai: [
    { key: 'prompt', label: 'Run prompt', color: '#7c3aed', icon: <Bot className="h-3.5 w-3.5" /> },
    { key: 'extract', label: 'Extract fields', color: '#2563eb', icon: <Sparkles className="h-3.5 w-3.5" /> },
  ],
};

export type ToolboxPanelBaseComponentsConfig = BaseComponentsSurfaceChromeConfig & {
  preset: 'categorized' | 'flat' | 'search-first';
  density: 'compact' | 'default';
  state: 'default' | 'empty' | 'loading' | 'error';
  draggableItems: boolean;
  showDescriptions: boolean;
  panelOpen: boolean;
  initialExpandedSection: DemoSectionId;
};

export const DEFAULT_TOOLBOX_PANEL_BASE_COMPONENTS_CONFIG: ToolboxPanelBaseComponentsConfig = {
  ...BASE_COMPONENTS_SURFACE_CHROME_DEFAULT,
  preset: 'categorized',
  density: 'default',
  state: 'default',
  draggableItems: false,
  showDescriptions: true,
  panelOpen: true,
  initialExpandedSection: 'structure',
};

export function resolveToolboxPanelPreviewModel(config: ToolboxPanelBaseComponentsConfig) {
  const categorized = config.preset === 'categorized' && config.state === 'default';
  return {
    root: 'toolbox-panel',
    preset: config.preset,
    state: config.state,
    open: config.panelOpen,
    densityClass: config.density === 'compact' ? '!min-h-7 !py-1' : null,
    draggableItems: config.draggableItems,
    showDescriptions: config.showDescriptions,
    /** Categorized toolbox always keeps exactly one section expanded. */
    expansionMode: categorized ? 'single-persistent' as const : null,
    initialExpandedSection: categorized ? config.initialExpandedSection : null,
    contentMode: config.state !== 'default'
      ? config.state
      : config.preset === 'search-first'
        ? 'search-first'
        : config.preset,
    chrome: {
      colorSource: config.colorSource,
      tone: config.tone,
      customColorHex: config.customColorHex,
    },
  };
}

type ToolboxPanelBaseComponentsPreviewProps = {
  config: ToolboxPanelBaseComponentsConfig;
};

const ToolboxPanelBaseComponentsPreview: React.FC<ToolboxPanelBaseComponentsPreviewProps> = ({ config }) => {
  const model = resolveToolboxPanelPreviewModel(config);
  const [open, setOpen] = useState(config.panelOpen);
  const [query, setQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set([config.initialExpandedSection]));
  const [selectedItem, setSelectedItem] = useState('');

  React.useEffect(() => setOpen(config.panelOpen), [config.panelOpen]);
  React.useEffect(() => setExpandedSections(new Set([config.initialExpandedSection])), [config.initialExpandedSection]);

  const isSearching = query.trim().length > 0;
  const normalizedQuery = query.trim().toLowerCase();

  const flatItems = useMemo(
    () => DEMO_SECTIONS.flatMap((section) => DEMO_ITEMS[section.id].map((item) => ({
      ...item,
      sectionId: section.id,
      sectionLabel: section.label,
    }))),
    [],
  );

  const searchHits = useMemo(
    () => flatItems.filter((item) => item.label.toLowerCase().includes(normalizedQuery)),
    [flatItems, normalizedQuery],
  );

  const toggleSection = (sectionId: string) => {
    // Exactly one section must stay open — re-clicking the open section is a no-op.
    setExpandedSections((current) => (
      current.has(sectionId) ? current : new Set([sectionId])
    ));
  };

  const renderItem = (item: (typeof flatItems)[number]) => (
    <ToolboxPanelItem
      key={`${item.sectionId}:${item.key}`}
      label={item.label}
      description={`${item.sectionLabel} · ${item.key}`}
      showDescriptionInline={config.showDescriptions}
      accentColor={item.color}
      icon={item.icon}
      draggable={model.draggableItems}
      onActivate={() => setSelectedItem(item.label)}
      className={model.densityClass ?? undefined}
    />
  );

  return (
    <div data-bc-preview-root="toolbox-panel" className="relative min-h-0 flex-1 overflow-hidden bg-slate-100/80">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.45) 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }}
      />

      <div className="absolute left-3 top-3 z-10">
        <AppButton intent={open ? 'toggle-on' : 'toggle-off'} size="sm" onClick={() => setOpen((value) => !value)}>
          <Blocks className="h-3.5 w-3.5" /> Toolbox
        </AppButton>
      </div>

      <ToolboxPanelShell
        open={open}
        onClose={() => setOpen(false)}
        title="Toolbox"
        titleIcon={<Blocks className="h-3.5 w-3.5 text-primary-600" />}
        colorSource={model.chrome.colorSource}
        tone={model.chrome.tone}
        customColorHex={model.chrome.customColorHex}
        searchValue={query}
        onSearchChange={setQuery}
      >
        {model.contentMode === 'loading' ? (
          <ToolboxPanelEmptyState><span className="inline-flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Loading toolbox…</span></ToolboxPanelEmptyState>
        ) : model.contentMode === 'error' ? (
          <ToolboxPanelEmptyState>Toolbox items could not be loaded. Try again.</ToolboxPanelEmptyState>
        ) : model.contentMode === 'empty' ? (
          <ToolboxPanelEmptyState>
            No toolbox items are available.
          </ToolboxPanelEmptyState>
        ) : isSearching ? (
          searchHits.length === 0 ? (
            <ToolboxPanelEmptyState>
              No toolbox items match “{query.trim()}”.
            </ToolboxPanelEmptyState>
          ) : (
            <ToolboxPanelScrollBody>
              <div className="flex flex-col">
                {searchHits.map(renderItem)}
              </div>
            </ToolboxPanelScrollBody>
          )
        ) : model.contentMode === 'search-first' && !isSearching ? (
          <ToolboxPanelEmptyState>Start typing to find a toolbox item.</ToolboxPanelEmptyState>
        ) : model.contentMode === 'flat' ? (
          <ToolboxPanelScrollBody><div className="flex flex-col">{flatItems.map(renderItem)}</div></ToolboxPanelScrollBody>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {DEMO_SECTIONS.map((section) => (
              <ToolboxPanelSection
                key={section.id}
                id={section.id}
                label={section.label}
                expanded={expandedSections.has(section.id)}
                onToggle={toggleSection}
              >
                <div className="flex flex-col">
                  {DEMO_ITEMS[section.id].map((item) => renderItem({
                    ...item,
                    sectionId: section.id,
                    sectionLabel: section.label,
                  }))}
                </div>
              </ToolboxPanelSection>
            ))}
          </div>
        )}
      </ToolboxPanelShell>
      {selectedItem ? (
        <p className="absolute bottom-3 left-3 z-10 rounded-md border border-cyan-200 bg-white px-2 py-1 text-xs font-semibold text-cyan-700">
          Activated {selectedItem}
        </p>
      ) : null}
    </div>
  );
};

export const ToolboxPanelBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<ToolboxPanelBaseComponentsConfig>(DEFAULT_TOOLBOX_PANEL_BASE_COMPONENTS_CONFIG);
  const configJson = useMemo(() => JSON.stringify({
    public: {
      isOpen: config.panelOpen,
      expansionMode: 'single-persistent',
      defaultExpandedKeys: [config.initialExpandedSection],
      density: config.density,
      allowItemDrag: config.draggableItems,
    },
    composition: { preset: config.preset, slots: { search: true, descriptions: config.showDescriptions } },
    demo: { fixtures: { items: 'categorized-components' }, scenarios: { state: config.state } },
  }, null, 2), [config]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="toolbox-panel" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_TOOLBOX_PANEL_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Panel" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {([
                  ['Preset', 'preset', ['categorized', 'flat', 'search-first']],
                  ['Density', 'density', ['compact', 'default']],
                  ['State', 'state', ['default', 'empty', 'loading', 'error']],
                ] as const).map(([label, field, options]) => (
                  <FormField key={field} label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config[field]} onChange={(event) => setConfig((current) => ({ ...current, [field]: event.target.value }))} ariaLabel={label}>
                      {options.map((value) => <option key={value} value={value}>{value}</option>)}
                    </UiSelect>
                  </FormField>
                ))}
                <FormField label="Draggable items" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.draggableItems ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, draggableItems: event.target.value === 'yes' }))} ariaLabel="Draggable items">
                    <option value="no">off</option><option value="yes">on</option>
                  </UiSelect>
                </FormField>
                <FormField label="Item descriptions" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.showDescriptions ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, showDescriptions: event.target.value === 'yes' }))} ariaLabel="Item descriptions">
                    <option value="yes">show</option><option value="no">hide</option>
                  </UiSelect>
                </FormField>
                <FormField label="Open on load" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.panelOpen ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        panelOpen: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Open on load"
                  >
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </UiSelect>
                </FormField>

                {config.preset === 'categorized' && config.state === 'default' ? <FormField label="Initial expanded section" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.initialExpandedSection}
                    onChange={(event) => {
                      const value = event.target.value as DemoSectionId;
                      if (DEMO_SECTIONS.some((section) => section.id === value)) {
                        setConfig((current) => ({ ...current, initialExpandedSection: value }));
                      }
                    }}
                    ariaLabel="Initial expanded section"
                  >
                    {DEMO_SECTIONS.map((section) => (
                      <option key={section.id} value={section.id}>{section.label}</option>
                    ))}
                  </UiSelect>
                </FormField> : null}
              </div>
            </FormSection>

            <BaseComponentsSurfaceChromeSection
              config={config}
              onChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
            />
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="toolbox-panel">
          <ToolboxPanelBaseComponentsPreview config={config} />
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
