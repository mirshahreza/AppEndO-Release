import React, { useEffect, useState } from 'react';
import { Lock, Plus, X } from 'lucide-react';
import { UiInput, UiSelect } from '../../../shared/ui';
import { ExpressionField } from './ExpressionField';
import { MappingFieldsEditor } from './MappingFieldsEditor';
import { workflowsApi, WorkflowsApiError } from '../api/workflowsApi';
import type { ActionJsonSchema, ActionJsonSchemaProperty, CanonicalExpression, CanonicalMapping, CanonicalMappingValue, DynamicOption, WorkflowDataSourceOption, WorkflowEdgeApiOption, WorkflowRecordFieldDescriptor, WorkflowSecretReference } from '../types';

/** p-99/WFT-2 — generic live dropdown for any field declaring `format: 'dynamic-options'`, fetched
 * once per mount from the Action-agnostic `/api/workflows/dynamic-options/:source` endpoint. Falls
 * back to a quiet inline note (never blocks the underlying `ExpressionField`) on a missing/failed
 * resolver, so an author can still type/reference a value by hand either way. */
const DynamicOptionsSelect: React.FC<{
  source: string;
  value: string;
  onPick: (value: string) => void;
}> = ({ source, value, onPick }) => {
  const [options, setOptions] = useState<DynamicOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOptions(null);
    setError(null);
    workflowsApi.getDynamicOptions(source)
      .then((result) => { if (!cancelled) setOptions(result.options); })
      .catch((e) => { if (!cancelled) setError(e instanceof WorkflowsApiError ? e.message : 'Failed to load options.'); });
    return () => { cancelled = true; };
  }, [source]);

  if (error) return <p className="text-[10px] font-normal text-amber-600">{error}</p>;
  if (!options) return <p className="text-[10px] font-normal text-slate-400">Loading options…</p>;
  if (options.length === 0) return null;

  return (
    <UiSelect
      size="sm"
      ariaLabel="Dynamic options"
      value={value}
      onChange={(e) => { if (e.target.value) onPick(e.target.value); }}
    >
      <option value="">Pick a value…</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </UiSelect>
  );
};

/** p-99/WFT-5 — per-column editor for a `format: 'dynamic-record-fields'` field (`data.record-create`/
 * `-update`/`-upsert`'s `fields` input): fetches the writable column list of the EdgeModel behind the
 * sibling `apiKey` config value, and renders one `ExpressionField` per column. Stores the result as a
 * nested `{type:'OBJECT', fields:{...}}` `CanonicalMappingValue` — an already-supported, already-
 * validated recursive shape (see `awm/types.ts`'s `CanonicalMappingValue`), not a new engine primitive. */
const DynamicRecordFieldsEditor: React.FC<{
  apiKey: string | undefined;
  definitionId: number;
  value: CanonicalMappingValue | undefined;
  onChange: (value: CanonicalMappingValue) => void;
  context: { consumerNodeKey: string | null; isWaitEventContext: boolean; isWorkItemOutputContext: boolean; isOutputAssignmentContext: boolean; isForEachItemContext: boolean };
  getOutputFieldNames?: (nodeKey: string) => string[];
  getOutputFieldPaths?: (nodeKey: string) => string[][];
}> = ({ apiKey, definitionId, value, onChange, context, getOutputFieldNames, getOutputFieldPaths }) => {
  const [fieldsList, setFieldsList] = useState<WorkflowRecordFieldDescriptor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFieldsList(null);
    setError(null);
    if (!apiKey) return;
    workflowsApi.getRecordFieldsForEdgeApiKey(apiKey)
      .then((result) => { if (!cancelled) setFieldsList(result.fields); })
      .catch((e) => { if (!cancelled) setError(e instanceof WorkflowsApiError ? e.message : 'Failed to load record fields.'); });
    return () => { cancelled = true; };
  }, [apiKey]);

  if (!apiKey) return <p className="text-[10px] font-normal text-amber-600">Pick a Data API above first.</p>;
  if (error) return <p className="text-[10px] font-normal text-amber-600">{error}</p>;
  if (!fieldsList) return <p className="text-[10px] font-normal text-slate-400">Loading columns…</p>;
  if (fieldsList.length === 0) return <p className="text-[10px] font-normal text-slate-400">This Data API's Model has no writable columns.</p>;

  const columnValues = value?.type === 'OBJECT' ? value.fields : {};

  const setColumn = (columnField: string, expression: CanonicalExpression) => {
    onChange({ type: 'OBJECT', fields: { ...columnValues, [columnField]: { type: 'EXPRESSION', expression } } });
  };

  return (
    <div className="flex flex-col gap-1.5 rounded border border-slate-100 p-1.5">
      {fieldsList.map((col) => {
        const currentValue = columnValues[col.field];
        const currentExpression = currentValue?.type === 'EXPRESSION' ? currentValue.expression : undefined;
        return (
          <ExpressionField
            key={col.field}
            label={`${col.name}${col.allowNull ? '' : ' *'}`}
            definitionId={definitionId}
            value={currentExpression}
            onChange={(expression) => setColumn(col.field, expression)}
            context={context}
            placeholder={col.dataType}
            getOutputFieldNames={getOutputFieldNames}
            getOutputFieldPaths={getOutputFieldPaths}
          />
        );
      })}
    </div>
  );
};

const humanizeFieldName = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());

const fieldHint = (prop: ActionJsonSchemaProperty): string | undefined => {
  const parts: string[] = [];
  if (prop.description) parts.push(prop.description);
  if (prop.enum && prop.enum.length > 0) parts.push(`One of: ${prop.enum.join(', ')}`);
  if (prop.default !== undefined) parts.push(`Default: ${JSON.stringify(prop.default)}`);
  return parts.length > 0 ? parts.join(' — ') : undefined;
};

const isLiteralOf = (expression: CanonicalExpression | undefined, value: unknown): boolean =>
  !!expression && expression.op === 'LITERAL' && (expression as { value: unknown }).value === value;

/**
 * Schema-driven counterpart to `MappingFieldsEditor` — instead of a blind key/value editor where an
 * author has to already know an Action's field names, this renders one labeled, described field per
 * `configSchema`/`inputSchema` property (see `resolveInlineActionSchema`), with a required marker and
 * a one-click literal picker for `enum`/`boolean` properties. The underlying stored shape is still
 * exactly `CanonicalMapping` — indistinguishable from one hand-written in the raw-JSON editor.
 *
 * Falls back to the original free-form `MappingFieldsEditor` whenever the Action has no resolvable
 * inline schema (undeclared/PLATFORM/PACKAGE Actions, or a `REF` schema this client can't resolve),
 * so nothing regresses for Actions this editor doesn't yet have field metadata for.
 */
export const ActionFieldsMappingEditor: React.FC<{
  label: string;
  definitionId: number;
  schema: ActionJsonSchema | null;
  mapping: CanonicalMapping;
  onChange: (mapping: CanonicalMapping) => void;
  context: { consumerNodeKey: string | null; isWaitEventContext: boolean; isWorkItemOutputContext: boolean; isOutputAssignmentContext: boolean; isForEachItemContext: boolean };
  /** Top-level field names this Action declares under `secretReferenceFields` (doc 04 section 7) —
   * see `secretFieldNamesForRoot`. Marked fields get a lock icon and an honest reminder that the
   * platform has no credential vault yet: the value must be the NAME of a server environment
   * variable, never the secret itself (publish-time validation already rejects a hardcoded literal
   * here; this is a proactive explanation instead of a later, more cryptic validation error). */
  secretFieldNames?: Set<string>;
  /** See `ReferencePickerInput`'s prop of the same name — threaded through unchanged. */
  getOutputFieldNames?: (nodeKey: string) => string[];
  getOutputFieldPaths?: (nodeKey: string) => string[][];
  /** The registered `WorkflowSecretReference` list (name+label only — never a value), offered as a
   * one-click quick-pick on secret-marked fields so an author doesn't have to remember/retype the
   * exact environment variable name. Purely a convenience over free typing — the field stays a full
   * `ExpressionField` either way. */
  secretReferences?: WorkflowSecretReference[];
  /** The platform's configured Data Sources — offered as a quick-pick `<select>` on any field whose
   * schema declares `format: 'data-source-id'` (e.g. `data.db-query`'s `dataSourceId`), since a
   * platform can have more than one Data Source and an author should not have to memorize its raw id. */
  dataSources?: WorkflowDataSourceOption[];
  /** Published Data APIs — offered as a quick-pick on `format: 'edge-api-key'` fields. */
  edgeApis?: WorkflowEdgeApiOption[];
  /** p-99/WFT-5 — literal values already chosen elsewhere on this same node (typically the sibling
   * *config* mapping's fields), keyed by field name, so a `format: 'dynamic-record-fields'` field in
   * one mapping (e.g. `input.fields`) can resolve its `dynamicRecordFieldsSource` (e.g. `'apiKey'`)
   * against a value literally set in the *other* mapping. See `extractLiteralConfigValues`. */
  siblingConfigValues?: Record<string, string>;
}> = ({ label, definitionId, schema, mapping, onChange, context, secretFieldNames, getOutputFieldNames, getOutputFieldPaths, secretReferences, dataSources, edgeApis, siblingConfigValues }) => {
  const [newFieldName, setNewFieldName] = useState('');

  if (!schema) {
    return <MappingFieldsEditor label={label} definitionId={definitionId} mapping={mapping} onChange={onChange} context={context} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} />;
  }

  const declaredNames = Object.keys(schema.properties ?? {});
  const requiredNames = new Set(schema.required ?? []);
  const fields = mapping.fields ?? {};
  const extraNames = Object.keys(fields).filter((name) => !declaredNames.includes(name));

  const setFieldValue = (fieldName: string, value: CanonicalMappingValue) => {
    onChange({ type: 'OBJECT', fields: { ...fields, [fieldName]: value } });
  };

  const setFieldExpression = (fieldName: string, expression: CanonicalExpression) => {
    setFieldValue(fieldName, { type: 'EXPRESSION', expression });
  };

  const removeField = (fieldName: string) => {
    const next = { ...fields };
    delete next[fieldName];
    onChange({ type: 'OBJECT', fields: next });
  };

  const addExtraField = () => {
    const name = newFieldName.trim();
    if (!name || name in fields) return;
    setFieldExpression(name, { op: 'LITERAL', value: '' });
    setNewFieldName('');
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold text-slate-700">{label}</span>
      {declaredNames.map((fieldName) => {
        const prop = schema.properties?.[fieldName] ?? {};
        const required = requiredNames.has(fieldName);
        const isSecret = secretFieldNames?.has(fieldName) ?? false;
        const fieldLabel = `${prop.title ?? humanizeFieldName(fieldName)}${required ? ' *' : ''}`;
        const currentValue = fields[fieldName];
        const currentExpression = currentValue?.type === 'EXPRESSION' ? currentValue.expression : undefined;
        return (
          <div key={fieldName} className={`flex flex-col gap-1 rounded border p-1.5 ${isSecret ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100'}`}>
            {isSecret ? (
              <div className="flex items-center gap-1 text-[10px] font-medium text-amber-700">
                <Lock className="h-3 w-3 shrink-0" />
                Secret reference — enter the NAME of a server environment variable, not the secret value itself.
              </div>
            ) : null}
            {isSecret && secretReferences && secretReferences.length > 0 ? (
              <UiSelect
                size="sm"
                ariaLabel="Secret reference"
                value=""
                onChange={(e) => {
                  if (e.target.value) setFieldExpression(fieldName, { op: 'LITERAL', value: e.target.value });
                }}
              >
                <option value="">Pick a registered secret reference…</option>
                {secretReferences.map((ref) => (
                  <option key={ref.id} value={ref.name}>
                    {ref.label} ({ref.name})
                  </option>
                ))}
              </UiSelect>
            ) : null}
            {prop.format === 'data-source-id' ? (
              dataSources && dataSources.length > 0 ? (
                <UiSelect
                  size="sm"
                  ariaLabel="Data source"
                  value={currentExpression?.op === 'LITERAL' && typeof (currentExpression as { value: unknown }).value === 'string' ? (currentExpression as { value: string }).value : ''}
                  onChange={(e) => {
                    if (e.target.value) setFieldExpression(fieldName, { op: 'LITERAL', value: e.target.value });
                  }}
                >
                  <option value="">Pick a configured Data Source…</option>
                  {dataSources.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({ds.type})
                    </option>
                  ))}
                </UiSelect>
              ) : (
                <p className="text-[10px] font-normal text-amber-600">No Data Sources are configured yet — add one under Settings → Data Sources.</p>
              )
            ) : null}
            {prop.format === 'edge-api-key' ? (
              edgeApis && edgeApis.length > 0 ? (
                <UiSelect
                  size="sm"
                  ariaLabel="Data API"
                  value={currentExpression?.op === 'LITERAL' && typeof (currentExpression as { value: unknown }).value === 'string' ? (currentExpression as { value: string }).value : ''}
                  onChange={(e) => {
                    if (e.target.value) setFieldExpression(fieldName, { op: 'LITERAL', value: e.target.value });
                  }}
                >
                  <option value="">Pick a published Data API…</option>
                  {edgeApis.map((api) => (
                    <option key={api.key} value={api.key}>
                      {api.label} ({api.key})
                    </option>
                  ))}
                </UiSelect>
              ) : (
                <p className="text-[10px] font-normal text-amber-600">No published Data APIs yet — publish one in Data Studio.</p>
              )
            ) : null}
            {prop.format === 'dynamic-options' && prop.dynamicOptionsSource ? (
              <DynamicOptionsSelect
                source={prop.dynamicOptionsSource}
                value={currentExpression?.op === 'LITERAL' && typeof (currentExpression as { value: unknown }).value === 'string' ? (currentExpression as { value: string }).value : ''}
                onPick={(picked) => setFieldExpression(fieldName, { op: 'LITERAL', value: picked })}
              />
            ) : null}
            {prop.format === 'dynamic-record-fields' && prop.dynamicRecordFieldsSource ? (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-slate-600">{fieldLabel}</span>
                {currentValue?.type === 'EXPRESSION' ? (
                  <>
                    <ExpressionField
                      label={fieldLabel}
                      definitionId={definitionId}
                      value={currentExpression}
                      onChange={(expression) => setFieldExpression(fieldName, expression)}
                      context={context}
                      placeholder={fieldHint(prop)}
                      getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
                    />
                    <button type="button" onClick={() => setFieldValue(fieldName, { type: 'OBJECT', fields: {} })} className="self-start text-[10px] text-primary-700 underline">
                      Switch to per-column fields
                    </button>
                  </>
                ) : (
                  <>
                    <DynamicRecordFieldsEditor
                      apiKey={siblingConfigValues?.[prop.dynamicRecordFieldsSource]}
                      definitionId={definitionId}
                      value={currentValue}
                      onChange={(next) => setFieldValue(fieldName, next)}
                      context={context}
                      getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
                    />
                    <button type="button" onClick={() => setFieldExpression(fieldName, { op: 'LITERAL', value: {} })} className="self-start text-[10px] text-slate-400 underline hover:text-slate-600">
                      Advanced: use a raw expression instead
                    </button>
                  </>
                )}
              </div>
            ) : (
              <ExpressionField
                label={fieldLabel}
                definitionId={definitionId}
                value={currentExpression}
                onChange={(expression) => setFieldExpression(fieldName, expression)}
                context={context}
                placeholder={fieldHint(prop)}
                getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
              />
            )}
            {prop.enum && prop.enum.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {prop.enum.map((option) => (
                  <button
                    key={String(option)}
                    type="button"
                    onClick={() => setFieldExpression(fieldName, { op: 'LITERAL', value: option })}
                    className={`rounded border px-1.5 py-0.5 text-[10px] ${
                      isLiteralOf(currentExpression, option)
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-slate-200 text-slate-600 hover:border-primary-400 hover:text-primary-700'
                    }`}
                  >
                    {String(option)}
                  </button>
                ))}
              </div>
            ) : null}
            {prop.type === 'boolean' ? (
              <label className="flex items-center gap-1.5 text-[10px] text-slate-600">
                <input
                  type="checkbox"
                  checked={isLiteralOf(currentExpression, true)}
                  onChange={(e) => setFieldExpression(fieldName, { op: 'LITERAL', value: e.target.checked })}
                />
                Quick-set true / false
              </label>
            ) : null}
          </div>
        );
      })}

      {extraNames.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Extra fields (not in the Action's schema)</span>
          {extraNames.map((fieldName) => {
            const currentValue = fields[fieldName];
            const currentExpression = currentValue?.type === 'EXPRESSION' ? currentValue.expression : undefined;
            return (
            <div key={fieldName} className="flex items-end gap-1.5 rounded border border-slate-100 p-1.5">
              <div className="flex-1">
                <ExpressionField label={fieldName} definitionId={definitionId} value={currentExpression} onChange={(expression) => setFieldExpression(fieldName, expression)} context={context} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} />
              </div>
              <button type="button" onClick={() => removeField(fieldName)} className="mb-0.5 text-slate-400 hover:text-rose-600" title="Remove field">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            );
          })}
        </div>
      ) : null}

      <div className="flex gap-1.5">
        <UiInput
          size="sm"
          aiAssist={false}
          value={newFieldName}
          onChange={(e) => setNewFieldName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExtraField(); } }}
          placeholder="Add an extra field not listed above…"
          className="flex-1 text-xs"
        />
        <button type="button" onClick={addExtraField} disabled={!newFieldName.trim()} className="flex items-center gap-1 rounded bg-slate-900 px-2 py-1 text-[11px] text-white disabled:opacity-40">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
    </div>
  );
};
