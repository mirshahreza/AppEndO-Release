import React, { useMemo, useState } from 'react';
import {
  Code2,
  FileText,
  History,
  LayoutDashboard,
  Settings,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppSurfaceBox,
  FormField,
  FormSection,
  UiSegmentedControl,
  UiSelect,
  UiTabs,
  UiWorkspaceTabs,
  type UiSegmentedControlProps,
  type UiTabItem,
  type UiTabsProps,
  type UiWorkspaceTabItem,
} from '../../../shared/ui';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsConfigBoolField } from '../components/BaseComponentsConfigBoolField';
import {
  BaseComponentsCatalogPanel,
  BaseComponentsMetadataBadge,
} from '../components/catalog';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
} from '../baseComponentsConfiguratorLayout';

type TabsPattern = 'content' | 'workspace' | 'segmented';
type PreviewViewport = 'desktop' | 'tablet' | 'phone';
type PreviewDirection = 'ltr' | 'rtl';

const PATTERN_OPTIONS: TabsPattern[] = ['content', 'workspace', 'segmented'];
const VISUAL_MODE_OPTIONS: NonNullable<UiTabsProps['visualMode']>[] = ['label', 'icon-label', 'icon-only'];
const VARIANT_OPTIONS: NonNullable<UiTabsProps['variant']>[] = ['line', 'contained'];
const PLACEMENT_OPTIONS: NonNullable<UiTabsProps['placement']>[] = ['top', 'start', 'end'];
const ALIGNMENT_OPTIONS: NonNullable<UiTabsProps['alignment']>[] = ['start', 'center', 'end'];
const WIDTH_OPTIONS: NonNullable<UiTabsProps['width']>[] = ['fit', 'equal'];
const ACTIVATION_OPTIONS: NonNullable<UiTabsProps['activationMode']>[] = ['manual', 'automatic'];
const LIFECYCLE_OPTIONS: NonNullable<UiTabsProps['panelLifecycle']>[] = ['lazy-keep', 'eager', 'unmount'];
const OVERFLOW_OPTIONS: NonNullable<UiTabsProps['overflow']>[] = ['scroll', 'menu'];
const PANEL_ATTACHMENT_OPTIONS: NonNullable<UiTabsProps['panelAttachment']>[] = [
  'integrated',
  'separated',
];
const ORIENTATION_OPTIONS: NonNullable<UiSegmentedControlProps['orientation']>[] = ['horizontal', 'vertical'];
const VIEWPORT_OPTIONS: PreviewViewport[] = ['desktop', 'tablet', 'phone'];
const DIRECTION_OPTIONS: PreviewDirection[] = ['ltr', 'rtl'];
const ITEM_COUNT_OPTIONS = [3, 6, 8] as const;

const TAB_DEFINITIONS: Array<{
  id: string;
  label: string;
  icon: LucideIcon;
  badge: number;
  status: UiTabItem['status'];
  description: string;
}> = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    badge: 4,
    status: 'success',
    description: 'A concise summary of activity, ownership, and current state.',
  },
  {
    id: 'details',
    label: 'Record details',
    icon: FileText,
    badge: 12,
    status: 'info',
    description: 'Structured fields and related information stay in this panel.',
  },
  {
    id: 'history',
    label: 'Change history',
    icon: History,
    badge: 8,
    status: 'warning',
    description: 'Review revisions without leaving the current record context.',
  },
  {
    id: 'settings',
    label: 'Configuration',
    icon: Settings,
    badge: 2,
    status: 'none',
    description: 'Tune behavior while preserving the state of previously visited panels.',
  },
  {
    id: 'source',
    label: 'Generated source',
    icon: Code2,
    badge: 6,
    status: 'error',
    description: 'Longer labels make overflow behavior visible at narrow widths.',
  },
  {
    id: 'advanced',
    label: 'Advanced options',
    icon: SlidersHorizontal,
    badge: 3,
    status: 'none',
    description: 'Less common controls remain discoverable in the same local context.',
  },
  {
    id: 'audit',
    label: 'Compliance audit',
    icon: FileText,
    badge: 9,
    status: 'warning',
    description: 'Audit metadata demonstrates a dense tab strip.',
  },
  {
    id: 'preferences',
    label: 'Personal preferences',
    icon: Settings,
    badge: 5,
    status: 'none',
    description: 'The final item verifies scrolling and all-tabs menu discovery.',
  },
];

const INITIAL_WORKSPACE_ITEMS: UiWorkspaceTabItem[] = [
  {
    id: 'customer-model',
    label: 'Customer model',
    icon: FileText,
    pinned: true,
    closeable: true,
    content: null,
  },
  {
    id: 'order-query',
    label: 'Order query',
    icon: Code2,
    dirty: true,
    closeable: true,
    content: null,
  },
  {
    id: 'deployment-settings',
    label: 'Deployment settings',
    icon: Settings,
    status: 'warning',
    closeable: true,
    content: null,
  },
];

export type TabsBaseComponentsConfig = {
  pattern: TabsPattern;
  visualMode: NonNullable<UiTabsProps['visualMode']>;
  variant: NonNullable<UiTabsProps['variant']>;
  placement: NonNullable<UiTabsProps['placement']>;
  alignment: NonNullable<UiTabsProps['alignment']>;
  width: NonNullable<UiTabsProps['width']>;
  activationMode: NonNullable<UiTabsProps['activationMode']>;
  panelLifecycle: NonNullable<UiTabsProps['panelLifecycle']>;
  overflow: NonNullable<UiTabsProps['overflow']>;
  panelAttachment: NonNullable<UiTabsProps['panelAttachment']>;
  itemCount: (typeof ITEM_COUNT_OPTIONS)[number];
  showBadges: boolean;
  disabledItem: boolean;
  workspaceClose: boolean;
  workspaceAdd: boolean;
  workspaceReorder: boolean;
  workspacePin: boolean;
  workspaceDirty: boolean;
  segmentedOrientation: NonNullable<UiSegmentedControlProps['orientation']>;
  viewport: PreviewViewport;
  direction: PreviewDirection;
};

export const DEFAULT_TABS_BASE_COMPONENTS_CONFIG: TabsBaseComponentsConfig = {
  pattern: 'content',
  visualMode: 'icon-label',
  variant: 'line',
  placement: 'top',
  alignment: 'start',
  width: 'fit',
  activationMode: 'manual',
  panelLifecycle: 'lazy-keep',
  overflow: 'scroll',
  panelAttachment: 'integrated',
  itemCount: 3,
  showBadges: true,
  disabledItem: false,
  workspaceClose: true,
  workspaceAdd: true,
  workspaceReorder: true,
  workspacePin: true,
  workspaceDirty: true,
  segmentedOrientation: 'horizontal',
  viewport: 'desktop',
  direction: 'ltr',
};

export function applyTabsWidth(
  config: TabsBaseComponentsConfig,
  width: TabsBaseComponentsConfig['width'],
): TabsBaseComponentsConfig {
  return {
    ...config,
    width,
    itemCount: width === 'equal' && config.itemCount > 5 ? 3 : config.itemCount,
  };
}

export function applyTabsItemCount(
  config: TabsBaseComponentsConfig,
  itemCount: TabsBaseComponentsConfig['itemCount'],
): TabsBaseComponentsConfig {
  return {
    ...config,
    itemCount,
    width: itemCount > 5 ? 'fit' : config.width,
  };
}

export function applyTabsActivationMode(
  config: TabsBaseComponentsConfig,
  activationMode: TabsBaseComponentsConfig['activationMode'],
): TabsBaseComponentsConfig {
  return {
    ...config,
    activationMode,
    panelLifecycle: activationMode === 'automatic' ? 'eager' : config.panelLifecycle,
  };
}

export function resolveTabsPreviewModel(config: TabsBaseComponentsConfig) {
  return {
    root: 'tabs',
    pattern: config.pattern,
    component: config.pattern === 'content' ? 'UiTabs' : config.pattern === 'workspace' ? 'UiWorkspaceTabs' : 'UiSegmentedControl',
    viewport: config.viewport,
    direction: config.direction,
    contentProps: config.pattern === 'content' ? {
      visualMode: config.visualMode,
      variant: config.variant,
      placement: config.placement,
      alignment: config.alignment,
      width: config.width,
      activationMode: config.panelLifecycle === 'eager' ? config.activationMode : 'manual',
      panelLifecycle: config.panelLifecycle,
      overflow: config.overflow,
      panelAttachment: config.panelAttachment,
      itemCount: config.itemCount,
      showBadges: config.showBadges,
      disabledItem: config.disabledItem,
    } : null,
    workspaceProps: config.pattern === 'workspace' ? {
      closeable: config.workspaceClose,
      showAddButton: config.workspaceAdd,
      allowReorder: config.workspaceReorder,
      allowPin: config.workspacePin,
      dirty: config.workspaceDirty,
      panelAttachment: config.panelAttachment,
    } : null,
    segmentedProps: config.pattern === 'segmented' ? {
      visualMode: config.visualMode,
      orientation: config.segmentedOrientation,
      width: config.width,
    } : null,
    controls: {
      content: config.pattern === 'content',
      workspace: config.pattern === 'workspace',
      segmented: config.pattern === 'segmented',
      panelAttachment: config.pattern !== 'segmented',
      visualMode: config.pattern !== 'workspace',
    },
  };
}

const PREVIEW_WIDTH_CLASS: Record<PreviewViewport, string> = {
  desktop: 'w-full',
  tablet: 'w-full max-w-[48rem]',
  phone: 'w-full max-w-[22rem]',
};

const SelectField = <T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) => (
  <FormField label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
    <UiSelect
      size="sm"
      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
      value={String(value)}
      isDisabled={disabled}
      onChange={(event) => {
        const next = options.find((option) => String(option) === event.target.value);
        if (next !== undefined) onChange(next);
      }}
      ariaLabel={label}
    >
      {options.map((option) => (
        <option key={String(option)} value={String(option)}>
          {String(option)}
        </option>
      ))}
    </UiSelect>
  </FormField>
);

const PreviewPanel: React.FC<{
  title: string;
  description: string;
  attachment: TabsBaseComponentsConfig['panelAttachment'];
  placement?: TabsBaseComponentsConfig['placement'];
}> = ({ title, description, attachment, placement = 'top' }) => (
  <div
    className={cn(
      'flex min-h-36 flex-col justify-between border border-slate-200 bg-white p-4',
      attachment === 'separated' && 'rounded-md shadow-sm',
      attachment === 'integrated' && 'shadow-none',
      attachment === 'integrated' && placement === 'top' && 'rounded-b-md rounded-t-none border-t-0',
      attachment === 'integrated' && placement === 'start' && 'rounded-e-md rounded-s-none border-s-0',
      attachment === 'integrated' && placement === 'end' && 'rounded-s-md rounded-e-none border-e-0',
    )}
  >
    <div>
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-600">{description}</p>
    </div>
    <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-cyan-700">
      Interactive panel content
    </p>
  </div>
);

export function buildTabsBaseComponentsConfigExport(config: TabsBaseComponentsConfig) {
  return {
    public:
      config.pattern === 'content'
        ? {
            component: 'UiTabs',
            visualMode: config.visualMode,
            variant: config.variant,
            placement: config.placement,
            alignment: config.alignment,
            width: config.width,
            activationMode: config.panelLifecycle === 'eager' ? config.activationMode : 'manual',
            panelLifecycle: config.panelLifecycle,
            overflow: config.overflow,
            panelAttachment: config.panelAttachment,
            ariaLabel: 'Record sections',
          }
        : config.pattern === 'workspace'
          ? {
              component: 'UiWorkspaceTabs',
              showAddButton: config.workspaceAdd,
              showAllTabsMenu: true,
              allowReorder: config.workspaceReorder,
              allowPin: config.workspacePin,
              ariaLabel: 'Open editors',
              panelAttachment: config.panelAttachment,
            }
          : {
              component: 'UiSegmentedControl',
              visualMode: config.visualMode,
              width: config.width,
              orientation: config.segmentedOrientation,
              ariaLabel: 'Editor view',
            },
    composition:
      config.pattern === 'workspace'
        ? {
            controlledSelection: true,
            handlers: {
              close: config.workspaceClose,
              add: config.workspaceAdd,
              reorder: config.workspaceReorder,
              pin: config.workspacePin,
              requestCloseDirty: config.workspaceDirty,
            },
          }
        : {
            controlledSelection: true,
            itemContent: config.visualMode,
          },
    demo: {
      fixtures: {
        itemCount: config.pattern === 'segmented' ? 3 : config.itemCount,
        badges: config.pattern === 'content' && config.showBadges,
        dirtyItem: config.pattern === 'workspace' && config.workspaceDirty,
      },
      scenarios: {
        disabledItem: config.pattern === 'content' && config.disabledItem,
        viewport: config.viewport,
        direction: config.direction,
      },
    },
  };
}

export const TabsBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<TabsBaseComponentsConfig>(DEFAULT_TABS_BASE_COMPONENTS_CONFIG);
  const previewModel = resolveTabsPreviewModel(config);
  const [selectedKey, setSelectedKey] = useState('overview');
  const [segmentKey, setSegmentKey] = useState('design');
  const [workspaceSelectedKey, setWorkspaceSelectedKey] = useState('order-query');
  const [workspaceItems, setWorkspaceItems] = useState<UiWorkspaceTabItem[]>(INITIAL_WORKSPACE_ITEMS);
  const [workspaceEvent, setWorkspaceEvent] = useState('Select, close, pin, add, or reorder an editor tab.');

  const contentItems = useMemo<UiTabItem[]>(
    () =>
      TAB_DEFINITIONS.slice(0, config.itemCount).map((item, index) => ({
        id: item.id,
        label: item.label,
        accessibleLabel: item.label,
        icon: item.icon,
        badge: config.showBadges ? item.badge : undefined,
        status: item.status,
        disabled: config.disabledItem && index === Math.min(config.itemCount - 1, 2),
        content: (
          <PreviewPanel
            title={item.label}
            description={item.description}
            attachment={config.panelAttachment}
            placement={config.placement}
          />
        ),
      })),
    [
      config.disabledItem,
      config.itemCount,
      config.panelAttachment,
      config.placement,
      config.showBadges,
    ],
  );

  const renderedWorkspaceItems = useMemo<UiWorkspaceTabItem[]>(
    () =>
      workspaceItems.map((item) => ({
        ...item,
        dirty: config.workspaceDirty ? item.dirty : false,
        closeable: config.workspaceClose,
        content: (
          <PreviewPanel
            title={item.label}
            description="Workspace tabs compose document lifecycle actions around a persistent editor panel."
            attachment={config.panelAttachment}
          />
        ),
      })),
    [config.panelAttachment, config.workspaceClose, config.workspaceDirty, workspaceItems],
  );

  const segmentedItems = useMemo(
    () =>
      [
        { id: 'design', label: 'Design', accessibleLabel: 'Design view', icon: LayoutDashboard },
        { id: 'source', label: 'Source', accessibleLabel: 'Source view', icon: Code2 },
        { id: 'settings', label: 'Settings', accessibleLabel: 'Settings view', icon: Settings },
      ],
    [],
  );

  React.useEffect(() => {
    if (contentItems.some((item) => item.id === selectedKey && !item.disabled)) return;
    setSelectedKey(contentItems.find((item) => !item.disabled)?.id ?? '');
  }, [contentItems, selectedKey]);

  const configJson = useMemo(
    () => JSON.stringify(buildTabsBaseComponentsConfigExport(config), null, 2),
    [config],
  );

  const reset = () => {
    setConfig(DEFAULT_TABS_BASE_COMPONENTS_CONFIG);
    setSelectedKey('overview');
    setSegmentKey('design');
    setWorkspaceSelectedKey('order-query');
    setWorkspaceItems(INITIAL_WORKSPACE_ITEMS);
    setWorkspaceEvent('Select, close, pin, add, or reorder an editor tab.');
  };

  const closeWorkspaceTab = (key: string) => {
    setWorkspaceItems((items) => items.filter((item) => item.id !== key));
    setWorkspaceEvent(`Closed ${key}.`);
  };

  const addWorkspaceTab = () => {
    let nextNumber = workspaceItems.length + 1;
    while (workspaceItems.some((item) => item.id === `untitled-${nextNumber}`)) nextNumber += 1;
    const id = `untitled-${nextNumber}`;
    setWorkspaceItems((items) => [
      ...items,
      {
        id,
        label: `Untitled ${nextNumber}`,
        icon: FileText,
        closeable: true,
        content: null,
      },
    ]);
    setWorkspaceSelectedKey(id);
    setWorkspaceEvent(`Added ${id}.`);
  };

  const reorderWorkspaceTabs = (orderedKeys: string[]) => {
    setWorkspaceItems((items) => {
      const byId = new Map(items.map((item) => [item.id, item]));
      return orderedKeys.flatMap((key) => {
        const item = byId.get(key);
        return item ? [item] : [];
      });
    });
    setWorkspaceEvent('Reordered open editors.');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="tabs" json={configJson}>
          <BaseComponentsResetButton onClick={reset} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection
              title="Pattern"
              description="Choose the tab contract before tuning its appearance."
              tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}
            >
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <SelectField
                  label="Pattern"
                  value={config.pattern}
                  options={PATTERN_OPTIONS}
                  onChange={(pattern) => setConfig((current) => ({ ...current, pattern }))}
                />
                {config.pattern !== 'workspace' ? (
                  <SelectField
                    label="Visual mode"
                    value={config.visualMode}
                    options={VISUAL_MODE_OPTIONS}
                    onChange={(visualMode) =>
                      setConfig((current) => ({ ...current, visualMode }))
                    }
                  />
                ) : null}
                {config.pattern !== 'segmented' ? (
                  <SelectField
                    label="Panel relationship"
                    value={config.panelAttachment}
                    options={PANEL_ATTACHMENT_OPTIONS}
                    onChange={(panelAttachment) =>
                      setConfig((current) => ({ ...current, panelAttachment }))
                    }
                  />
                ) : null}
              </div>
            </FormSection>

            {config.pattern === 'content' ? (
              <>
                <FormSection
                  title="Content tabs"
                  description="Line and contained tabs switch peer content panels."
                  tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}
                  divided
                >
                  <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                    <SelectField
                      label="Variant"
                      value={config.variant}
                      options={VARIANT_OPTIONS}
                      onChange={(variant) => setConfig((current) => ({ ...current, variant }))}
                    />
                    <SelectField
                      label="Placement"
                      value={config.placement}
                      options={PLACEMENT_OPTIONS}
                      onChange={(placement) => setConfig((current) => ({ ...current, placement }))}
                    />
                    <SelectField
                      label="Alignment"
                      value={config.alignment}
                      options={ALIGNMENT_OPTIONS}
                      onChange={(alignment) => setConfig((current) => ({ ...current, alignment }))}
                    />
                    <SelectField
                      label="Width"
                      value={config.width}
                      options={WIDTH_OPTIONS}
                      onChange={(width) => setConfig((current) => applyTabsWidth(current, width))}
                    />
                    <SelectField
                      label="Overflow"
                      value={config.overflow}
                      options={OVERFLOW_OPTIONS}
                      onChange={(overflow) => setConfig((current) => ({ ...current, overflow }))}
                    />
                    <SelectField
                      label="Item count"
                      value={config.itemCount}
                      options={ITEM_COUNT_OPTIONS}
                      onChange={(itemCount) =>
                        setConfig((current) => applyTabsItemCount(current, itemCount))
                      }
                    />
                    <BaseComponentsConfigBoolField
                      label="Passive badges"
                      checked={config.showBadges}
                      ariaLabel="Show passive badges"
                      onChange={(checked) => setConfig((current) => ({ ...current, showBadges: checked }))}
                    />
                    <BaseComponentsConfigBoolField
                      label="Disabled item"
                      checked={config.disabledItem}
                      ariaLabel="Include disabled item"
                      onChange={(checked) => setConfig((current) => ({ ...current, disabledItem: checked }))}
                    />
                  </div>
                </FormSection>

                <FormSection
                  title="Activation and lifecycle"
                  description="Automatic activation is available only when every panel is eager."
                  tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}
                  divided
                >
                  <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                    <SelectField
                      label="Panel lifecycle"
                      value={config.panelLifecycle}
                      options={LIFECYCLE_OPTIONS}
                      onChange={(panelLifecycle) =>
                        setConfig((current) => ({
                          ...current,
                          panelLifecycle,
                          activationMode:
                            panelLifecycle === 'eager' ? current.activationMode : 'manual',
                        }))
                      }
                    />
                    <SelectField
                      label="Activation"
                      value={config.activationMode}
                      options={ACTIVATION_OPTIONS}
                      onChange={(activationMode) =>
                        setConfig((current) =>
                          applyTabsActivationMode(current, activationMode)
                        )
                      }
                    />
                  </div>
                </FormSection>
              </>
            ) : null}

            {config.pattern === 'workspace' ? (
              <FormSection
                title="Workspace behavior"
                description="Editor tabs compose lifecycle actions without changing the content-tabs contract."
                tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}
                divided
              >
                <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                  <BaseComponentsConfigBoolField
                    label="Close"
                    checked={config.workspaceClose}
                    ariaLabel="Allow close"
                    onChange={(checked) => setConfig((current) => ({ ...current, workspaceClose: checked }))}
                  />
                  <BaseComponentsConfigBoolField
                    label="Add action"
                    checked={config.workspaceAdd}
                    ariaLabel="Show add action"
                    onChange={(checked) => setConfig((current) => ({ ...current, workspaceAdd: checked }))}
                  />
                  <BaseComponentsConfigBoolField
                    label="Reorder"
                    checked={config.workspaceReorder}
                    ariaLabel="Allow reorder"
                    onChange={(checked) => setConfig((current) => ({ ...current, workspaceReorder: checked }))}
                  />
                  <BaseComponentsConfigBoolField
                    label="Pin"
                    checked={config.workspacePin}
                    ariaLabel="Allow pin"
                    onChange={(checked) => setConfig((current) => ({ ...current, workspacePin: checked }))}
                  />
                  <BaseComponentsConfigBoolField
                    label="Dirty editor"
                    checked={config.workspaceDirty}
                    ariaLabel="Include dirty editor"
                    onChange={(checked) => setConfig((current) => ({ ...current, workspaceDirty: checked }))}
                  />
                </div>
              </FormSection>
            ) : null}

            {config.pattern === 'segmented' ? (
              <FormSection
                title="Segmented control"
                description="Use for a compact single-choice view or mode switch, never content panels."
                tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}
                divided
              >
                <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                  <SelectField
                    label="Orientation"
                    value={config.segmentedOrientation}
                    options={ORIENTATION_OPTIONS}
                    onChange={(segmentedOrientation) =>
                      setConfig((current) => ({ ...current, segmentedOrientation }))
                    }
                  />
                  <SelectField
                    label="Width"
                    value={config.width}
                    options={WIDTH_OPTIONS}
                    onChange={(width) => setConfig((current) => ({ ...current, width }))}
                  />
                </div>
              </FormSection>
            ) : null}

            <FormSection
              title="Preview environment"
              description="Validate logical placement and overflow at representative widths."
              tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}
              divided
            >
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <SelectField
                  label="Viewport"
                  value={config.viewport}
                  options={VIEWPORT_OPTIONS}
                  onChange={(viewport) => setConfig((current) => ({ ...current, viewport }))}
                />
                <SelectField
                  label="Direction"
                  value={config.direction}
                  options={DIRECTION_OPTIONS}
                  onChange={(direction) => setConfig((current) => ({ ...current, direction }))}
                />
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="tabs">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'items-center bg-slate-50/50')}>
            <div
              dir={config.direction}
              data-bc-preview-root="tabs"
              data-testid="tabs-preview-viewport"
              data-viewport={config.viewport}
              className={cn(
                'mx-auto flex min-h-[20rem] min-w-0 flex-col gap-3 overflow-hidden rounded-md border border-slate-200 bg-white p-3 shadow-sm transition-[max-width]',
                PREVIEW_WIDTH_CLASS[config.viewport],
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {config.pattern === 'content'
                      ? 'Record sections'
                      : config.pattern === 'workspace'
                        ? 'Open editors'
                        : 'Editor view'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {config.direction.toUpperCase()} · {config.viewport}
                  </p>
                </div>
                <div className="flex gap-1">
                  <BaseComponentsMetadataBadge tone="cyan">{config.pattern}</BaseComponentsMetadataBadge>
                  <BaseComponentsMetadataBadge tone="emerald">
                    {config.pattern === 'workspace' ? 'document lifecycle' : config.visualMode}
                  </BaseComponentsMetadataBadge>
                </div>
              </div>

              {previewModel.pattern === 'content' ? (
                <UiTabs
                  items={contentItems}
                  selectedKey={selectedKey}
                  onSelectionChange={setSelectedKey}
                  visualMode={config.visualMode}
                  variant={config.variant}
                  placement={config.placement}
                  alignment={config.alignment}
                  width={config.width}
                  activationMode={config.activationMode}
                  panelLifecycle={config.panelLifecycle}
                  overflow={config.overflow}
                  panelAttachment={config.panelAttachment}
                  ariaLabel="Record sections"
                  className="min-h-0 flex-1"
                />
              ) : null}

              {previewModel.pattern === 'workspace' ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200">
                  <UiWorkspaceTabs
                    items={renderedWorkspaceItems}
                    selectedKey={workspaceSelectedKey}
                    onSelectionChange={setWorkspaceSelectedKey}
                    onClose={closeWorkspaceTab}
                    onAdd={addWorkspaceTab}
                    onReorder={reorderWorkspaceTabs}
                    onPinChange={(key, pinned) => {
                      setWorkspaceItems((items) =>
                        items.map((item) => (item.id === key ? { ...item, pinned } : item)),
                      );
                      setWorkspaceEvent(`${pinned ? 'Pinned' : 'Unpinned'} ${key}.`);
                    }}
                    onRequestCloseDirty={async (key) => {
                      setWorkspaceEvent(`Discarded unsaved changes in ${key} before closing.`);
                      return 'discard';
                    }}
                    showAddButton={config.workspaceAdd}
                    allowReorder={config.workspaceReorder}
                    allowPin={config.workspacePin}
                    panelAttachment={config.panelAttachment}
                    ariaLabel="Open editors"
                    className="min-h-0 flex-1"
                  />
                  <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                    {workspaceEvent}
                  </div>
                </div>
              ) : null}

              {previewModel.pattern === 'segmented' ? (
                <div className="flex flex-1 flex-col items-start gap-4">
                  <UiSegmentedControl
                    items={segmentedItems}
                    selectedKey={segmentKey}
                    onSelectionChange={setSegmentKey}
                    visualMode={config.visualMode}
                    width={config.width}
                    orientation={config.segmentedOrientation}
                    ariaLabel="Editor view"
                    className={cn(config.width === 'equal' && 'w-full')}
                  />
                  <AppSurfaceBox
                    title={`${segmentedItems.find((item) => item.id === segmentKey)?.label ?? 'Design'} view`}
                    tone="cyan"
                    className="w-full"
                  >
                    <p className="text-xs leading-relaxed text-slate-600">
                      Segmented controls select one compact mode. They do not own panel lifecycle,
                      overflow menus, or editor close actions.
                    </p>
                  </AppSurfaceBox>
                </div>
              ) : null}
            </div>

            <div className="mx-auto w-full max-w-3xl">
              <BaseComponentsCatalogPanel
                title="Pattern contract"
                summary="Choose by interaction semantics; visual similarity does not make these patterns interchangeable."
              >
                <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                  <p><strong className="text-slate-800">Content:</strong> peer panels and lifecycle.</p>
                  <p><strong className="text-slate-800">Workspace:</strong> open documents and close actions.</p>
                  <p><strong className="text-slate-800">Segmented:</strong> compact single-choice modes.</p>
                </div>
              </BaseComponentsCatalogPanel>
            </div>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
