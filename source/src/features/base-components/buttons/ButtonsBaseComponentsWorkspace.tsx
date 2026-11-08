import React, { useMemo, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Check, Plus, Trash2, UploadCloud, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  AppButtonGroup,
  AppSplitButton,
  FormField,
  FormSection,
  SplitButtonMenuItem,
  UiInput,
  UiSelect,
  WorkspaceBackIcon,
} from '../../../shared/ui';
import type { AppButtonGroupOrientation } from '../../../shared/ui/AppButtonGroup';
import type { ButtonIntent } from '../../../shared/ui/buttonSemantics';
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
  BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
} from '../baseComponentsConfiguratorLayout';
import { BASE_COMPONENTS_CAPTION_CLASS } from '../baseComponentsVisualTokens';

export type ButtonsBaseComponentsConfig = {
  /** Canonical nested-editor / workspace back control. */
  kind: 'workspace-back' | 'labeled-app-button' | 'split-button' | 'button-group';
  ariaLabel: string;
  title: string;
  labeledIntent: ButtonIntent;
  labeledLabel: string;
  groupOrientation: AppButtonGroupOrientation;
};

export const DEFAULT_BUTTONS_BASE_COMPONENTS_CONFIG: ButtonsBaseComponentsConfig = {
  kind: 'workspace-back',
  ariaLabel: 'Back to list',
  title: 'Back to list',
  labeledIntent: 'create',
  labeledLabel: 'Create',
  groupOrientation: 'horizontal',
};

export function resolveButtonsPreviewModel(config: ButtonsBaseComponentsConfig) {
  return {
    kind: config.kind,
    component: config.kind === 'workspace-back'
      ? 'WorkspaceBackIcon'
      : config.kind === 'split-button'
        ? 'AppSplitButton'
        : config.kind === 'button-group'
          ? 'AppButtonGroup'
          : 'AppButton',
    workspaceBack: config.kind === 'workspace-back'
      ? {
        hitTarget: 'h-8 w-8',
        icon: 'ArrowLeft h-6 w-6 strokeWidth=2',
        tokens: ['ICON_ACTION_BUTTON_MD_CLASS', 'ICON_ACTION_CANCEL_CLASS'],
        ariaLabel: config.ariaLabel.trim() || 'Back to list',
        title: (config.title.trim() || config.ariaLabel.trim() || 'Back to list'),
      }
      : null,
    labeled: config.kind === 'labeled-app-button' || config.kind === 'split-button'
      ? {
        intent: config.labeledIntent,
        size: 'sm',
        label: config.labeledLabel.trim() || 'Action',
        split: config.kind === 'split-button',
      }
      : null,
    group: config.kind === 'button-group'
      ? {
        orientation: config.groupOrientation,
        intent: config.labeledIntent,
        ariaLabel: 'Text alignment',
        items: ['Align left', 'Align center', 'Align right'],
      }
      : null,
  } as const;
}

export function exportButtonsBaseComponentsConfig(config: ButtonsBaseComponentsConfig) {
  return resolveButtonsPreviewModel(config);
}

const LABELED_INTENT_SAMPLES: Array<{ intent: ButtonIntent; label: string; icon: React.ReactNode }> = [
  { intent: 'create', label: 'Create', icon: <Plus className="h-3.5 w-3.5" /> },
  { intent: 'cancel', label: 'Cancel', icon: <X className="h-3.5 w-3.5" /> },
  { intent: 'confirm', label: 'Save', icon: <Check className="h-3.5 w-3.5" /> },
  { intent: 'destructive-soft', label: 'Delete', icon: <Trash2 className="h-3.5 w-3.5" /> },
  { intent: 'secondary', label: 'Publish', icon: <UploadCloud className="h-3.5 w-3.5" /> },
];

const BUTTON_GROUP_ITEMS: Array<{ id: string; label: string; icon: React.ReactNode }> = [
  { id: 'left', label: 'Align left', icon: <AlignLeft className="h-3.5 w-3.5" /> },
  { id: 'center', label: 'Align center', icon: <AlignCenter className="h-3.5 w-3.5" /> },
  { id: 'right', label: 'Align right', icon: <AlignRight className="h-3.5 w-3.5" /> },
];

type ButtonsBaseComponentsPreviewProps = {
  config: ButtonsBaseComponentsConfig;
};

const ButtonsBaseComponentsPreview: React.FC<ButtonsBaseComponentsPreviewProps> = ({ config }) => {
  const [lastAction, setLastAction] = useState('No button action yet.');
  const [splitOpen, setSplitOpen] = useState(false);
  const model = resolveButtonsPreviewModel(config);

  return (
    <div data-bc-preview-root="buttons" className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'gap-6')}>
      {model.workspaceBack ? (
        <div className="flex w-full max-w-xl flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <p className={BASE_COMPONENTS_CAPTION_CLASS}>
            Nested editor / workspace header — use exactly this control (not AppButton, not ChevronLeft).
          </p>
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <WorkspaceBackIcon
              ariaLabel={model.workspaceBack.ariaLabel}
              title={model.workspaceBack.title}
              onClick={() => setLastAction(`Navigated back · ${model.workspaceBack!.ariaLabel}`)}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">Content Editor / Sample</p>
              <p className="truncate font-mono text-[11px] text-slate-500">cms/contents/edit/…</p>
            </div>
          </div>
          <dl className="grid gap-1 text-[11px] text-slate-600">
            <div><span className="font-semibold text-slate-800">Component</span> · WorkspaceBackIcon</div>
            <div><span className="font-semibold text-slate-800">Hit target</span> · {model.workspaceBack.hitTarget}</div>
            <div><span className="font-semibold text-slate-800">Icon</span> · {model.workspaceBack.icon}</div>
            <div><span className="font-semibold text-slate-800">Tokens</span> · {model.workspaceBack.tokens.join(' + ')}</div>
          </dl>
        </div>
      ) : null}

      {model.labeled && !model.labeled.split ? (
        <div className="flex w-full max-w-xl flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <p className={BASE_COMPONENTS_CAPTION_CLASS}>
            Labeled actions use AppButton + leading Lucide h-3.5 — never text-only.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <AppButton
              intent={model.labeled.intent}
              size="sm"
              onClick={() => setLastAction(`Clicked ${model.labeled!.label}`)}
            >
              {LABELED_INTENT_SAMPLES.find((sample) => sample.intent === model.labeled!.intent)?.icon
                ?? <Plus className="h-3.5 w-3.5" />}
              {model.labeled.label}
            </AppButton>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {LABELED_INTENT_SAMPLES.map((sample) => (
              <AppButton
                key={sample.intent}
                intent={sample.intent}
                size="sm"
                onClick={() => setLastAction(`Sample ${sample.intent}`)}
              >
                {sample.icon}
                {sample.label}
              </AppButton>
            ))}
          </div>
        </div>
      ) : null}

      {model.labeled?.split ? (
        <div className="flex w-full max-w-xl flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <p className={BASE_COMPONENTS_CAPTION_CLASS}>
            Primary action plus overflow menu — AppSplitButton, not a pair of adjacent AppButtons.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <AppSplitButton
              intent={model.labeled.intent}
              size="sm"
              label={model.labeled.label}
              icon={LABELED_INTENT_SAMPLES.find((sample) => sample.intent === model.labeled!.intent)?.icon ?? <Plus className="h-3.5 w-3.5" />}
              isOpen={splitOpen}
              onOpenChange={setSplitOpen}
              onPrimaryClick={() => setLastAction(`Primary ${model.labeled!.label}`)}
              menuAriaLabel={`${model.labeled.label} options`}
              triggerAriaLabel={`${model.labeled.label} menu`}
            >
              <SplitButtonMenuItem onClick={() => { setSplitOpen(false); setLastAction('CSV export selected.'); }}>CSV</SplitButtonMenuItem>
              <SplitButtonMenuItem onClick={() => { setSplitOpen(false); setLastAction('JSON export selected.'); }}>JSON</SplitButtonMenuItem>
            </AppSplitButton>
          </div>
        </div>
      ) : null}

      {model.group ? (
        <div className="flex w-full max-w-xl flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <p className={BASE_COMPONENTS_CAPTION_CLASS}>
            Related peer actions share one chrome — AppButtonGroup, not loose adjacent AppButtons and not UiSegmentedControl.
          </p>
          <AppButtonGroup orientation={model.group.orientation} ariaLabel={model.group.ariaLabel}>
            {BUTTON_GROUP_ITEMS.map((item) => (
              <AppButton
                key={item.id}
                intent={model.group!.intent}
                size="sm"
                onClick={() => setLastAction(`${item.label} selected.`)}
              >
                {item.icon}
                {item.label}
              </AppButton>
            ))}
          </AppButtonGroup>
        </div>
      ) : null}

      <p className="text-xs text-slate-500" role="status">{lastAction}</p>
    </div>
  );
};

export const ButtonsBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<ButtonsBaseComponentsConfig>(DEFAULT_BUTTONS_BASE_COMPONENTS_CONFIG);
  const configJson = useMemo(() => JSON.stringify(exportButtonsBaseComponentsConfig(config), null, 2), [config]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="buttons" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_BUTTONS_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Buttons" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Kind" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.kind}
                    onChange={(event) => {
                      const kind = event.target.value as ButtonsBaseComponentsConfig['kind'];
                      setConfig((current) => ({
                        ...current,
                        kind,
                        labeledIntent: kind === 'button-group' && current.kind !== 'button-group'
                          ? 'secondary'
                          : current.labeledIntent,
                      }));
                    }}
                    ariaLabel="Button kind"
                  >
                    <option value="workspace-back">workspace back</option>
                    <option value="labeled-app-button">labeled AppButton</option>
                    <option value="split-button">split button</option>
                    <option value="button-group">button group</option>
                  </UiSelect>
                </FormField>

                {config.kind === 'workspace-back' ? (
                  <>
                    <FormField label="aria-label" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiInput
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                        value={config.ariaLabel}
                        onChange={(event) => setConfig((current) => ({ ...current, ariaLabel: event.target.value }))}
                        autoDir={false}
                      />
                    </FormField>
                    <FormField label="title" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiInput
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                        value={config.title}
                        onChange={(event) => setConfig((current) => ({ ...current, title: event.target.value }))}
                        autoDir={false}
                      />
                    </FormField>
                  </>
                ) : (
                  <>
                    <FormField label="Intent" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiSelect
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        value={config.labeledIntent}
                        onChange={(event) => setConfig((current) => ({
                          ...current,
                          labeledIntent: event.target.value as ButtonIntent,
                        }))}
                        ariaLabel="Labeled button intent"
                      >
                        {LABELED_INTENT_SAMPLES.map((sample) => (
                          <option key={sample.intent} value={sample.intent}>{sample.intent}</option>
                        ))}
                      </UiSelect>
                    </FormField>
                    {config.kind === 'button-group' ? (
                      <FormField label="Orientation" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                        <UiSelect
                          size="sm"
                          className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                          value={config.groupOrientation}
                          onChange={(event) => setConfig((current) => ({
                            ...current,
                            groupOrientation: event.target.value as AppButtonGroupOrientation,
                          }))}
                          ariaLabel="Button group orientation"
                        >
                          <option value="horizontal">horizontal</option>
                          <option value="vertical">vertical</option>
                        </UiSelect>
                      </FormField>
                    ) : (
                      <FormField label="Label" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                        <UiInput
                          size="sm"
                          className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                          value={config.labeledLabel}
                          onChange={(event) => setConfig((current) => ({ ...current, labeledLabel: event.target.value }))}
                        />
                      </FormField>
                    )}
                  </>
                )}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="buttons">
          <ButtonsBaseComponentsPreview config={config} />
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
