import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ClipboardCheck,
  Database,
  Sparkles,
  Wand2,
  Save,
} from 'lucide-react';
import {
  AppButton,
  FormField,
  FormSection,
  StepWizardShell,
  type StepWizardStepDef,
  type StepWizardTabColorPreset,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
import type {
  AppSurfaceBoxTone,
  CreateEditModalSize,
  DialogBackdropBlur,
  DialogBackdropTint,
  DialogBackdropTransparency,
} from '../../../shared/ui/surfaceClasses';
import { COLOR_PICKER_DEFAULT_HEX } from '../../../shared/ui/surfaceClasses';
import { cn } from '../../../lib/utils';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import { BaseComponentsPreviewFrame, BASE_COMPONENTS_WORKSPACE_INSET_CLASS } from '../components/BaseComponentsWorkspacePanel';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsBackdropFields } from '../components/BaseComponentsBackdropFields';
import {
  BaseComponentsOverlayHeaderFields,
  renderBaseComponentsOverlayHeaderActions,
} from '../components/BaseComponentsOverlayHeaderFields';
import {
  BASE_COMPONENTS_SURFACE_CHROME_DEFAULT,
  BaseComponentsSurfaceChromeSection,
  type BaseComponentsSurfaceChromeConfig,
} from '../components/BaseComponentsSurfaceChromeFields';
import {
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_CONFIG_SUBSECTION_CLASS,
  BASE_COMPONENTS_CONFIG_SUBSECTION_DIVIDER_CLASS,
  BASE_COMPONENTS_CONFIG_SUBSECTION_LABEL_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';

type BodyMode = 'plain' | 'scroll';

type StepConfig = {
  title: string;
  hasIcon: boolean;
  hasDescription: boolean;
  tone: AppSurfaceBoxTone | 'none';
  disabled: boolean;
};

export type WizardBaseComponentsConfig = BaseComponentsSurfaceChromeConfig & {
  size: CreateEditModalSize;
  title: string;
  subtitle: string;
  showTitleIcon: boolean;
  steps: StepConfig[];
  bodyMode: BodyMode;
  showDescriptionBand: boolean;
  showFinalAction: boolean;
  blockAdvanceOnFirstStep: boolean;
  orientation: 'horizontal' | 'vertical';
  marker: 'number' | 'icon';
  stepTabColorMode: StepWizardTabColorPreset | 'custom';
  stepTabSelectedHex: string;
  stepTabUnselectedHex: string;
  navigation: 'linear' | 'nonlinear';
  clickableSteps: boolean;
  validationSummary: boolean;
  saveDraft: boolean;
  state: 'default' | 'blocked' | 'invalid' | 'saving' | 'complete';
  viewport: 'desktop' | 'tablet' | 'phone';
  showCloseButton: boolean;
  headerActionCount: number;
  backdropTint: DialogBackdropTint;
  backdropBlur: DialogBackdropBlur;
  backdropTransparency: DialogBackdropTransparency;
};

const SIZE_OPTIONS: CreateEditModalSize[] = [
  '3xl',
  '4xl',
  '5xl',
  'maximized',
  'full',
];

const TONE_OPTIONS: (AppSurfaceBoxTone | 'none')[] = [
  'none',
  'indigo',
  'cyan',
  'emerald',
  'amber',
  'violet',
  'rose',
];

const STEP_ICON_OPTIONS = [Database, Sparkles, ClipboardCheck, Check] as const;

const DEFAULT_STEP: StepConfig = {
  title: 'Step',
  hasIcon: true,
  hasDescription: true,
  tone: 'none',
  disabled: false,
};

export const DEFAULT_WIZARD_BASE_COMPONENTS_CONFIG: WizardBaseComponentsConfig = {
  ...BASE_COMPONENTS_SURFACE_CHROME_DEFAULT,
  size: '5xl',
  title: 'Wizard preview',
  subtitle: 'Multi-step flow with step indicators and description band',
  showTitleIcon: true,
  steps: [
    { ...DEFAULT_STEP, title: 'Basics', tone: 'indigo' },
    { ...DEFAULT_STEP, title: 'Details', tone: 'cyan' },
    { ...DEFAULT_STEP, title: 'Review', tone: 'emerald' },
  ],
  bodyMode: 'plain',
  showDescriptionBand: true,
  showFinalAction: true,
  blockAdvanceOnFirstStep: false,
  orientation: 'horizontal',
  marker: 'icon',
  stepTabColorMode: 'theme',
  stepTabSelectedHex: COLOR_PICKER_DEFAULT_HEX,
  stepTabUnselectedHex: '#94A3B8',
  navigation: 'linear',
  clickableSteps: false,
  validationSummary: true,
  saveDraft: false,
  state: 'default',
  viewport: 'desktop',
  showCloseButton: true,
  headerActionCount: 0,
  backdropTint: 'faint',
  backdropBlur: 'default',
  backdropTransparency: 'opaque',
};

function buildStepDefs(steps: StepConfig[]): StepWizardStepDef[] {
  return steps.map((step, index) => ({
    title: step.title,
    icon: step.hasIcon ? STEP_ICON_OPTIONS[index % STEP_ICON_OPTIONS.length] : undefined,
    description: step.hasDescription
      ? `Description for ${step.title} — configure fields and review before continuing.`
      : undefined,
    tone: step.tone === 'none' ? undefined : step.tone,
    disabled: step.disabled,
  }));
}

export function resolveEnabledWizardStep(steps: readonly StepWizardStepDef[], requestedStep: number): number {
  if (!steps[requestedStep]?.disabled) return requestedStep;
  const nextEnabled = steps.findIndex((definition) => !definition.disabled);
  return nextEnabled >= 0 ? nextEnabled : 0;
}

export function resolveWizardPreviewProps(
  config: WizardBaseComponentsConfig,
  step: number,
  stepCount: number,
) {
  return {
    orientation: config.orientation,
    marker: config.marker,
    stepTabColor: config.stepTabColorMode === 'custom'
      ? { selected: config.stepTabSelectedHex, unselected: config.stepTabUnselectedHex }
      : config.stepTabColorMode,
    shellClassName: cn(
      config.viewport === 'tablet' && '!w-[min(760px,calc(100vw-32px))]',
      config.viewport === 'phone' && '!h-[calc(100dvh-24px)] !w-[min(390px,calc(100vw-24px))]',
    ) || undefined,
    canMoveNext: config.state !== 'saving' && step < stepCount - 1,
    finalActionDisabled: config.state === 'saving',
    showValidationSummary: config.validationSummary && config.state === 'invalid',
    showBlockedState: config.state === 'blocked',
    showSavingState: config.state === 'saving',
    showCompleteState: config.state === 'complete',
    showCloseButton: config.showCloseButton,
    headerActionCount: config.headerActionCount,
    backdropTint: config.backdropTint,
    backdropBlur: config.backdropBlur,
    backdropTransparency: config.backdropTransparency,
  };
}

export const WizardBaseComponentsPreview: React.FC<{
  config: WizardBaseComponentsConfig;
  open: boolean;
  onClose: () => void;
}> = ({ config, open, onClose }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStep(0);
  }, [open]);

  const stepDefs = useMemo(() => buildStepDefs(config.steps).map((definition) => ({
    ...definition,
    icon: config.marker === 'icon' ? definition.icon : undefined,
  })), [config.marker, config.steps]);

  useEffect(() => {
    if (!stepDefs[step]?.disabled) return;
    setStep(resolveEnabledWizardStep(stepDefs, step));
  }, [step, stepDefs]);

  const activeStep = stepDefs[step];
  const previewProps = resolveWizardPreviewProps(config, step, stepDefs.length);
  const resolvedDescription = config.showDescriptionBand
    ? (activeStep?.description ?? '')
    : '';

  return (
    <StepWizardShell
      title={config.title}
      subtitle={config.subtitle || undefined}
      titleIcon={config.showTitleIcon ? Wand2 : undefined}
      colorSource={config.colorSource}
      tone={config.tone}
      customColorHex={config.customColorHex}
      steps={stepDefs}
      step={step}
      onStepChange={setStep}
      onClose={onClose}
      onBackdropClick={onClose}
      size={config.size}
      orientation={previewProps.orientation}
      marker={previewProps.marker}
      stepTabColor={previewProps.stepTabColor}
      shellClassName={previewProps.shellClassName}
      stepDescription={resolvedDescription || undefined}
      canActivateStep={(index) => config.navigation === 'nonlinear' && config.clickableSteps && !stepDefs[index]?.disabled}
      footerExtra={config.saveDraft ? (
        <AppButton intent="secondary" size="sm" disabled={config.state === 'saving'}>
          <Save className="h-3.5 w-3.5" />
          {config.state === 'saving' ? 'Saving draft…' : 'Save draft'}
        </AppButton>
      ) : undefined}
      finalStepAction={
        config.showFinalAction
          ? {
              label: 'Finish',
              icon: <Check className="h-3.5 w-3.5" />,
              onClick: onClose,
              disabled: previewProps.finalActionDisabled,
            }
          : undefined
      }
      onNext={() => {
        if ((config.blockAdvanceOnFirstStep || config.state === 'blocked' || config.state === 'invalid') && step === 0) {
          return false;
        }
        return true;
      }}
      canMoveNext={previewProps.canMoveNext}
      contained
      showCloseButton={previewProps.showCloseButton}
      headerExtra={renderBaseComponentsOverlayHeaderActions(previewProps.headerActionCount)}
      backdropTint={previewProps.backdropTint}
      backdropBlur={previewProps.backdropBlur}
      backdropTransparency={previewProps.backdropTransparency}
    >
      {previewProps.showValidationSummary ? (
        <div className="mb-3 border-s-2 border-rose-400 ps-3 text-xs text-rose-700" role="alert">
          Complete the required fields before moving to the next step.
        </div>
      ) : null}
      {previewProps.showBlockedState ? (
        <p className="mb-3 border-s-2 border-amber-400 ps-3 text-xs text-amber-800" role="status">Step 1 is blocked until its prerequisite is complete.</p>
      ) : null}
      {previewProps.showSavingState ? (
        <p className="mb-3 text-xs font-medium text-cyan-700" role="status">Saving wizard progress…</p>
      ) : null}
      {previewProps.showCompleteState ? (
        <p className="mb-3 text-sm font-semibold text-emerald-700" role="status">All steps are complete and ready to submit.</p>
      ) : null}
      {config.bodyMode === 'scroll' ? (
        <div className="space-y-2">
          {Array.from({ length: 24 }, (_, index) => (
            <p key={index} className="text-xs text-slate-600">
              Scrollable wizard body line {index + 1} — only the body region scrolls while headers and footers stay fixed.
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-700">
          Step body uses the flat white inner host. Group fields with <code className="text-xs">FormSection</code> — not nested panel boxes.
        </p>
      )}
    </StepWizardShell>
  );
};

export const WizardBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<WizardBaseComponentsConfig>(DEFAULT_WIZARD_BASE_COMPONENTS_CONFIG);

  const configJson = useMemo(() => JSON.stringify({
    public: {
      orientation: config.orientation,
      marker: config.marker,
      navigationMode: config.navigation,
      allowStepSelection: config.clickableSteps,
      size: config.size,
      title: config.title,
      subtitle: config.subtitle,
      titleIcon: config.showTitleIcon,
      backdropTint: config.backdropTint,
      backdropBlur: config.backdropBlur,
      backdropTransparency: config.backdropTransparency,
      showCloseButton: config.showCloseButton,
      headerActionCount: config.headerActionCount,
    },
    composition: {
      showDescriptions: config.showDescriptionBand,
      validationSummary: config.validationSummary,
      saveDraftAction: config.saveDraft,
      finalAction: config.showFinalAction,
      bodyMode: config.bodyMode,
      blockAdvanceOnFirstStep: config.blockAdvanceOnFirstStep,
    },
    demo: { fixtures: { steps: config.steps }, scenarios: { state: config.state, viewport: config.viewport } },
  }, null, 2), [config]);

  const setStepCount = (count: number) => {
    setConfig((current) => {
      const steps = [...current.steps];
      while (steps.length < count) {
        steps.push({
          ...DEFAULT_STEP,
          title: `Step ${steps.length + 1}`,
        });
      }
      return { ...current, steps: steps.slice(0, count) };
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="wizard" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_WIZARD_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Shell" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Orientation" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.orientation}
                    onChange={(event) => setConfig((current) => ({ ...current, orientation: event.target.value as WizardBaseComponentsConfig['orientation'] }))}
                    ariaLabel="Wizard orientation">
                    <option value="horizontal">horizontal</option><option value="vertical">vertical</option>
                  </UiSelect>
                </FormField>
                <FormField label="Size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.size}
                    onChange={(event) => {
                      const value = event.target.value as CreateEditModalSize;
                      if (SIZE_OPTIONS.includes(value)) {
                        setConfig((current) => ({ ...current, size: value }));
                      }
                    }}
                    ariaLabel="Wizard size"
                  >
                    {SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <BaseComponentsBackdropFields
                  tint={config.backdropTint}
                  blur={config.backdropBlur}
                  transparency={config.backdropTransparency}
                  onTintChange={(backdropTint) => setConfig((current) => ({ ...current, backdropTint }))}
                  onBlurChange={(backdropBlur) => setConfig((current) => ({ ...current, backdropBlur }))}
                  onTransparencyChange={(backdropTransparency) => setConfig((current) => ({ ...current, backdropTransparency }))}
                />
              </div>
            </FormSection>

            <BaseComponentsSurfaceChromeSection
              config={config}
              onChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
            />

            <FormSection title="Header" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Title" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                    value={config.title}
                    onChange={(event) => setConfig((current) => ({ ...current, title: event.target.value }))}
                  />
                </FormField>

                <FormField label="Subtitle" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                    value={config.subtitle}
                    onChange={(event) => setConfig((current) => ({ ...current, subtitle: event.target.value }))}
                  />
                </FormField>

                <FormField label="Title icon" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showTitleIcon ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showTitleIcon: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Show title icon"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField>
                <BaseComponentsOverlayHeaderFields
                  showCloseButton={config.showCloseButton}
                  headerActionCount={config.headerActionCount}
                  onShowCloseButtonChange={(showCloseButton) => setConfig((current) => ({ ...current, showCloseButton }))}
                  onHeaderActionCountChange={(headerActionCount) => setConfig((current) => ({ ...current, headerActionCount }))}
                />
              </div>
            </FormSection>

            <FormSection title="Steps" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_SECTION_STACK_CLASS}>
                <FormField label="Step count (2–5)" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={String(config.steps.length)}
                    onChange={(event) => setStepCount(Number(event.target.value))}
                    ariaLabel="Step count"
                  >
                    {[2, 3, 4, 5].map((count) => (
                      <option key={count} value={String(count)}>{count}</option>
                    ))}
                  </UiSelect>
                </FormField>

                {config.steps.map((step, index) => (
                  <div
                    key={index}
                    className={cn(
                      BASE_COMPONENTS_CONFIG_SUBSECTION_CLASS,
                      index > 0 && BASE_COMPONENTS_CONFIG_SUBSECTION_DIVIDER_CLASS,
                    )}
                  >
                    <p className={BASE_COMPONENTS_CONFIG_SUBSECTION_LABEL_CLASS}>Step {index + 1}</p>
                    <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                      <FormField label="Title" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                        <UiInput
                          size="sm"
                          className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                          value={step.title}
                          onChange={(event) => {
                            setConfig((current) => {
                              const steps = [...current.steps];
                              steps[index] = { ...steps[index], title: event.target.value };
                              return { ...current, steps };
                            });
                          }}
                        />
                      </FormField>
                      <FormField label="Step icon" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                        <UiSelect
                          size="sm"
                          className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                          value={step.hasIcon ? 'yes' : 'no'}
                          onChange={(event) => {
                            setConfig((current) => {
                              const steps = [...current.steps];
                              steps[index] = {
                                ...steps[index],
                                hasIcon: event.target.value === 'yes',
                              };
                              return { ...current, steps };
                            });
                          }}
                          ariaLabel={`Step ${index + 1} icon`}
                        >
                          <option value="yes">show</option>
                          <option value="no">hide</option>
                        </UiSelect>
                      </FormField>
                      <FormField label="Description" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                        <UiSelect
                          size="sm"
                          className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                          value={step.hasDescription ? 'yes' : 'no'}
                          onChange={(event) => {
                            setConfig((current) => {
                              const steps = [...current.steps];
                              steps[index] = {
                                ...steps[index],
                                hasDescription: event.target.value === 'yes',
                              };
                              return { ...current, steps };
                            });
                          }}
                          ariaLabel={`Step ${index + 1} description`}
                        >
                          <option value="yes">show</option>
                          <option value="no">hide</option>
                        </UiSelect>
                      </FormField>
                      <FormField label="Active tone" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                        <UiSelect
                          size="sm"
                          className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                          value={step.tone}
                          onChange={(event) => {
                            const tone = event.target.value as AppSurfaceBoxTone | 'none';
                            if (TONE_OPTIONS.includes(tone)) {
                              setConfig((current) => {
                                const steps = [...current.steps];
                                steps[index] = { ...steps[index], tone };
                                return { ...current, steps };
                              });
                            }
                          }}
                          ariaLabel={`Step ${index + 1} tone`}
                        >
                          {TONE_OPTIONS.map((tone) => (
                            <option key={tone} value={tone}>{tone}</option>
                          ))}
                        </UiSelect>
                      </FormField>
                      <FormField label="Disabled" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                        <UiSelect
                          size="sm"
                          className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                          value={step.disabled ? 'yes' : 'no'}
                          onChange={(event) => {
                            setConfig((current) => {
                              const steps = [...current.steps];
                              steps[index] = {
                                ...steps[index],
                                disabled: event.target.value === 'yes',
                              };
                              return { ...current, steps };
                            });
                          }}
                          ariaLabel={`Step ${index + 1} disabled`}
                        >
                          <option value="no">no</option>
                          <option value="yes">yes</option>
                        </UiSelect>
                      </FormField>
                    </div>
                  </div>
                ))}
              </div>
            </FormSection>

            <FormSection title="Body &amp; navigation" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Marker" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.marker}
                    onChange={(event) => setConfig((current) => ({ ...current, marker: event.target.value as WizardBaseComponentsConfig['marker'] }))}
                    ariaLabel="Wizard marker">
                    <option value="number">number</option><option value="icon">icon</option>
                  </UiSelect>
                </FormField>
                <FormField label="Step tabs" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.stepTabColorMode}
                    onChange={(event) => {
                      const stepTabColorMode = event.target.value as WizardBaseComponentsConfig['stepTabColorMode'];
                      if (stepTabColorMode === 'gray' || stepTabColorMode === 'theme' || stepTabColorMode === 'custom') {
                        setConfig((current) => ({ ...current, stepTabColorMode }));
                      }
                    }}
                    ariaLabel="Wizard step tab color"
                  >
                    <option value="gray">gray</option>
                    <option value="theme">theme</option>
                    <option value="custom">custom pair</option>
                  </UiSelect>
                </FormField>
                {config.stepTabColorMode === 'custom' ? (
                  <>
                    <FormField label="Selected tab" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.stepTabSelectedHex}
                          onChange={(event) => {
                            setConfig((current) => ({
                              ...current,
                              stepTabSelectedHex: event.target.value.toUpperCase(),
                            }));
                          }}
                          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                          aria-label="Selected step tab color"
                        />
                        <UiInput
                          size="sm"
                          autoDir={false}
                          className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                          value={config.stepTabSelectedHex}
                          onChange={(event) => {
                            setConfig((current) => ({ ...current, stepTabSelectedHex: event.target.value }));
                          }}
                          ariaLabel="Selected step tab hex"
                        />
                      </div>
                    </FormField>
                    <FormField label="Unselected tab" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.stepTabUnselectedHex}
                          onChange={(event) => {
                            setConfig((current) => ({
                              ...current,
                              stepTabUnselectedHex: event.target.value.toUpperCase(),
                            }));
                          }}
                          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                          aria-label="Unselected step tab color"
                        />
                        <UiInput
                          size="sm"
                          autoDir={false}
                          className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                          value={config.stepTabUnselectedHex}
                          onChange={(event) => {
                            setConfig((current) => ({ ...current, stepTabUnselectedHex: event.target.value }));
                          }}
                          ariaLabel="Unselected step tab hex"
                        />
                      </div>
                    </FormField>
                  </>
                ) : null}
                <FormField label="Navigation" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.navigation}
                    onChange={(event) => setConfig((current) => ({ ...current, navigation: event.target.value as WizardBaseComponentsConfig['navigation'] }))}
                    ariaLabel="Wizard navigation">
                    <option value="linear">linear</option><option value="nonlinear">nonlinear</option>
                  </UiSelect>
                </FormField>
                {config.navigation === 'nonlinear' ? <FormField label="Clickable steps" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.clickableSteps ? 'yes' : 'no'}
                    onChange={(event) => setConfig((current) => ({ ...current, clickableSteps: event.target.value === 'yes' }))}
                    ariaLabel="Wizard clickable steps">
                    <option value="no">disabled</option><option value="yes">enabled</option>
                  </UiSelect>
                </FormField> : null}
                <FormField label="State" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.state}
                    onChange={(event) => setConfig((current) => ({ ...current, state: event.target.value as WizardBaseComponentsConfig['state'] }))}
                    ariaLabel="Wizard state">
                    {(['default', 'blocked', 'invalid', 'saving', 'complete'] as const).map((state) => <option key={state} value={state}>{state}</option>)}
                  </UiSelect>
                </FormField>
                <FormField label="Viewport" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.viewport}
                    onChange={(event) => setConfig((current) => ({ ...current, viewport: event.target.value as WizardBaseComponentsConfig['viewport'] }))}
                    ariaLabel="Wizard viewport">
                    <option value="desktop">desktop</option><option value="tablet">tablet</option><option value="phone">phone compact</option>
                  </UiSelect>
                </FormField>
                <FormField label="Save draft" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.saveDraft ? 'yes' : 'no'}
                    onChange={(event) => setConfig((current) => ({ ...current, saveDraft: event.target.value === 'yes' }))}
                    ariaLabel="Wizard save draft">
                    <option value="no">hide</option><option value="yes">show</option>
                  </UiSelect>
                </FormField>
                <FormField label="Body mode" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.bodyMode}
                    onChange={(event) => {
                      const mode = event.target.value as BodyMode;
                      if (mode === 'plain' || mode === 'scroll') {
                        setConfig((current) => ({ ...current, bodyMode: mode }));
                      }
                    }}
                    ariaLabel="Body mode"
                  >
                    <option value="plain">plain</option>
                    <option value="scroll">long scroll</option>
                  </UiSelect>
                </FormField>

                <FormField label="Description band" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showDescriptionBand ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showDescriptionBand: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Description band"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField>

                <FormField label="Final step action" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showFinalAction ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showFinalAction: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Final step action"
                  >
                    <option value="yes">Finish button</option>
                    <option value="no">Next only</option>
                  </UiSelect>
                </FormField>

                <FormField label="Block advance on step 1" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.blockAdvanceOnFirstStep ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        blockAdvanceOnFirstStep: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Block advance on first step"
                  >
                    <option value="no">no</option>
                    <option value="yes">yes</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="wizard" fill>
          <WizardBaseComponentsPreview config={config} open onClose={() => undefined} />
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
