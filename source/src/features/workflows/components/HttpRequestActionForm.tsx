import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { AppButton, UiInput, UiSelect } from '../../../shared/ui';
import { ExpressionField } from './ExpressionField';
import type { CanonicalExpression, CanonicalMapping } from '../types';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

type Ctx = { consumerNodeKey: string | null; isWaitEventContext: boolean; isWorkItemOutputContext: boolean; isOutputAssignmentContext: boolean; isForEachItemContext: boolean };

const literalValueOf = (expression: CanonicalExpression | undefined): unknown =>
  expression?.op === 'LITERAL' ? (expression as { value: unknown }).value : undefined;

const isPlainObjectLiteral = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Dedicated form for the corePack `integration.http-request` Action — the generic schema-driven
 * `ActionFieldsMappingEditor` already technically supports every field (enum quick-picks cover
 * Method), but a first-class HTTP client experience is worth the one-action investment: a real
 * Method dropdown, Body hidden for GET, and a proper multi-row header editor. Headers stay
 * type-system-honest: `config.headers` is still exactly one `CanonicalExpression` (no "build an
 * object from N sub-expressions" op exists in the closed AWM `CanonicalExpression` union), so the
 * row editor only activates when that expression is (or has just been initialized as) a plain
 * `LITERAL` object — a non-literal (e.g. an "@" reference to an upstream node's headers object)
 * falls back to the normal single `ExpressionField`, same as any other field.
 */
export const HttpRequestActionForm: React.FC<{
  definitionId: number;
  input: CanonicalMapping;
  config: CanonicalMapping;
  onChangeInput: (mapping: CanonicalMapping) => void;
  onChangeConfig: (mapping: CanonicalMapping) => void;
  context: Ctx;
  getOutputFieldNames?: (nodeKey: string) => string[];
  getOutputFieldPaths?: (nodeKey: string) => string[][];
}> = ({ definitionId, input, config, onChangeInput, onChangeConfig, context, getOutputFieldNames, getOutputFieldPaths }) => {
  const [newHeaderName, setNewHeaderName] = useState('');

  const methodExpression = input.fields?.method?.expression;
  const method = typeof literalValueOf(methodExpression) === 'string' ? String(literalValueOf(methodExpression)) : 'GET';

  const setInputField = (name: string, expression: CanonicalExpression) => {
    onChangeInput({ type: 'OBJECT', fields: { ...input.fields, [name]: { type: 'EXPRESSION', expression } } });
  };

  const headersExpression = config.fields?.headers?.expression;
  const headersLiteral = isPlainObjectLiteral(literalValueOf(headersExpression)) ? (literalValueOf(headersExpression) as Record<string, string>) : null;

  const setHeadersLiteral = (next: Record<string, string>) => {
    onChangeConfig({ type: 'OBJECT', fields: { ...config.fields, headers: { type: 'EXPRESSION', expression: { op: 'LITERAL', value: next } } } });
  };

  const addHeader = () => {
    const name = newHeaderName.trim();
    if (!name || (headersLiteral && name in headersLiteral)) return;
    setHeadersLiteral({ ...(headersLiteral ?? {}), [name]: '' });
    setNewHeaderName('');
  };

  const removeHeader = (name: string) => {
    if (!headersLiteral) return;
    const next = { ...headersLiteral };
    delete next[name];
    setHeadersLiteral(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[110px_1fr] gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
          Method
          <UiSelect
            size="sm"
            ariaLabel="HTTP method"
            value={HTTP_METHODS.includes(method as (typeof HTTP_METHODS)[number]) ? method : 'GET'}
            onChange={(e) => setInputField('method', { op: 'LITERAL', value: e.target.value })}
          >
            {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </UiSelect>
        </label>
        <ExpressionField
          label="URL"
          definitionId={definitionId}
          value={input.fields?.url?.expression}
          onChange={(expression) => setInputField('url', expression)}
          context={context}
          placeholder="https://api.example.com/resource"
          getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
        />
      </div>

      <div className="flex flex-col gap-1.5 rounded border border-slate-100 p-2">
        <span className="text-[11px] font-semibold text-slate-700">Headers</span>
        {headersLiteral ? (
          <>
            {Object.keys(headersLiteral).length === 0 ? <p className="text-[10px] text-slate-400">No headers yet.</p> : null}
            {Object.entries(headersLiteral).map(([name, value]) => (
              <div key={name} className="flex items-center gap-1.5">
                <UiInput size="sm" aiAssist={false} className="w-1/3 text-xs font-mono" value={name} disabled />
                <UiInput
                  size="sm"
                  aiAssist={false}
                  className="flex-1 text-xs"
                  value={value}
                  onChange={(e) => setHeadersLiteral({ ...headersLiteral, [name]: e.target.value })}
                  placeholder="value, e.g. application/json"
                />
                <AppButton
                  type="button"
                  intent="utility"
                  size="icon-sm"
                  tabStop="skip"
                  onClick={() => removeHeader(name)}
                  title="Remove header"
                >
                  <X className="h-3.5 w-3.5" />
                </AppButton>
              </div>
            ))}
            <div className="flex gap-1.5">
              <UiInput
                size="sm"
                aiAssist={false}
                value={newHeaderName}
                onChange={(e) => setNewHeaderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHeader(); } }}
                placeholder="header name, e.g. Authorization"
                className="flex-1 text-xs"
              />
              <AppButton type="button" intent="primary" size="sm" onClick={addHeader} disabled={!newHeaderName.trim()}>
                <Plus className="h-3.5 w-3.5" />
                Add
              </AppButton>
            </div>
          </>
        ) : (
          <>
            <ExpressionField
              label=""
              definitionId={definitionId}
              value={headersExpression}
              onChange={(expression) => onChangeConfig({ type: 'OBJECT', fields: { ...config.fields, headers: { type: 'EXPRESSION', expression } } })}
              context={context}
              placeholder='{"Authorization": "..."} or an "@" reference'
              getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
            />
            <AppButton type="button" intent="utility" size="sm" className="self-start" onClick={() => setHeadersLiteral({})}>
              <Plus className="h-3.5 w-3.5" />
              Start from a blank header list
            </AppButton>
          </>
        )}
      </div>

      {method !== 'GET' ? (
        <ExpressionField
          label="Body"
          definitionId={definitionId}
          value={input.fields?.body?.expression}
          onChange={(expression) => setInputField('body', expression)}
          context={context}
          placeholder="Request body (sent as JSON)"
          getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
        />
      ) : null}

      <ExpressionField
        label="Max response bytes"
        definitionId={definitionId}
        value={config.fields?.maxResponseBytes?.expression}
        onChange={(expression) => onChangeConfig({ type: 'OBJECT', fields: { ...config.fields, maxResponseBytes: { type: 'EXPRESSION', expression } } })}
        context={context}
        placeholder="1000000 (default 1 MB, hard cap 10 MB — raise for larger CSV files)"
        getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
      />
    </div>
  );
};
