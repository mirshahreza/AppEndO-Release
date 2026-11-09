import React, { useCallback, useId, useMemo, useState } from 'react';
import { CalendarClock, Hand, Lock, Shield, ShieldCheck, Zap } from 'lucide-react';
import {
  AiAssistFormField,
  AiPublishedFormAssistToolbar,
  AiFieldAssistSectionProvider,
  AppButton,
  CatalogSpecimenCodeBadge,
  DesignerMaskInputField,
  DirectionalText,
  FeatureToggleField,
  formatStudioBcSpecimenCode,
  FormField,
  FormSection,
  PasswordStrengthHints,
  SemVerInput,
  UiCheckboxChoiceList,
  UiCombobox,
  UiImageField,
  UiImageUploadField,
  UiInput,
  UiOptionCardGroup,
  type UiOptionCardOption,
  UiRadioChoiceList,
  UiSelect,
  UiSelectMenu,
  UiSwitch,
  UiTextarea,
  UiTreeSelect,
  UrlSegmentSlugInput,
  AI_FIELD_LABEL_EXTRA_PLACEHOLDER_CLASS,
  FORM_FIELD_LABEL_CLASS,
  resolveChoiceBoxShellClass,
  resolveFormFieldPairGridClass,
  resolveUiChoiceLabelRowClass,
  type UiTreeSelectNode,
} from '../../../shared/ui';
import type { EuaExtractedFieldValue } from '../../../shared/api/contracts/ai/euaFieldAssist';
import {
  useEuaDefaultModelId,
  useEuaFieldAssistReady,
} from '../../../shared/ui/ai-field-assist';
import { FormFieldsSemanticValidationSample } from './FormFieldsSemanticValidationSample';
import {
  getContentTextDirection,
  isRtlDominantText,
} from '../../../shared/lib/textDirection';
import { RTL_TEXT_DIRECTION_SAMPLES } from '../../../shared/lib/rtlScriptPreviewSamples';
import { cn } from '../../../lib/utils';
import { FORM_SECTION_DESC_CLASS } from '../../../shared/ui/FormSection';
import {
  HERO_UI_FIELD_SIZES,
  type HeroUiFieldSize,
  isHeroUiFieldSize,
  resolveHeroUiFieldSizeTokens,
} from '../../../shared/ui/heroFieldSize';
import type { SectionId } from '../types';
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
  BASE_COMPONENTS_PREVIEW_SHELL_CLASS,
} from '../baseComponentsConfiguratorLayout';

export type FormFieldControlSize = HeroUiFieldSize;

export type FormFieldsFieldGroup = 'text' | 'choice' | 'selection' | 'structured' | 'ai';

export const FORM_FIELDS_SECTION_ID_BY_GROUP: Record<FormFieldsFieldGroup, SectionId> = {
  text: 'text-fields',
  choice: 'choice-fields',
  selection: 'selection-fields',
  structured: 'structured-fields',
  ai: 'ai-fields',
};

export type FormFieldsOptionCardFixture = 'policy' | 'encryption' | 'delivery';
export type FormFieldsOptionCardColumns = 2 | 3;

export type FormFieldsBaseComponentsConfig = {
  group: FormFieldsFieldGroup;
  controlSize: FormFieldControlSize;
  invalid: boolean;
  requiredInvalidOnMount: boolean;
  disabled: boolean;
  required: boolean;
  feedbackPlacement: 'overlay' | 'below';
  /** Default on: set input/textarea `dir` from first meaningful character. */
  autoDir: boolean;
  showHint: boolean;
  readOnly: boolean;
  prefix: string;
  suffix: string;
  optionCardFixture: FormFieldsOptionCardFixture;
  optionCardColumns: FormFieldsOptionCardColumns;
  optionCardDensity: 'default' | 'compact';
  optionCardShowIcon: boolean;
  optionCardShowMeta: boolean;
};

const DEFAULT_CONFIG: FormFieldsBaseComponentsConfig = {
  group: 'text',
  controlSize: 'sm',
  invalid: false,
  requiredInvalidOnMount: true,
  disabled: false,
  required: true,
  feedbackPlacement: 'overlay',
  autoDir: true,
  showHint: false,
  readOnly: false,
  prefix: '$',
  suffix: 'USD',
  optionCardFixture: 'policy',
  optionCardColumns: 2,
  optionCardDensity: 'default',
  optionCardShowIcon: true,
  optionCardShowMeta: true,
};

const FIELD_GROUP_OPTIONS: Array<{
  value: FormFieldsFieldGroup;
  label: string;
  description: string;
}> = [
  { value: 'text', label: 'Text', description: 'Input, search, password, textarea, and direction-aware entry.' },
  { value: 'choice', label: 'Choice', description: 'Checkbox, radio lists, switch, and exclusive option cards.' },
  { value: 'selection', label: 'Selection', description: 'Select, combobox, autocomplete, tree select, and rich menus.' },
  { value: 'structured', label: 'Structured', description: 'Character-restricted identifiers such as semver and URL segments.' },
  { value: 'ai', label: 'AI', description: 'Field-level suggestions and section-level structured extraction.' },
];

export const applyFormFieldsBooleanOption = (
  current: FormFieldsBaseComponentsConfig,
  key: keyof FormFieldsBaseComponentsConfig,
  value: boolean,
): FormFieldsBaseComponentsConfig => ({
  ...current,
  [key]: value,
  ...(key === 'required' && !value ? { requiredInvalidOnMount: false } : {}),
});

export const resolveFormFieldsOptionLiveness = (config: FormFieldsBaseComponentsConfig) => {
  const supportsFormFieldFeedback = config.group === 'text'
    || config.group === 'selection'
    || config.group === 'structured'
    || config.group === 'ai';
  const supportsAutoDir = config.group === 'text' || config.group === 'ai';
  const supportsHint = supportsFormFieldFeedback;
  const supportsReadOnly = config.group === 'text';
  const supportsInputGroup = config.group === 'text';
  const supportsOptionCards = config.group === 'choice';
  const visibleOptions: string[] = [
    'controlSize',
    ...(supportsFormFieldFeedback ? ['feedbackPlacement', 'required', 'invalid'] : []),
    ...(supportsFormFieldFeedback && config.required ? ['requiredInvalidOnMount'] : []),
    'disabled',
    ...(supportsAutoDir ? ['autoDir'] : []),
    ...(supportsHint ? ['showHint'] : []),
    ...(supportsReadOnly ? ['readOnly'] : []),
    ...(supportsInputGroup ? ['prefix', 'suffix'] : []),
    ...(supportsOptionCards
      ? ['optionCardFixture', 'optionCardColumns', 'optionCardDensity', 'optionCardShowIcon', 'optionCardShowMeta']
      : []),
  ];

  return {
    renderGroup: config.group,
    visibleOptions,
    inputProps: {
      size: config.controlSize,
      isDisabled: config.disabled,
      isInvalid: supportsFormFieldFeedback
        && (config.invalid || (config.required && config.requiredInvalidOnMount)),
      autoDir: supportsAutoDir ? config.autoDir : false,
      readOnly: supportsReadOnly ? config.readOnly : false,
    },
    formFieldProps: {
      required: supportsFormFieldFeedback ? config.required : false,
      feedbackPlacement: config.feedbackPlacement,
      hint: supportsHint && config.showHint ? 'Use the organization display name.' : undefined,
    },
    optionCard: {
      fixture: config.optionCardFixture,
      columns: config.optionCardColumns,
      density: config.optionCardDensity,
      showIcon: config.optionCardShowIcon,
      showMeta: config.optionCardShowMeta,
    },
  };
};

const TEXT_DIRECTION_SAMPLES = RTL_TEXT_DIRECTION_SAMPLES;

type TextDirectionSampleId = (typeof TEXT_DIRECTION_SAMPLES)[number]['id'] | 'custom';

const CONTROL_SIZE_OPTIONS = HERO_UI_FIELD_SIZES;

/** Balances AiAssistFormField label rows that include the context-suggest icon. */
const AI_LABEL_EXTRA_PLACEHOLDER = (
  <span className={AI_FIELD_LABEL_EXTRA_PLACEHOLDER_CLASS} aria-hidden />
);

const previewTwoColumnClass = resolveFormFieldPairGridClass;

const BEHAVIOR_CHECKBOX_OPTIONS = [
  { id: 'notify', label: 'Send notification on save', defaultChecked: true },
  { id: 'audit', label: 'Write audit log entry', defaultChecked: true },
  { id: 'webhook', label: 'Trigger outbound webhook', defaultChecked: false },
  { id: 'cache', label: 'Invalidate edge cache', defaultChecked: false },
  { id: 'snapshot', label: 'Capture config snapshot', defaultChecked: false },
] as const;

const BEHAVIOR_RADIO_OPTIONS = [
  { value: 'prod', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'dev', label: 'Development' },
  { value: 'qa', label: 'QA baseComponents' },
  { value: 'dr', label: 'Disaster recovery' },
] as const;

const OPTION_CARD_FIXTURES: Record<FormFieldsOptionCardFixture, {
  label: string;
  ariaLabel: string;
  options: UiOptionCardOption[];
}> = {
  policy: {
    label: 'Release policy',
    ariaLabel: 'Release policy',
    options: [
      {
        value: 'standard',
        title: 'Standard',
        description: 'Submit with the form. No extra confirmation step.',
        shortDescription: 'Submit with the form.',
        icon: Shield,
        tone: 'indigo',
      },
      {
        value: 'guarded',
        title: 'Guarded',
        description: 'Require confirmation before the change is applied.',
        shortDescription: 'Require confirmation.',
        icon: ShieldCheck,
        tone: 'amber',
      },
    ],
  },
  encryption: {
    label: 'Encryption',
    ariaLabel: 'SMTP encryption',
    options: [
      {
        value: 'starttls',
        title: 'STARTTLS',
        description: 'Connect in plain text, then upgrade to TLS before authentication. Typical for port 465; also used on port 587.',
        shortDescription: 'Plain connect, then upgrade to TLS (ports 465/587).',
        meta: 'Typical port: 465',
        icon: ShieldCheck,
        tone: 'cyan',
      },
      {
        value: 'implicitTls',
        title: 'SSL/TLS (implicit)',
        description: 'TLS from the first byte (SMTPS). Use when the server expects immediate encryption — typically port 587.',
        shortDescription: 'TLS from the first byte (typically port 587).',
        meta: 'Typical port: 587',
        icon: Lock,
        tone: 'violet',
      },
    ],
  },
  delivery: {
    label: 'Delivery',
    ariaLabel: 'Delivery mode',
    options: [
      {
        value: 'immediate',
        title: 'Immediate',
        description: 'Send as soon as the job is queued.',
        shortDescription: 'Send as soon as queued.',
        icon: Zap,
        tone: 'emerald',
      },
      {
        value: 'scheduled',
        title: 'Scheduled',
        description: 'Run on the next matching cron tick.',
        shortDescription: 'Run on the next cron tick.',
        icon: CalendarClock,
        tone: 'amber',
      },
      {
        value: 'manual',
        title: 'Manual',
        description: 'Wait for an operator to start the run.',
        shortDescription: 'Wait for an operator.',
        icon: Hand,
      },
    ],
  },
};

const COMPARE_CHECKBOX_OPTIONS = [
  { id: 'notify', label: 'Send notification on save', defaultChecked: true },
  { id: 'approval', label: 'Require approval', defaultChecked: false },
  { id: 'audit', label: 'Write audit log', defaultChecked: true },
] as const;

const COMPARE_RADIO_OPTIONS = [
  { value: 'prod', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'dev', label: 'Development' },
] as const;

const ChoiceCompareColumn: React.FC<{ caption: string; children: React.ReactNode }> = ({
  caption,
  children,
}) => (
  <div className="flex min-w-0 flex-col gap-[2px]">
    <p className={FORM_FIELD_LABEL_CLASS}>{caption}</p>
    {children}
  </div>
);

type FormFieldsNativeHeroChoiceCompareProps = {
  size: FormFieldControlSize;
  disabled?: boolean;
};

/**
 * Catalog-only contrast. Product forms must use UiCheckbox / UiRadioGroup —
 * never copy the native column.
 */
const FormFieldsNativeHeroChoiceCompare: React.FC<FormFieldsNativeHeroChoiceCompareProps> = ({
  size,
  disabled,
}) => {
  const nativeRadioName = useId();
  const sizeTokens = resolveHeroUiFieldSizeTokens(size);
  const [nativeCheckedById, setNativeCheckedById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      COMPARE_CHECKBOX_OPTIONS.map((option) => [option.id, option.defaultChecked]),
    ),
  );
  const [heroCheckedById, setHeroCheckedById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      COMPARE_CHECKBOX_OPTIONS.map((option) => [option.id, option.defaultChecked]),
    ),
  );
  const [nativeRadio, setNativeRadio] = useState<string>(COMPARE_RADIO_OPTIONS[0].value);
  const [heroRadio, setHeroRadio] = useState<string>(COMPARE_RADIO_OPTIONS[0].value);

  return (
    <FormSection
      title="Native vs Hero"
      tone="slate"
      description="Browser-native checkbox and radio beside the shared Hero wrappers. Product forms use the Hero column only."
    >
      <div className={previewTwoColumnClass(true)}>
        <ChoiceCompareColumn caption="Native checkbox">
          <div
            className={resolveChoiceBoxShellClass(disabled)}
            role="group"
            data-catalog-native-choice="checkbox"
          >
            {COMPARE_CHECKBOX_OPTIONS.map((option) => (
              <label key={option.id} className={resolveUiChoiceLabelRowClass(size)}>
                <input
                  type="checkbox"
                  checked={nativeCheckedById[option.id]}
                  disabled={disabled}
                  className={cn(sizeTokens.checkboxControlClass, 'shrink-0')}
                  onChange={(event) => {
                    setNativeCheckedById((current) => ({
                      ...current,
                      [option.id]: event.target.checked,
                    }));
                  }}
                />
                {option.label}
              </label>
            ))}
          </div>
        </ChoiceCompareColumn>
        <ChoiceCompareColumn caption="Hero checkbox">
          <UiCheckboxChoiceList
            idPrefix="compare-hero-checkbox"
            size={size}
            disabled={disabled}
            options={COMPARE_CHECKBOX_OPTIONS.map((option) => ({
              id: option.id,
              label: option.label,
              checked: heroCheckedById[option.id],
              onChange: (checked) => {
                setHeroCheckedById((current) => ({
                  ...current,
                  [option.id]: checked,
                }));
              },
            }))}
          />
        </ChoiceCompareColumn>
      </div>
      <div className={previewTwoColumnClass(true)}>
        <ChoiceCompareColumn caption="Native radio">
          <div
            className={resolveChoiceBoxShellClass(disabled)}
            role="radiogroup"
            aria-label="Native deployment tier"
            data-catalog-native-choice="radio"
          >
            {COMPARE_RADIO_OPTIONS.map((option) => (
              <label key={option.value} className={resolveUiChoiceLabelRowClass(size)}>
                <input
                  type="radio"
                  name={nativeRadioName}
                  value={option.value}
                  checked={nativeRadio === option.value}
                  disabled={disabled}
                  className={cn(sizeTokens.radioControlClass, 'shrink-0')}
                  onChange={() => setNativeRadio(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </ChoiceCompareColumn>
        <ChoiceCompareColumn caption="Hero radio">
          <UiRadioChoiceList
            value={heroRadio}
            onChange={setHeroRadio}
            size={size}
            disabled={disabled}
            ariaLabel="Hero deployment tier"
            options={COMPARE_RADIO_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </ChoiceCompareColumn>
      </div>
    </FormSection>
  );
};

type FormFieldsPasswordPreviewProps = {
  size: FormFieldControlSize;
  disabled?: boolean;
  readOnly?: boolean;
};

const FormFieldsPasswordPreview: React.FC<FormFieldsPasswordPreviewProps> = ({ size, disabled, readOnly }) => {
  const [password, setPassword] = useState('Northwind-2026');
  return (
    <div className="min-w-0">
      <FormField label="Password">
        <UiInput
          size={size}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          isDisabled={disabled}
          readOnly={readOnly}
          autoDir={false}
          autoComplete="new-password"
        />
      </FormField>
      <PasswordStrengthHints password={password} />
    </div>
  );
};

type FormFieldsCheckboxPreviewProps = {
  size: FormFieldControlSize;
  disabled?: boolean;
};

const FormFieldsCheckboxPreview: React.FC<FormFieldsCheckboxPreviewProps> = ({ size, disabled }) => {
  const [checkedById, setCheckedById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      BEHAVIOR_CHECKBOX_OPTIONS.map((option) => [option.id, option.defaultChecked]),
    ),
  );

  return (
    <UiCheckboxChoiceList
      idPrefix="behavior-checkbox"
      size={size}
      disabled={disabled}
      options={BEHAVIOR_CHECKBOX_OPTIONS.map((option) => ({
        id: option.id,
        label: option.label,
        checked: checkedById[option.id],
        onChange: (checked) => {
          setCheckedById((current) => ({
            ...current,
            [option.id]: checked,
          }));
        },
      }))}
    />
  );
};

type FormFieldsRadioPreviewProps = {
  size: FormFieldControlSize;
  disabled?: boolean;
};

const FormFieldsRadioPreview: React.FC<FormFieldsRadioPreviewProps> = ({ size, disabled }) => {
  const [value, setValue] = useState<string>(BEHAVIOR_RADIO_OPTIONS[0].value);

  return (
    <UiRadioChoiceList
      value={value}
      onChange={setValue}
      size={size}
      disabled={disabled}
      ariaLabel="Deployment tier"
      options={BEHAVIOR_RADIO_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      }))}
    />
  );
};

const FormFieldsGroupExamples: React.FC<{ config: FormFieldsBaseComponentsConfig }> = ({ config }) => {
  const [switchSelected, setSwitchSelected] = useState(true);
  const optionCardFixture = OPTION_CARD_FIXTURES[config.optionCardFixture];
  const [optionCardValue, setOptionCardValue] = useState(optionCardFixture.options[0]?.value ?? 'standard');
  const [selection, setSelection] = useState('production');
  const [treeSelection, setTreeSelection] = useState('eng');
  const [multiSelection, setMultiSelection] = useState('production,staging');
  const [semanticVersion, setSemanticVersion] = useState('2.4.0');
  const [urlSegment, setUrlSegment] = useState('release-notes');
  const selectionItems = [
    { id: 'production', textValue: 'Production' },
    { id: 'staging', textValue: 'Staging' },
    { id: 'development', textValue: 'Development' },
  ];
  const treeItems: UiTreeSelectNode[] = [
    {
      id: 'org',
      label: 'Organization',
      children: [
        {
          id: 'eng',
          label: 'Engineering',
          children: [
            { id: 'eng-fe', label: 'Frontend' },
            { id: 'eng-be', label: 'Backend' },
          ],
        },
        {
          id: 'sales',
          label: 'Sales',
          children: [
            { id: 'sales-west', label: 'West' },
            { id: 'sales-east', label: 'East' },
          ],
        },
      ],
    },
    { id: 'partners', label: 'Partners' },
  ];
  const menuOptions = selectionItems.map((item) => ({
    ...item,
    content: <span className="text-xs text-slate-700">{item.textValue}</span>,
  }));

  if (config.group === 'text') {
    return (
      <FormSection title="Input recipes" tone="slate" description="Input, search, password, textarea, number, mask, and image entry.">
        <div id="text-fields" className={previewTwoColumnClass(true)}>
          <FormField label="Display name" hint={config.showHint ? 'Use the organization display name.' : undefined}>
            <UiInput size={config.controlSize} placeholder="Northwind connector" isDisabled={config.disabled} readOnly={config.readOnly} autoDir={config.autoDir} />
          </FormField>
          <FormField label="Search records">
            <UiInput size={config.controlSize} type="search" placeholder="Search by name…" isDisabled={config.disabled} readOnly={config.readOnly} autoDir={config.autoDir} />
          </FormField>
          <FormFieldsPasswordPreview size={config.controlSize} disabled={config.disabled} readOnly={config.readOnly} />
          <FormField label="Quantity">
            <UiInput size={config.controlSize} type="number" placeholder="12" isDisabled={config.disabled} readOnly={config.readOnly} autoDir={false} />
          </FormField>
          <FormField label="Amount" hint={config.showHint ? 'Prefix and suffix sit inside the same field chrome.' : undefined}>
            <UiInput
              size={config.controlSize}
              type="number"
              placeholder="48.00"
              isDisabled={config.disabled}
              readOnly={config.readOnly}
              autoDir={false}
              startContent={config.prefix || undefined}
              endContent={config.suffix || undefined}
            />
          </FormField>
          <FormField label="Phone">
            <DesignerMaskInputField size={config.controlSize} maskKind="pattern" maskPreset="phone-intl" placeholder="+1 202 555 0142" isDisabled={config.disabled} readOnly={config.readOnly} />
          </FormField>
          <FormField label="Operator notes">
            <UiTextarea size={config.controlSize} rows={2} placeholder="Add context…" isDisabled={config.disabled} readOnly={config.readOnly} autoDir={config.autoDir} />
          </FormField>
          <FormField label="Photo (compact)">
            <UiImageField size={88} disabled={config.disabled} enableAiPanel={false} openEditorOnPick={false} onChange={() => undefined} />
          </FormField>
          <FormField label="Image (rectangle)" className="sm:col-span-2">
            <UiImageUploadField shape="rectangle" disabled={config.disabled} enableAiPanel={false} onChange={() => undefined} />
          </FormField>
          <FormField label="Image (circle)" className="flex flex-col items-center sm:col-span-2">
            <UiImageUploadField shape="circle" disabled={config.disabled} enableAiPanel={false} onChange={() => undefined} />
          </FormField>
        </div>
      </FormSection>
    );
  }

  if (config.group === 'choice') {
    const optionCardOptions = optionCardFixture.options.map((option) => ({
      ...option,
      icon: config.optionCardShowIcon ? option.icon : undefined,
      meta: config.optionCardShowMeta ? option.meta : undefined,
    }));
    const selectedValue = optionCardOptions.some((option) => option.value === optionCardValue)
      ? optionCardValue
      : (optionCardOptions[0]?.value ?? '');

    return (
      <FormSection title="Lists and cards" tone="emerald" description="Short label lists use radios. Title-plus-description exclusive picks use option cards — one box per option, icon in the title, no radio dots.">
        <div id="choice-fields" className="space-y-3">
          <UiSwitch isSelected={switchSelected} isDisabled={config.disabled} onChange={setSwitchSelected} label="Publish immediately" />
          <FormFieldsCheckboxPreview size={config.controlSize} disabled={config.disabled} />
          <FormFieldsRadioPreview size={config.controlSize} disabled={config.disabled} />
          <UiOptionCardGroup
            value={selectedValue}
            onChange={setOptionCardValue}
            options={optionCardOptions}
            ariaLabel={optionCardFixture.ariaLabel}
            label={optionCardFixture.label}
            disabled={config.disabled}
            density={config.optionCardDensity}
            columns={config.optionCardColumns}
          />
        </div>
      </FormSection>
    );
  }

  if (config.group === 'selection') {
    return (
      <FormSection title="Menus and selectors" tone="cyan" description="Select-only, rich menus, constrained comboboxes, freeform autocomplete, multi-value selection, and tree node selectors.">
        <div id="selection-fields" className={previewTwoColumnClass(true)}>
          <FormField label="Typeable environment"><UiCombobox size={config.controlSize} value={selection} items={selectionItems} onChange={(event) => setSelection(event.target.value)} isDisabled={config.disabled} ariaLabel="Typeable environment" /></FormField>
          <FormField label="Type to suggest" hint="Suggestions stay closed until you type.">
            <UiCombobox
              size={config.controlSize}
              value={selection}
              items={selectionItems}
              onChange={(event) => setSelection(event.target.value)}
              isDisabled={config.disabled}
              ariaLabel="Type to suggest"
              menuTrigger="input"
            />
          </FormField>
          <FormField label="Rich result menu"><UiSelectMenu size={config.controlSize} selectedKey={selection} options={menuOptions} onSelectionChange={setSelection} isDisabled={config.disabled} ariaLabel="Rich environment menu" /></FormField>
          <FormField label="Select-only environment"><UiSelect size={config.controlSize} value={selection} onChange={(event) => setSelection(event.target.value)} isDisabled={config.disabled} ariaLabel="Select-only environment"><option value="production">Production</option><option value="staging">Staging</option></UiSelect></FormField>
          <FormField
            label="Multi-select environments"
            hint="Same Select control with multiple — comma-separated value protocol."
          >
            <UiSelect
              size={config.controlSize}
              multiple
              value={multiSelection}
              placeholder="Pick environments…"
              onChange={(event) => setMultiSelection(event.target.value)}
              isDisabled={config.disabled}
              ariaLabel="Multi-select environments"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
              <option value="preview">Preview</option>
            </UiSelect>
          </FormField>
          <FormField
            label="Tree node"
            hint="Pick any branch or leaf from a hierarchical tree."
          >
            <UiTreeSelect
              size={config.controlSize}
              value={treeSelection}
              items={treeItems}
              onChange={setTreeSelection}
              isDisabled={config.disabled}
              ariaLabel="Tree node"
              placeholder="Select a node…"
            />
          </FormField>
        </div>
      </FormSection>
    );
  }

  if (config.group === 'structured') {
    return (
      <FormSection title="Identifiers" tone="violet" description="Character-restricted identifiers keep auto direction off and validate their own grammar.">
        <div id="structured-fields" className={previewTwoColumnClass(true)}>
          <FormField label="Semantic version"><SemVerInput size={config.controlSize} value={semanticVersion} onChange={setSemanticVersion} disabled={config.disabled} /></FormField>
          <FormField label="URL segment"><UrlSegmentSlugInput size={config.controlSize} value={urlSegment} onChange={setUrlSegment} disabled={config.disabled} /></FormField>
        </div>
      </FormSection>
    );
  }

  return (
    <FormSection title="AI-assisted fields" tone="indigo" description="Field-level suggestions and section-level structured extraction use the published AI assist controls.">
      <div id="ai-fields" className="rounded-md border border-dashed border-indigo-200 bg-indigo-50/40 p-3 text-xs text-indigo-800">
        AI actions remain attached to labels and the section toolbar in the live deployment record below.
      </div>
    </FormSection>
  );
};

type FormFieldsPreviewFieldsProps = {
  size: FormFieldControlSize;
  config: FormFieldsBaseComponentsConfig;
  inputValue: string;
  onInputValueChange: (value: string) => void;
  notesValue: string;
  onNotesValueChange: (value: string) => void;
  selectValue: string;
  onSelectValueChange: (value: string) => void;
  semver: string;
  onSemverChange: (value: string) => void;
  slug: string;
  onSlugChange: (value: string) => void;
  featureEnabled: boolean;
  onFeatureEnabledChange: (value: boolean) => void;
};

const FormFieldsPreviewFields: React.FC<FormFieldsPreviewFieldsProps> = ({
  size,
  config,
  inputValue,
  onInputValueChange,
  notesValue,
  onNotesValueChange,
  selectValue,
  onSelectValueChange,
  semver,
  onSemverChange,
  slug,
  onSlugChange,
  featureEnabled,
  onFeatureEnabledChange,
}) => {
  const requiredInputInvalid = config.requiredInvalidOnMount && config.required && !inputValue.trim();
  const requiredSelectInvalid = config.requiredInvalidOnMount && config.required && !selectValue;
  const inputInvalid = config.invalid || requiredInputInvalid;
  const selectInvalid = config.invalid || requiredSelectInvalid;
  const inputError = inputInvalid ? 'Name is required.' : undefined;
  const selectError = selectInvalid ? 'Pick an environment.' : undefined;
  const textareaError = config.invalid ? 'Notes must be under 500 characters.' : undefined;

  const fieldProps = {
    required: config.required,
    feedbackPlacement: config.feedbackPlacement,
    hint: config.showHint ? 'Use the organization display name.' : undefined,
  };

  return (
    <div className="flex flex-col gap-1">
      {config.group === 'text' || config.group === 'ai' || config.group === 'selection' ? (
        <FormSection
          title="Identity"
          tone="indigo"
          description="How this deployment appears in lists and environment routing."
        >
          <div className={previewTwoColumnClass(config.group !== 'selection')}>
            {config.group !== 'selection' ? (
              <AiAssistFormField
                className="min-w-0"
                label="Display name"
                fieldKind="singleLine"
                error={inputError}
                invalid={inputInvalid}
                getValue={() => inputValue}
                onApplyValue={onInputValueChange}
                neighborFields={[
                  { label: 'Environment', value: selectValue },
                  { label: 'Notes', value: notesValue },
                ]}
                {...fieldProps}
              >
                <UiInput
                  size={size}
                  value={inputValue}
                  onChange={(e) => onInputValueChange(e.target.value)}
                  isDisabled={config.disabled}
                  isInvalid={inputInvalid}
                  autoDir={config.autoDir}
                  readOnly={config.readOnly}
                  fieldLabel="Display name"
                  placeholder="Northwind connector"
                />
              </AiAssistFormField>
            ) : null}

            {config.group === 'selection' || config.group === 'ai' ? (
              <FormField
                label="Environment"
                labelExtra={config.group === 'ai' ? AI_LABEL_EXTRA_PLACEHOLDER : undefined}
                className="min-w-0"
                error={selectError}
                invalid={selectInvalid}
                {...fieldProps}
              >
                <UiSelect
                  size={size}
                  value={selectValue}
                  onChange={(e) => onSelectValueChange(e.target.value)}
                  isDisabled={config.disabled}
                  isInvalid={selectInvalid}
                  ariaLabel="Environment"
                >
                  <option value="">Select…</option>
                  <option value="prod">Production</option>
                  <option value="staging">Staging</option>
                </UiSelect>
              </FormField>
            ) : null}
          </div>
        </FormSection>
      ) : null}

      {config.group === 'text' || config.group === 'ai' ? (
        <FormSection
          title="Notes"
          tone="cyan"
          divided={config.group === 'ai' || config.group === 'text'}
          description="Optional operator notes — surfaced in audit trails only."
        >
          <AiAssistFormField
            label="Release notes"
            fieldKind="multiline"
            error={textareaError}
            invalid={config.invalid}
            getValue={() => notesValue}
            onApplyValue={onNotesValueChange}
            neighborFields={[
              { label: 'Display name', value: inputValue },
              { label: 'Environment', value: selectValue },
            ]}
            {...fieldProps}
          >
            <UiTextarea
              size={size}
              value={notesValue}
              onChange={(e) => onNotesValueChange(e.target.value)}
              isDisabled={config.disabled}
              isInvalid={config.invalid}
              autoDir={config.autoDir}
              fieldLabel="Release notes"
              placeholder="Primary API endpoint for order sync."
              rows={3}
            />
          </AiAssistFormField>
        </FormSection>
      ) : null}

      {config.group === 'choice' ? (
        <>
          <FormFieldsNativeHeroChoiceCompare size={size} disabled={config.disabled} />

          <FormSection
            title="Feature toggles"
            tone="slate"
            divided
            description="Checkbox beside the title; helper text starts below the control row."
          >
            <FeatureToggleField
              id="baseComponents-form-feature-enabled"
              checked={featureEnabled}
              disabled={config.disabled}
              onChange={onFeatureEnabledChange}
              title="Enable deployment sync"
              description="When enabled, outbound webhooks fire after each successful publish. Dependent fields below stay visible and disable when this is off."
            />
            <fieldset
              disabled={config.disabled || !featureEnabled}
              className={cn('m-0 border-0 p-0', !featureEnabled && 'opacity-60')}
            >
              <FormField label="Webhook URL" className="mt-2">
                <UiInput
                  size={size}
                  defaultValue="https://hooks.example.com/deployments"
                  isDisabled={config.disabled || !featureEnabled}
                  autoDir={config.autoDir}
                  ariaLabel="Webhook URL"
                />
              </FormField>
            </fieldset>
          </FormSection>

          <FormSection title="Behavior" tone="emerald" divided>
            <div className={previewTwoColumnClass(true)}>
              <FormFieldsCheckboxPreview size={size} disabled={config.disabled} />
              <FormFieldsRadioPreview size={size} disabled={config.disabled} />
            </div>
          </FormSection>
        </>
      ) : null}

      {config.group === 'structured' ? (
        <FormSection title="Identifiers" tone="violet" description="Character-restricted identifiers keep auto direction off and validate their own grammar.">
          <div className={previewTwoColumnClass(true)}>
            <FormField
              label="Version"
              className="min-w-0"
              error={config.invalid ? 'Invalid semver.' : undefined}
              invalid={config.invalid}
              {...fieldProps}
            >
              <SemVerInput
                size={size}
                value={semver}
                onChange={onSemverChange}
                disabled={config.disabled}
                isInvalid={config.invalid}
              />
            </FormField>

            <FormField
              label="URL segment"
              className="min-w-0"
              error={config.invalid ? 'Slug is taken.' : undefined}
              invalid={config.invalid}
              {...fieldProps}
            >
              <UrlSegmentSlugInput
                size={size}
                value={slug}
                onChange={onSlugChange}
                disabled={config.disabled}
                isInvalid={config.invalid}
              />
            </FormField>
          </div>
        </FormSection>
      ) : null}
    </div>
  );
};

type FormFieldsTextDirectionPreviewProps = {
  sampleId: TextDirectionSampleId;
  sampleText: string;
  customText: string;
  onSelectSample: (sampleId: Exclude<TextDirectionSampleId, 'custom'>, value: string) => void;
  onCustomTextChange: (value: string) => void;
};

const FormFieldsTextDirectionPreview: React.FC<FormFieldsTextDirectionPreviewProps> = ({
  sampleId,
  sampleText,
  customText,
  onSelectSample,
  onCustomTextChange,
}) => {
  const direction = getContentTextDirection(sampleText);

  return (
    <FormSection
      title="Display text direction"
      tone="indigo"
      divided
      description="Display text (messages, notes, feedback) uses DirectionalText / getContentTextDirection. Form inputs use autoDir on UiInput and UiTextarea — see State → Auto direction."
    >
      <div className="flex flex-col gap-2">
        <FormField label="Preset">
          <div className="flex flex-wrap gap-2">
            {TEXT_DIRECTION_SAMPLES.map((sample) => (
              <AppButton
                key={sample.id}
                type="button"
                intent={sampleId === sample.id ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => onSelectSample(sample.id, sample.value)}
              >
                {sample.label}
              </AppButton>
            ))}
            <AppButton
              type="button"
              intent={sampleId === 'custom' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => onCustomTextChange(customText)}
            >
              Custom
            </AppButton>
          </div>
        </FormField>
        <div className={previewTwoColumnClass(true)}>
          <FormField label="UiTextarea · autoDir" className="min-w-0">
            <UiTextarea
              size="sm"
              rows={1}
              className="h-[3.25rem]"
              value={customText}
              onChange={(event) => onCustomTextChange(event.target.value)}
              autoDir
              fieldLabel="Display text sample"
            />
          </FormField>
          <FormField label={`DirectionalText · read-only · ${direction}`} className="min-w-0">
            <div className="h-[3.25rem] overflow-auto rounded-[6px] border border-slate-300 bg-white px-3 py-2 shadow-sm">
              <DirectionalText
                text={sampleText}
                className="whitespace-pre-wrap text-sm text-slate-800"
              />
            </div>
          </FormField>
        </div>
      </div>
    </FormSection>
  );
};

type FormFieldsBaseComponentsPreviewProps = {
  config: FormFieldsBaseComponentsConfig;
  onControlSizeChange: (size: FormFieldControlSize) => void;
  directionSampleId: TextDirectionSampleId;
  directionSampleText: string;
  directionCustomText: string;
  onSelectDirectionSample: (sampleId: Exclude<TextDirectionSampleId, 'custom'>, value: string) => void;
  onDirectionCustomTextChange: (value: string) => void;
};

const FormFieldsBaseComponentsPreview: React.FC<FormFieldsBaseComponentsPreviewProps> = ({
  config,
  onControlSizeChange,
  directionSampleId,
  directionSampleText,
  directionCustomText,
  onSelectDirectionSample,
  onDirectionCustomTextChange,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [notesValue, setNotesValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [semver, setSemver] = useState('1.2.3');
  const [slug, setSlug] = useState('northwind-api');
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const actionsEnabled = useEuaFieldAssistReady();
  const defaultModelId = useEuaDefaultModelId();

  const extractFieldMap = useMemo(() => ([
    {
      name: 'displayName',
      label: 'Display name',
      type: 'text',
      currentValue: inputValue,
    },
    {
      name: 'environment',
      label: 'Environment',
      type: 'select',
      validationHint: 'Use prod or staging',
      currentValue: selectValue,
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      currentValue: notesValue,
    },
  ]), [inputValue, notesValue, selectValue]);

  const handleStructuredExtractApply = useCallback((updates: EuaExtractedFieldValue[]) => {
    updates.forEach(({ name, value }) => {
      if (name === 'displayName') {
        setInputValue(value);
        return;
      }
      if (name === 'environment') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'prod' || normalized.includes('production')) {
          setSelectValue('prod');
        } else if (normalized === 'staging' || normalized.includes('stage')) {
          setSelectValue('staging');
        } else {
          setSelectValue(value);
        }
        return;
      }
      if (name === 'notes') {
        setNotesValue(value);
      }
    });
  }, []);

  const fieldBlockProps = {
    size: config.controlSize,
    config,
    inputValue,
    onInputValueChange: setInputValue,
    notesValue,
    onNotesValueChange: setNotesValue,
    selectValue,
    onSelectValueChange: setSelectValue,
    semver,
    onSemverChange: setSemver,
    slug,
    onSlugChange: setSlug,
    featureEnabled,
    onFeatureEnabledChange: setFeatureEnabled,
  };

  const activeGroup = FIELD_GROUP_OPTIONS.find((option) => option.value === config.group) ?? FIELD_GROUP_OPTIONS[0];
  const sectionId = FORM_FIELDS_SECTION_ID_BY_GROUP[config.group];
  const showAiToolbar = config.group === 'text' || config.group === 'ai';
  const showTextDirection = config.group === 'text';
  const showGroupExamples = config.group !== 'structured' && config.group !== 'ai';

  return (
    <div className={BASE_COMPONENTS_PREVIEW_SHELL_CLASS}>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <UiSelect
            size="sm"
            className="w-[4.5rem]"
            value={config.controlSize}
            onChange={(event) => {
              const value = event.target.value;
              if (isHeroUiFieldSize(value)) {
                onControlSizeChange(value);
              }
            }}
            ariaLabel="Control size"
          >
            {CONTROL_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </UiSelect>
          {showAiToolbar ? (
            <AiPublishedFormAssistToolbar
              className="shrink-0"
              fields={extractFieldMap}
              sectionTitle={activeGroup.label}
              sectionDescription={activeGroup.description}
              surface="published"
              formId={`baseComponents-${sectionId}`}
              modelId={defaultModelId}
              actionsEnabled={actionsEnabled}
              onApply={handleStructuredExtractApply}
            />
          ) : null}
        </div>
        <p className={FORM_SECTION_DESC_CLASS}>
          {activeGroup.description} Supported control sizes: xs, sm (default), md, lg — sm and md are preferred for routine UI.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        {showGroupExamples ? <FormFieldsGroupExamples config={config} /> : null}
        <AiFieldAssistSectionProvider
          sectionTitle={activeGroup.label}
          sectionDescription={activeGroup.description}
          neighborFields={[
            { label: 'Display name', value: inputValue },
            { label: 'Environment', value: selectValue },
            { label: 'Notes', value: notesValue },
          ]}
        >
          <FormFieldsPreviewFields {...fieldBlockProps} />
        </AiFieldAssistSectionProvider>
        {config.group === 'ai' ? (
          <FormFieldsSemanticValidationSample size={config.controlSize} disabled={config.disabled} />
        ) : null}
        {showTextDirection ? (
          <FormFieldsTextDirectionPreview
            sampleId={directionSampleId}
            sampleText={directionSampleText}
            customText={directionCustomText}
            onSelectSample={onSelectDirectionSample}
            onCustomTextChange={onDirectionCustomTextChange}
          />
        ) : null}
      </div>
    </div>
  );
};

const FormFieldsBaseComponentsWorkspace: React.FC<{ group: FormFieldsFieldGroup }> = ({ group }) => {
  const [config, setConfig] = useState<FormFieldsBaseComponentsConfig>({ ...DEFAULT_CONFIG, group });
  const [directionSampleId, setDirectionSampleId] = useState<TextDirectionSampleId>('fa');
  const [directionCustomText, setDirectionCustomText] = useState<string>(TEXT_DIRECTION_SAMPLES[1].value);
  const sectionId = FORM_FIELDS_SECTION_ID_BY_GROUP[group];

  const activeDirectionSample = TEXT_DIRECTION_SAMPLES.find((sample) => sample.id === directionSampleId)
    ?? TEXT_DIRECTION_SAMPLES[1];
  const directionSampleText = directionSampleId === 'custom'
    ? directionCustomText
    : activeDirectionSample.value;

  const configJson = useMemo(() => JSON.stringify({
    ...config,
    textDirection: {
      sampleId: directionSampleId,
      previewText: directionSampleText,
      direction: getContentTextDirection(directionSampleText),
      isRtlDominant: isRtlDominantText(directionSampleText),
    },
  }, null, 2), [config, directionSampleId, directionSampleText]);

  const toggleField = (key: keyof FormFieldsBaseComponentsConfig, value: boolean) => {
    setConfig((current) => applyFormFieldsBooleanOption(current, key, value));
  };

  const optionLiveness = resolveFormFieldsOptionLiveness(config);
  const showOption = (optionId: string) => optionLiveness.visibleOptions.includes(optionId);

  const resetAll = () => {
    setConfig({ ...DEFAULT_CONFIG, group });
    setDirectionSampleId('fa');
    setDirectionCustomText(TEXT_DIRECTION_SAMPLES[1].value);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <CatalogSpecimenCodeBadge code={formatStudioBcSpecimenCode(sectionId, group)} />
        <BaseComponentsConfigToolbarControls sectionId={sectionId} json={configJson}>
          <BaseComponentsResetButton onClick={resetAll} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            {config.group === 'choice' ? (
              <FormSection
                title="Option cards"
                tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}
                description="Exclusive title-plus-description picks. Short label lists still use UiRadioChoiceList."
              >
                <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                  {showOption('optionCardFixture') ? (
                    <FormField label="Fixture" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiSelect
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        value={config.optionCardFixture}
                        onChange={(event) => {
                          const fixture = event.target.value as FormFieldsOptionCardFixture;
                          setConfig((current) => ({
                            ...current,
                            optionCardFixture: fixture,
                            optionCardColumns: fixture === 'delivery' ? 3 : 2,
                            optionCardShowMeta: fixture === 'encryption',
                          }));
                        }}
                        ariaLabel="Option card fixture"
                      >
                        <option value="policy">policy (2)</option>
                        <option value="encryption">encryption (2 + meta)</option>
                        <option value="delivery">delivery (3)</option>
                      </UiSelect>
                    </FormField>
                  ) : null}
                  {showOption('optionCardColumns') ? (
                    <FormField label="Columns" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiSelect
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        value={String(config.optionCardColumns)}
                        onChange={(event) => setConfig((current) => ({
                          ...current,
                          optionCardColumns: Number(event.target.value) as FormFieldsOptionCardColumns,
                        }))}
                        ariaLabel="Option card columns"
                      >
                        <option value="2">2</option>
                        <option value="3">3</option>
                      </UiSelect>
                    </FormField>
                  ) : null}
                  {showOption('optionCardDensity') ? (
                    <FormField label="Density" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiSelect
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        value={config.optionCardDensity}
                        onChange={(event) => setConfig((current) => ({
                          ...current,
                          optionCardDensity: event.target.value as FormFieldsBaseComponentsConfig['optionCardDensity'],
                        }))}
                        ariaLabel="Option card density"
                      >
                        <option value="default">default</option>
                        <option value="compact">compact</option>
                      </UiSelect>
                    </FormField>
                  ) : null}
                  {showOption('optionCardShowIcon') ? (
                    <FormField label="Title icon" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiSelect
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        value={config.optionCardShowIcon ? 'yes' : 'no'}
                        onChange={(event) => toggleField('optionCardShowIcon', event.target.value === 'yes')}
                        ariaLabel="Option card title icon"
                      >
                        <option value="yes">yes</option>
                        <option value="no">no</option>
                      </UiSelect>
                    </FormField>
                  ) : null}
                  {showOption('optionCardShowMeta') ? (
                    <FormField label="Meta line" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiSelect
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        value={config.optionCardShowMeta ? 'yes' : 'no'}
                        onChange={(event) => toggleField('optionCardShowMeta', event.target.value === 'yes')}
                        ariaLabel="Option card meta line"
                      >
                        <option value="yes">yes</option>
                        <option value="no">no</option>
                      </UiSelect>
                    </FormField>
                  ) : null}
                </div>
              </FormSection>
            ) : null}
            <FormSection title="State" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {showOption('feedbackPlacement') ? (
                  <FormField label="Feedback placement" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.feedbackPlacement}
                      onChange={(event) => setConfig((current) => ({
                        ...current,
                        feedbackPlacement: event.target.value as FormFieldsBaseComponentsConfig['feedbackPlacement'],
                      }))}
                      ariaLabel="Feedback placement"
                    >
                      <option value="overlay">overlay (auto)</option>
                      <option value="below">below</option>
                    </UiSelect>
                  </FormField>
                ) : null}

                {showOption('requiredInvalidOnMount') ? (
                  <FormField label="Required invalid on mount" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.requiredInvalidOnMount ? 'yes' : 'no'}
                      onChange={(event) => toggleField('requiredInvalidOnMount', event.target.value === 'yes')}
                      ariaLabel="Required invalid on mount"
                    >
                      <option value="no">no</option>
                      <option value="yes">yes</option>
                    </UiSelect>
                  </FormField>
                ) : null}

                {showOption('invalid') ? (
                  <FormField label="Invalid" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.invalid ? 'yes' : 'no'}
                      onChange={(event) => toggleField('invalid', event.target.value === 'yes')}
                      ariaLabel="Invalid"
                    >
                      <option value="no">no</option>
                      <option value="yes">yes</option>
                    </UiSelect>
                  </FormField>
                ) : null}

                {showOption('disabled') ? (
                  <FormField label="Disabled" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.disabled ? 'yes' : 'no'}
                      onChange={(event) => toggleField('disabled', event.target.value === 'yes')}
                      ariaLabel="Disabled"
                    >
                      <option value="no">no</option>
                      <option value="yes">yes</option>
                    </UiSelect>
                  </FormField>
                ) : null}

                {showOption('required') ? (
                  <FormField label="Required" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.required ? 'yes' : 'no'}
                      onChange={(event) => toggleField('required', event.target.value === 'yes')}
                      ariaLabel="Required"
                    >
                      <option value="no">no</option>
                      <option value="yes">yes</option>
                    </UiSelect>
                  </FormField>
                ) : null}

                {showOption('autoDir') ? (
                  <FormField
                    label="Auto direction"
                    hint="When on (default), UiInput and UiTextarea set dir from the first meaningful character — RTL scripts flip the field to rtl. Character-restricted identifiers (slugs, keys, cron, JSON) should pass autoDir={false}. For display text (messages/notes), use DirectionalText — see Display text direction in the preview."
                    className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  >
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.autoDir ? 'yes' : 'no'}
                      onChange={(event) => toggleField('autoDir', event.target.value === 'yes')}
                      ariaLabel="Auto direction"
                    >
                      <option value="no">no</option>
                      <option value="yes">yes (default)</option>
                    </UiSelect>
                  </FormField>
                ) : null}

                {showOption('showHint') ? (
                  <FormField label="Hint" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.showHint ? 'yes' : 'no'}
                      onChange={(event) => toggleField('showHint', event.target.value === 'yes')}
                      ariaLabel="Show hint"
                    >
                      <option value="no">no</option>
                      <option value="yes">yes</option>
                    </UiSelect>
                  </FormField>
                ) : null}

                {showOption('readOnly') ? (
                  <FormField label="Read only" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.readOnly ? 'yes' : 'no'}
                      onChange={(event) => toggleField('readOnly', event.target.value === 'yes')}
                      ariaLabel="Read only"
                    >
                      <option value="no">no</option>
                      <option value="yes">yes</option>
                    </UiSelect>
                  </FormField>
                ) : null}

                {showOption('prefix') ? (
                  <FormField label="Prefix" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiInput
                      size="sm"
                      value={config.prefix}
                      onChange={(event) => setConfig((current) => ({ ...current, prefix: event.target.value }))}
                      ariaLabel="Input prefix"
                    />
                  </FormField>
                ) : null}

                {showOption('suffix') ? (
                  <FormField label="Suffix" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiInput
                      size="sm"
                      value={config.suffix}
                      onChange={(event) => setConfig((current) => ({ ...current, suffix: event.target.value }))}
                      ariaLabel="Input suffix"
                    />
                  </FormField>
                ) : null}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId={sectionId}>
          <FormFieldsBaseComponentsPreview
            config={config}
            directionSampleId={directionSampleId}
            directionSampleText={directionSampleText}
            directionCustomText={directionCustomText}
            onSelectDirectionSample={(sampleId, value) => {
              setDirectionSampleId(sampleId);
              setDirectionCustomText(value);
            }}
            onDirectionCustomTextChange={(value) => {
              setDirectionSampleId('custom');
              setDirectionCustomText(value);
            }}
            onControlSizeChange={(controlSize) => setConfig((current) => ({ ...current, controlSize }))}
          />
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};

export const TextFieldsBaseComponentsWorkspace: React.FC = () => (
  <FormFieldsBaseComponentsWorkspace group="text" />
);

export const ChoiceFieldsBaseComponentsWorkspace: React.FC = () => (
  <FormFieldsBaseComponentsWorkspace group="choice" />
);

export const SelectionFieldsBaseComponentsWorkspace: React.FC = () => (
  <FormFieldsBaseComponentsWorkspace group="selection" />
);

export const StructuredFieldsBaseComponentsWorkspace: React.FC = () => (
  <FormFieldsBaseComponentsWorkspace group="structured" />
);

export const AiFieldsBaseComponentsWorkspace: React.FC = () => (
  <FormFieldsBaseComponentsWorkspace group="ai" />
);
