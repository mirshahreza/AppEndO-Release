import React, { useEffect, useMemo, useState } from 'react';
import { Cloud, HardDrive, Save, X } from 'lucide-react';
import { UiInput, UiSelect } from '../../../../shared/ui';
import {
  AI_PROVIDER_SETUP_TEMPLATES,
  buildAiProviderConfigFromTemplate,
  describeProviderEndpointHint,
  getAiProviderLabel,
  getAiProviderSetupTemplate,
  getAiProviderSetupTemplateById,
  listAiProviderSetupTemplatesByHost,
  resolveAiProviderHostKind,
  type AiProviderHostKind,
} from '../../../../shared/api/contracts/ai/constants';
import type { AiProviderConfig, AiProviderKind } from '../../../../shared/api/contracts/ai/types';
import { AppButton } from '../../../../shared/ui/AppButton';
import { CreateEditModalShell } from '../../../../shared/ui/CreateEditModalShell';
import { cn } from '../../../../lib/utils';
import {
  SETTINGS_CONTROL_CLASS,
  SETTINGS_FORM_GROUP_BODY_STACK_CLASS,
  SettingsField,
  SettingsFormGroup,
} from '../form/SettingsFormPrimitives';
import {
  providerRequiresApiKey,
} from './constants';

export type AiProviderFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  form: AiProviderConfig;
  configuredProviderKinds?: AiProviderKind[];
  hasStoredApiKey?: boolean;
  formError: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFormChange: (next: AiProviderConfig) => void;
};

const AI_MODELS_SECTION_ID = 'ai-models' as const;

const HOST_BADGE_CLASS: Record<AiProviderHostKind, string> = {
  cloud: 'border-sky-200 bg-sky-50 text-sky-800',
  local: 'border-amber-200 bg-amber-50 text-amber-900',
};

const resolveTemplateIdForForm = (config: AiProviderConfig): string => {
  const normalizedBase = (config.baseUrl ?? '').trim();
  const normalizedLabel = (config.providerLabel ?? '').trim();

  const exact = AI_PROVIDER_SETUP_TEMPLATES.find((item) => {
    if (item.kind !== config.provider) return false;
    const templateBase = (item.defaultBaseUrl ?? '').trim();
    const baseMatches = normalizedBase === templateBase
      || (!normalizedBase && !templateBase);
    const labelMatches = !normalizedLabel || normalizedLabel === item.label;
    return baseMatches && labelMatches;
  });

  if (exact) return exact.id;
  return getAiProviderSetupTemplate(config.provider)?.id ?? config.provider;
};

const ProviderHostBadge: React.FC<{ hostKind: AiProviderHostKind }> = ({ hostKind }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
      HOST_BADGE_CLASS[hostKind],
    )}
  >
    {hostKind === 'local' ? (
      <HardDrive className="h-3 w-3 shrink-0" aria-hidden />
    ) : (
      <Cloud className="h-3 w-3 shrink-0" aria-hidden />
    )}
    {hostKind === 'local' ? 'Local' : 'Cloud'}
  </span>
);

export const AiProviderFormModal: React.FC<AiProviderFormModalProps> = ({
  open,
  mode,
  form,
  configuredProviderKinds = [],
  hasStoredApiKey = false,
  formError,
  isSaving,
  onClose,
  onSubmit,
  onFormChange,
}) => {
  const requiresApiKey = providerRequiresApiKey(form.provider);
  const endpointHint = describeProviderEndpointHint(form.provider, form.baseUrl);

  const [selectedTemplateId, setSelectedTemplateId] = useState(() => resolveTemplateIdForForm(form));

  const cloudTemplates = useMemo(
    () => listAiProviderSetupTemplatesByHost('cloud'),
    [],
  );

  const localTemplates = useMemo(
    () => listAiProviderSetupTemplatesByHost('local'),
    [],
  );

  const isTemplateKindConfigured = (templateId: string) => {
    const template = getAiProviderSetupTemplateById(templateId);
    return Boolean(template && configuredProviderKinds.includes(template.kind));
  };

  const firstAddableTemplateId = useMemo(() => {
    const match = AI_PROVIDER_SETUP_TEMPLATES.find(
      (item) => !configuredProviderKinds.includes(item.kind),
    );
    return match?.id ?? AI_PROVIDER_SETUP_TEMPLATES[0]?.id ?? 'openai';
  }, [configuredProviderKinds]);

  useEffect(() => {
    if (!open || mode !== 'create') return;
    let nextId = resolveTemplateIdForForm(form);
    if (isTemplateKindConfigured(nextId)) {
      nextId = firstAddableTemplateId;
      onFormChange(buildAiProviderConfigFromTemplate(nextId));
    }
    setSelectedTemplateId(nextId);
  }, [open, mode]);

  const setupTemplate = mode === 'create'
    ? getAiProviderSetupTemplateById(selectedTemplateId) ?? getAiProviderSetupTemplate(form.provider)
    : getAiProviderSetupTemplate(form.provider);

  const hostKind = mode === 'create' && setupTemplate
    ? setupTemplate.hostKind
    : resolveAiProviderHostKind(form.provider, form.baseUrl);

  const canAddSelectedTemplate = mode !== 'create'
    || !isTemplateKindConfigured(selectedTemplateId);

  if (!open) return null;

  const displayName = getAiProviderLabel(form.provider, form.providerLabel);
  const baseUrlPlaceholder = setupTemplate?.baseUrlPlaceholder
    ?? setupTemplate?.defaultBaseUrl
    ?? 'https://…';

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    onFormChange(buildAiProviderConfigFromTemplate(templateId));
  };

  return (
    <CreateEditModalShell
      size="4xl"
      title={mode === 'create' ? 'Add Provider' : `Edit Provider — ${displayName}`}
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose} disabled={isSaving}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton intent="primary" onClick={onSubmit} disabled={isSaving || (mode === 'create' && !canAddSelectedTemplate)}>
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : mode === 'create' ? 'Add' : 'Save'}
          </AppButton>
        </>
      )}
    >
      <div className={SETTINGS_FORM_GROUP_BODY_STACK_CLASS}>
        {formError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {formError}
          </div>
        ) : null}

        {mode === 'create' ? (
          <SettingsFormGroup
            title="Provider type"
            sectionId={AI_MODELS_SECTION_ID}
            description="Pick a hosted cloud API or a local runtime (Ollama, LM Studio, …). Fields below are prefilled like VS Code language-model provider entries — adjust before saving."
          >
            <>
              <SettingsField label="Template">
                <UiSelect
                  size="sm"
                  nested
                  clipSafePopover
                  popoverPlacement="bottom"
                  shouldFlip
                  className={SETTINGS_CONTROL_CLASS}
                  value={selectedTemplateId}
                  onChange={(event) => handleTemplateChange(event.target.value)}
                >
                  <optgroup label="Cloud — hosted API">
                    {cloudTemplates.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={configuredProviderKinds.includes(item.kind)}
                      >
                        {item.label}
                        {configuredProviderKinds.includes(item.kind) ? ' (already added)' : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Local — your machine or LAN">
                    {localTemplates.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={configuredProviderKinds.includes(item.kind)}
                      >
                        {item.label}
                        {configuredProviderKinds.includes(item.kind) ? ' (already added)' : ''}
                      </option>
                    ))}
                  </optgroup>
                </UiSelect>
              </SettingsField>
              {!canAddSelectedTemplate ? (
                <p className="text-xs text-amber-800">
                  This provider type is already configured. Pick another template or delete the existing row first.
                </p>
              ) : null}
              {setupTemplate ? (
                <div className="flex flex-col gap-1.5">
                  <ProviderHostBadge hostKind={setupTemplate.hostKind} />
                  <p className="text-xs leading-relaxed text-slate-600">{setupTemplate.description}</p>
                </div>
              ) : null}
            </>
          </SettingsFormGroup>
        ) : null}

        <SettingsFormGroup
          title="Provider"
          sectionId={AI_MODELS_SECTION_ID}
          divided={mode === 'create'}
          description="Display name shown in the model tree and chat model picker."
        >
          <div className="flex flex-wrap items-center gap-2">
            <ProviderHostBadge hostKind={hostKind} />
            <span className="text-[11px] text-slate-500">
              {hostKind === 'local'
                ? 'Connects to a server on your machine or private network.'
                : 'Connects to a vendor-hosted HTTPS API.'}
            </span>
          </div>
          <SettingsField label="Name">
            <UiInput
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
              value={form.providerLabel || ''}
              placeholder={getAiProviderLabel(form.provider)}
              onChange={(event) => onFormChange({ ...form, providerLabel: event.target.value })}
            />
          </SettingsField>
        </SettingsFormGroup>

        {requiresApiKey ? (
          <SettingsFormGroup
            title="Credentials"
            sectionId={AI_MODELS_SECTION_ID}
            divided
            description={setupTemplate?.apiKeyHint ?? 'API key for this provider.'}
          >
            <SettingsField
              label="API Key"
              hint={hasStoredApiKey && !form.apiKey?.trim()
                ? 'A key is already stored. Enter a new value to replace it.'
                : undefined}
            >
              <UiInput
                size="sm"
                type="password"
                value={form.apiKey || ''}
                placeholder={hasStoredApiKey ? 'Enter new key to replace stored value' : 'Enter provider API key'}
                onChange={(event) => onFormChange({ ...form, apiKey: event.target.value })}
                autoComplete="off"
                className={cn(SETTINGS_CONTROL_CLASS, 'font-mono')}
              />
            </SettingsField>
          </SettingsFormGroup>
        ) : null}

        <SettingsFormGroup
          title="Connection"
          sectionId={AI_MODELS_SECTION_ID}
          divided={requiresApiKey || mode === 'create'}
          description={hostKind === 'local'
            ? 'Base URL of the local server (include /v1 when the server expects an OpenAI-style prefix).'
            : 'API base URL for HTTP providers. Optional when a built-in default exists.'}
        >
          <SettingsField label="Base URL" hint={endpointHint}>
            <UiInput
              size="sm"
              value={form.baseUrl || ''}
              placeholder={baseUrlPlaceholder}
              onChange={(event) => onFormChange({ ...form, baseUrl: event.target.value })}
              className={cn(SETTINGS_CONTROL_CLASS, 'font-mono')}
            />
          </SettingsField>
        </SettingsFormGroup>
      </div>
    </CreateEditModalShell>
  );
};
