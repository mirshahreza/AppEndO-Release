import * as React from 'react';
import { BadgeCheck, Bell, CircleAlert, MoreHorizontal, Rocket, Shield, Timer } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  PAGE_HEADER_ICON_SLOT_CLASS,
  PAGE_HEADER_ICON_TITLE_CLUSTER_CLASS,
  UiAccordion,
  UiSelect,
  UI_ACCORDION_OPEN_HEADER_TONES,
  type UiAccordionChrome,
  type UiAccordionItemGap,
  type UiAccordionOpenHeaderTone,
} from '../../../shared/ui';
import { UiDisclosure } from '../../../shared/ui/UiDisclosure';
import { BaseComponentsConfigToolbarControls, BaseComponentsResetButton } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import { BaseComponentsPreviewFrame, BASE_COMPONENTS_WORKSPACE_INSET_CLASS } from '../components/BaseComponentsWorkspacePanel';
import {
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';

export type AccordionDisclosureBaseComponentsConfig = {
  pattern: 'accordion' | 'disclosure';
  expansion: 'single' | 'multiple' | 'persistent-one';
  collapsible: boolean;
  presentation: 'bordered' | 'separated';
  chrome: UiAccordionChrome;
  itemGap: UiAccordionItemGap;
  openHeaderTone: UiAccordionOpenHeaderTone;
  density: 'compact' | 'default';
  headingIcon: 'none' | 'leading';
  headingContent: 'title' | 'title-status' | 'title-actions';
  state: 'default' | 'disabled' | 'invalid-inside';
};

export const DEFAULT_ACCORDION_DISCLOSURE_BASE_COMPONENTS_CONFIG: AccordionDisclosureBaseComponentsConfig = {
  pattern: 'accordion',
  expansion: 'single',
  collapsible: true,
  presentation: 'separated',
  chrome: 'border-shadow',
  itemGap: 'sm',
  openHeaderTone: 'none',
  density: 'default',
  headingIcon: 'none',
  headingContent: 'title-status',
  state: 'default',
};

export function applyAccordionDisclosureOption<K extends keyof AccordionDisclosureBaseComponentsConfig>(
  config: AccordionDisclosureBaseComponentsConfig,
  field: K,
  value: AccordionDisclosureBaseComponentsConfig[K],
): AccordionDisclosureBaseComponentsConfig {
  const next: AccordionDisclosureBaseComponentsConfig = {
    ...config,
    [field]: value,
    ...(field === 'expansion' && value === 'persistent-one' ? { collapsible: false } : {}),
  };
  if (field === 'presentation') {
    const presentation = value as AccordionDisclosureBaseComponentsConfig['presentation'];
    return {
      ...next,
      chrome: presentation === 'separated' ? 'border-shadow' : 'border',
      itemGap: presentation === 'separated' ? 'sm' : 'none',
    };
  }
  return next;
}

export function resolveAccordionDisclosurePreviewModel(config: AccordionDisclosureBaseComponentsConfig) {
  const accordion = config.pattern === 'accordion';
  return {
    root: 'accordion-disclosure',
    component: accordion ? 'UiAccordion' : 'UiDisclosure',
    disabled: config.state === 'disabled',
    invalidInside: config.state === 'invalid-inside',
    variant: config.presentation,
    chrome: config.chrome,
    itemGap: accordion ? config.itemGap : null,
    openHeaderTone: config.openHeaderTone,
    density: config.density,
    headingIcon: config.headingIcon,
    headingContent: config.headingContent,
    expansion: accordion ? config.expansion : null,
    collapsible: accordion && config.expansion !== 'persistent-one' && config.collapsible,
    controls: {
      expansion: accordion,
      collapsible: accordion && config.expansion !== 'persistent-one',
      itemGap: accordion,
    },
  };
}

const ACCORDION_ITEM_ICONS = [
  { Icon: Rocket, toneClass: 'text-cyan-600' },
  { Icon: Shield, toneClass: 'text-indigo-600' },
  { Icon: Bell, toneClass: 'text-amber-600' },
] as const;

const HeadingIcon: React.FC<{ icon: (typeof ACCORDION_ITEM_ICONS)[number] }> = ({ icon }) => {
  const Icon = icon.Icon;
  return (
    <span className={cn(PAGE_HEADER_ICON_SLOT_CLASS, icon.toneClass)} aria-hidden>
      <Icon />
    </span>
  );
};

const Heading: React.FC<{ title: string; config: AccordionDisclosureBaseComponentsConfig; iconIndex: number }> = ({ title, config, iconIndex }) => (
  <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-slate-800">
    <span className={PAGE_HEADER_ICON_TITLE_CLUSTER_CLASS}>
      {config.headingIcon === 'leading' ? <HeadingIcon icon={ACCORDION_ITEM_ICONS[iconIndex] ?? ACCORDION_ITEM_ICONS[0]} /> : null}
      <span className="truncate">{title}</span>
    </span>
    {config.headingContent === 'title-status' ? (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <BadgeCheck className="h-3.5 w-3.5" /> Ready
      </span>
    ) : null}
    {config.headingContent === 'title-actions' ? <span className="ms-auto inline-flex items-center gap-1 text-xs font-medium text-slate-500"><MoreHorizontal className="h-4 w-4" /> Actions</span> : null}
  </span>
);

const ConfigSelect = <K extends keyof AccordionDisclosureBaseComponentsConfig>({
  label,
  field,
  value,
  options,
  onChange,
}: {
  label: string;
  field: K;
  value: AccordionDisclosureBaseComponentsConfig[K];
  options: readonly string[];
  onChange: (field: K, value: AccordionDisclosureBaseComponentsConfig[K]) => void;
}) => (
  <FormField label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
    <UiSelect
      size="sm"
      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
      value={String(value)}
      onChange={(event) => onChange(field, event.target.value as AccordionDisclosureBaseComponentsConfig[K])}
      ariaLabel={label}
    >
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </UiSelect>
  </FormField>
);

export const AccordionDisclosureBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = React.useState(DEFAULT_ACCORDION_DISCLOSURE_BASE_COMPONENTS_CONFIG);
  const previewModel = resolveAccordionDisclosurePreviewModel(config);
  const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(new Set(['deployment']));
  const [disclosureExpanded, setDisclosureExpanded] = React.useState(true);
  const update = <K extends keyof AccordionDisclosureBaseComponentsConfig>(field: K, value: AccordionDisclosureBaseComponentsConfig[K]) => {
    setConfig((current) => applyAccordionDisclosureOption(current, field, value));
  };
  const json = React.useMemo(() => JSON.stringify({
    public: {
      selectionMode: config.expansion,
      isCollapsible: config.collapsible,
      variant: config.presentation,
      chrome: config.chrome,
      itemGap: config.itemGap,
      openHeaderTone: config.openHeaderTone,
      density: config.density,
    },
    composition: { headingPreset: config.headingContent, headingIcon: config.headingIcon },
    demo: { pattern: config.pattern, fixture: 'deployment-checklist', state: config.state },
  }, null, 2), [config]);

  const handleAccordionChange = (keys: Set<string>) => {
    setExpandedKeys(keys);
  };

  const accordionItems = ['deployment', 'access', 'notifications'].map((id, index) => ({
    id,
    heading: <Heading title={['Deployment settings', 'Access policy', 'Notifications'][index]} config={config} iconIndex={index} />,
    panel: (
      <div className={cn('text-sm text-slate-600', config.state === 'invalid-inside' && index === 0 && 'text-rose-700')}>
        {config.state === 'invalid-inside' && index === 0
          ? <span className="inline-flex items-center gap-1"><CircleAlert className="h-4 w-4" /> Deployment region is required.</span>
          : 'Review and configure the settings for this area.'}
      </div>
    ),
    disabled: previewModel.disabled,
    triggerClassName: config.density === 'compact' ? 'px-3 py-2' : 'px-4 py-3',
    panelClassName: config.density === 'compact' ? 'px-3 pb-2' : 'px-4 pb-3',
  }));

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="accordion-disclosure" json={json}>
          <BaseComponentsResetButton onClick={() => { setConfig(DEFAULT_ACCORDION_DISCLOSURE_BASE_COMPONENTS_CONFIG); setExpandedKeys(new Set(['deployment'])); setDisclosureExpanded(true); }} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Pattern" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <ConfigSelect label="Pattern" field="pattern" value={config.pattern} options={['accordion', 'disclosure']} onChange={update} />
                {config.pattern === 'accordion' ? <ConfigSelect label="Expansion" field="expansion" value={config.expansion} options={['single', 'multiple', 'persistent-one']} onChange={(field, value) => {
                  update(field, value);
                }} /> : null}
                {config.pattern === 'accordion' && config.expansion !== 'persistent-one' ? <FormField label="Collapsible" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.collapsible ? 'true' : 'false'}
                    onChange={(event) => update('collapsible', event.target.value === 'true')}
                    ariaLabel="Collapsible"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </UiSelect>
                </FormField> : null}
                <ConfigSelect label="Presentation" field="presentation" value={config.presentation} options={['bordered', 'separated']} onChange={update} />
                <ConfigSelect label="Shadow / border" field="chrome" value={config.chrome} options={['none', 'border', 'shadow', 'border-shadow']} onChange={update} />
                {config.pattern === 'accordion' ? <ConfigSelect label="Item gap" field="itemGap" value={config.itemGap} options={['none', 'sm', 'md', 'lg']} onChange={update} /> : null}
                <ConfigSelect label="Open header" field="openHeaderTone" value={config.openHeaderTone} options={UI_ACCORDION_OPEN_HEADER_TONES} onChange={update} />
                <ConfigSelect label="Density" field="density" value={config.density} options={['compact', 'default']} onChange={update} />
                <ConfigSelect label="Heading icon" field="headingIcon" value={config.headingIcon} options={['none', 'leading']} onChange={update} />
                <ConfigSelect label="Heading content" field="headingContent" value={config.headingContent} options={['title', 'title-status', 'title-actions']} onChange={update} />
                <ConfigSelect label="State" field="state" value={config.state} options={['default', 'disabled', 'invalid-inside']} onChange={update} />
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="accordion-disclosure">
          <div data-bc-preview-root="accordion-disclosure" className={BASE_COMPONENTS_PREVIEW_BODY_CLASS}>
            <div className="max-w-2xl">
              <h2 className="mb-1 text-base font-bold text-slate-900">
                {config.pattern === 'accordion' ? 'Release readiness' : 'Advanced delivery settings'}
              </h2>
              <p className="mb-3 text-xs text-slate-500">
                {config.pattern === 'accordion' ? 'Coordinated sections share expansion policy.' : 'This region expands independently of every sibling.'}
              </p>
              {config.pattern === 'accordion' ? (
                <UiAccordion
                  items={accordionItems}
                  expandedKeys={expandedKeys}
                  onExpandedChange={handleAccordionChange}
                  expansion={config.expansion}
                  collapsible={config.collapsible}
                  chrome={config.chrome}
                  itemGap={config.itemGap}
                  openHeaderTone={config.openHeaderTone}
                  variant="light"
                />
              ) : (
                <UiDisclosure
                  trigger={config.headingIcon === 'leading' ? (
                    <span className={PAGE_HEADER_ICON_TITLE_CLUSTER_CLASS}>
                      <span className={cn(PAGE_HEADER_ICON_SLOT_CLASS, 'text-cyan-600')} aria-hidden>
                        <Timer />
                      </span>
                      <span>Retry and timeout policy</span>
                    </span>
                  ) : 'Retry and timeout policy'}
                  summary="Applies to outbound deployment requests"
                  isExpanded={disclosureExpanded}
                  onExpandedChange={setDisclosureExpanded}
                  isDisabled={previewModel.disabled}
                  variant={config.presentation}
                  chrome={config.chrome}
                  openHeaderTone={config.openHeaderTone}
                  density={config.density}
                >
                  Retry failed requests up to three times with exponential backoff.
                </UiDisclosure>
              )}
            </div>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
