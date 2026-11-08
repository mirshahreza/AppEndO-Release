import React from 'react';
import { Save, X } from 'lucide-react';
import { FeatureToggleField, UiInput, UiSelect } from '../../../../shared/ui';
import { AI_WEB_SEARCH_PROVIDER_OPTIONS } from '../../../../shared/api/contracts/ai/constants';
import type { AiWebSearchProvider } from '../../../../shared/api/contracts/ai/types';
import { AppButton } from '../../../../shared/ui/AppButton';
import { CreateEditModalShell } from '../../../../shared/ui/CreateEditModalShell';
import { SETTINGS_FORM_GROUP_BODY_STACK_CLASS, SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS } from '../form/SettingsFormPrimitives';

export type McpWebSearchDraft = {
  provider: AiWebSearchProvider;
  apiKey: string;
  maxResults: number;
};

export type McpWebSearchModalProps = {
  open: boolean;
  draft: McpWebSearchDraft;
  formError: string | null;
  hasStoredApiKey: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onDraftChange: (next: McpWebSearchDraft) => void;
};

const fieldLabelClass = 'block text-sm font-semibold text-slate-700 ps-[4px]';

export const McpWebSearchModal: React.FC<McpWebSearchModalProps> = ({
  open,
  draft,
  formError,
  hasStoredApiKey,
  isSaving,
  onClose,
  onSubmit,
  onDraftChange,
}) => {
  if (!open) return null;

  return (
    <CreateEditModalShell
      size="3xl"
      title="Web / Search — appendo-web"
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose} disabled={isSaving}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton intent="primary" onClick={onSubmit} disabled={isSaving}>
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : 'Save'}
          </AppButton>
        </>
      )}
    >
      <div className={SETTINGS_FORM_GROUP_BODY_STACK_CLASS}>
        <p className="text-xs text-slate-500">
          Configure the search provider for the <code className="text-[11px]">web_search</code> agent tool.
          <code className="text-[11px]">fetch_url</code> and <code className="text-[11px]">screenshot_url</code> use SSRF protection and do not require a provider.
        </p>

        {formError ? <p className="text-xs font-semibold text-rose-600">{formError}</p> : null}

        <section className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
          <div className="flex flex-col gap-[2px]">
            <label className={fieldLabelClass}>Provider</label>
            <UiSelect
              size="sm"
              value={draft.provider}
              onChange={(event) => onDraftChange({
                ...draft,
                provider: event.target.value as AiWebSearchProvider,
              })}
            >
              {AI_WEB_SEARCH_PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </UiSelect>
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className={fieldLabelClass}>Max results</label>
            <UiInput
              size="sm"
              type="number"
              value={draft.maxResults}
              onChange={(event) => onDraftChange({
                ...draft,
                maxResults: Number(event.target.value) || 1,
              })}
              disabled={draft.provider === 'disabled'}
            />
          </div>

          <div className="flex flex-col gap-[2px] md:col-span-2">
            <label className={fieldLabelClass}>API key</label>
            <UiInput
              size="sm"
              type="password"
              value={draft.apiKey}
              onChange={(event) => onDraftChange({ ...draft, apiKey: event.target.value })}
              placeholder={hasStoredApiKey ? 'Stored key — leave blank to keep' : 'Provider API key'}
              disabled={draft.provider === 'disabled'}
            />
          </div>
        </section>

        <FeatureToggleField
          checked={draft.provider !== 'disabled'}
          onChange={(enabled) => onDraftChange({
            ...draft,
            provider: enabled ? (draft.provider === 'disabled' ? 'brave' : draft.provider) : 'disabled',
          })}
          title="Enabled"
          description="When off, web search is unavailable in Agent capabilities."
        />
      </div>
    </CreateEditModalShell>
  );
};
