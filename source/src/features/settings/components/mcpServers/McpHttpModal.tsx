import React from 'react';
import { Save, X } from 'lucide-react';
import { UiTextarea } from '../../../../shared/ui';
import { AppButton } from '../../../../shared/ui/AppButton';
import { CreateEditModalShell } from '../../../../shared/ui/CreateEditModalShell';

export type McpHttpDraft = {
  allowedHostnamesText: string;
};

export type McpHttpModalProps = {
  open: boolean;
  draft: McpHttpDraft;
  formError: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onDraftChange: (next: McpHttpDraft) => void;
};

const fieldLabelClass = 'block text-sm font-semibold text-slate-700 ps-[4px]';

export const McpHttpModal: React.FC<McpHttpModalProps> = ({
  open,
  draft,
  formError,
  isSaving,
  onClose,
  onSubmit,
  onDraftChange,
}) => {
  if (!open) return null;

  return (
    <CreateEditModalShell
      size="3xl"
      title="API Call — appendo-http"
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
      <div className="flex flex-col gap-5">
        <p className="text-xs text-slate-500">
          Allowlist hostnames for the <code className="text-[11px]">http_request</code> agent tool.
          Requests to other hosts are rejected. SSRF protection still blocks loopback and private addresses.
        </p>

        {formError ? <p className="text-xs font-semibold text-rose-600">{formError}</p> : null}

        <div className="flex flex-col gap-[2px]">
          <label className={fieldLabelClass}>Allowed hostnames</label>
          <UiTextarea
            size="sm"
            rows={6}
            value={draft.allowedHostnamesText}
            onChange={(event) => onDraftChange({
              ...draft,
              allowedHostnamesText: event.target.value,
            })}
            placeholder={'api.example.com\nhooks.example.com'}
          />
          <p className="ps-[4px] text-xs text-slate-500">One hostname per line or comma-separated. No protocol or path.</p>
        </div>
      </div>
    </CreateEditModalShell>
  );
};
