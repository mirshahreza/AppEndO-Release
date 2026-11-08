import React, { useMemo, useState } from 'react';
import { Loader2, Menu } from 'lucide-react';
import {
  AppButton,
  FormField,
  FormSection,
  SidebarMenu,
  SidebarMenuScrollArea,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
import {
  ShellMobileDrawerNavigation,
  ShellSidebarMegaNavigation,
  ShellSidebarRailNavigation,
} from '../../../shared/ui/shell-navigation';
import type { AdminShellNavGroup } from '../../../layouts/adminShell/types';
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
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_CONFIG_SUBSECTION_LABEL_CLASS,
} from '../baseComponentsConfiguratorLayout';

type SidebarRenderer = 'standard' | 'rail' | 'mega' | 'drawer';
const VARIANT_OPTIONS: SidebarRenderer[] = ['standard', 'rail', 'mega', 'drawer'];

const DEMO_UNGROUPED_START_GROUP: AdminShellNavGroup = {
  heading: null,
  items: [
    { label: 'Home', path: '/base-components/demo/home', icon: 'Home' },
    { label: 'Search', path: '/base-components/demo/search', icon: 'Search' },
  ],
};

const DEMO_GROUPED_NAV: AdminShellNavGroup[] = [
  {
    heading: 'Platform',
    icon: 'Home',
    items: [
      { label: 'Dashboard', path: '/base-components/demo/dashboard', icon: 'Home' },
      { label: 'Workflows', path: '/base-components/demo/workflows', icon: 'GitBranch' },
      { label: 'Components', path: '/base-components/demo/components', icon: 'Blocks' },
      { label: 'Server functions', path: '/base-components/demo/server-functions', icon: 'Terminal' },
      { label: 'Packages', path: '/base-components/demo/packages', icon: 'Package' },
    ],
  },
  {
    heading: 'Data',
    icon: 'Database',
    items: [
      { label: 'Base info', path: '/base-components/demo/base-info', icon: 'Library' },
      { label: 'Data Studio', path: '/base-components/demo/data-studio', icon: 'Database' },
      { label: 'My APIs', path: '/base-components/demo/my-apis', icon: 'Webhook' },
      { label: 'Cache keys', path: '/base-components/demo/cache-keys', icon: 'Key' },
    ],
  },
  {
    heading: 'Settings',
    icon: 'Settings',
    items: [
      { label: 'Users', path: '/base-components/demo/users', icon: 'Users' },
      { label: 'Roles', path: '/base-components/demo/roles', icon: 'Shield' },
      { label: 'Navigations', path: '/base-components/demo/navigations', icon: 'Menu' },
      { label: 'Portals', path: '/base-components/demo/portals', icon: 'AppWindow' },
      { label: 'Culture packs', path: '/base-components/demo/culture', icon: 'Languages' },
    ],
  },
  {
    heading: 'Development',
    icon: 'Code',
    items: [
      { label: 'Base Components', path: '/base-components/demo/base-components', icon: 'FlaskConical' },
      { label: 'Icon sets', path: '/base-components/demo/icon-sets', icon: 'Shapes' },
      { label: 'Git integration', path: '/base-components/demo/git', icon: 'GitBranch' },
    ],
  },
];

const DEMO_UNGROUPED_END_GROUP: AdminShellNavGroup = {
  heading: null,
  items: [
    { label: 'Documentation', path: '/base-components/demo/docs', icon: 'BookOpen' },
    { label: 'Help', path: '/base-components/demo/help', icon: 'CircleHelp' },
  ],
};

const DEMO_NAV_GROUPS = [
  DEMO_UNGROUPED_START_GROUP,
  ...DEMO_GROUPED_NAV,
  DEMO_UNGROUPED_END_GROUP,
];

export type SidebarMenuBaseComponentsConfig = {
  renderer: SidebarRenderer;
  structure: 'grouped' | 'flat';
  density: 'compact' | 'default';
  edge: 'start' | 'end';
  direction: 'ltr' | 'rtl';
  viewport: 'desktop' | 'phone';
  state: 'default' | 'loading' | 'empty' | 'unavailable-route';
  showBadges: boolean;
  showDescriptions: boolean;
  collapsed: boolean;
  activePath: string;
  accordion: boolean;
  lockActiveGroup: boolean;
  fillHeight: boolean;
  ungroupedAtStart: boolean;
  ungroupedAtEnd: boolean;
  groupGapPx: number;
  requireOpenGroup: boolean;
};

export const DEFAULT_SIDEBAR_MENU_BASE_COMPONENTS_CONFIG: SidebarMenuBaseComponentsConfig = {
  renderer: 'standard',
  structure: 'grouped',
  density: 'default',
  edge: 'start',
  direction: 'ltr',
  viewport: 'desktop',
  state: 'default',
  showBadges: true,
  showDescriptions: true,
  collapsed: false,
  activePath: '/base-components/demo/workflows',
  accordion: false,
  lockActiveGroup: true,
  fillHeight: false,
  ungroupedAtStart: false,
  ungroupedAtEnd: true,
  groupGapPx: 0,
  requireOpenGroup: false,
};

export function resolveSidebarMenuPreviewModel(config: SidebarMenuBaseComponentsConfig) {
  const renderer: SidebarRenderer = config.viewport === 'phone' ? 'drawer' : config.renderer;
  const standard = renderer === 'standard';
  const grouped = config.structure === 'grouped';
  return {
    root: 'sidebar-menu',
    renderer,
    structure: config.structure,
    density: config.density,
    edge: config.edge,
    direction: config.direction,
    viewport: config.viewport,
    state: config.state,
    collapsed: renderer === 'rail' || (standard && config.collapsed),
    activePath: config.activePath,
    showRichItemControls: !standard,
    showGroupControls: standard && grouped,
    showFillHeightControl: standard && !config.collapsed,
    props: {
      accordion: standard && grouped && config.accordion,
      requireOpenGroup: standard && grouped && config.requireOpenGroup,
      lockActiveGroup: standard && grouped && config.lockActiveGroup,
      fillHeight: standard && !config.collapsed && config.fillHeight,
      ungroupedAtStart: standard && grouped && config.ungroupedAtStart,
      ungroupedAtEnd: standard && grouped && config.ungroupedAtEnd,
      groupGapPx: standard && grouped ? config.groupGapPx : null,
      showBadges: !standard && config.showBadges,
      showDescriptions: !standard && config.showDescriptions,
    },
  };
}

export function applySidebarRenderer(
  config: SidebarMenuBaseComponentsConfig,
  renderer: SidebarRenderer,
): SidebarMenuBaseComponentsConfig {
  return {
    ...config,
    renderer,
    collapsed: renderer === 'rail',
    fillHeight: renderer === 'standard' ? config.fillHeight : false,
  };
}

type SidebarMenuBaseComponentsPreviewProps = {
  config: SidebarMenuBaseComponentsConfig;
};

const SidebarMenuBaseComponentsPreview: React.FC<SidebarMenuBaseComponentsPreviewProps> = ({ config }) => {
  const model = resolveSidebarMenuPreviewModel(config);
  const [pathname, setPathname] = useState(config.activePath);
  const [drawerOpen, setDrawerOpen] = useState(false);

  React.useEffect(() => {
    setPathname(config.activePath);
  }, [config.activePath]);

  const groups = useMemo(() => {
    if (config.state === 'empty') return [];
    const source = config.structure === 'flat'
      ? [{ heading: null, items: DEMO_NAV_GROUPS.flatMap((group) => group.items) }]
      : DEMO_NAV_GROUPS;
    return source.map((group) => ({
      ...group,
      items: group.items.map((item, index) => ({
        ...item,
        description: config.showDescriptions ? `Open ${item.label ?? 'this destination'}` : undefined,
        presentation: config.showBadges && index === 1 ? { badge: 'New' } : undefined,
      })),
    }));
  }, [config.showBadges, config.showDescriptions, config.state, config.structure]);

  const commonNavigationProps = {
    groups,
    currentPath: pathname,
    onNavigate: (path: string) => setPathname(path),
  };
  const effectiveRenderer = model.renderer;

  const navigation = config.state === 'loading' ? (
    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading navigation…</div>
  ) : config.state === 'empty' ? (
    <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">No navigation destinations are available.</div>
  ) : config.state === 'unavailable-route' ? (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This navigation route is unavailable.</div>
  ) : effectiveRenderer === 'mega' ? (
    <ShellSidebarMegaNavigation {...commonNavigationProps} ariaLabel="Production sidebar mega navigation" featuredArea="end" />
  ) : effectiveRenderer === 'rail' ? (
    <ShellSidebarRailNavigation {...commonNavigationProps} ariaLabel="Production sidebar rail navigation" />
  ) : effectiveRenderer === 'drawer' ? (
    <>
      <AppButton intent="utility" size="sm" onClick={() => setDrawerOpen(true)}>
        <Menu className="h-3.5 w-3.5" /> Open production drawer
      </AppButton>
      <ShellMobileDrawerNavigation
        {...commonNavigationProps}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        side={config.edge}
        title="Workspace navigation"
        defaultExpandedGroups={groups.flatMap((group) => group.heading ? [group.heading] : [])}
      />
    </>
  ) : (
    <SidebarMenu
      variant="tree"
      groups={groups}
      pathname={pathname}
      collapsed={model.collapsed}
      isRtl={config.direction === 'rtl'}
      accordion={model.props.accordion}
      lockActiveGroup={model.props.lockActiveGroup}
      fillHeight={model.props.fillHeight}
      ungroupedAtStart={model.props.ungroupedAtStart}
      ungroupedAtEnd={model.props.ungroupedAtEnd}
      groupGapPx={model.props.groupGapPx ?? undefined}
      requireOpenGroup={model.props.requireOpenGroup}
      className={model.props.fillHeight ? 'min-h-0 flex-1' : undefined}
      onNavigate={setPathname}
    />
  );

  return (
    <div
      data-bc-preview-root="sidebar-menu"
      className={cn(
        'flex min-h-0 flex-1 p-3',
        config.fillHeight ? 'h-full flex-col' : 'items-center justify-center overflow-auto',
        config.viewport === 'phone' && 'mx-auto max-w-sm',
      )}
      dir={config.direction}
    >
      <div
        className={cn(
          'flex min-h-0 flex-col overflow-hidden rounded-xl border border-shell-content-border/40 bg-shell-sidebar shadow-sm transition-all duration-200',
          effectiveRenderer === 'rail' || config.collapsed ? 'w-[88px]' : effectiveRenderer === 'mega' ? 'w-[320px]' : 'w-[250px]',
          config.fillHeight ? 'h-full flex-1' : 'h-[520px] shrink-0',
          config.edge === 'end' && 'ms-auto',
        )}
      >
        <div className="shrink-0 border-b border-shell-content-border/30 px-3 py-2">
          <p className={cn('truncate', BASE_COMPONENTS_CONFIG_SUBSECTION_LABEL_CLASS)}>
            {config.collapsed ? 'Nav' : `${effectiveRenderer} production preview`}
          </p>
        </div>
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden',
            config.collapsed ? 'px-1' : 'px-[16px]',
            config.fillHeight ? 'pt-3 pb-2' : 'pt-3 pb-4',
          )}
        >
          {config.fillHeight ? (
            <div className={cn('min-h-0 flex-1', config.density === 'compact' && 'text-xs [&_a]:!py-1 [&_button]:!py-1')}>{navigation}</div>
          ) : (
            <SidebarMenuScrollArea
              className="min-h-0 flex-1"
              dir={config.direction}
              aria-label="Navigation"
            >
              <div className={config.density === 'compact' ? 'text-xs [&_a]:!py-1 [&_button]:!py-1' : undefined}>{navigation}</div>
            </SidebarMenuScrollArea>
          )}
        </div>
      </div>
    </div>
  );
};

export const SidebarMenuBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<SidebarMenuBaseComponentsConfig>(DEFAULT_SIDEBAR_MENU_BASE_COMPONENTS_CONFIG);
  const effectiveRenderer = resolveSidebarMenuPreviewModel(config).renderer;
  const configJson = useMemo(() => JSON.stringify({
    public: {
      collapsed: config.collapsed,
      expansionMode: config.accordion ? 'accordion' : 'multiple',
      density: config.density,
      edge: config.edge,
      heightMode: config.fillHeight ? 'fill' : 'fit',
    },
    composition: {
      rendererId: effectiveRenderer,
      itemContent: [
        'icon',
        'label',
        effectiveRenderer !== 'standard' && config.showBadges && 'badge',
        effectiveRenderer !== 'standard' && config.showDescriptions && 'description',
      ].filter(Boolean),
    },
    demo: {
      fixtures: { manifest: config.structure === 'grouped' ? 'shell-designer-ci' : 'flat-navigation' },
      scenarios: { direction: config.direction, viewport: config.viewport, state: config.state },
    },
  }, null, 2), [config]);

  const activePathOptions = useMemo(
    () => DEMO_NAV_GROUPS.flatMap((group) => group.items)
      .filter((item) => item.path)
      .map((item) => ({ value: item.path!, label: item.label ?? item.path! })),
    [],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="sidebar-menu" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_SIDEBAR_MENU_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Renderer" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Variant" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.renderer}
                    onChange={(event) => {
                      const value = event.target.value as SidebarRenderer;
                      if (VARIANT_OPTIONS.includes(value)) {
                        setConfig((current) => applySidebarRenderer(current, value));
                      }
                    }}
                    ariaLabel="Sidebar menu variant"
                  >
                    {VARIANT_OPTIONS.map((variant) => (
                      <option key={variant} value={variant}>{variant}</option>
                    ))}
                  </UiSelect>
                </FormField>
                {([
                  ['Structure', 'structure', ['grouped', 'flat']],
                  ['Density', 'density', ['compact', 'default']],
                  ['Edge', 'edge', ['start', 'end']],
                  ['Direction', 'direction', ['ltr', 'rtl']],
                  ['Viewport', 'viewport', ['desktop', 'phone']],
                  ['State', 'state', ['default', 'loading', 'empty', 'unavailable-route']],
                ] as const).map(([label, field, options]) => (
                  <FormField key={field} label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config[field]} onChange={(event) => setConfig((current) => ({ ...current, [field]: event.target.value }))} ariaLabel={label}>
                      {options.map((value) => <option key={value} value={value}>{value}</option>)}
                    </UiSelect>
                  </FormField>
                ))}
                {effectiveRenderer !== 'standard' ? ([
                  ['Item badges', 'showBadges'],
                  ['Item descriptions', 'showDescriptions'],
                ] as const).map(([label, field]) => (
                  <FormField key={field} label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config[field] ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, [field]: event.target.value === 'yes' }))} ariaLabel={label}>
                      <option value="yes">show</option><option value="no">hide</option>
                    </UiSelect>
                  </FormField>
                )) : null}

                {effectiveRenderer === 'standard' ? <FormField label="Collapsed" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.collapsed ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        collapsed: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Sidebar collapsed"
                  >
                    <option value="no">expanded</option>
                    <option value="yes">collapsed</option>
                  </UiSelect>
                </FormField> : null}

                <FormField label="Active path" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.activePath}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        activePath: event.target.value,
                      }));
                    }}
                    ariaLabel="Active navigation path"
                  >
                    {activePathOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </UiSelect>
                </FormField>

                {effectiveRenderer === 'standard' && config.structure === 'grouped' ? <FormField label="Accordion" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.accordion ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        accordion: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Accordion group expansion"
                  >
                    <option value="no">off — multiple groups open</option>
                    <option value="yes">on — one group open</option>
                  </UiSelect>
                </FormField> : null}

                {effectiveRenderer === 'standard' && config.structure === 'grouped' ? <FormField label="Require open group" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.requireOpenGroup ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        requireOpenGroup: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Require at least one open navigation group"
                  >
                    <option value="yes">on — always one group open</option>
                    <option value="no">off — all groups can close</option>
                  </UiSelect>
                </FormField> : null}

                {effectiveRenderer === 'standard' && config.structure === 'grouped' ? <FormField label="Lock active group" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.lockActiveGroup ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        lockActiveGroup: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Lock active navigation group"
                  >
                    <option value="yes">on — cannot collapse active section</option>
                    <option value="no">off — active section can collapse</option>
                  </UiSelect>
                </FormField> : null}

                {effectiveRenderer === 'standard' && !config.collapsed ? <FormField label="Fill height" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.fillHeight ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        fillHeight: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Fill height with per-section scroll"
                  >
                    <option value="no">off — menu scrolls as one</option>
                    <option value="yes">on — 100% height, section scroll</option>
                  </UiSelect>
                </FormField> : null}

                {effectiveRenderer === 'standard' && config.structure === 'grouped' ? <FormField label="Ungrouped at start" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.ungroupedAtStart ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        ungroupedAtStart: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Show ungrouped items at menu start"
                  >
                    <option value="no">hide</option>
                    <option value="yes">show — Home, Search</option>
                  </UiSelect>
                </FormField> : null}

                {effectiveRenderer === 'standard' && config.structure === 'grouped' ? <FormField label="Ungrouped at end" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.ungroupedAtEnd ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        ungroupedAtEnd: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Show ungrouped items at menu end"
                  >
                    <option value="no">hide</option>
                    <option value="yes">show — Documentation, Help</option>
                  </UiSelect>
                </FormField> : null}

                {effectiveRenderer === 'standard' && config.structure === 'grouped' ? <FormField label="Group gap (px)" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    type="number"
                    min={0}
                    max={30}
                    step={1}
                    value={String(config.groupGapPx)}
                    onChange={(event) => {
                      const parsed = Number.parseInt(event.target.value, 10);
                      setConfig((current) => ({
                        ...current,
                        groupGapPx: Number.isFinite(parsed)
                          ? Math.max(0, Math.min(30, parsed))
                          : 0,
                      }));
                    }}
                    ariaLabel="Vertical gap between navigation groups in pixels"
                  />
                </FormField> : null}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="sidebar-menu">
          <SidebarMenuBaseComponentsPreview config={config} />
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
