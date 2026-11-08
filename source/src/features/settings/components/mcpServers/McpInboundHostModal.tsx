import React from 'react';
import { Save, X } from 'lucide-react';
import { BASE_ROLES } from '../../../../shared/api/contracts/roles/constants';
import { FeatureToggleField, UiInput, UiSelect } from '../../../../shared/ui';
import { AppButton } from '../../../../shared/ui/AppButton';
import { CreateEditModalShell } from '../../../../shared/ui/CreateEditModalShell';
import { SETTINGS_FORM_GROUP_BODY_STACK_CLASS } from '../form/SettingsFormPrimitives';

export type McpInboundHostDraft = {
  enabled: boolean;
  apiKey: string;
  serviceRoleName: string;
};

export type McpInboundHostModalProps = {
  open: boolean;
  draft: McpInboundHostDraft;
  formError: string | null;
  hasStoredApiKey: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onDraftChange: (next: McpInboundHostDraft) => void;
};

const fieldLabelClass = 'block text-sm font-semibold text-slate-700 ps-[4px]';

export const McpInboundHostModal: React.FC<McpInboundHostModalProps> = ({
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
      title="Inbound MCP Host"
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
          Expose AppEndO as an MCP server at <code className="text-[11px]">GET/POST /api/mcp</code> for external MCP clients.
          Authenticate with <code className="text-[11px]">Authorization: Bearer</code> or <code className="text-[11px]">X-API-Key</code>.
        </p>

        {formError ? <p className="text-xs font-semibold text-rose-600">{formError}</p> : null}

        <FeatureToggleField
          checked={draft.enabled}
          onChange={(enabled) => onDraftChange({ ...draft, enabled })}
          title="Enabled"
          description="Allow external MCP clients to connect."
        />

        <div className="flex flex-col gap-[2px]">
          <label className={fieldLabelClass}>Service role</label>
          <UiSelect
            size="sm"
            value={draft.serviceRoleName}
            onChange={(event) => onDraftChange({ ...draft, serviceRoleName: event.target.value })}
            disabled={!draft.enabled}
          >
            {BASE_ROLES.map((roleName) => (
              <option key={roleName} value={roleName}>{roleName}</option>
            ))}
          </UiSelect>
          <span className="text-xs text-slate-500 ps-[4px]">
            Inbound tools are limited to the intersection of default capability packs and this role&apos;s MCP grants.
          </span>
        </div>

        <div className="flex flex-col gap-[2px]">
          <label className={fieldLabelClass}>API key</label>
          <UiInput
            size="sm"
            type="password"
            value={draft.apiKey}
            onChange={(event) => onDraftChange({ ...draft, apiKey: event.target.value })}
            placeholder={hasStoredApiKey ? 'Stored key — leave blank to keep' : 'Minimum 16 characters'}
            disabled={!draft.enabled}
          />
        </div>
      </div>
    </CreateEditModalShell>
  );
};
