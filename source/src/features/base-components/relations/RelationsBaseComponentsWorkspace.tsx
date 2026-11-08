import React, { useMemo, useState } from 'react';
import {
  GitBranch,
  Link2,
  ListTree,
  Share2,
} from 'lucide-react';
import {
  AppButton,
  FormField,
  FormSection,
  RelationFormWidgetGallery,
  UiSelect,
} from '../../../shared/ui';
import {
  RELATION_FORM_WIDGET_OPTIONS,
  relationFormWidgetOptionsForKind,
  type RelationFormWidget,
  type RelationWidgetKindHint,
} from '../../../shared/api/contracts/data-api';
import { cn } from '../../../lib/utils';
import {
  HERO_UI_FIELD_SIZES,
  type HeroUiFieldSize,
  isHeroUiFieldSize,
} from '../../../shared/ui/heroFieldSize';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import {
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_PREVIEW_SHELL_CLASS,
} from '../baseComponentsConfiguratorLayout';

/** BaseComponents relation kinds — physical shares the belongs-to catalog. */
export type RelationsBaseComponentsKind = Exclude<RelationWidgetKindHint, 'physical'>;

export type RelationsBaseComponentsConfig = {
  controlSize: HeroUiFieldSize;
  disabled: boolean;
  kind: RelationsBaseComponentsKind;
  widget: RelationFormWidget;
  cardinality: 'single' | 'multiple';
  limits: 'none' | 'at-least-one' | 'bounded-five';
  presentation: 'widget-default' | 'list' | 'tags' | 'cards' | 'grid' | 'repeater' | 'lookup';
  inlineMutation: readonly ('create' | 'edit' | 'reorder')[];
  state: 'default' | 'disabled';
};

const DEFAULT_CONFIG: RelationsBaseComponentsConfig = {
  controlSize: 'sm',
  disabled: false,
  kind: 'belongsTo',
  widget: 'lookup',
  cardinality: 'single',
  limits: 'none',
  presentation: 'widget-default',
  inlineMutation: [],
  state: 'default',
};

const INLINE_MUTATION_PRESETS: Array<{ label: string; value: RelationsBaseComponentsConfig['inlineMutation'] }> = [
  { label: 'none', value: [] },
  { label: 'create', value: ['create'] },
  { label: 'create and edit', value: ['create', 'edit'] },
  { label: 'create, edit, reorder', value: ['create', 'edit', 'reorder'] },
];

export const resolveRelationsConfigForKind = (
  current: RelationsBaseComponentsConfig,
  kind: RelationsBaseComponentsKind,
): RelationsBaseComponentsConfig => {
  const widgets = relationFormWidgetOptionsForKind(kind);
  return {
    ...current,
    kind,
    widget: widgets.some((widget) => widget.value === current.widget)
      ? current.widget
      : widgets[0]?.value ?? 'hidden',
  };
};

export const resolveRelationsOptionLiveness = (config: RelationsBaseComponentsConfig) => ({
  compatibleWidgets: relationFormWidgetOptionsForKind(config.kind).map((option) => option.value),
  galleryProps: {
    size: config.controlSize,
    disabled: config.disabled || config.state === 'disabled',
    kind: config.kind,
    widgets: [config.widget] as readonly RelationFormWidget[],
  },
  visibleOptions: ['kind', 'widget', 'cardinality', 'limits', 'presentation', 'inlineMutation', 'controlSize', 'state'],
  cardinality: config.cardinality,
  limits: config.limits,
  presentation: config.presentation,
  inlineMutation: config.inlineMutation,
});

const KIND_OPTIONS: Array<{
  value: RelationsBaseComponentsKind;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'belongsTo',
    label: 'Belongs to',
    description: 'Pick one existing related record (FK / physical).',
    icon: <Link2 className="h-3.5 w-3.5" aria-hidden />,
  },
  {
    value: 'hasMany',
    label: 'Has many',
    description: 'Manage an owned child collection.',
    icon: <ListTree className="h-3.5 w-3.5" aria-hidden />,
  },
  {
    value: 'belongsToMany',
    label: 'Belongs to many',
    description: 'Attach or detach existing peers via junction.',
    icon: <Share2 className="h-3.5 w-3.5" aria-hidden />,
  },
  {
    value: 'hasOne',
    label: 'Has one',
    description: 'Create or edit at most one owned nested record.',
    icon: <GitBranch className="h-3.5 w-3.5" aria-hidden />,
  },
];

export const RelationsBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<RelationsBaseComponentsConfig>(DEFAULT_CONFIG);
  const configJson = useMemo(() => JSON.stringify(config, null, 2), [config]);
  const activeKind = KIND_OPTIONS.find((option) => option.value === config.kind) ?? KIND_OPTIONS[0];
  const compatibleWidgets = relationFormWidgetOptionsForKind(config.kind);
  const activeWidget = RELATION_FORM_WIDGET_OPTIONS.find((option) => option.value === config.widget);
  const optionLiveness = resolveRelationsOptionLiveness(config);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="relations" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection
              title="Relation kind"
              tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}
            >
              <div className="flex flex-col gap-1.5" role="group" aria-label="Relation kind">
                {KIND_OPTIONS.map((option) => {
                  const selected = option.value === config.kind;
                  return (
                    <AppButton
                      key={option.value}
                      type="button"
                      intent={selected ? 'primary' : 'secondary'}
                      size="sm"
                      className="w-full justify-start"
                      aria-pressed={selected}
                      aria-label={`${option.label}. ${option.description}`}
                      onClick={() => setConfig((current) => (
                        resolveRelationsConfigForKind(current, option.value)
                      ))}
                    >
                      {option.icon}
                      {option.label}
                    </AppButton>
                  );
                })}
              </div>
            </FormSection>

            <FormSection title="Widget" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Form widget" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.widget} onChange={(event) => setConfig((current) => ({ ...current, widget: event.target.value as RelationFormWidget }))} ariaLabel="Relation form widget">
                    {compatibleWidgets.map((widget) => <option key={widget.value} value={widget.value}>{widget.label}</option>)}
                  </UiSelect>
                </FormField>
                <p className="text-[11px] text-slate-500">{activeWidget?.description}</p>
              </div>
            </FormSection>

            <FormSection title={`${activeWidget?.label ?? 'Widget'} options`} tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Control size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.controlSize}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (isHeroUiFieldSize(value)) {
                        setConfig((current) => ({ ...current, controlSize: value }));
                      }
                    }}
                    ariaLabel="Control size"
                  >
                    {HERO_UI_FIELD_SIZES.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </UiSelect>
                </FormField>

                <FormField label="Cardinality" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.cardinality} onChange={(event) => setConfig((current) => ({ ...current, cardinality: event.target.value as RelationsBaseComponentsConfig['cardinality'] }))} ariaLabel="Relation cardinality">
                    <option value="single">single</option><option value="multiple">multiple</option>
                  </UiSelect>
                </FormField>
                <FormField label="Limits" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.limits} onChange={(event) => setConfig((current) => ({ ...current, limits: event.target.value as RelationsBaseComponentsConfig['limits'] }))} ariaLabel="Relation limits">
                    <option value="none">none</option><option value="at-least-one">at least one</option><option value="bounded-five">bounded to five</option>
                  </UiSelect>
                </FormField>
                <FormField label="Presentation" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.presentation} onChange={(event) => setConfig((current) => ({ ...current, presentation: event.target.value as RelationsBaseComponentsConfig['presentation'] }))} ariaLabel="Relation presentation">
                    {['widget-default', 'list', 'tags', 'cards', 'grid', 'repeater', 'lookup'].map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <FormField label="Inline mutation" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.inlineMutation.join(',')}
                    onChange={(event) => {
                      const next = INLINE_MUTATION_PRESETS.find((preset) => preset.value.join(',') === event.target.value);
                      if (next) setConfig((current) => ({ ...current, inlineMutation: next.value }));
                    }}
                    ariaLabel="Relation inline mutation"
                  >
                    {INLINE_MUTATION_PRESETS.map((preset) => (
                      <option key={preset.label} value={preset.value.join(',')}>{preset.label}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <FormField label="Scenario" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.state}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      state: event.target.value as RelationsBaseComponentsConfig['state'],
                      disabled: event.target.value === 'disabled',
                    }))}
                    ariaLabel="Relation scenario"
                  >
                    {['default', 'disabled'].map((state) => <option key={state} value={state}>{state}</option>)}
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="relations">
          <div className={BASE_COMPONENTS_PREVIEW_SHELL_CLASS}>
            <RelationFormWidgetGallery
              {...optionLiveness.galleryProps}
              title={`${activeKind.label} · ${activeWidget?.label ?? config.widget}`}
              hint={`${activeKind.description} ${config.cardinality} · ${config.presentation} · limits ${config.limits}${config.inlineMutation.length ? ` · ${config.inlineMutation.join(', ')}` : ''}. ${config.state}.`}
            />
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
