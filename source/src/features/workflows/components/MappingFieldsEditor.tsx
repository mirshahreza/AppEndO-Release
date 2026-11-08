import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { UiInput } from '../../../shared/ui';
import { ExpressionField } from './ExpressionField';
import type { CanonicalExpression, CanonicalMapping } from '../types';

/** Editor for one `CanonicalMapping` (ACTION input/config, END output, WORK_ITEM input) — a set of
 * named fields, each an `ExpressionField`. Mirrors the exact `{type:'OBJECT', fields:{k:{type:
 * 'EXPRESSION', expression}}}` shape `applyDraftOperations` validates, so a field built here is
 * indistinguishable from one hand-written in the raw-JSON editor. */
export const MappingFieldsEditor: React.FC<{
  label: string;
  definitionId: number;
  mapping: CanonicalMapping;
  onChange: (mapping: CanonicalMapping) => void;
  context: { consumerNodeKey: string | null; isWaitEventContext: boolean; isWorkItemOutputContext: boolean; isOutputAssignmentContext: boolean; isForEachItemContext: boolean };
  /** See `ReferencePickerInput`'s prop of the same name — threaded through unchanged. */
  getOutputFieldNames?: (nodeKey: string) => string[];
  getOutputFieldPaths?: (nodeKey: string) => string[][];
}> = ({ label, definitionId, mapping, onChange, context, getOutputFieldNames, getOutputFieldPaths }) => {
  const [newFieldName, setNewFieldName] = useState('');
  const fieldNames = Object.keys(mapping.fields ?? {});

  const setFieldExpression = (fieldName: string, expression: CanonicalExpression) => {
    onChange({ type: 'OBJECT', fields: { ...mapping.fields, [fieldName]: { type: 'EXPRESSION', expression } } });
  };

  const removeField = (fieldName: string) => {
    const next = { ...mapping.fields };
    delete next[fieldName];
    onChange({ type: 'OBJECT', fields: next });
  };

  const addField = () => {
    const name = newFieldName.trim();
    if (!name || fieldNames.includes(name)) return;
    setFieldExpression(name, { op: 'LITERAL', value: '' });
    setNewFieldName('');
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold text-slate-700">{label}</span>
      {fieldNames.length === 0 ? <p className="text-[10px] text-slate-400">No fields yet.</p> : null}
      {fieldNames.map((fieldName) => {
        const currentValue = mapping.fields[fieldName];
        const currentExpression = currentValue?.type === 'EXPRESSION' ? currentValue.expression : undefined;
        return (
          <div key={fieldName} className="flex items-end gap-1.5 rounded border border-slate-100 p-1.5">
            <div className="flex-1">
              <ExpressionField
                label={fieldName}
                definitionId={definitionId}
                value={currentExpression}
                onChange={(expression) => setFieldExpression(fieldName, expression)}
                context={context}
                getOutputFieldNames={getOutputFieldNames}
                getOutputFieldPaths={getOutputFieldPaths}
              />
            </div>
            <button type="button" onClick={() => removeField(fieldName)} className="mb-0.5 text-slate-400 hover:text-rose-600" title="Remove field">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
      <div className="flex gap-1.5">
        <UiInput
          size="sm"
          aiAssist={false}
          value={newFieldName}
          onChange={(e) => setNewFieldName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addField(); } }}
          placeholder="new field name…"
          className="flex-1 text-xs"
        />
        <button type="button" onClick={addField} disabled={!newFieldName.trim()} className="flex items-center gap-1 rounded bg-slate-900 px-2 py-1 text-[11px] text-white disabled:opacity-40">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
    </div>
  );
};
