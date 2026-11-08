import React from 'react';
import { Save, Webhook, X } from 'lucide-react';
import type { ServerFunctionHookConfig, ServerFunctionHooksConfig } from '../api/contracts/server-functions/hooks';
import type { ServerFunctionMetadataJson } from '../api/contracts/server-functions/types';
import { AppButton } from './AppButton';
import { CreateEditModalShell } from './CreateEditModalShell';
import { UiCheckboxChoice, UiCheckboxChoiceList } from './FormChoiceFields';
import { UiInput } from './HeroFieldControls';

type HookKind = 'before' | 'after';

const emptyHook = (): ServerFunctionHookConfig => ({ workflowName: '', fields: [] });

export const HOOKS_ACTION_ARIA_LABEL = 'Configure hooks';

/**
 * p-68 WHOOK Part C — "before/after execution, fire this workflow" toggle. Always fire-and-forget
 * (see `workflowHookFiring.ts`); this is purely a notification, not an interceptor over the
 * function's own input/output. Fields offered per side come from the function's own derived doc
 * metadata (`metadataJson.derived.docHints`) — no separate schema-introspection call needed.
 */
export const ServerFunctionHooksModal: React.FC<{
  open: boolean;
  titlePath: string;
  hooks: ServerFunctionHooksConfig;
  metadataJson?: ServerFunctionMetadataJson | null;
  disabled?: boolean;
  onClose: () => void;
  onChange: (hooks: ServerFunctionHooksConfig) => void;
  onSave: () => void | Promise<void>;
}> = ({ open, titlePath, hooks, metadataJson, disabled = false, onClose, onChange, onSave }) => {
  if (!open) return null;

  const docHints = metadataJson?.derived?.docHints;
  const inputFields = [...new Set([
    ...(docHints?.paramFields ?? []),
    ...(docHints?.queryFields ?? []),
    ...(docHints?.validationFields ?? []),
  ])];
  const outputFields = docHints?.outputFields ?? [];

  const updateHook = (kind: HookKind, patch: Partial<ServerFunctionHookConfig> | null) => {
    if (patch === null) {
      onChange({ ...hooks, [kind]: undefined });
      return;
    }
    onChange({ ...hooks, [kind]: { ...(hooks[kind] ?? emptyHook()), ...patch } });
  };

  const toggleField = (kind: HookKind, field: string) => {
    const current = hooks[kind] ?? emptyHook();
    const fields = current.fields.includes(field)
      ? current.fields.filter((item) => item !== field)
      : [...current.fields, field];
    updateHook(kind, { fields });
  };

  const renderSection = (kind: HookKind, label: string, availableFields: string[]) => {
    const config = hooks[kind];
    const enabled = Boolean(config);

    return (
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
        <UiCheckboxChoice
          checked={enabled}
          disabled={disabled}
          onChange={(checked) => updateHook(kind, checked ? emptyHook() : null)}
        >
          {label}
        </UiCheckboxChoice>

        {enabled ? (
          <div className="flex flex-col gap-2 ps-6">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-600">Workflow name</span>
              <UiInput
                size="sm"
                aiAssist={false}
                autoDir={false}
                className="font-mono"
                placeholder="e.g. order-completed"
                value={config?.workflowName ?? ''}
                disabled={disabled}
                ariaLabel="Workflow name"
                onChange={(e) => updateHook(kind, { workflowName: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-600">
                {kind === 'before' ? 'Input fields to forward' : 'Output fields to forward'}
              </span>
              {availableFields.length === 0 ? (
                <p className="text-[11px] text-slate-500">No known fields yet — save the function once to detect them, or fields sent won't be filtered.</p>
              ) : (
                <UiCheckboxChoiceList
                  size="sm"
                  orientation="horizontal"
                  disabled={disabled}
                  idPrefix={`${kind}-hook-field`}
                  options={availableFields.map((field) => ({
                    id: field,
                    label: <span className="font-mono">{field}</span>,
                    checked: config?.fields.includes(field) ?? false,
                    onChange: () => toggleField(kind, field),
                  }))}
                />
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <CreateEditModalShell
      title={`Hooks — ${titlePath}`}
      size="auto"
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton intent="primary" size="sm" disabled={disabled} onClick={() => void onSave()}>
            <Save className="h-3.5 w-3.5" />
            Save Hooks
          </AppButton>
        </>
      )}
    >
      <div className="flex w-[420px] flex-col gap-3 p-[15px] text-sm">
        <p className="rounded border border-indigo-200 bg-indigo-50/60 p-2 text-[11px] text-indigo-800">
          <Webhook className="me-1 inline h-3 w-3" />
          Fire-and-forget only — this function never waits for the workflow, and never sees its result.
        </p>
        {renderSection('before', 'Before execution, start a workflow', inputFields)}
        {renderSection('after', 'After execution, start a workflow', outputFields)}
      </div>
    </CreateEditModalShell>
  );
};
