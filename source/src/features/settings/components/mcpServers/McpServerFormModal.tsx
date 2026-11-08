import React, { useMemo, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { FeatureToggleField, UiInput, UiSelect, UiTextarea } from '../../../../shared/ui';
import type { AiMcpServerConfig } from '../../../../shared/api/contracts/ai/types';
import { AppButton } from '../../../../shared/ui/AppButton';
import { CreateEditModalShell } from '../../../../shared/ui/CreateEditModalShell';
import { SETTINGS_FORM_GROUP_BODY_STACK_CLASS, SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS, SETTINGS_CONTROL_CLASS, SETTINGS_SUBSECTION_LABEL_CLASS } from '../form/SettingsFormPrimitives';
import { cn } from '../../../../lib/utils';
import {
  formatCommaSeparatedList,
  MCP_TRANSPORT_OPTIONS,
  parseCommaSeparatedList,
  parseEnvRecord,
  serializeEnvRecord,
  slugifyMcpServerId,
} from './constants';

export type McpServerFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  form: AiMcpServerConfig;
  formError: string | null;
  isSaving: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFormChange: (next: AiMcpServerConfig) => void;
};

const fieldLabelClass = SETTINGS_SUBSECTION_LABEL_CLASS;

export const McpServerFormModal: React.FC<McpServerFormModalProps> = ({
  open,
  mode,
  form,
  formError,
  isSaving,
  readOnly = false,
  onClose,
  onSubmit,
  onFormChange,
}) => {
  const [argsInput, setArgsInput] = useState('');
  const [allowedToolsInput, setAllowedToolsInput] = useState('');
  const [envInput, setEnvInput] = useState('');

  const showRemoteFields = form.transport === 'sse' || form.transport === 'http';
  const showStdioFields = form.transport === 'stdio';

  const transportOptions = useMemo(() => MCP_TRANSPORT_OPTIONS, []);

  React.useEffect(() => {
    if (!open) return;
    setArgsInput(formatCommaSeparatedList(form.args));
    setAllowedToolsInput(formatCommaSeparatedList(form.allowedTools));
    setEnvInput(serializeEnvRecord(form.env));
  }, [form.args, form.allowedTools, form.env, open]);

  if (!open) return null;

  return (
    <CreateEditModalShell
      size="3xl"
      title={
        readOnly
          ? `View MCP Server — ${form.label}`
          : mode === 'create'
            ? 'Create MCP Server'
            : `Edit MCP Server — ${form.label}`
      }
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose} disabled={isSaving}>
            <X className="h-3.5 w-3.5" />
            {readOnly ? 'Close' : 'Cancel'}
          </AppButton>
          {!readOnly ? (
            <AppButton intent="primary" onClick={onSubmit} disabled={isSaving}>
              {mode === 'create' ? (
                <Plus className="h-3.5 w-3.5" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isSaving ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
            </AppButton>
          ) : null}
        </>
      )}
    >
      <div className={SETTINGS_FORM_GROUP_BODY_STACK_CLASS}>
        {readOnly ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            This MCP server is managed by an installed package and cannot be edited here.
          </p>
        ) : null}
        {formError ? <p className="text-xs font-semibold text-rose-600">{formError}</p> : null}

        <section className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
          <div className="flex flex-col gap-[2px]">
            <label className={fieldLabelClass}>Label</label>
            <UiInput
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
              value={form.label}
              disabled={readOnly}
              onChange={(event) => {
                const label = event.target.value;
                onFormChange({
                  ...form,
                  label,
                  id: mode === 'create' && !form.id.trim() ? slugifyMcpServerId(label) : form.id,
                });
              }}
            />
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className={fieldLabelClass}>Server ID</label>
            <UiInput
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
              value={form.id}
              disabled={mode === 'edit' || readOnly}
              onChange={(event) => onFormChange({ ...form, id: event.target.value })}
            />
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className={fieldLabelClass}>Transport</label>
            <UiSelect
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
              value={form.transport}
              disabled={readOnly}
              onChange={(event) => onFormChange({
                ...form,
                transport: event.target.value as AiMcpServerConfig['transport'],
              })}
            >
              {transportOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </UiSelect>
          </div>

          <FeatureToggleField
            className="pt-6"
            checked={form.enabled}
            disabled={readOnly}
            onChange={(enabled) => onFormChange({ ...form, enabled })}
            title="Enabled"
            description="Available for Agent sessions when toggled on in AppEndoo."
          />
        </section>

        {showStdioFields ? (
          <section className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
            <div className="flex flex-col gap-[2px] md:col-span-2">
              <label className={fieldLabelClass}>Command</label>
              <UiInput
                size="sm"
              className={SETTINGS_CONTROL_CLASS}
                value={form.command ?? ''}
                disabled={readOnly}
                onChange={(event) => onFormChange({ ...form, command: event.target.value })}
                placeholder="npx"
              />
            </div>
            <div className="flex flex-col gap-[2px] md:col-span-2">
              <label className={fieldLabelClass}>Args (comma-separated)</label>
              <UiInput
                size="sm"
              className={SETTINGS_CONTROL_CLASS}
                value={argsInput}
                disabled={readOnly}
                onChange={(event) => {
                  setArgsInput(event.target.value);
                  onFormChange({ ...form, args: parseCommaSeparatedList(event.target.value) });
                }}
                placeholder="-y, @modelcontextprotocol/server-filesystem, /path"
              />
            </div>
          </section>
        ) : null}

        {showRemoteFields ? (
          <div className="flex flex-col gap-[2px]">
            <label className={fieldLabelClass}>URL</label>
            <UiInput
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
              value={form.url ?? ''}
              disabled={readOnly}
              onChange={(event) => onFormChange({ ...form, url: event.target.value })}
              placeholder="https://mcp.example.com/sse"
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-[2px]">
          <label className={fieldLabelClass}>Allowed tools (comma-separated, empty = all)</label>
          <UiInput
            size="sm"
            className={SETTINGS_CONTROL_CLASS}
            value={allowedToolsInput}
            disabled={readOnly}
            onChange={(event) => {
              setAllowedToolsInput(event.target.value);
              onFormChange({ ...form, allowedTools: parseCommaSeparatedList(event.target.value) });
            }}
            placeholder="tool_a, tool_b"
          />
        </div>

        <div className="flex flex-col gap-[2px]">
          <label className={fieldLabelClass}>Environment variables (KEY=value per line)</label>
          <UiTextarea
            size="sm"
            className={SETTINGS_CONTROL_CLASS}
            value={envInput}
            disabled={readOnly}
            onChange={(event) => {
              setEnvInput(event.target.value);
              onFormChange({ ...form, env: parseEnvRecord(event.target.value) });
            }}
            placeholder={'API_KEY=secret\nDEBUG=true'}
          />
        </div>

        <div className="flex flex-col gap-[2px]">
          <label className={fieldLabelClass}>Note</label>
          <UiTextarea
            size="sm"
            className={SETTINGS_CONTROL_CLASS}
            value={form.note ?? ''}
            disabled={readOnly}
            onChange={(event) => onFormChange({ ...form, note: event.target.value })}
          />
        </div>
      </div>
    </CreateEditModalShell>
  );
};
