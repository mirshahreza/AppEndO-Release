import React, { useEffect, useState } from 'react';

import { Ban, Check, Loader2, Plus, Save, X } from 'lucide-react';

import { UiInput, UiSelect, UiTextarea } from '../../../../shared/ui';
import { useCultureT } from '../../../../core/culture/CultureContext';
import {
  AI_CAPABILITY_GROUPS,
  AI_PROVIDER_OPTIONS,
  describeModelEndpointHint,
  getAiProviderLabel,
} from '../../../../shared/api/contracts/ai/constants';

import { resolveEffectiveRequestParams, sanitizeRequestParams } from '../../../../core/ai/providers/modelRequestParams';
import { AiCapabilityGroupSeparator } from '../../../../shared/lib/aiModelCapabilityDisplay';
import type { AiModelCapabilities, AiModelEntry, AiProviderKind } from '../../../../shared/api/contracts/ai/types';
import { useAiProviderRemoteModelsQuery } from '../../../../shared/api/queries/aiModels';

import { AppButton } from '../../../../shared/ui/AppButton';

import { CreateEditModalShell } from '../../../../shared/ui/CreateEditModalShell';

import { cn } from '../../../../lib/utils';
import { getAiCapabilityLabel } from '../../settingsLabelsI18n';

import {
  SETTINGS_CONTROL_CLASS,
  SETTINGS_FORM_GRID_GAP_CLASS,
  SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS,
  SETTINGS_FORM_GROUP_BODY_STACK_CLASS,
  SettingsCheckboxCard,
  SettingsDisabledFieldset,
  SettingsField,
  SettingsFormGroup,
} from '../form/SettingsFormPrimitives';

import {

  PROVIDER_BADGE_CLASS,

  providerRequiresAzureFields,

  providerSupportsRemoteModelList,

} from './constants';



export type AiModelFormModalProps = {

  open: boolean;

  mode: 'create' | 'edit';

  form: AiModelEntry;

  configuredProviderKinds?: AiProviderKind[];

  providerBaseUrl?: string;

  formError: string | null;

  isSaving: boolean;

  onClose: () => void;

  onSubmit: () => void;

  onFormChange: (next: AiModelEntry) => void;

};



const AI_MODELS_SECTION_ID = 'ai-models' as const;

const AI_MODEL_REMOTE_OPTIONS_LIST_ID = 'ai-model-remote-options';



const ENABLED_SEGMENT_CLASS = (active: boolean) => cn(

  'inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none',

  active

    ? 'bg-emerald-50 text-emerald-700'

    : 'text-slate-500 hover:text-emerald-700',

);



const DISABLED_SEGMENT_CLASS = (active: boolean) => cn(

  'inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none',

  active

    ? 'bg-rose-50 text-rose-700'

    : 'text-slate-500 hover:text-rose-700',

);



export const AiModelFormModal: React.FC<AiModelFormModalProps> = ({

  open,

  mode,

  form,

  configuredProviderKinds = [],

  providerBaseUrl,

  formError,

  isSaving,

  onClose,

  onSubmit,

  onFormChange,

}) => {

  const t = useCultureT();
  const showAzureFields = providerRequiresAzureFields(form.provider);

  const endpointHint = describeModelEndpointHint(form.provider, form.baseUrl, providerBaseUrl);

  const providerLabel = getAiProviderLabel(form.provider, form.providerLabel);

  const remoteModelsSupported = providerSupportsRemoteModelList(form.provider);

  const remoteModelsQuery = useAiProviderRemoteModelsQuery(form.provider, open && remoteModelsSupported);

  const remoteModels = remoteModelsQuery.data ?? [];

  const handleModelIdChange = (value: string) => {

    const matched = mode === 'create' ? remoteModels.find((item) => item.id === value) : undefined;

    onFormChange({

      ...form,

      modelId: value,

      ...(matched?.contextLength ? { contextWindowTokens: matched.contextLength } : {}),

    });

  };

  const handleProviderChange = (provider: AiProviderKind) => {

    onFormChange({

      ...form,

      provider,

      providerLabel: getAiProviderLabel(provider),

      modelId: '',

      baseUrl: '',

      deploymentName: '',

      apiVersion: '',

    });

  };

  const [requestParamsInput, setRequestParamsInput] = useState('');

  const [requestParamsError, setRequestParamsError] = useState<string | null>(null);

  useEffect(() => {

    if (!open) return;

    const effective = resolveEffectiveRequestParams(form);

    setRequestParamsInput(

      effective && Object.keys(effective).length > 0

        ? JSON.stringify(effective, null, 2)

        : '',

    );

    setRequestParamsError(null);

  }, [open, form.id, form.requestParams, form.maxOutputTokens, form.temperatureDefault, form.modelId]);

  if (!open) return null;



  const fieldsDisabled = !form.enabled;

  const modelIdInvalid = !form.modelId.trim();



  const updateCapability = (key: keyof AiModelCapabilities, checked: boolean) => {

    onFormChange({

      ...form,

      capabilities: {

        ...form.capabilities,

        [key]: checked,

      },

    });

  };



  const handleRequestParamsChange = (value: string) => {

    setRequestParamsInput(value);

    const trimmed = value.trim();

    if (!trimmed) {

      setRequestParamsError(null);

      onFormChange({ ...form, requestParams: undefined });

      return;

    }



    try {

      const parsed = JSON.parse(trimmed) as unknown;

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {

        setRequestParamsError('Request parameters must be a JSON object.');

        return;

      }

      setRequestParamsError(null);

      const sanitized = sanitizeRequestParams(form.modelId, parsed as Record<string, unknown>);
      onFormChange({ ...form, requestParams: sanitized });

    } catch {

      setRequestParamsError('Invalid JSON.');

    }

  };



  const combinedFormError = formError ?? requestParamsError;



  return (

    <CreateEditModalShell

      size="3xl"

      title={mode === 'create' ? 'Create AI Model' : `Edit AI Model — ${form.modelId}`}

      onClose={onClose}

      closeOnEscape={false}

      subtitle={(

        <div className="flex flex-wrap items-center justify-between gap-3">

          <div className="flex min-w-0 flex-wrap items-center gap-2">

            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Provider</span>

            <span className={cn(

              'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold',

              PROVIDER_BADGE_CLASS,

            )}

            >

              {providerLabel}

            </span>

          </div>



          <div

            role="tablist"

            aria-label="Model availability"

            className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white p-1"

          >

            <button

              type="button"

              role="tab"

              aria-selected={form.enabled}

              className={ENABLED_SEGMENT_CLASS(form.enabled)}

              onClick={() => onFormChange({ ...form, enabled: true })}

            >

              <Check className="h-3 w-3 shrink-0" aria-hidden />

              Enabled

            </button>

            <button

              type="button"

              role="tab"

              aria-selected={!form.enabled}

              className={DISABLED_SEGMENT_CLASS(!form.enabled)}

              onClick={() => onFormChange({ ...form, enabled: false })}

            >

              <Ban className="h-3 w-3 shrink-0" aria-hidden />

              Disabled

            </button>

          </div>

        </div>

      )}

      footer={(

        <>

          <AppButton intent="cancel" onClick={onClose} disabled={isSaving}>

            <X className="h-3.5 w-3.5" />

            Cancel

          </AppButton>

          <AppButton intent="primary" onClick={onSubmit} disabled={isSaving || Boolean(requestParamsError)}>

            {isSaving ? (

              <Loader2 className="h-3.5 w-3.5 animate-spin" />

            ) : mode === 'create' ? (

              <Plus className="h-3.5 w-3.5" />

            ) : (

              <Save className="h-3.5 w-3.5" />

            )}

            {isSaving ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}

          </AppButton>

        </>

      )}

    >

      <div className={SETTINGS_FORM_GROUP_BODY_STACK_CLASS}>

        {combinedFormError ? (

          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">

            {combinedFormError}

          </div>

        ) : null}



        <SettingsDisabledFieldset disabled={fieldsDisabled}>

          {mode === 'create' ? (
            configuredProviderKinds.length === 0 ? (
              <p className="text-xs text-slate-600">
                Add a provider first (toolbar → Add provider), then create models under it.
              </p>
            ) : (
              <SettingsField label="Provider">
                <UiSelect
                  size="sm"
                  className={SETTINGS_CONTROL_CLASS}
                  value={form.provider}
                  onChange={(event) => handleProviderChange(event.target.value as AiProviderKind)}
                >
                  {AI_PROVIDER_OPTIONS.filter((option) => configuredProviderKinds.includes(option.value)).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </UiSelect>
              </SettingsField>
            )
          ) : null}

          <SettingsField
            label="Model ID"
            hint={
              remoteModelsSupported && remoteModelsQuery.isFetching
                ? 'Loading available models…'
                : remoteModelsSupported && remoteModelsQuery.isError
                  ? 'Could not load the model list from the provider — save an API key first, or type the model id manually.'
                  : undefined
            }
          >

            <UiInput

              size="sm"

              autoDir={false}

              value={form.modelId}

              isInvalid={modelIdInvalid}

              errorMessage={modelIdInvalid ? 'Model ID is required.' : undefined}

              onChange={(event) => handleModelIdChange(event.target.value)}

              list={remoteModelsSupported ? AI_MODEL_REMOTE_OPTIONS_LIST_ID : undefined}

              className={cn(SETTINGS_CONTROL_CLASS, 'font-mono')}

            />

            {remoteModelsSupported ? (
              <datalist id={AI_MODEL_REMOTE_OPTIONS_LIST_ID}>
                {remoteModels.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name ? `${item.name}${item.contextLength ? ` — ${item.contextLength.toLocaleString()} ctx` : ''}` : item.id}
                  </option>
                ))}
              </datalist>
            ) : null}

          </SettingsField>



          <SettingsFormGroup

            title="Connection"

            sectionId={AI_MODELS_SECTION_ID}

            divided

            description="Optional model-level endpoint override. Leave empty to inherit the provider base URL."

          >

            <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>

              <SettingsField label="Endpoint URL" hint={endpointHint} className="md:col-span-2">

                <UiInput

                  size="sm"

                  autoDir={false}

                  value={form.baseUrl || ''}

                  onChange={(event) => onFormChange({ ...form, baseUrl: event.target.value })}

                  className={cn(SETTINGS_CONTROL_CLASS, 'font-mono')}

                />

              </SettingsField>



              {showAzureFields ? (

                <>

                  <SettingsField label="Deployment Name">

                    <UiInput

                      size="sm"

                      className={SETTINGS_CONTROL_CLASS}

                      autoDir={false}

                      value={form.deploymentName || ''}

                      onChange={(event) => onFormChange({ ...form, deploymentName: event.target.value })}

                    />

                  </SettingsField>

                  <SettingsField label="API Version">

                    <UiInput

                      size="sm"

                      className={SETTINGS_CONTROL_CLASS}

                      autoDir={false}

                      value={form.apiVersion || ''}

                      onChange={(event) => onFormChange({ ...form, apiVersion: event.target.value })}

                      placeholder="2024-02-15-preview"

                    />

                  </SettingsField>

                </>

              ) : null}

              <SettingsField label="Request timeout (ms)" hint="HTTP timeout for provider calls — not sent in the API body.">

                <UiInput

                  size="sm"

                  className={SETTINGS_CONTROL_CLASS}

                  type="number"

                  value={form.timeoutMs ?? ''}

                  onChange={(event) => onFormChange({

                    ...form,

                    timeoutMs: event.target.value ? Number(event.target.value) : undefined,

                  })}

                  placeholder="60000"

                />

              </SettingsField>

            </div>

          </SettingsFormGroup>



          <SettingsFormGroup

            title="Capabilities"

            sectionId={AI_MODELS_SECTION_ID}

            divided

            description="Features exposed when this model is selected in chat."

          >

            <div className={cn('flex flex-wrap items-start', SETTINGS_FORM_GRID_GAP_CLASS)}>
              {AI_CAPABILITY_GROUPS.map((group, groupIndex) => (
                <React.Fragment key={group.join('-')}>
                  {groupIndex > 0 ? (
                    <AiCapabilityGroupSeparator className="hidden min-h-[2.5rem] self-stretch sm:block" />
                  ) : null}
                  <div className={cn('flex min-w-[9.5rem] flex-col', SETTINGS_FORM_GRID_GAP_CLASS)}>
                    {group.map((key) => (
                      <SettingsCheckboxCard
                        key={key}
                        id={`ai-model-cap-${key}`}
                        checked={form.capabilities[key]}
                        disabled={fieldsDisabled}
                        onChange={(checked) => updateCapability(key, checked)}
                        label={getAiCapabilityLabel(t, key)}
                      />
                    ))}
                  </div>
                </React.Fragment>
              ))}
            </div>

          </SettingsFormGroup>



          <SettingsFormGroup

            title="Request Parameters"

            sectionId={AI_MODELS_SECTION_ID}

            divided

            description="JSON merged into the provider API request. Set limits and sampling per model/platform — omit temperature for o-series reasoning models."

          >

            <SettingsField
              label="API request body (JSON)"
              hint="Examples: max_tokens / max_completion_tokens, temperature, reasoning_effort. Ollama uses an options object."
              labelBand={false}
            >

              <UiTextarea

                size="sm"

                autoDir={false}

                rows={8}

                value={requestParamsInput}

                disabled={fieldsDisabled}

                onChange={(event) => handleRequestParamsChange(event.target.value)}

                placeholder={'{\n  "max_completion_tokens": 4096\n}'}

                className={cn(SETTINGS_CONTROL_CLASS, 'font-mono')}

              />

            </SettingsField>

          </SettingsFormGroup>

        </SettingsDisabledFieldset>

      </div>

    </CreateEditModalShell>

  );

};


