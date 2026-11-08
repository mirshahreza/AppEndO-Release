import React, { useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { AppSearchBox } from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { useServerFunctionsCatalogQuery } from '../../../shared/api/queries/server-functions';
import { isCatalogHiddenServerFunction } from '../../../shared/api/contracts/server-functions/reservedFunctions';
import type { ServerFunctionItem } from '../../../shared/api/contracts/server-functions/types';
import {
  buildServerFunctionSwaggerUrl,
  openServerFunctionDocUrl,
} from '../../server-functions/lib/serverFunctionDocsUrls';
import { ExpressionField } from './ExpressionField';
import {
  filterServerFunctionsForInternalApi,
  resolveServerFunctionSample,
  serverFunctionDocDescription,
  serverFunctionDocSummary,
} from './internalApiCallFormUtils';
import type { CanonicalExpression, CanonicalMapping } from '../types';

type Ctx = {
  consumerNodeKey: string | null;
  isWaitEventContext: boolean;
  isWorkItemOutputContext: boolean;
  isOutputAssignmentContext: boolean;
  isForEachItemContext: boolean;
};

const literalValueOf = (expression: CanonicalExpression | undefined): unknown =>
  expression?.op === 'LITERAL' ? (expression as { value: unknown }).value : undefined;

/**
 * Dedicated form for `integration.internal-api-call` — pick a managed Server Function by search
 * (id, path, docs, samples) and map the Test Console payload envelope.
 */
export const InternalApiCallActionForm: React.FC<{
  definitionId: number;
  input: CanonicalMapping;
  onChangeInput: (mapping: CanonicalMapping) => void;
  context: Ctx;
  getOutputFieldNames?: (nodeKey: string) => string[];
  getOutputFieldPaths?: (nodeKey: string) => string[][];
}> = ({ definitionId, input, onChangeInput, context, getOutputFieldNames, getOutputFieldPaths }) => {
  const [query, setQuery] = useState('');
  const catalogQuery = useServerFunctionsCatalogQuery();

  const functions = useMemo(
    () => (catalogQuery.data?.functions ?? []).filter((fn) => !isCatalogHiddenServerFunction(fn)),
    [catalogQuery.data?.functions],
  );

  const matches = useMemo(
    () => filterServerFunctionsForInternalApi(functions, query),
    [functions, query],
  );

  const functionIdExpression = input.fields?.functionId?.expression;
  const selectedId = typeof literalValueOf(functionIdExpression) === 'string'
    ? String(literalValueOf(functionIdExpression))
    : '';
  const selected = functions.find((fn) => fn.id === selectedId) ?? null;

  const setInputField = (name: string, expression: CanonicalExpression) => {
    onChangeInput({ type: 'OBJECT', fields: { ...input.fields, [name]: { type: 'EXPRESSION', expression } } });
  };

  const selectFunction = (fn: ServerFunctionItem) => {
    const nextFields = {
      ...input.fields,
      functionId: { type: 'EXPRESSION' as const, expression: { op: 'LITERAL' as const, value: fn.id } },
    };
    const currentPayload = literalValueOf(input.fields?.payload?.expression);
    const payloadIsEmpty = currentPayload === undefined
      || currentPayload === null
      || (typeof currentPayload === 'object' && !Array.isArray(currentPayload) && Object.keys(currentPayload as object).length === 0);
    if (payloadIsEmpty) {
      const nextSample = resolveServerFunctionSample(fn);
      if (nextSample) {
        nextFields.payload = { type: 'EXPRESSION', expression: { op: 'LITERAL', value: nextSample } };
      }
    }
    onChangeInput({ type: 'OBJECT', fields: nextFields });
  };

  const applySample = () => {
    if (!selected) return;
    const sample = resolveServerFunctionSample(selected);
    if (!sample) return;
    setInputField('payload', { op: 'LITERAL', value: sample });
  };

  const summary = selected ? serverFunctionDocSummary(selected) : null;
  const description = selected ? serverFunctionDocDescription(selected) : null;
  const validationFields = selected?.metadataJson?.derived?.docHints?.validationFields ?? [];
  const sample = selected ? resolveServerFunctionSample(selected) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-slate-700">Server function</span>
        <AppSearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search functions, paths, docs…"
          ariaLabel="Search server functions"
        />
        <div className="max-h-48 overflow-y-auto rounded border border-slate-200 bg-white">
          {catalogQuery.isLoading ? (
            <p className="px-3 py-4 text-center text-[11px] text-slate-500">Loading server functions…</p>
          ) : matches.length === 0 ? (
            <p className="px-3 py-4 text-center text-[11px] text-slate-500">
              {query.trim() ? `No server functions match “${query.trim()}”.` : 'No server functions are available.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {matches.map((fn) => {
                const isSelected = fn.id === selectedId;
                return (
                  <li key={fn.id}>
                    <button
                      type="button"
                      onClick={() => selectFunction(fn)}
                      className={cn(
                        'flex w-full flex-col items-start px-2.5 py-1.5 text-left',
                        isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <span className="truncate text-[11px] font-medium text-slate-800">{fn.id}</span>
                      <span className="truncate font-mono text-[10px] text-slate-500">
                        {fn.method} {fn.path}
                      </span>
                      {serverFunctionDocSummary(fn) ? (
                        <span className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">{serverFunctionDocSummary(fn)}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <ExpressionField
        label="Function id"
        definitionId={definitionId}
        value={functionIdExpression}
        onChange={(expression) => setInputField('functionId', expression)}
        context={context}
        placeholder="Or type a function id / @ reference"
        getOutputFieldNames={getOutputFieldNames}
        getOutputFieldPaths={getOutputFieldPaths}
      />

      {selected ? (
        <div className="flex flex-col gap-1.5 rounded border border-slate-100 bg-slate-50/80 p-2">
          <span className="text-[11px] font-semibold text-slate-700">
            {selected.method} {selected.path}
          </span>
          {summary ? <p className="text-[11px] text-slate-600">{summary}</p> : null}
          {description && description !== summary ? (
            <p className="text-[10px] leading-snug text-slate-500">{description}</p>
          ) : null}
          {validationFields.length > 0 ? (
            <p className="text-[10px] text-slate-500">
              Fields: {validationFields.join(', ')}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-0.5">
            <button
              type="button"
              onClick={applySample}
              disabled={!sample}
              className="text-[10px] font-semibold text-primary-600 hover:underline disabled:text-slate-400 disabled:no-underline"
            >
              Use sample payload
            </button>
            <button
              type="button"
              onClick={() => openServerFunctionDocUrl(buildServerFunctionSwaggerUrl('function', selected.id))}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary-600 hover:underline"
            >
              <BookOpen className="h-3 w-3" />
              Open documentation
            </button>
          </div>
        </div>
      ) : null}

      <ExpressionField
        label="Payload"
        definitionId={definitionId}
        value={input.fields?.payload?.expression}
        onChange={(expression) => setInputField('payload', expression)}
        context={context}
        placeholder='{"body":{…}} or a flat JSON object — same as the Test Console sample'
        getOutputFieldNames={getOutputFieldNames}
        getOutputFieldPaths={getOutputFieldPaths}
      />
    </div>
  );
};
