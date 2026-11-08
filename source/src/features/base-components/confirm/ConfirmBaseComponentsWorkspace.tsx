import React, { useMemo, useState } from 'react';
import {
  Archive,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import {
  AppButton,
  ConfirmDialogShell,
  FormField,
  FormSection,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
import type { ButtonIntent } from '../../../shared/ui/buttonSemantics';
import type {
  CreateEditModalSize,
  DialogBackdropBlur,
  DialogBackdropTint,
  DialogBackdropTransparency,
  DialogPrimaryHeaderTone,
} from '../../../shared/ui/surfaceClasses';
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

type BodyMode = 'simple' | 'typed' | 'impact-list';
type FlowTone = 'danger' | 'warning' | 'info' | 'success';

export type ConfirmBaseComponentsConfig = BaseComponentsSurfaceChromeConfig & {
  flowTone: FlowTone;
  size: CreateEditModalSize;
  title: string;
  bodyMode: BodyMode;
  entityName: string;
  confirmIntent: ButtonIntent;
  confirmLabel: string;
  isConfirming: boolean;
  showError: boolean;
  confirmPhrase: string;
  secondaryAction: boolean;
  focusPolicy: 'safest' | 'primary';
  showCloseButton: boolean;
  headerActionCount: number;
  backdropTint: DialogBackdropTint;
  backdropBlur: DialogBackdropBlur;
  backdropTransparency: DialogBackdropTransparency;
};

export const DEFAULT_CONFIRM_BASE_COMPONENTS_CONFIG: ConfirmBaseComponentsConfig = {
  ...BASE_COMPONENTS_SURFACE_CHROME_DEFAULT,
  flowTone: 'danger',
  size: 'sm',
  title: 'Delete server function?',
  bodyMode: 'impact-list',
  entityName: 'orders/sync-inventory',
  confirmIntent: 'destructive',
  confirmLabel: 'Delete',
  isConfirming: false,
  showError: false,
  confirmPhrase: 'DELETE',
  secondaryAction: false,
  focusPolicy: 'safest',
  showCloseButton: true,
  headerActionCount: 0,
  backdropTint: 'medium',
  backdropBlur: 'default',
  backdropTransparency: 'opaque',
};

function resolveHeaderTone(flowTone: FlowTone): DialogPrimaryHeaderTone {
  if (flowTone === 'danger') return 'danger';
  return 'default';
}

function resolveIconTone(flowTone: FlowTone): string {
  if (flowTone === 'warning') return 'text-amber-600';
  if (flowTone === 'success') return 'text-emerald-600';
  if (flowTone === 'info') return 'text-cyan-600';
  return 'text-rose-600';
}

export function applyConfirmFlowTone(
  current: ConfirmBaseComponentsConfig,
  flowTone: FlowTone,
): ConfirmBaseComponentsConfig {
  if (flowTone === 'danger') return { ...current, flowTone, title: 'Delete server function?', confirmIntent: 'destructive', confirmLabel: 'Delete' };
  if (flowTone === 'warning') return { ...current, flowTone, title: 'Revoke API key?', confirmIntent: 'warning', confirmLabel: 'Revoke' };
  if (flowTone === 'info') return { ...current, flowTone, title: 'Publish this revision?', confirmIntent: 'primary', confirmLabel: 'Publish' };
  return { ...current, flowTone, title: 'Unlock user account?', confirmIntent: 'confirm', confirmLabel: 'Unlock' };
}

export function resolveConfirmPreviewProps(
  config: ConfirmBaseComponentsConfig,
  typedPhrase: string,
) {
  return {
    tone: resolveHeaderTone(config.flowTone),
    iconToneClassName: resolveIconTone(config.flowTone),
    initialFocus: config.focusPolicy === 'primary' ? 'confirm' as const : 'cancel' as const,
    confirmDisabled: config.bodyMode === 'typed' && typedPhrase !== config.confirmPhrase,
    isConfirming: config.isConfirming,
    error: config.showError ? 'Delete failed. Try again.' : undefined,
    showSecondaryAction: config.secondaryAction,
    showCloseButton: config.showCloseButton,
    headerActionCount: config.headerActionCount,
    backdropTint: config.backdropTint,
    backdropBlur: config.backdropBlur,
    backdropTransparency: config.backdropTransparency,
  };
}

type ConfirmBaseComponentsPreviewProps = {
  config: ConfirmBaseComponentsConfig;
  open: boolean;
  onClose: () => void;
};

const ConfirmBaseComponentsPreview: React.FC<ConfirmBaseComponentsPreviewProps> = ({
  config,
  open,
  onClose,
}) => {
  const [typedPhrase, setTypedPhrase] = useState('');
  React.useEffect(() => {
    if (open) setTypedPhrase('');
  }, [open]);
  const previewProps = resolveConfirmPreviewProps(config, typedPhrase);
  const icon = config.flowTone === 'danger'
    ? <Trash2 className="h-4 w-4" aria-hidden />
    : <AlertTriangle className="h-4 w-4" aria-hidden />;

  const body = config.bodyMode === 'impact-list' ? (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-slate-800">This action cannot be undone.</p>
      <p className="text-xs text-slate-600">The following item will be permanently removed.</p>
      <code className="text-xs font-mono text-slate-700">{config.entityName}</code>
      <ul className="list-disc ps-5 text-xs text-slate-600">
        <li>3 active workflow references</li>
        <li>1 scheduled invocation</li>
      </ul>
    </div>
  ) : config.bodyMode === 'typed' ? (
    <div className="space-y-2">
      <p className="text-sm text-slate-700">Type <strong>{config.confirmPhrase}</strong> to confirm this irreversible action.</p>
      <UiInput size="sm" value={typedPhrase} onChange={(event) => setTypedPhrase(event.target.value)}
        autoDir={false} isInvalid={typedPhrase.length > 0 && typedPhrase !== config.confirmPhrase}
        errorMessage="The confirmation phrase does not match." />
    </div>
  ) : (
    <p className="text-sm font-semibold text-slate-800">Are you sure you want to continue?</p>
  );

  return (
    <ConfirmDialogShell
      open={open}
      title={config.title}
      icon={icon}
      tone={previewProps.tone}
      iconToneClassName={previewProps.iconToneClassName}
      size={config.size}
      colorSource={config.colorSource}
      chromeTone={config.tone}
      customColorHex={config.customColorHex}
      onClose={onClose}
      confirmIntent={config.confirmIntent}
      confirmLabel={config.confirmLabel}
      isConfirming={previewProps.isConfirming}
      initialFocus={previewProps.initialFocus}
      confirmDisabled={previewProps.confirmDisabled}
      onConfirm={onClose}
      error={previewProps.error}
      auxiliaryFooter={previewProps.showSecondaryAction ? (
        <AppButton size="sm" intent="secondary">
          <Archive className="h-3.5 w-3.5" />
          Archive instead
        </AppButton>
      ) : undefined}
      contained
      showCloseButton={previewProps.showCloseButton}
      headerExtra={renderBaseComponentsOverlayHeaderActions(previewProps.headerActionCount)}
      backdropTint={previewProps.backdropTint}
      backdropBlur={previewProps.backdropBlur}
      backdropTransparency={previewProps.backdropTransparency}
    >
      {body}
    </ConfirmDialogShell>
  );
};

export const ConfirmBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<ConfirmBaseComponentsConfig>(DEFAULT_CONFIRM_BASE_COMPONENTS_CONFIG);
  const configJson = useMemo(() => JSON.stringify({
    public: {
      tone: config.flowTone,
      size: config.size,
      confirmIntent: config.confirmIntent,
      backdropTint: config.backdropTint,
      backdropBlur: config.backdropBlur,
      backdropTransparency: config.backdropTransparency,
      showCloseButton: config.showCloseButton,
      headerActionCount: config.headerActionCount,
    },
    composition: {
      bodyPreset: config.bodyMode,
      confirmationPhrase: config.bodyMode === 'typed' ? config.confirmPhrase : undefined,
      secondaryAction: config.secondaryAction,
      initialFocus: config.focusPolicy,
    },
    demo: { fixtures: { entity: config.entityName }, scenarios: { state: config.isConfirming ? 'pending' : config.showError ? 'error' : 'default' } },
  }, null, 2), [config]);

  const applyFlowTone = (flowTone: FlowTone) => {
    setConfig((current) => applyConfirmFlowTone(current, flowTone));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="confirm" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIRM_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Flow" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Preset" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.flowTone}
                    onChange={(event) => {
                      const value = event.target.value as FlowTone;
                      if (value === 'danger' || value === 'warning' || value === 'info' || value === 'success') {
                        applyFlowTone(value);
                      }
                    }}
                    ariaLabel="Flow preset"
                  >
                    <option value="danger">danger</option>
                    <option value="warning">warning</option>
                    <option value="info">information</option>
                    <option value="success">success</option>
                  </UiSelect>
                </FormField>

                <FormField label="Size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.size}
                    onChange={(event) => {
                      const value = event.target.value as CreateEditModalSize;
                      if (value === 'sm' || value === 'md' || value === 'lg') {
                        setConfig((current) => ({ ...current, size: value }));
                      }
                    }}
                    ariaLabel="Dialog size"
                  >
                    <option value="sm">sm</option>
                    <option value="md">md</option>
                    <option value="lg">lg</option>
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
                <BaseComponentsOverlayHeaderFields
                  showCloseButton={config.showCloseButton}
                  headerActionCount={config.headerActionCount}
                  onShowCloseButtonChange={(showCloseButton) => setConfig((current) => ({ ...current, showCloseButton }))}
                  onHeaderActionCountChange={(headerActionCount) => setConfig((current) => ({ ...current, headerActionCount }))}
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

            <FormSection title="Body & state" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Body" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.bodyMode}
                    onChange={(event) => {
                      const value = event.target.value as BodyMode;
                      if (value === 'simple' || value === 'typed' || value === 'impact-list') {
                        setConfig((current) => ({ ...current, bodyMode: value }));
                      }
                    }}
                    ariaLabel="Body mode"
                  >
                    <option value="simple">simple</option>
                    <option value="typed">typed phrase</option>
                    <option value="impact-list">impact list</option>
                  </UiSelect>
                </FormField>

                {config.bodyMode === 'impact-list' ? (
                  <FormField label="Entity" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiInput
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                      value={config.entityName}
                      onChange={(event) => setConfig((current) => ({ ...current, entityName: event.target.value }))}
                    />
                  </FormField>
                ) : null}
                {config.bodyMode === 'typed' ? (
                  <FormField label="Confirm phrase" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiInput size="sm" autoDir={false} className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS} value={config.confirmPhrase}
                      onChange={(event) => setConfig((current) => ({ ...current, confirmPhrase: event.target.value }))} />
                  </FormField>
                ) : null}

                <FormField label="Confirming" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.isConfirming ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        isConfirming: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Confirming state"
                  >
                    <option value="no">no</option>
                    <option value="yes">yes</option>
                  </UiSelect>
                </FormField>

                <FormField label="Error banner" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showError ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showError: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Error banner"
                  >
                    <option value="no">hide</option>
                    <option value="yes">show</option>
                  </UiSelect>
                </FormField>
                <FormField label="Secondary action" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.secondaryAction ? 'yes' : 'no'}
                    onChange={(event) => setConfig((current) => ({ ...current, secondaryAction: event.target.value === 'yes' }))}
                    ariaLabel="Confirm secondary action">
                    <option value="no">none</option><option value="yes">archive instead</option>
                  </UiSelect>
                </FormField>
                <FormField label="Initial focus" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.focusPolicy}
                    onChange={(event) => setConfig((current) => ({ ...current, focusPolicy: event.target.value as ConfirmBaseComponentsConfig['focusPolicy'] }))}
                    ariaLabel="Confirm focus policy">
                    <option value="safest">safest action</option><option value="primary">confirm action</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="confirm" fill>
          <ConfirmBaseComponentsPreview config={config} open onClose={() => undefined} />
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
