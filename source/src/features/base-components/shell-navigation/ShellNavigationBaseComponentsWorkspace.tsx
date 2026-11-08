import * as React from 'react';
import { Circle, Menu, Search, Settings } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  FormField,
  FormSection,
  ShellContextNavigation,
  ShellFooterNavigation,
  ShellMegaMenuFeatured,
  ShellMegaMenuGroup,
  ShellMegaMenuPanel,
  ShellMobileDrawerNavigation,
  ShellMobilePopoverNavigation,
  ShellNavBadge,
  ShellNavDescription,
  ShellNavDivider,
  ShellNavGroup,
  ShellNavIcon,
  ShellNavItem,
  ShellNavLink,
  ShellNavList,
  ShellNavRoot,
  ShellNavTrigger,
  ShellNavigationSearch,
  ShellNavigationUtilities,
  ShellSidebarMegaNavigation,
  ShellSidebarNavigation,
  ShellSidebarRailNavigation,
  ShellTopMegaNavigation,
  ShellTopNavigation,
  ShellTopNavigationOverflow,
  UiSelect,
  type ShellDirection,
  type ShellNavigationGroup,
  type ShellNavigationItem,
  type ShellViewportTier,
} from '../../../shared/ui';
import {
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';
import { BaseComponentsConfigToolbarControls, BaseComponentsResetButton } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsConfigBoolField } from '../components/BaseComponentsConfigBoolField';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import { BaseComponentsPreviewFrame, BASE_COMPONENTS_WORKSPACE_INSET_CLASS } from '../components/BaseComponentsWorkspacePanel';

export const SHELL_NAVIGATION_COMPONENT_IDS = [
  'ShellNavRoot', 'ShellNavList', 'ShellNavGroup', 'ShellNavItem', 'ShellNavLink',
  'ShellNavTrigger', 'ShellNavIcon', 'ShellNavBadge', 'ShellNavDescription', 'ShellNavDivider',
  'ShellSidebarNavigation', 'ShellSidebarRailNavigation', 'ShellSidebarMegaNavigation',
  'ShellTopNavigation', 'ShellTopNavigationOverflow', 'ShellTopMegaNavigation',
  'ShellMegaMenuPanel', 'ShellMegaMenuGroup', 'ShellMegaMenuFeatured',
  'ShellMobileDrawerNavigation', 'ShellMobilePopoverNavigation', 'ShellFooterNavigation',
  'ShellContextNavigation', 'ShellNavigationSearch', 'ShellNavigationUtilities',
] as const;

type NavigationComponentId = (typeof SHELL_NAVIGATION_COMPONENT_IDS)[number];
type ManifestFixture = 'flat' | 'grouped' | 'deep' | 'long-labels' | 'badges' | 'featured' | 'shell-designer-ci';
type NavigationState = 'default' | 'open' | 'collapsed' | 'loading' | 'empty' | 'unavailable-route';

export type ShellNavigationItemContent = 'label' | 'icon' | 'badge' | 'description' | 'featured';

export type ShellNavigationGalleryConfig = {
  component: NavigationComponentId;
  manifest: ManifestFixture;
  activePath: 'fixture-default' | 'first' | 'nested' | 'unavailable';
  state: NavigationState;
  viewport: ShellViewportTier;
  direction: ShellDirection;
  keyboardTrace: boolean;
  itemContent: readonly ShellNavigationItemContent[];
};

export const DEFAULT_SHELL_NAVIGATION_GALLERY_CONFIG: ShellNavigationGalleryConfig = {
  component: 'ShellSidebarNavigation',
  manifest: 'shell-designer-ci',
  activePath: 'fixture-default',
  state: 'default',
  viewport: 'desktop',
  direction: 'ltr',
  keyboardTrace: true,
  itemContent: ['icon', 'label'],
};

const ITEM_CONTENT_PRESETS: Array<{ label: string; value: readonly ShellNavigationItemContent[] }> = [
  { label: 'label', value: ['label'] },
  { label: 'icon and label', value: ['icon', 'label'] },
  { label: 'icon, label, badge', value: ['icon', 'label', 'badge'] },
  { label: 'full', value: ['icon', 'label', 'badge', 'description', 'featured'] },
];

const DATA_NAVIGATION_COMPONENTS = new Set<NavigationComponentId>([
  'ShellSidebarNavigation', 'ShellSidebarRailNavigation', 'ShellSidebarMegaNavigation',
  'ShellTopNavigation', 'ShellTopNavigationOverflow', 'ShellTopMegaNavigation',
  'ShellMegaMenuPanel', 'ShellMegaMenuGroup', 'ShellMegaMenuFeatured',
  'ShellMobileDrawerNavigation', 'ShellMobilePopoverNavigation', 'ShellFooterNavigation',
  'ShellContextNavigation', 'ShellNavigationSearch',
]);

export const getShellNavigationGalleryOptions = (
  component: NavigationComponentId,
  manifest: ManifestFixture,
) => {
  const usesManifest = DATA_NAVIGATION_COMPONENTS.has(component);
  const activePaths: readonly ShellNavigationGalleryConfig['activePath'][] = usesManifest
    ? (manifest === 'deep'
      ? ['fixture-default', 'first', 'nested', 'unavailable']
      : ['fixture-default', 'first', 'unavailable'])
    : [];
  const states: readonly NavigationState[] = [
    'default',
    ...(['ShellNavTrigger', 'ShellMobileDrawerNavigation', 'ShellMobilePopoverNavigation'].includes(component) ? ['open'] : []),
    ...(DATA_NAVIGATION_COMPONENTS.has(component) ? ['unavailable-route'] : []),
  ] as readonly NavigationState[];
  return { usesManifest, activePaths, states };
};

export const resolveShellNavigationCurrentPath = (config: ShellNavigationGalleryConfig) =>
  config.activePath === 'unavailable' || config.state === 'unavailable-route'
    ? '/missing'
    : config.activePath === 'nested'
      ? '/studio/components/shell'
      : config.activePath === 'first'
        ? '/studio/overview'
        : '/studio/deployments';

export const exportShellNavigationGalleryConfig = (config: ShellNavigationGalleryConfig) => ({
  public: {
    currentPath: resolveShellNavigationCurrentPath(config),
    direction: config.direction,
  },
  composition: {
    component: config.component,
    itemContent: [...config.itemContent],
    interaction: config.component.includes('Mega') || config.component.includes('Top') ? 'menubar' : 'disclosure',
  },
  demo: {
    fixtures: getShellNavigationGalleryOptions(config.component, config.manifest).usesManifest
      ? { manifest: config.manifest }
      : {},
    scenarios: { state: config.state, viewport: config.viewport, keyboardTrace: config.keyboardTrace },
  },
});

const baseItems: ShellNavigationItem[] = [
  { label: 'Overview', icon: 'LayoutDashboard', description: 'Shell health and activity', path: '/studio/overview', pageKey: 'overview' },
  { label: 'Components', icon: 'Blocks', description: 'Registered component catalog', path: '/studio/components', pageKey: 'components' },
  { label: 'Deployments', icon: 'Rocket', description: 'Release environments', path: '/studio/deployments', pageKey: 'deployments', presentation: { badge: '3' } },
];

const applyItemContent = (
  items: ShellNavigationItem[],
  itemContent: readonly ShellNavigationItemContent[],
): ShellNavigationItem[] => {
  const allowed = new Set(itemContent);
  return items.map((item) => ({
    ...item,
    icon: allowed.has('icon') ? item.icon : undefined,
    description: allowed.has('description') ? item.description : undefined,
    presentation: {
      ...(allowed.has('badge') ? item.presentation : {}),
      ...(allowed.has('featured') && item.presentation?.featured ? { featured: true } : {}),
    },
  }));
};

const buildFixture = (fixture: ManifestFixture, itemContent: readonly ShellNavigationItemContent[] = ['icon', 'label']): ShellNavigationGroup[] => {
  if (fixture === 'flat') return [{ items: applyItemContent(baseItems, itemContent) }];
  if (fixture === 'shell-designer-ci') {
    return [
      { heading: 'Studio', items: applyItemContent(baseItems.slice(0, 2), itemContent) },
      { heading: 'Delivery', items: applyItemContent([{ ...baseItems[2], label: 'CI deployments', presentation: { badge: '3' } }], itemContent) },
    ];
  }
  const development: ShellNavigationGroup = {
    heading: 'Development',
    items: applyItemContent(fixture === 'deep'
      ? [{ ...baseItems[1], children: [{ label: 'Shell galleries', icon: 'PanelsTopLeft', path: '/studio/components/shell', pageKey: 'shell' }] }]
      : baseItems.slice(0, 2), itemContent),
  };
  const operationsItems = baseItems.slice(2).map((item) => ({
    ...item,
    label: fixture === 'long-labels' ? 'Deployment environments and release coordination' : item.label,
    presentation: fixture === 'badges' ? { badge: '12 new' } : item.presentation,
  }));
  if (fixture === 'featured') {
    operationsItems[0] = { ...operationsItems[0], presentation: { ...operationsItems[0].presentation, featured: true } };
  }
  return [development, { heading: 'Operations', items: applyItemContent(operationsItems, itemContent) }];
};

const SelectField = <T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly T[]; onChange: (value: T) => void;
}) => (
  <FormField label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={value} ariaLabel={label} onChange={(event) => onChange(event.target.value as T)}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </UiSelect>
  </FormField>
);

const primitiveContent = {
  link: <><ShellNavIcon><Circle className="h-3.5 w-3.5" /></ShellNavIcon><span>Shell overview</span><ShellNavBadge>New</ShellNavBadge></>,
};

const NavigationPreview: React.FC<{
  config: ShellNavigationGalleryConfig;
  groups: ShellNavigationGroup[];
  currentPath: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}> = ({ config, groups, currentPath, open, setOpen }) => {
  const common = { groups, currentPath, onNavigate: () => undefined };
  const firstGroup = groups[0] ?? { heading: 'Empty', items: [] };
  const firstItem = firstGroup.items[0] ?? baseItems[0];
  const shell = (node: React.ReactNode) => (
    <div className={cn('min-h-52 rounded-lg border border-slate-200 bg-white p-4', config.state === 'collapsed' && 'max-w-24')}>
      {node}
    </div>
  );
  if (config.state === 'loading') return shell(<p role="status" className="text-sm font-semibold text-slate-600">Loading navigation manifest…</p>);
  if (config.state === 'empty') return shell(<p className="text-sm font-semibold text-slate-600">No navigation items are registered.</p>);

  switch (config.component) {
    case 'ShellNavRoot': return shell(<ShellNavRoot aria-label="Primitive root"><ShellNavList><ShellNavItem><ShellNavLink href="/studio/overview" active>{primitiveContent.link}</ShellNavLink></ShellNavItem></ShellNavList></ShellNavRoot>);
    case 'ShellNavList': return shell(<ShellNavList className="space-y-1"><ShellNavItem><ShellNavLink href="#">{primitiveContent.link}</ShellNavLink></ShellNavItem><ShellNavDivider /><ShellNavItem>Second list item</ShellNavItem></ShellNavList>);
    case 'ShellNavGroup': return shell(<ShellNavGroup><h3 className="mb-2 text-xs font-bold uppercase text-slate-500">Development</h3><ShellNavList><ShellNavItem><ShellNavLink href="#">{primitiveContent.link}</ShellNavLink></ShellNavItem></ShellNavList></ShellNavGroup>);
    case 'ShellNavItem': return shell(<ShellNavList><ShellNavItem className="rounded-md border border-violet-200 p-2">{primitiveContent.link}</ShellNavItem></ShellNavList>);
    case 'ShellNavLink': return shell(<ShellNavLink href="/studio/overview" active className="flex items-center gap-2 bg-violet-50 p-2">{primitiveContent.link}</ShellNavLink>);
    case 'ShellNavTrigger': return shell(<ShellNavTrigger expanded={open || config.state === 'open'} controls="gallery-navigation-panel" onClick={() => setOpen(!open)} className="flex items-center gap-2 border border-slate-200 px-3 py-2"><Menu className="h-4 w-4" />Toggle navigation group</ShellNavTrigger>);
    case 'ShellNavIcon': return shell(<div className="flex items-center gap-2"><ShellNavIcon className="text-violet-700"><Settings className="h-5 w-5" /></ShellNavIcon><span className="text-sm">Decorative navigation icon</span></div>);
    case 'ShellNavBadge': return shell(<div className="flex gap-2"><ShellNavBadge>3</ShellNavBadge><ShellNavBadge>Preview</ShellNavBadge></div>);
    case 'ShellNavDescription': return shell(<ShellNavDescription>Secondary route context remains concise and noninteractive.</ShellNavDescription>);
    case 'ShellNavDivider': return shell(<ShellNavList><ShellNavItem>Primary routes</ShellNavItem><ShellNavDivider /><ShellNavItem>Utility routes</ShellNavItem></ShellNavList>);
    case 'ShellSidebarNavigation': return shell(<ShellSidebarNavigation {...common} defaultExpandedGroups={groups.map((group) => group.heading ?? '')} />);
    case 'ShellSidebarRailNavigation': return shell(<ShellSidebarRailNavigation {...common} />);
    case 'ShellSidebarMegaNavigation': return shell(<ShellSidebarMegaNavigation {...common} featuredArea="end" />);
    case 'ShellTopNavigation': return shell(<ShellTopNavigation {...common} />);
    case 'ShellTopNavigationOverflow': return shell(<ShellTopNavigationOverflow {...common} itemEstimatePx={90} />);
    case 'ShellTopMegaNavigation': return shell(<ShellTopMegaNavigation {...common} featuredArea="end" />);
    case 'ShellMegaMenuPanel': return shell(<ShellMegaMenuPanel {...common} featuredArea="end" />);
    case 'ShellMegaMenuGroup': return shell(<ShellMegaMenuGroup group={firstGroup} common={common} />);
    case 'ShellMegaMenuFeatured': return shell(<ShellMegaMenuFeatured item={{ ...firstItem, presentation: { ...firstItem.presentation, featured: true } }} common={common} />);
    case 'ShellMobileDrawerNavigation': return shell(<><AppButton intent="utility" size="sm" onClick={() => setOpen(true)}><Menu className="h-3.5 w-3.5" />Open drawer</AppButton><ShellMobileDrawerNavigation {...common} open={open || config.state === 'open'} onOpenChange={setOpen} title="Gallery navigation" /></>);
    case 'ShellMobilePopoverNavigation': return shell(<ShellMobilePopoverNavigation {...common} open={open || config.state === 'open'} onOpenChange={setOpen} availableInlineSize={config.viewport === 'phone' ? 280 : 480} trigger={<AppButton intent="utility" size="sm"><Menu className="h-3.5 w-3.5" />Open navigation</AppButton>} />);
    case 'ShellFooterNavigation': return shell(<ShellFooterNavigation {...common} stacked={config.viewport === 'phone'} />);
    case 'ShellContextNavigation': return shell(<ShellContextNavigation {...common} />);
    case 'ShellNavigationSearch': return shell(<div className="space-y-3"><ShellNavigationSearch groups={groups} minimumItemCount={0} debounceMs={0} /><ShellSidebarNavigation {...common} defaultExpandedGroups={groups.map((group) => group.heading ?? '')} /></div>);
    case 'ShellNavigationUtilities': return shell(<ShellNavigationUtilities><AppButton intent="utility" size="sm"><Search className="h-3.5 w-3.5" />Search</AppButton><AppButton intent="utility" size="sm"><Settings className="h-3.5 w-3.5" />Settings</AppButton></ShellNavigationUtilities>);
  }
};

export const ShellNavigationBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = React.useState(DEFAULT_SHELL_NAVIGATION_GALLERY_CONFIG);
  const [open, setOpen] = React.useState(false);
  const update = <K extends keyof ShellNavigationGalleryConfig>(key: K, value: ShellNavigationGalleryConfig[K]) =>
    setConfig((current) => ({ ...current, [key]: value }));
  const groups = React.useMemo(() => buildFixture(config.manifest, config.itemContent), [config.itemContent, config.manifest]);
  const currentPath = resolveShellNavigationCurrentPath(config);
  const componentOptions = getShellNavigationGalleryOptions(config.component, config.manifest);
  const json = JSON.stringify(exportShellNavigationGalleryConfig(config), null, 2);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="shell-navigation" json={json}>
          <BaseComponentsResetButton onClick={() => { setConfig(DEFAULT_SHELL_NAVIGATION_GALLERY_CONFIG); setOpen(false); }} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Renderer" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <SelectField label="Production export" value={config.component} options={SHELL_NAVIGATION_COMPONENT_IDS} onChange={(value) => setConfig((current) => {
                  const options = getShellNavigationGalleryOptions(value, current.manifest);
                  return { ...current, component: value, activePath: options.activePaths[0] ?? 'fixture-default', state: 'default' };
                })} />
                {componentOptions.usesManifest ? <SelectField label="Manifest fixture" value={config.manifest} options={['flat', 'grouped', 'deep', 'long-labels', 'badges', 'featured', 'shell-designer-ci']} onChange={(value) => setConfig((current) => ({ ...current, manifest: value, activePath: value === 'deep' ? current.activePath : current.activePath === 'nested' ? 'fixture-default' : current.activePath }))} /> : null}
                {componentOptions.activePaths.length ? <SelectField label="Active path" value={config.activePath} options={componentOptions.activePaths} onChange={(value) => update('activePath', value)} /> : null}
              </div>
            </FormSection>
            <FormSection title="Scenario" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE} divided>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {componentOptions.states.length > 1 ? <SelectField label="State" value={config.state} options={componentOptions.states} onChange={(value) => update('state', value)} /> : null}
                <SelectField label="Viewport" value={config.viewport} options={['desktop', 'tablet', 'phone']} onChange={(value) => update('viewport', value)} />
                <SelectField label="Direction" value={config.direction} options={['ltr', 'rtl']} onChange={(value) => update('direction', value)} />
                <FormField label="Item content" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.itemContent.join(',')}
                    ariaLabel="Navigation item content"
                    onChange={(event) => {
                      const next = ITEM_CONTENT_PRESETS.find((preset) => preset.value.join(',') === event.target.value);
                      if (next) update('itemContent', next.value);
                    }}
                  >
                    {ITEM_CONTENT_PRESETS.map((preset) => (
                      <option key={preset.label} value={preset.value.join(',')}>{preset.label}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <BaseComponentsConfigBoolField
                  label="Keyboard examples"
                  checked={config.keyboardTrace}
                  ariaLabel="Show keyboard examples"
                  onChange={(checked) => update('keyboardTrace', checked)}
                />
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="shell-navigation">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'mx-auto transition-[max-width]', config.viewport === 'phone' ? 'max-w-[22rem]' : config.viewport === 'tablet' ? 'max-w-[42rem]' : 'max-w-none')} dir={config.direction} data-viewport={config.viewport}>
            {config.keyboardTrace ? (
              <div className="flex flex-wrap gap-1.5" aria-label="Keyboard examples">
                {['Tab: enter navigation', 'Arrow keys: move', 'Enter: activate', 'Escape: close'].map((example) => <kbd key={example} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">{example}</kbd>)}
              </div>
            ) : null}
            <NavigationPreview config={config} groups={groups} currentPath={currentPath} open={open} setOpen={setOpen} />
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
