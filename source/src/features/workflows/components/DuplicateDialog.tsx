import React, { useState } from 'react';
import { UiInput, UiRadioGroup } from '../../../shared/ui';
import { workflowsApi, WorkflowsApiError } from '../api/workflowsApi';
import type { WorkflowDefinitionSummary, WorkflowDesignerProjection } from '../types';

export type WorkflowDuplicateSource = {
  definitionId: number;
  scopeKey: string;
  key: string;
  draftVersion: number;
  currentPublishedRevisionId: number | null;
};

export const workflowDuplicateSourceFromSummary = (definition: WorkflowDefinitionSummary): WorkflowDuplicateSource => ({
  definitionId: definition.id,
  scopeKey: definition.scopeKey,
  key: definition.key,
  draftVersion: definition.draftVersion,
  currentPublishedRevisionId: definition.currentPublishedRevisionId,
});

export const workflowDuplicateSourceFromProjection = (projection: WorkflowDesignerProjection): WorkflowDuplicateSource => ({
  definitionId: projection.definition.id,
  scopeKey: projection.definition.scopeKey,
  key: projection.definition.key,
  draftVersion: projection.draftVersion,
  currentPublishedRevisionId: projection.currentPublishedRevision?.id ?? null,
});

/**
 * Doc 08 section 9 — Duplicate requires target scope, new key/name and a source draft (version-
 * fenced) or revision snapshot. Not a Template Gallery/Marketplace/Remix feature.
 */
export const DuplicateDialog: React.FC<{ source: WorkflowDuplicateSource; onClose: () => void; onDuplicated: (newDefinitionId: number) => void }> = ({ source, onClose, onDuplicated }) => {
  const [sourceType, setSourceType] = useState<'DRAFT' | 'REVISION'>('DRAFT');
  const [targetKey, setTargetKey] = useState(`${source.key}-copy`);
  const [targetName, setTargetName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const duplicateSource =
        sourceType === 'DRAFT'
          ? { type: 'DRAFT', workflowDefinitionId: source.definitionId, expectedDraftVersion: source.draftVersion }
          : { type: 'REVISION', sourceRevisionId: source.currentPublishedRevisionId };
      const target = { scopeKey: source.scopeKey, key: targetKey, name: targetName || undefined };
      const result = await workflowsApi.duplicate(duplicateSource, target);
      onDuplicated((result.record as { id: number }).id);
    } catch (err) {
      setError(err instanceof WorkflowsApiError ? `${err.code}: ${err.message}` : 'Duplicate failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30">
      <div className="w-96 rounded bg-white p-4 shadow-xl">
        <h3 className="mb-3 text-sm font-semibold">Duplicate workflow</h3>
        <div className="flex flex-col gap-2 text-xs">
          <UiRadioGroup
            size="sm"
            value={sourceType}
            onChange={(value) => setSourceType(value as 'DRAFT' | 'REVISION')}
            options={[
              { value: 'DRAFT', label: `from current draft (v${source.draftVersion})` },
              {
                value: 'REVISION',
                label: `from published revision ${source.currentPublishedRevisionId ? `#${source.currentPublishedRevisionId}` : '(none published)'}`,
                disabled: !source.currentPublishedRevisionId,
              },
            ]}
          />
          <label>
            New key
            <UiInput size="sm" autoDir={false} className="mt-0.5 w-full" value={targetKey} onChange={(e) => setTargetKey(e.target.value)} />
          </label>
          <label>
            New name (optional)
            <UiInput size="sm" className="mt-0.5 w-full" value={targetName} onChange={(e) => setTargetName(e.target.value)} />
          </label>
        </div>
        {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3 py-1.5 text-xs">
            Cancel
          </button>
          <button type="button" disabled={busy || !targetKey} onClick={submit} className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-50">
            Duplicate
          </button>
        </div>
      </div>
    </div>
  );
};
