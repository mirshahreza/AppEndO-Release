import React, { useCallback, useMemo, useState } from 'react';
import { UiInput } from '../../../shared/ui';
import { workflowsApi } from '../api/workflowsApi';
import type { ReferenceDescriptor } from '../types';

/**
 * Doc 08 section 7 / doc 11 section 5 — the Semantic `@` Reference Picker. Typing `@` opens
 * authorized context-valid roots fetched from `WorkflowReferenceCatalog`; fuzzy search narrows by
 * label; selection resolves exactly one descriptor (never the label text) and is inserted as a
 * stable canonical token `@WORKFLOW_INPUT`, `@VAR:total`, `@NODE:a1`, `@EVENT`, `@WORK_ITEM:OUTCOME`
 * — the same stable identity `descriptorIdentity()` computes server-side, never the (possibly
 * colliding) display label.
 */
export const ReferencePickerInput: React.FC<{
  definitionId: number;
  value: string;
  onChange?: (value: string) => void;
  /** Fires with the exact selected descriptor (in addition to `onChange`'s display token) so a form
   * field can compile it into a real CanonicalExpression rather than re-parsing the token string.
   * `segments` carries an optional field-path suffix (e.g. picking a suggested output field). */
  onSelectDescriptor?: (descriptor: ReferenceDescriptor, segments?: Array<string | number>) => void;
  readOnly?: boolean;
  context: { consumerNodeKey: string | null; isWaitEventContext: boolean; isWorkItemOutputContext: boolean; isOutputAssignmentContext: boolean; isForEachItemContext: boolean };
  /** Known output field names for a NODE_OUTPUT descriptor's `nodeKey`, if any — pure client-side
   * UI sugar (see `buildOutputFieldsIndex`), rendered as one-click sub-suggestions under that node's
   * row. Never affects which descriptors themselves are offered — that stays server-authorized. */
  getOutputFieldNames?: (nodeKey: string) => string[];
  /** WFV2-22 — full dotted field paths (e.g. `[['body','status']]`) when the output schema is known. */
  getOutputFieldPaths?: (nodeKey: string) => string[][];
}> = ({ definitionId, value, onChange, onSelectDescriptor, readOnly, context, getOutputFieldNames, getOutputFieldPaths }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [descriptors, setDescriptors] = useState<ReferenceDescriptor[]>([]);
  const [loading, setLoading] = useState(false);

  const openPicker = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    try {
      const result = await workflowsApi.getReferenceCatalog(definitionId, context);
      setDescriptors(result.descriptors as ReferenceDescriptor[]);
    } finally {
      setLoading(false);
    }
  }, [definitionId, context]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === '@') {
      void openPicker();
    }
    if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const filtered = descriptors.filter((d) => d.label.toLowerCase().includes(query.toLowerCase()));

  const groupedRows = useMemo(() => {
    const rows: Array<{ kind: 'header'; label: string } | { kind: 'descriptor'; descriptor: ReferenceDescriptor }> = [];
    const nonNodeOutput = filtered.filter((d) => d.type !== 'NODE_OUTPUT');
    const nodeOutputs = filtered.filter((d) => d.type === 'NODE_OUTPUT');

    for (const descriptor of nonNodeOutput) {
      rows.push({ kind: 'descriptor', descriptor });
    }

    if (nodeOutputs.length === 0) return rows;

    const byDistance = new Map<number, ReferenceDescriptor[]>();
    for (const descriptor of nodeOutputs) {
      const distance = typeof descriptor.ancestorDistance === 'number' ? descriptor.ancestorDistance : 0;
      const list = byDistance.get(distance) ?? [];
      list.push(descriptor);
      byDistance.set(distance, list);
    }

    for (const distance of Array.from(byDistance.keys()).sort((a, b) => a - b)) {
      const label = distance === 0
        ? 'Current node output'
        : distance === 1
          ? 'Immediate upstream'
          : `${distance} steps upstream`;
      rows.push({ kind: 'header', label });
      for (const descriptor of byDistance.get(distance) ?? []) {
        rows.push({ kind: 'descriptor', descriptor });
      }
    }

    return rows;
  }, [filtered]);

  const insert = (descriptor: ReferenceDescriptor, segments: Array<string | number> = []) => {
    const suffix = segments.length > 0 ? `.${segments.join('.')}` : '';
    const token = `@${descriptorToken(descriptor)}${suffix}`;
    onChange?.(token);
    onSelectDescriptor?.(descriptor, segments);
    setOpen(false);
    setQuery('');
  };

  const fieldPathsForNode = (nodeKey: string): string[][] => {
    const paths = getOutputFieldPaths?.(nodeKey);
    if (paths && paths.length > 0) return paths;
    return (getOutputFieldNames?.(nodeKey) ?? []).map((name) => [name]);
  };

  return (
    <div className="relative">
      <UiInput
        size="sm"
        aiAssist={false}
        readOnly={readOnly}
        className="w-full text-xs"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="type @ for references…"
      />
      {open ? (
        <div className="absolute z-10 mt-1 w-72 rounded border border-slate-300 bg-white shadow-lg">
          <UiInput
            autoFocus
            size="sm"
            aiAssist={false}
            placeholder="…"
            className="w-full border-0 border-b border-slate-200 text-xs !rounded-none !shadow-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-56 overflow-y-auto">
            {loading ? <div className="p-2 text-xs text-slate-500">Loading…</div> : null}
            {!loading && filtered.length === 0 ? <div className="p-2 text-xs text-slate-500">No authorized references match.</div> : null}
            {groupedRows.map((row, index) => {
              if (row.kind === 'header') {
                return (
                  <div key={`header-${row.label}-${index}`} className="border-t border-slate-100 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:border-t-0">
                    {row.label}
                  </div>
                );
              }
              const d = row.descriptor;
              const outputFieldPaths = d.type === 'NODE_OUTPUT' ? fieldPathsForNode(d.nodeKey as string) : [];
              const indent = d.type === 'NODE_OUTPUT' && typeof d.ancestorDistance === 'number' && d.ancestorDistance > 0
                ? Math.min(d.ancestorDistance, 4) * 8
                : 0;
              return (
                <div key={`${d.type}:${JSON.stringify(d)}`}>
                  <button
                    type="button"
                    onClick={() => insert(d)}
                    className="block w-full py-1.5 text-left text-xs hover:bg-slate-100"
                    style={{ paddingLeft: `${8 + indent}px`, paddingRight: '8px' }}
                  >
                    <span className="font-mono text-slate-500">{d.type}</span> {d.label}
                  </button>
                  {outputFieldPaths.length > 0 ? (
                    <div className="flex flex-wrap gap-1 px-2 pb-1.5" style={{ paddingLeft: `${8 + indent}px` }}>
                      {outputFieldPaths.map((segments) => {
                        const dotted = segments.join('.');
                        return (
                          <button
                            key={dotted}
                            type="button"
                            onClick={() => insert(d, segments)}
                            title={`Insert ${d.label}.${dotted}`}
                            className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 hover:border-primary-400 hover:text-primary-700"
                          >
                            .{dotted}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="w-full border-t border-slate-200 px-2 py-1 text-xs text-slate-500">
            close
          </button>
        </div>
      ) : null}
    </div>
  );
};

function descriptorToken(d: ReferenceDescriptor): string {
  switch (d.type) {
    case 'WORKFLOW_INPUT':
      return 'WORKFLOW_INPUT';
    case 'WORKFLOW_VARIABLE':
      return `VAR:${d.variableKey as string}`;
    case 'NODE_OUTPUT':
      return `NODE:${d.nodeKey as string}`;
    case 'CURRENT_NODE_INPUT':
      return 'CURRENT_NODE_INPUT';
    case 'CURRENT_EVENT':
      return 'EVENT';
    case 'CURRENT_WORK_ITEM':
      return `WORK_ITEM:${d.projection as string}`;
    case 'CURRENT_ITEM':
      return 'ITEM';
    case 'CURRENT_ITEM_INDEX':
      return 'ITEM_INDEX';
    default:
      return d.type;
  }
}
