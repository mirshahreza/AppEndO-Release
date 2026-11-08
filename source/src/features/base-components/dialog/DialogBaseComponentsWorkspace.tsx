import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  Trash2,
} from 'lucide-react';
import {
  AppButton,
  AppDialogShell,
  DialogBand,
  DialogBody,
  DialogFooter,
  DialogPrimaryHeader,
  FeatureToggleField,
  FormField,
  FormSection,
  UiInput,
  UiRadioChoiceGroup,
  UiSelect,
} from '../../../shared/ui';
import type { CreateEditModalSize, DialogBandTone, DialogBackdropBlur, DialogBackdropTint, DialogBackdropTransparency } from '../../../shared/ui/surfaceClasses';
import { cn } from '../../../lib/utils';
import type { DialogBackdropProfile } from '../../../shared/ui/dialog';
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
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_CONFIG_SUBSECTION_CLASS,
  BASE_COMPONENTS_CONFIG_SUBSECTION_DIVIDER_CLASS,
  BASE_COMPONENTS_CONFIG_SUBSECTION_LABEL_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';

type BodyMode = 'plain' | 'validation' | 'scroll';
type FooterMode = 'none' | 'auxiliary' | 'action' | 'both';
type ActionPreset = 'cancel-save' | 'cancel-delete' | 'wizard';
type BandContentMode = 'text' | 'radio' | 'enabled';
type DialogPreset = 'informational' | 'transactional' | 'danger' | 'acknowledgment' | 'progress';
type DialogState = 'default' | 'loading' | 'error';

type BandConfig = {
  tone: DialogBandTone;
  content: BandContentMode;
};

export type DialogBaseComponentsConfig = BaseComponentsSurfaceChromeConfig & {
  backdrop: DialogBackdropProfile;
  backdropTint: DialogBackdropTint;
  backdropBlur: DialogBackdropBlur;
  backdropTransparency: DialogBackdropTransparency;
  size: CreateEditModalSize;
  title: string;
  headerActionCount: number;
  showCloseButton: boolean;
  bands: BandConfig[];
  bodyMode: BodyMode;
  footerMode: FooterMode;
  actionPreset: ActionPreset;
  preset: DialogPreset;
  state: DialogState;
  dismissPolicy: 'escape,outside' | 'escape' | 'close-button' | 'locked';
  focusPolicy: 'safe-defaults' | 'primary-action' | 'first-field';
};

const SIZE_OPTIONS: CreateEditModalSize[] = [
  'auto',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  'maximized',
  'full',
];

const TONE_OPTIONS: DialogBandTone[] = ['muted', 'elevated', 'shell'];

const BACKDROP_OPTIONS: { value: DialogBackdropProfile; label: string }[] = [
  { value: 'admin', label: 'admin' },
  { value: 'designer', label: 'designer' },
];

export const DEFAULT_DIALOG_BASE_COMPONENTS_CONFIG: DialogBaseComponentsConfig = {
  ...BASE_COMPONENTS_SURFACE_CHROME_DEFAULT,
  backdrop: 'admin',
  backdropTint: 'medium',
  backdropBlur: 'default',
  backdropTransparency: 'opaque',
  size: '3xl',
  title: 'Dialog preview',
  headerActionCount: 1,
  showCloseButton: true,
  bands: [
    { tone: 'elevated', content: 'radio' },
    { tone: 'muted', content: 'text' },
  ],
  bodyMode: 'plain',
  footerMode: 'both',
  actionPreset: 'cancel-save',
  preset: 'informational',
  state: 'default',
  dismissPolicy: 'escape,outside',
  focusPolicy: 'safe-defaults',
};

export function resolveDialogPreset(
  current: DialogBaseComponentsConfig,
  preset: DialogPreset,
): DialogBaseComponentsConfig {
  if (preset === 'danger') return { ...current, preset, title: 'Delete this record?', bodyMode: 'validation', footerMode: 'action', actionPreset: 'cancel-delete', state: 'default' };
  if (preset === 'transactional') return { ...current, preset, title: 'Edit record', bodyMode: 'plain', footerMode: 'both', actionPreset: 'cancel-save', state: 'default' };
  if (preset === 'acknowledgment') return { ...current, preset, title: 'Acknowledge notice', bodyMode: 'plain', footerMode: 'action', actionPreset: 'cancel-save', state: 'default' };
  if (preset === 'progress') return { ...current, preset, title: 'Operation in progress', footerMode: 'auxiliary', state: 'loading', dismissPolicy: 'locked', showCloseButton: false };
  return { ...current, preset, title: 'Dialog preview', bodyMode: 'plain', footerMode: 'auxiliary', state: 'default', dismissPolicy: 'escape,outside', showCloseButton: true };
}

export function resolveDialogPreviewProps(config: DialogBaseComponentsConfig) {
  return {
    backdrop: config.backdrop,
    backdropTint: config.backdropTint,
    backdropBlur: config.backdropBlur,
    backdropTransparency: config.backdropTransparency,
    size: config.size,
    closeOnBackdrop: config.dismissPolicy.includes('outside'),
    closeOnEscape: config.dismissPolicy.includes('escape'),
    showCloseButton: config.showCloseButton,
    headerActionCount: config.headerActionCount,
    headerTone: config.preset === 'danger' ? 'danger' as const : 'default' as const,
    focusTarget: config.focusPolicy,
  };
}

const EnabledBandDemo: React.FC = () => {
  const [enabled, setEnabled] = useState(true);

  return (
    <FeatureToggleField
      id="dialog-baseComponents-enabled"
      checked={enabled}
      onChange={setEnabled}
      title="Enabled"
      description="Operator must opt in before editing fields."
    />
  );
};

const RadioBandDemo: React.FC<{ index: number }> = ({ index }) => {
  const [value, setValue] = useState('allow-all');

  return (
    <UiRadioChoiceGroup
      name={`band-radio-${index}`}
      value={value}
      onChange={setValue}
      orientation="horizontal"
      className="flex flex-wrap gap-4"
      ariaLabel={`Band ${index + 1} access mode`}
      options={[
        { value: 'allow-all', label: 'Allow all' },
        { value: 'restricted', label: 'Restricted' },
      ]}
    />
  );
};

function renderBandContent(mode: BandContentMode, index: number) {
  if (mode === 'enabled') {
    return <EnabledBandDemo key={index} />;
  }

  if (mode === 'radio') {
    return <RadioBandDemo key={index} index={index} />;
  }

  return (
    <p className="text-xs text-slate-600">
      Secondary band {index + 1} — variable height metadata or controls.
    </p>
  );
}

function renderActionFooter(preset: ActionPreset, focusPolicy: DialogBaseComponentsConfig['focusPolicy']) {
  if (preset === 'cancel-delete') {
    return (
      <>
        <AppButton intent="cancel" size="sm" autoFocus={focusPolicy === 'safe-defaults'}>
          <X className="h-3.5 w-3.5" />
          Cancel
        </AppButton>
        <AppButton intent="destructive" size="sm" autoFocus={focusPolicy === 'primary-action'}>
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </AppButton>
      </>
    );
  }

  if (preset === 'wizard') {
    return (
      <>
        <AppButton intent="cancel" size="sm" autoFocus={focusPolicy === 'safe-defaults'}>
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </AppButton>
        <span className="text-xs font-medium text-slate-500">Step 2 / 4</span>
        <AppButton intent="secondary" size="sm" autoFocus={focusPolicy === 'primary-action'}>
          <ChevronRight className="h-3.5 w-3.5" />
          Next
        </AppButton>
      </>
    );
  }

  return (
    <>
      <AppButton intent="cancel" size="sm" autoFocus={focusPolicy === 'safe-defaults'}>
        <X className="h-3.5 w-3.5" />
        Cancel
      </AppButton>
      <AppButton intent="primary" size="sm" autoFocus={focusPolicy === 'primary-action'}>
        <Save className="h-3.5 w-3.5" />
        Save
      </AppButton>
    </>
  );
}

export const DialogBaseComponentsPreview: React.FC<{
  config: DialogBaseComponentsConfig;
  open: boolean;
  onClose: () => void;
}> = ({ config, open, onClose }) => {
  const previewProps = resolveDialogPreviewProps(config);
  const designerSurfaceClassName =
    config.size === 'maximized' || config.size === 'full'
      ? undefined
      : 'max-w-[calc(100vw-32px)]';

  return (
    <AppDialogShell
      open={open}
      backdrop={previewProps.backdrop}
      backdropTint={previewProps.backdrop === 'admin' ? previewProps.backdropTint : undefined}
      backdropBlur={previewProps.backdrop === 'admin' ? previewProps.backdropBlur : undefined}
      backdropTransparency={previewProps.backdrop === 'admin' ? previewProps.backdropTransparency : undefined}
      size={previewProps.size}
      onClose={onClose}
      onBackdropClick={previewProps.closeOnBackdrop ? onClose : undefined}
      closeOnBackdrop={previewProps.closeOnBackdrop}
      closeOnEscape={previewProps.closeOnEscape}
      colorSource={config.colorSource}
      tone={config.tone}
      customColorHex={config.customColorHex}
      designerSurfaceClassName={designerSurfaceClassName}
      ariaLabel={config.title}
      contained
    >
      <DialogPrimaryHeader
        title={config.title}
        onClose={onClose}
        showCloseButton={previewProps.showCloseButton}
        tone={previewProps.headerTone}
        headerExtra={renderBaseComponentsOverlayHeaderActions(config.headerActionCount)}
      />
      {config.bands.map((band, index) => (
        <DialogBand key={`${band.tone}-${index}`} tone={band.tone}>
          {renderBandContent(band.content, index)}
        </DialogBand>
      ))}
      <DialogBody gradient={false}>
        {config.state === 'loading' ? (
          <div className="py-8 text-center text-sm text-cyan-700" aria-busy="true">Loading dialog content…</div>
        ) : config.state === 'error' ? (
          <div className="mb-3 border-s-2 border-rose-400 ps-3 text-sm text-rose-700" role="alert">Dialog content could not be loaded.</div>
        ) : null}
        {config.focusPolicy === 'first-field' && config.state === 'default' ? (
          <FormField label="Focusable preview field" className="mb-3">
            <UiInput size="sm" autoFocus defaultValue="Ready for input" />
          </FormField>
        ) : null}
        {config.bodyMode === 'validation' ? (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            Validation failed — fix the highlighted fields before saving.
          </div>
        ) : null}
        {config.bodyMode === 'scroll' ? (
          <div className="space-y-2">
            {Array.from({ length: 24 }, (_, index) => (
              <p key={index} className="text-xs text-slate-600">
                Scrollable body line {index + 1} — only the body region scrolls while headers and footers stay fixed.
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-700">
          Body inner host stays pure white. Chrome tint applies to shell border, header, bands, and footers only.
          </p>
        )}
      </DialogBody>
      {config.footerMode === 'auxiliary' || config.footerMode === 'both' ? (
        <DialogFooter variant="auxiliary">
          <span className="text-xs text-slate-500">Auxiliary footer — hints or navigation</span>
          <span className="text-xs font-semibold text-amber-700">Draft</span>
        </DialogFooter>
      ) : null}
      {config.footerMode === 'action' || config.footerMode === 'both' ? (
        <DialogFooter
          variant="action"
          stacked={config.footerMode === 'both'}
          className={config.actionPreset === 'wizard' ? 'justify-between' : undefined}
        >
          {renderActionFooter(config.actionPreset, config.focusPolicy)}
        </DialogFooter>
      ) : null}
    </AppDialogShell>
  );
};

export const DialogBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<DialogBaseComponentsConfig>(DEFAULT_DIALOG_BASE_COMPONENTS_CONFIG);

  const configJson = useMemo(() => JSON.stringify({
    public: {
      size: config.size,
      bodyMode: config.bodyMode === 'scroll' ? 'scroll' : 'auto',
      backdrop: config.backdrop,
      backdropTint: config.backdropTint,
      backdropBlur: config.backdropBlur,
      backdropTransparency: config.backdropTransparency,
      showCloseButton: config.showCloseButton,
      headerActionCount: config.headerActionCount,
      dismissPolicy: config.dismissPolicy === 'locked' ? [] : config.dismissPolicy.split(','),
      state: config.state,
    },
    composition: {
      preset: config.preset,
      header: { title: config.title, actionCount: config.headerActionCount },
      bands: config.bands,
      footer: config.footerMode,
      actionPreset: config.footerMode === 'action' || config.footerMode === 'both' ? config.actionPreset : undefined,
      focusPolicy: config.focusPolicy,
    },
    demo: { fixtures: {}, scenarios: { state: config.state } },
  }, null, 2), [config]);

  const setBandCount = (count: number) => {
    setConfig((current) => {
      const bands = [...current.bands];
      while (bands.length < count) {
        bands.push({ tone: TONE_OPTIONS[bands.length % TONE_OPTIONS.length], content: 'text' });
      }
      return { ...current, bands: bands.slice(0, count) };
    });
  };

  const applyPreset = (preset: DialogPreset) => {
    setConfig((current) => resolveDialogPreset(current, preset));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="dialog" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_DIALOG_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Shell" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Preset" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.preset}
                    onChange={(event) => applyPreset(event.target.value as DialogPreset)}
                    ariaLabel="Dialog preset">
                    {(['informational', 'transactional', 'danger', 'acknowledgment', 'progress'] as const).map((preset) => <option key={preset} value={preset}>{preset}</option>)}
                  </UiSelect>
                </FormField>
                <FormField label="Kind" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.backdrop}
                    onChange={(event) => {
                      const value = event.target.value as DialogBackdropProfile;
                      if (BACKDROP_OPTIONS.some((option) => option.value === value)) {
                        setConfig((current) => ({ ...current, backdrop: value }));
                      }
                    }}
                    ariaLabel="Backdrop kind"
                  >
                    {BACKDROP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </UiSelect>
                </FormField>
                {config.backdrop === 'admin' ? (
                  <BaseComponentsBackdropFields
                    tint={config.backdropTint}
                    blur={config.backdropBlur}
                    transparency={config.backdropTransparency}
                    onTintChange={(backdropTint) => setConfig((current) => ({ ...current, backdropTint }))}
                    onBlurChange={(backdropBlur) => setConfig((current) => ({ ...current, backdropBlur }))}
                    onTransparencyChange={(backdropTransparency) => setConfig((current) => ({ ...current, backdropTransparency }))}
                  />
                ) : null}

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
                    ariaLabel="Dialog size"
                  >
                    {SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </UiSelect>
                </FormField>

                <FormField label="Title" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.title}
                    onChange={(event) => setConfig((current) => ({ ...current, title: event.target.value }))}
                  />
                </FormField>
                <BaseComponentsOverlayHeaderFields
                  showCloseButton={config.showCloseButton}
                  headerActionCount={config.headerActionCount}
                  onShowCloseButtonChange={(showCloseButton) => setConfig((current) => ({ ...current, showCloseButton }))}
                  onHeaderActionCountChange={(headerActionCount) => setConfig((current) => ({ ...current, headerActionCount }))}
                />
                <FormField label="Dismiss policy" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.dismissPolicy}
                    onChange={(event) => setConfig((current) => ({ ...current, dismissPolicy: event.target.value as DialogBaseComponentsConfig['dismissPolicy'] }))}
                    ariaLabel="Dialog dismiss policy">
                    <option value="escape,outside">Escape + outside</option><option value="escape">Escape only</option>
                    <option value="close-button">Close button only</option><option value="locked">locked progress</option>
                  </UiSelect>
                </FormField>
                <FormField label="State" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.state}
                    onChange={(event) => setConfig((current) => ({ ...current, state: event.target.value as DialogState }))}
                    ariaLabel="Dialog state">
                    <option value="default">default</option><option value="loading">loading</option><option value="error">error</option>
                  </UiSelect>
                </FormField>
                <FormField label="Initial focus" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.focusPolicy}
                    onChange={(event) => setConfig((current) => ({ ...current, focusPolicy: event.target.value as DialogBaseComponentsConfig['focusPolicy'] }))}
                    ariaLabel="Dialog focus policy">
                    <option value="safe-defaults">safe default</option><option value="primary-action">primary action</option>
                    <option value="first-field">first field</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>

            <BaseComponentsSurfaceChromeSection
              config={config}
              onChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
            />

            <FormSection title="Bands" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_SECTION_STACK_CLASS}>
                <FormField label="Band count (0–3)" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={String(config.bands.length)}
                    onChange={(event) => setBandCount(Number(event.target.value))}
                    ariaLabel="Band count"
                  >
                    {[0, 1, 2, 3].map((count) => (
                      <option key={count} value={String(count)}>{count}</option>
                    ))}
                  </UiSelect>
                </FormField>

                {config.bands.map((band, index) => (
                  <div
                    key={index}
                    className={cn(
                      BASE_COMPONENTS_CONFIG_SUBSECTION_CLASS,
                      index > 0 && BASE_COMPONENTS_CONFIG_SUBSECTION_DIVIDER_CLASS,
                    )}
                  >
                    <p className={BASE_COMPONENTS_CONFIG_SUBSECTION_LABEL_CLASS}>Band {index + 1}</p>
                    <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                      <FormField label="Tone" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                        <UiSelect
                          size="sm"
                          className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                          value={band.tone}
                          onChange={(event) => {
                            const tone = event.target.value as DialogBandTone;
                            if (TONE_OPTIONS.includes(tone)) {
                              setConfig((current) => {
                                const bands = [...current.bands];
                                bands[index] = { ...bands[index], tone };
                                return { ...current, bands };
                              });
                            }
                          }}
                          ariaLabel={`Band ${index + 1} tone`}
                        >
                          {TONE_OPTIONS.map((tone) => (
                            <option key={tone} value={tone}>{tone}</option>
                          ))}
                        </UiSelect>
                      </FormField>
                      <FormField label="Sample content" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                        <UiSelect
                          size="sm"
                          className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                          value={band.content}
                          onChange={(event) => {
                            const content = event.target.value as BandContentMode;
                            if (content === 'text' || content === 'radio' || content === 'enabled') {
                              setConfig((current) => {
                                const bands = [...current.bands];
                                bands[index] = { ...bands[index], content };
                                return { ...current, bands };
                              });
                            }
                          }}
                          ariaLabel={`Band ${index + 1} content`}
                        >
                          <option value="text">text</option>
                          <option value="radio">radio row</option>
                          <option value="enabled">enabled band</option>
                        </UiSelect>
                      </FormField>
                    </div>
                  </div>
                ))}
              </div>
            </FormSection>

            <FormSection title="Body &amp; footer" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Body mode" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.bodyMode}
                    onChange={(event) => {
                      const mode = event.target.value as BodyMode;
                      if (mode === 'plain' || mode === 'validation' || mode === 'scroll') {
                        setConfig((current) => ({ ...current, bodyMode: mode }));
                      }
                    }}
                    ariaLabel="Body mode"
                  >
                    <option value="plain">plain</option>
                    <option value="validation">validation banner</option>
                    <option value="scroll">long scroll</option>
                  </UiSelect>
                </FormField>

                <FormField label="Footer mode" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.footerMode}
                      onChange={(event) => {
                        const mode = event.target.value as FooterMode;
                        if (mode === 'none' || mode === 'auxiliary' || mode === 'action' || mode === 'both') {
                          setConfig((current) => ({ ...current, footerMode: mode }));
                        }
                      }}
                      ariaLabel="Footer mode"
                    >
                      <option value="none">none</option>
                      <option value="auxiliary">auxiliary only</option>
                      <option value="action">action only</option>
                      <option value="both">both</option>
                    </UiSelect>
                  </FormField>

                  {(config.footerMode === 'action' || config.footerMode === 'both') ? (
                    <FormField label="Action preset" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiSelect
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        value={config.actionPreset}
                        onChange={(event) => {
                          const preset = event.target.value as ActionPreset;
                          if (preset === 'cancel-save' || preset === 'cancel-delete' || preset === 'wizard') {
                            setConfig((current) => ({ ...current, actionPreset: preset }));
                          }
                        }}
                        ariaLabel="Action footer preset"
                      >
                        <option value="cancel-save">Cancel + Save</option>
                        <option value="cancel-delete">Cancel + Delete</option>
                        <option value="wizard">Wizard navigation</option>
                      </UiSelect>
                    </FormField>
                  ) : null}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="dialog" fill>
          <DialogBaseComponentsPreview config={config} open onClose={() => undefined} />
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
