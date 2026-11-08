import React, { useMemo, useState } from 'react';
import {
  X,
  Save,
} from 'lucide-react';
import {
  AppButton,
  CreateEditModalShell,
  FeatureToggleField,
  FormField,
  FormSection,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
import type { CreateEditModalSize, DialogBackdropBlur, DialogBackdropTint, DialogBackdropTransparency } from '../../../shared/ui/surfaceClasses';
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
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';

const SIZE_OPTIONS: CreateEditModalSize[] = [
  'auto', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', 'maximized', 'full',
];

export type CreateEditBaseComponentsConfig = BaseComponentsSurfaceChromeConfig & {
  size: CreateEditModalSize;
  title: string;
  showSubtitle: boolean;
  showCloseButton: boolean;
  headerActionCount: number;
  showAuxiliaryFooter: boolean;
  showIntermediateFooter: boolean;
  showActionFooter: boolean;
  enabledGatedForm: boolean;
  enabled: boolean;
  mode: 'create' | 'edit';
  composition: 'single' | 'sectioned' | 'two-column' | 'editor-rail';
  accessBand: boolean;
  validationSummary: boolean;
  dirtyGuard: boolean;
  state: 'default' | 'invalid' | 'saving' | 'save-error' | 'dirty';
  backdropTint: DialogBackdropTint;
  backdropBlur: DialogBackdropBlur;
  backdropTransparency: DialogBackdropTransparency;
};

export const DEFAULT_CREATE_EDIT_BASE_COMPONENTS_CONFIG: CreateEditBaseComponentsConfig = {
  ...BASE_COMPONENTS_SURFACE_CHROME_DEFAULT,
  size: '3xl',
  title: 'Edit record',
  showSubtitle: true,
  showCloseButton: true,
  headerActionCount: 1,
  showAuxiliaryFooter: false,
  showIntermediateFooter: false,
  showActionFooter: true,
  enabledGatedForm: true,
  enabled: true,
  mode: 'edit',
  composition: 'sectioned',
  accessBand: false,
  validationSummary: true,
  dirtyGuard: true,
  state: 'default',
  backdropTint: 'medium',
  backdropBlur: 'default',
  backdropTransparency: 'opaque',
};

export function resolveCreateEditPreviewModel(
  config: CreateEditBaseComponentsConfig,
  enabled: boolean,
) {
  return {
    shell: {
      title: config.title,
      size: config.size,
      showSubtitle: config.showSubtitle,
      showCloseButton: config.showCloseButton,
      headerActionCount: config.headerActionCount,
      showAuxiliaryFooter: config.showAuxiliaryFooter,
      showIntermediateFooter: config.showIntermediateFooter,
      showActionFooter: config.showActionFooter,
      backdropTint: config.backdropTint,
      backdropBlur: config.backdropBlur,
      backdropTransparency: config.backdropTransparency,
    },
    composition: {
      twoColumn: config.composition === 'two-column',
      sectioned: config.composition === 'sectioned',
      editorRail: config.composition === 'editor-rail',
    },
    fieldDisabled: config.enabledGatedForm && !enabled,
    showValidationSummary: config.validationSummary && config.state === 'invalid',
    showSaveError: config.state === 'save-error',
    showDirtyState: config.dirtyGuard && config.state === 'dirty',
    closeRequiresConfirmation: config.dirtyGuard && config.state === 'dirty',
    primaryLabel: config.state === 'saving'
      ? 'Saving…'
      : config.mode === 'create'
        ? 'Create'
        : 'Save',
    primaryDisabled: config.state === 'saving',
  };
}

type CreateEditBaseComponentsPreviewProps = {
  config: CreateEditBaseComponentsConfig;
  open: boolean;
  onClose: () => void;
};

const CreateEditBaseComponentsPreview: React.FC<CreateEditBaseComponentsPreviewProps> = ({
  config,
  open,
  onClose,
}) => {
  const [enabled, setEnabled] = useState(config.enabled);
  const [showDirtyPrompt, setShowDirtyPrompt] = useState(false);

  React.useEffect(() => {
    if (open) {
      setEnabled(config.enabled);
      setShowDirtyPrompt(false);
    }
  }, [open, config.enabled]);

  if (!open) {
    return null;
  }
  const previewModel = resolveCreateEditPreviewModel(config, enabled);

  const requestClose = () => {
    if (previewModel.closeRequiresConfirmation) {
      setShowDirtyPrompt(true);
      return;
    }
    onClose();
  };

  const fields = (
    <div className={cn(
      BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
      previewModel.composition.twoColumn && 'grid grid-cols-2 gap-3',
    )}>
      <FormField label="Display name">
        <UiInput size="sm" defaultValue="Northwind connector" isInvalid={config.state === 'invalid'} errorMessage="Display name is required." />
      </FormField>
      <FormField label="Environment">
        <UiSelect size="sm" defaultValue="prod" ariaLabel="Environment">
          <option value="prod">Production</option>
          <option value="staging">Staging</option>
        </UiSelect>
      </FormField>
      {previewModel.composition.sectioned ? (
        <FormSection title="Connection" tone="cyan" divided className="col-span-full">
          <p className="text-xs text-slate-600">Sectioned forms separate related settings with flat semantic headings.</p>
        </FormSection>
      ) : null}
    </div>
  );

  const bodyContent = (
    <>
      {config.accessBand ? (
        <div className="-mx-[15px] -mt-[15px] border-b border-amber-200 bg-amber-50/70 px-[15px] py-2 text-xs text-amber-800">
          Access: workspace administrators can edit this record.
        </div>
      ) : null}
      {previewModel.showValidationSummary ? (
        <div className="mb-3 border-s-2 border-rose-400 ps-3 text-xs text-rose-700" role="alert">
          Fix 2 validation errors before saving.
        </div>
      ) : null}
      {previewModel.showSaveError ? (
        <div className="mb-3 border-s-2 border-rose-400 ps-3 text-xs text-rose-700" role="alert">
          Save failed. Review the connection and try again.
        </div>
      ) : null}
      {previewModel.showDirtyState ? (
        <div className="mb-3 border-s-2 border-amber-400 ps-3 text-xs text-amber-800" role="status">
          Unsaved changes will require Save, Discard, or Cancel before closing.
        </div>
      ) : null}
      {showDirtyPrompt ? (
        <div className="mb-3 border-s-2 border-amber-400 bg-amber-50/60 px-3 py-2" role="alertdialog" aria-label="Unsaved changes">
          <p className="text-xs font-semibold text-amber-900">Discard unsaved changes?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <AppButton intent="cancel" size="sm" onClick={() => setShowDirtyPrompt(false)}>
              <X className="h-3.5 w-3.5" />Keep editing
            </AppButton>
            <AppButton intent="destructive-soft" size="sm" onClick={onClose}>
              <X className="h-3.5 w-3.5" />Discard
            </AppButton>
          </div>
        </div>
      ) : null}
      {config.enabledGatedForm ? (
        <div className="-mx-[15px] -mt-[15px] border-b border-slate-200 bg-slate-50/80 px-[15px] py-3">
          <FeatureToggleField
            id="create-edit-baseComponents-enabled"
            checked={enabled}
            onChange={setEnabled}
            title="Enabled"
            description="When enabled, the fields below are editable. When disabled, they stay visible but cannot be changed."
          />
        </div>
      ) : null}
      <div className={cn(previewModel.composition.editorRail && 'grid grid-cols-[minmax(0,1fr)_180px] gap-4')}>
        <fieldset disabled={previewModel.fieldDisabled} className={cn('m-0 border-0 p-0', previewModel.fieldDisabled && 'opacity-60')}>
          {fields}
        </fieldset>
        {previewModel.composition.editorRail ? (
          <aside className="border-s border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">Record summary</p>
            <p className="mt-2">Environment: Production</p>
            <p>Mode: {config.mode}</p>
          </aside>
        ) : null}
      </div>
    </>
  );

  return (
    <CreateEditModalShell
      title={previewModel.shell.title}
      size={previewModel.shell.size}
      onClose={requestClose}
      showCloseButton={previewModel.shell.showCloseButton}
      colorSource={config.colorSource}
      tone={config.tone}
      customColorHex={config.customColorHex}
      gradient={false}
      subtitle={previewModel.shell.showSubtitle ? 'Last updated 2026-07-02 · v1.4.2' : undefined}
      headerExtra={renderBaseComponentsOverlayHeaderActions(previewModel.shell.headerActionCount)}
      auxiliaryFooter={previewModel.shell.showAuxiliaryFooter ? (
        <p className="text-xs text-slate-600">Override policy applies to this tenant only.</p>
      ) : undefined}
      intermediateFooter={previewModel.shell.showIntermediateFooter ? (
        <p className="text-xs font-medium text-amber-800">Repack will run after save.</p>
      ) : undefined}
      footer={previewModel.shell.showActionFooter ? (
        <>
          <AppButton intent="cancel" size="sm" onClick={requestClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton intent="primary" size="sm" disabled={previewModel.primaryDisabled}>
            <Save className="h-3.5 w-3.5" />
            {previewModel.primaryLabel}
          </AppButton>
        </>
      ) : undefined}
      contained
      backdropTint={previewModel.shell.backdropTint}
      backdropBlur={previewModel.shell.backdropBlur}
      backdropTransparency={previewModel.shell.backdropTransparency}
    >
      {bodyContent}
    </CreateEditModalShell>
  );
};

export const CreateEditBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<CreateEditBaseComponentsConfig>(DEFAULT_CREATE_EDIT_BASE_COMPONENTS_CONFIG);
  const configJson = useMemo(() => JSON.stringify({
    public: {
      size: config.size,
      title: config.title,
      enabledGated: config.enabledGatedForm,
      defaultEnabled: config.enabledGatedForm ? config.enabled : undefined,
      backdropTint: config.backdropTint,
      backdropBlur: config.backdropBlur,
      backdropTransparency: config.backdropTransparency,
      showCloseButton: config.showCloseButton,
      headerActionCount: config.headerActionCount,
    },
    composition: {
      mode: config.mode,
      composition: config.composition,
      header: { title: config.title, subtitle: config.showSubtitle, icon: true },
      accessBand: config.accessBand,
      validationSummary: config.validationSummary,
      dirtyGuard: config.dirtyGuard,
      regions: {
        subtitle: config.showSubtitle,
        headerExtra: config.headerActionCount > 0,
        close: config.showCloseButton,
        auxiliaryFooter: config.showAuxiliaryFooter,
        intermediateFooter: config.showIntermediateFooter,
        actionFooter: config.showActionFooter,
      },
      footer: config.mode === 'create' ? 'create-cancel' : 'save-cancel',
    },
    demo: { fixtures: {}, scenarios: { state: config.state } },
  }, null, 2), [config]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="create-edit" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CREATE_EDIT_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Shell" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Mode" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.mode}
                    onChange={(event) => setConfig((current) => ({ ...current, mode: event.target.value as CreateEditBaseComponentsConfig['mode'] }))}
                    ariaLabel="Create or edit mode">
                    <option value="create">create</option><option value="edit">edit</option>
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
                    ariaLabel="Modal size"
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

                <FormField label="Title" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                    value={config.title}
                    onChange={(event) => setConfig((current) => ({ ...current, title: event.target.value }))}
                  />
                </FormField>
              </div>
            </FormSection>

            <BaseComponentsSurfaceChromeSection
              config={config}
              onChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
            />

            <FormSection title="Regions" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Subtitle band" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showSubtitle ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showSubtitle: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Subtitle band"
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

            <FormSection title="Footers" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Auxiliary" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showAuxiliaryFooter ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showAuxiliaryFooter: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Auxiliary footer"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField>

                <FormField label="Intermediate" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showIntermediateFooter ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showIntermediateFooter: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Intermediate footer"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField>

                <FormField label="Action footer" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showActionFooter ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showActionFooter: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Action footer"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Form pattern" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Composition" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.composition}
                    onChange={(event) => setConfig((current) => ({ ...current, composition: event.target.value as CreateEditBaseComponentsConfig['composition'] }))}
                    ariaLabel="Create edit composition">
                    <option value="single">single</option><option value="sectioned">sectioned</option>
                    <option value="two-column">two column</option><option value="editor-rail">editor + summary rail</option>
                  </UiSelect>
                </FormField>
                <FormField label="State" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.state}
                    onChange={(event) => setConfig((current) => ({ ...current, state: event.target.value as CreateEditBaseComponentsConfig['state'] }))}
                    ariaLabel="Create edit state">
                    <option value="default">default</option><option value="invalid">invalid</option>
                    <option value="dirty">dirty</option><option value="saving">saving</option><option value="save-error">save error</option>
                  </UiSelect>
                </FormField>
                <FormField label="Access band" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.accessBand ? 'yes' : 'no'}
                    onChange={(event) => setConfig((current) => ({ ...current, accessBand: event.target.value === 'yes' }))}
                    ariaLabel="Create edit access band">
                    <option value="no">hide</option><option value="yes">show</option>
                  </UiSelect>
                </FormField>
                <FormField label="Validation summary" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.validationSummary ? 'yes' : 'no'}
                    onChange={(event) => setConfig((current) => ({ ...current, validationSummary: event.target.value === 'yes' }))}
                    ariaLabel="Create edit validation summary">
                    <option value="yes">show when invalid</option><option value="no">hide</option>
                  </UiSelect>
                </FormField>
                <FormField label="Dirty close guard" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.dirtyGuard ? 'yes' : 'no'}
                    onChange={(event) => setConfig((current) => ({ ...current, dirtyGuard: event.target.value === 'yes' }))}
                    ariaLabel="Create edit dirty guard">
                    <option value="yes">Save / Discard / Cancel</option><option value="no">disabled</option>
                  </UiSelect>
                </FormField>
                <FormField label="Enabled-gated" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.enabledGatedForm ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        enabledGatedForm: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Enabled-gated form"
                  >
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </UiSelect>
                </FormField>

                {config.enabledGatedForm ? (
                  <FormField label="Default enabled" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.enabled ? 'yes' : 'no'}
                      onChange={(event) => {
                        setConfig((current) => ({
                          ...current,
                          enabled: event.target.value === 'yes',
                        }));
                      }}
                      ariaLabel="Default enabled"
                    >
                      <option value="yes">yes</option>
                      <option value="no">no</option>
                    </UiSelect>
                  </FormField>
                ) : null}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="create-edit" fill>
          <CreateEditBaseComponentsPreview config={config} open onClose={() => undefined} />
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
