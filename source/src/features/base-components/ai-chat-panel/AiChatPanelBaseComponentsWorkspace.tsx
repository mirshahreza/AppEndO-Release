import React, { useMemo, useState } from 'react';
import { Bot, MessageSquare } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  UiContextChatPanel,
  UiSelect,
} from '../../../shared/ui';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsConfigBoolField } from '../components/BaseComponentsConfigBoolField';
import { BaseComponentsConfigToolbarControls, BaseComponentsResetButton } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';
import {
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';

export type AiChatPanelBaseComponentsConfig = {
  state: 'default' | 'disabled' | 'no-models' | 'sending' | 'empty';
  agencyMode: 'ask' | 'read-only' | 'agentic';
  agencyModes: 'all' | 'ask-agentic' | 'off';
  agencyPickerVariant: 'buttons' | 'dropdown';
  showHeader: boolean;
  showWelcomeWarning: boolean;
  showCommands: boolean;
  showModelPicker: boolean;
  showSendButton: boolean;
  showSendingIndicator: boolean;
  promptAutoGrow: boolean;
  showPromptToolbarStart: boolean;
  showComposer: boolean;
};

const DEFAULT_CONFIG: AiChatPanelBaseComponentsConfig = {
  state: 'default',
  agencyMode: 'ask',
  agencyModes: 'all',
  agencyPickerVariant: 'buttons',
  showHeader: false,
  showWelcomeWarning: false,
  showCommands: true,
  showModelPicker: true,
  showSendButton: true,
  showSendingIndicator: true,
  promptAutoGrow: false,
  showPromptToolbarStart: false,
  showComposer: true,
};

const DEMO_MODELS = [{ id: 'demo-chat', name: 'Demo chat' }];

const resolveAgencyModes = (preset: AiChatPanelBaseComponentsConfig['agencyModes']) => {
  if (preset === 'off') {
    return undefined;
  }
  if (preset === 'ask-agentic') {
    return ['ask', 'agentic'] as const;
  }
  return ['ask', 'read-only', 'agentic'] as const;
};

export const resolveAiChatPanelOptionLiveness = (config: AiChatPanelBaseComponentsConfig) => {
  const visibleOptions = [
    'state',
    'agencyMode',
    'agencyModes',
    'showHeader',
    'showWelcomeWarning',
    'showCommands',
    'showModelPicker',
    'showSendButton',
    'showSendingIndicator',
    'promptAutoGrow',
    'showPromptToolbarStart',
    'showComposer',
  ];
  if (config.agencyModes !== 'off') {
    visibleOptions.push('agencyPickerVariant');
  }
  if (!config.promptAutoGrow) {
    visibleOptions.push('promptRows');
  }

  return {
    visibleOptions,
    panelProps: {
      aiEnabled: config.state !== 'disabled',
      models: config.state === 'no-models' ? [] : DEMO_MODELS,
      sending: config.state === 'sending',
      showModelPicker: config.showModelPicker,
      showSendButton: config.showSendButton,
      showSendingIndicator: config.showSendingIndicator,
      promptAutoGrow: config.promptAutoGrow,
      promptComposerStart: config.showPromptToolbarStart,
      promptRows: config.promptAutoGrow ? 1 : 3,
      showComposer: config.showComposer,
      agencyMode: config.agencyMode,
      agencyModes: resolveAgencyModes(config.agencyModes),
      agencyPickerVariant: config.agencyPickerVariant,
      welcomeWarningText: config.showWelcomeWarning
        ? 'Warning: suggested commands may change remote state.'
        : undefined,
    },
  };
};

const ConfigSelect: React.FC<{
  label: string;
  value: string;
  ariaLabel: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}> = ({ label, value, ariaLabel, options, onChange }) => (
  <FormField label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
    <UiSelect
      size="sm"
      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      ariaLabel={ariaLabel}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </UiSelect>
  </FormField>
);

export const AiChatPanelBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<AiChatPanelBaseComponentsConfig>(DEFAULT_CONFIG);
  const liveness = resolveAiChatPanelOptionLiveness(config);
  const configJson = useMemo(
    () => JSON.stringify(liveness.panelProps, null, 2),
    [liveness.panelProps],
  );

  const patch = <K extends keyof AiChatPanelBaseComponentsConfig>(
    key: K,
    value: AiChatPanelBaseComponentsConfig[K],
  ) => {
    setConfig((current) => {
      const next = { ...current, [key]: value };
      if (key === 'showPromptToolbarStart' && value === true) {
        next.showModelPicker = false;
      }
      if (key === 'agencyModes' && value === 'ask-agentic' && next.agencyMode === 'read-only') {
        next.agencyMode = 'ask';
      }
      return next;
    });
  };

  const demoEmpty = (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center p-6 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Bot className="h-6 w-6 text-indigo-500" />
      </div>
      <h3 className="text-sm font-medium tracking-tight text-slate-800">AppEndO</h3>
      <p className="mt-2 text-xs text-slate-500">Ask about this page, or switch to Agent for tools.</p>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="ai-chat-panel" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="AI chat panel" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <ConfigSelect
                  label="State"
                  ariaLabel="AI chat panel state"
                  value={config.state}
                  options={[
                    { value: 'default', label: 'default' },
                    { value: 'disabled', label: 'disabled' },
                    { value: 'no-models', label: 'no models' },
                    { value: 'sending', label: 'sending' },
                    { value: 'empty', label: 'empty' },
                  ]}
                  onChange={(value) => patch('state', value as AiChatPanelBaseComponentsConfig['state'])}
                />
                <ConfigSelect
                  label="Agency"
                  ariaLabel="AI chat panel agency"
                  value={config.agencyMode}
                  options={[
                    { value: 'ask', label: 'ask (chat only)' },
                    { value: 'read-only', label: 'read only (safe commands)' },
                    { value: 'agentic', label: 'agentic (run everything)' },
                  ]}
                  onChange={(value) => patch('agencyMode', value as AiChatPanelBaseComponentsConfig['agencyMode'])}
                />
                <ConfigSelect
                  label="Allowed agency"
                  ariaLabel="AI chat panel allowed agency modes"
                  value={config.agencyModes}
                  options={[
                    { value: 'all', label: 'ask + read only + agentic' },
                    { value: 'ask-agentic', label: 'ask + agentic (no read only)' },
                    { value: 'off', label: 'hidden (host owns mode)' },
                  ]}
                  onChange={(value) => patch('agencyModes', value as AiChatPanelBaseComponentsConfig['agencyModes'])}
                />
                {config.agencyModes !== 'off' ? (
                <ConfigSelect
                  label="Agency control"
                  ariaLabel="AI chat panel agency control"
                  value={config.agencyPickerVariant}
                  options={[
                    { value: 'buttons', label: 'buttons (header)' },
                    { value: 'dropdown', label: 'dropdown (next to model)' },
                  ]}
                  onChange={(value) => patch('agencyPickerVariant', value as AiChatPanelBaseComponentsConfig['agencyPickerVariant'])}
                />
                ) : null}
                <BaseComponentsConfigBoolField
                  label="Header slot"
                  checked={config.showHeader}
                  onChange={(checked) => patch('showHeader', checked)}
                />
                <BaseComponentsConfigBoolField
                  label="Welcome warning"
                  checked={config.showWelcomeWarning}
                  onChange={(checked) => patch('showWelcomeWarning', checked)}
                />
                <BaseComponentsConfigBoolField
                  label="Command cards"
                  checked={config.showCommands}
                  onChange={(checked) => patch('showCommands', checked)}
                />
                <BaseComponentsConfigBoolField
                  label="Model picker"
                  checked={config.showModelPicker}
                  onChange={(checked) => patch('showModelPicker', checked)}
                />
                <BaseComponentsConfigBoolField
                  label="Send button"
                  checked={config.showSendButton}
                  onChange={(checked) => patch('showSendButton', checked)}
                />
                <BaseComponentsConfigBoolField
                  label="Sending indicator"
                  checked={config.showSendingIndicator}
                  onChange={(checked) => patch('showSendingIndicator', checked)}
                />
                <BaseComponentsConfigBoolField
                  label="Prompt auto-grow"
                  checked={config.promptAutoGrow}
                  onChange={(checked) => patch('promptAutoGrow', checked)}
                />
                <BaseComponentsConfigBoolField
                  label="Prompt toolbar start"
                  checked={config.showPromptToolbarStart}
                  onChange={(checked) => patch('showPromptToolbarStart', checked)}
                />
                <BaseComponentsConfigBoolField
                  label="Composer"
                  checked={config.showComposer}
                  onChange={(checked) => patch('showComposer', checked)}
                />
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="ai-chat-panel" fill>
          <div
            data-bc-preview-root="ai-chat-panel"
            className="flex h-full min-h-[28rem] min-w-0 overflow-hidden border-t border-slate-200"
          >
            <UiContextChatPanel
              key={config.state}
              placement="fill"
              className="h-full min-w-0 flex-1"
              welcomeText="Ask about the host canvas. Hosts send context; returned actions apply automatically."
              placeholder="Ask to inspect context or run a command…"
              sendingLabel="Working…"
              promptAriaLabel="Demo AI prompt"
              sessionHistoryKey="base-components.ai-chat-panel"
              models={liveness.panelProps.models}
              aiEnabled={liveness.panelProps.aiEnabled}
              sending={liveness.panelProps.sending}
              disabledBanner="AI is disabled in platform settings."
              emptyModelsBanner="Enable a chat model in AI settings."
              showModelPicker={liveness.panelProps.showModelPicker}
              showSendButton={liveness.panelProps.showSendButton}
              showSendingIndicator={liveness.panelProps.showSendingIndicator}
              showComposer={liveness.panelProps.showComposer}
              promptAutoGrow={liveness.panelProps.promptAutoGrow}
              promptRows={liveness.panelProps.promptRows}
              welcomeWarningText={liveness.panelProps.welcomeWarningText}
              agencyMode={liveness.panelProps.agencyMode}
              agencyModes={liveness.panelProps.agencyModes}
              agencyPickerVariant={liveness.panelProps.agencyPickerVariant}
              onAgencyModeChange={(mode) => patch('agencyMode', mode)}
              headerSlot={config.showHeader ? (
                <p className="text-[11px] font-medium text-slate-600">Assist mode: review commands before they run.</p>
              ) : undefined}
              bodySlot={config.state === 'empty' ? demoEmpty : undefined}
              promptToolbarStart={config.showPromptToolbarStart ? (
                <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-600">
                  <MessageSquare className="h-3 w-3" />
                  Ask
                </span>
              ) : undefined}
              onSend={async ({ prompt }) => {
                await new Promise((resolve) => {
                  window.setTimeout(resolve, 280);
                });
                return {
                  text: `Demo reply: ${prompt}`,
                  commands: config.showCommands ? [{
                    id: 'demo-cmd',
                    command: 'ls -la /var/www',
                    language: 'bash',
                    effect: 'read',
                    status: 'ran',
                  }] : [],
                };
              }}
            />
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
