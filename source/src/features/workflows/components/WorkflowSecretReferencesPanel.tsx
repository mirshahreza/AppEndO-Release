import React, { useCallback, useEffect, useState } from 'react';
import { Lock, Plus, Save, Trash2, X } from 'lucide-react';
import { FloatingPanelShell } from '../../../shared/ui/FloatingPanelShell';
import { AppButton, ConfirmDialogShell, UiCheckbox, UiInput, UiTextarea } from '../../../shared/ui';
import { workflowsApi, WorkflowsApiError } from '../api/workflowsApi';
import type { WorkflowSecretReference } from '../types';

const PANEL_BOUNDS = { minWidth: 360, maxWidth: 640, minHeight: 320, maximizeInset: 24 };

const emptyForm = { name: '', label: '', description: '', value: '' };
const emptyEditForm = { label: '', description: '', value: '', clearValue: false };

/**
 * Admin management panel for the `WorkflowSecretReference` registry. Two modes coexist (p-99/
 * WFT-3): a reference can still be name-only (Option 1 — an env-var indirection the platform team
 * sets manually on the server), or it can hold a real value, encrypted at rest
 * (`workflowCredentialCrypto.ts`) and resolved in preference to the env var at dispatch time. The
 * stored value is NEVER read back to this UI — only whether one exists (`hasStoredValue`).
 * `name` is immutable after creation — renaming would silently break every already-authored field
 * that already stores the old name as its literal value.
 */
export const WorkflowSecretReferencesPanel: React.FC<{
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}> = ({ open, onClose, onChanged }) => {
  const [references, setReferences] = useState<WorkflowSecretReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await workflowsApi.listSecretReferences();
      setReferences(result.references);
    } catch (e) {
      setError(e instanceof WorkflowsApiError ? e.message : 'Failed to load secret references.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const submitCreate = async () => {
    if (!form.name.trim() || !form.label.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await workflowsApi.createSecretReference({
        name: form.name.trim(),
        label: form.label.trim(),
        description: form.description.trim() || null,
        value: form.value.trim() || undefined,
      });
      setForm(emptyForm);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof WorkflowsApiError ? e.message : 'Failed to create secret reference.');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (ref: WorkflowSecretReference) => {
    setEditingId(ref.id);
    setEditForm({ label: ref.label, description: ref.description ?? '', value: '', clearValue: false });
  };

  const submitEdit = async (id: number) => {
    if (!editForm.label.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await workflowsApi.updateSecretReference(id, {
        label: editForm.label.trim(),
        description: editForm.description.trim() || null,
        // Checked "clear" wins over a typed value; an empty, unchecked field omits the key entirely
        // (leaves whatever is already stored untouched) — never silently wiped by a label-only edit.
        ...(editForm.clearValue ? { value: null } : editForm.value.trim() ? { value: editForm.value.trim() } : {}),
      });
      setEditingId(null);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof WorkflowsApiError ? e.message : 'Failed to update secret reference.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (pendingDeleteId === null) return;
    setBusy(true);
    setError(null);
    try {
      await workflowsApi.deleteSecretReference(pendingDeleteId);
      setPendingDeleteId(null);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof WorkflowsApiError ? e.message : 'Failed to delete secret reference.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FloatingPanelShell
      open={open}
      onClose={onClose}
      title="Secret references"
      titleIcon={<Lock className="h-4 w-4 text-amber-600" />}
      bounds={PANEL_BOUNDS}
      defaultWidth={460}
      defaultHeight={520}
      initialPosition="center"
      zIndexClassName="z-[93]"
    >
      <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
        <p className="rounded border border-amber-200 bg-amber-50/60 p-2 text-[11px] text-amber-800">
          Either store an encrypted value here directly, or leave it blank and set a same-named environment variable on the server instead — a stored value always wins over the environment variable when both exist. The stored value is never shown again once saved.
        </p>

        {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}

        <div className="flex flex-col gap-1.5 rounded border border-slate-200 p-2">
          <span className="text-[11px] font-semibold text-slate-700">Add a secret reference</span>
          <UiInput
            size="sm"
            aiAssist={false}
            className="text-xs"
            placeholder="Name, e.g. SLACK_WEBHOOK_URL"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <UiInput
            size="sm"
            aiAssist={false}
            className="text-xs"
            placeholder="Friendly label, e.g. Slack webhook (#ops channel)"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
          <UiTextarea
            size="sm"
            aiAssist={false}
            className="text-xs"
            placeholder="Description (optional)"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <UiInput
            size="sm"
            aiAssist={false}
            type="password"
            className="text-xs"
            placeholder="Value (optional — leave blank to use a server environment variable instead)"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
          />
          <AppButton intent="primary" size="sm" disabled={busy || !form.name.trim() || !form.label.trim()} onClick={() => void submitCreate()}>
            <Plus className="h-3.5 w-3.5" /> Add
          </AppButton>
        </div>

        <div className="flex flex-col gap-1.5">
          {loading ? <p className="text-xs text-slate-500">Loading…</p> : null}
          {!loading && references.length === 0 ? <p className="text-xs text-slate-500">No secret references registered yet.</p> : null}
          {references.map((ref) => (
            <div key={ref.id} className="flex flex-col gap-1 rounded border border-slate-200 p-2">
              {editingId === ref.id ? (
                <>
                  <span className="font-mono text-xs text-slate-500">{ref.name}</span>
                  <UiInput size="sm" aiAssist={false} className="text-xs" value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} />
                  <UiTextarea size="sm" aiAssist={false} className="text-xs" rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                  <UiInput
                    size="sm"
                    aiAssist={false}
                    type="password"
                    className="text-xs"
                    disabled={editForm.clearValue}
                    placeholder={ref.hasStoredValue ? 'Leave blank to keep the stored value' : 'Set a value (optional)'}
                    value={editForm.value}
                    onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                  />
                  {ref.hasStoredValue ? (
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-600">
                      <UiCheckbox size="sm" checked={editForm.clearValue} onChange={(e) => setEditForm({ ...editForm, clearValue: e.target.checked, value: '' })} />
                      Clear the stored value (revert to using a server environment variable)
                    </label>
                  ) : null}
                  <div className="flex gap-1.5">
                    <AppButton intent="primary" size="sm" disabled={busy || !editForm.label.trim()} onClick={() => void submitEdit(ref.id)}>
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </AppButton>
                    <AppButton intent="cancel" size="sm" disabled={busy} onClick={() => setEditingId(null)}>
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </AppButton>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-slate-800">{ref.label}</span>
                        <span
                          className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${ref.hasStoredValue ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                          title={ref.hasStoredValue ? 'A value is stored (encrypted) for this reference' : 'No value stored — resolves from a server environment variable'}
                        >
                          {ref.hasStoredValue ? 'value stored' : 'env-var only'}
                        </span>
                        {!ref.hasStoredValue ? (
                          <span
                            className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${ref.configuredOnThisNode ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                            title={ref.configuredOnThisNode ? 'Set on this server process' : 'Not set on this server process (may still be set on other nodes)'}
                          >
                            {ref.configuredOnThisNode ? 'configured' : 'not set here'}
                          </span>
                        ) : null}
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">{ref.name}</span>
                      {ref.description ? <p className="mt-0.5 text-[10px] text-slate-500">{ref.description}</p> : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => startEdit(ref)} className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100">
                        Edit
                      </button>
                      <button type="button" onClick={() => setPendingDeleteId(ref.id)} className="rounded border border-red-200 p-1 text-red-500 hover:bg-red-50" title="Delete">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialogShell
        open={pendingDeleteId !== null}
        title="Delete secret reference"
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        confirmLabel="Delete"
        confirmIntent="destructive-soft"
      >
        <p className="text-sm text-slate-700">
          This removes the reference (and its stored value, if any) — any node already referencing it by literal value keeps working only if a same-named environment variable still exists on the server. Continue?
        </p>
      </ConfirmDialogShell>
    </FloatingPanelShell>
  );
};
