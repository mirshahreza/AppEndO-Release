import React from 'react';
import { UiInput, UiSelect, UiCheckbox } from '../../../shared/ui';
import { ExpressionField } from './ExpressionField';
import { MappingFieldsEditor } from './MappingFieldsEditor';
import { EscalationPolicyEditor, type EscalationPolicy } from './EscalationPolicyEditor';
import { ActionFieldsMappingEditor } from './ActionFieldsMappingEditor';
import { ActionKeyCombobox } from './ActionKeyCombobox';
import { MonacoEditorPanel, setupEdgeCodeEditorOnMount } from '../../server-functions/components/MonacoEditorPanel';
import { HttpRequestActionForm } from './HttpRequestActionForm';
import { InternalApiCallActionForm } from './InternalApiCallActionForm';
import { INTERNAL_API_CALL_ACTION_KEY, type ActionCatalogEntry } from './actionCatalogUtils';
import { resolveInlineActionSchema, secretFieldNamesForRoot } from '../types';
import type { CanonicalMapping, WorkflowDataSourceOption, WorkflowEdgeApiOption, WorkflowModel, WorkflowNode, WorkflowSecretReference } from '../types';

const INLINE_CODE_STARTER = [
  '// Runs server-side, right here — no separate Server Function to create or call.',
  '// req.body   = this node\'s evaluated Input mapping',
  '// req.query  = this node\'s evaluated Config mapping',
  '// Call res.json(...) with this node\'s output.',
  'res.json({ ok: true });',
].join('\n');

const defaultInlineCodeActionRef = () => ({ type: 'INLINE_CODE' as const, code: INLINE_CODE_STARTER, language: 'ts' as const });
const defaultRegistryActionRef = () => ({ type: 'EXACT_PROVIDER' as const, action: { actionKey: 'text.template', actionVersion: '1' }, providerId: 'core', providerVersion: '1' });

type Ctx = { consumerNodeKey: string | null; isWaitEventContext: boolean; isWorkItemOutputContext: boolean; isOutputAssignmentContext: boolean; isForEachItemContext: boolean };

const asMapping = (value: unknown): CanonicalMapping => (value && typeof value === 'object' ? (value as CanonicalMapping) : { type: 'OBJECT', fields: {} });

/** p-99/WFT-5 — the config mapping's own literal (non-expression) field values, by name, so the
 * *input* mapping's `ActionFieldsMappingEditor` can resolve a `format: 'dynamic-record-fields'`
 * field's `dynamicRecordFieldsSource` (e.g. `'apiKey'`) against a value literally set in config —
 * config and input are edited as two separate `ActionFieldsMappingEditor` instances, so this is the
 * only channel between them. A reference/expression value (not a literal) simply resolves to nothing
 * here — the dynamic fields editor then asks the author to pick the Data API above first. */
const extractLiteralConfigValues = (mapping: CanonicalMapping): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [name, field] of Object.entries(mapping.fields ?? {})) {
    if (field.type === 'EXPRESSION' && field.expression.op === 'LITERAL' && typeof (field.expression as { value: unknown }).value === 'string') {
      result[name] = (field.expression as { value: string }).value;
    }
  }
  return result;
};

/** Bespoke field-level forms for 10 of the 11 node kinds — every kind that carries at least one
 * author-facing field. PARALLEL_SPLIT alone stays on the raw-JSON editor: `{kind, key}` is its
 * entire shape, so there is nothing a form could usefully expose. WAIT_EVENT's `correlation`/
 * `timeout.afterMs` and SUBFLOW's `input` route through `ExpressionField`/`MappingFieldsEditor`
 * exactly like every other kind, so the "@" reference picker is now live on every expression field
 * in the Designer, not just the original 7 kinds.
 */
export const NodeKindForm: React.FC<{
  node: WorkflowNode;
  model: WorkflowModel;
  definitionId: number;
  actionCatalog: ActionCatalogEntry[];
  onChange: (next: WorkflowNode) => void;
  /** See `ReferencePickerInput`'s prop of the same name — threaded through unchanged. */
  getOutputFieldNames?: (nodeKey: string) => string[];
  getOutputFieldPaths?: (nodeKey: string) => string[][];
  /** The registered `WorkflowSecretReference` list — threaded into `ActionFieldsMappingEditor`'s
   * secret-marked fields as one-click name suggestions. */
  secretReferences?: WorkflowSecretReference[];
  /** The platform's configured Data Sources — threaded into `ActionFieldsMappingEditor`'s
   * `format: 'data-source-id'` fields as a quick-pick. */
  dataSources?: WorkflowDataSourceOption[];
  /** Published Data APIs — threaded into `format: 'edge-api-key'` fields as a quick-pick. */
  edgeApis?: WorkflowEdgeApiOption[];
}> = ({ node, model, definitionId, actionCatalog, onChange, getOutputFieldNames, getOutputFieldPaths, secretReferences, dataSources, edgeApis }) => {
  const ctx: Ctx = { consumerNodeKey: node.key, isWaitEventContext: node.kind === 'WAIT_EVENT', isWorkItemOutputContext: false, isOutputAssignmentContext: false, isForEachItemContext: false };
  const forEachItemCtx: Ctx = { ...ctx, isForEachItemContext: true };
  const set = (patch: Record<string, unknown>) => onChange({ ...node, ...patch });

  switch (node.kind) {
    case 'ACTION': {
      const rawActionRef = (node.actionRef ?? {}) as { type?: string; action?: { actionKey?: string; actionVersion?: string }; code?: string; language?: 'ts' | 'js' };
      const isInlineCode = rawActionRef.type === 'INLINE_CODE';
      const actionRef = rawActionRef;
      const selectedAction = actionCatalog.find((a) => a.key === actionRef.action?.actionKey);
      const resolvedInputSchema = isInlineCode ? null : resolveInlineActionSchema(selectedAction?.inputSchema);
      const resolvedConfigSchema = isInlineCode ? null : resolveInlineActionSchema(selectedAction?.configSchema);
      const secretInputFieldNames = secretFieldNamesForRoot(selectedAction?.secretReferenceFields, 'input');
      const secretConfigFieldNames = secretFieldNamesForRoot(selectedAction?.secretReferenceFields, 'config');
      return (
        <div className="flex flex-col gap-3">
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-[11px] font-semibold">
            <button
              type="button"
              className={`flex-1 rounded-md px-2 py-1 ${!isInlineCode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              onClick={() => set({ actionRef: defaultRegistryActionRef() })}
            >
              Registry action
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-2 py-1 ${isInlineCode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              onClick={() => set({ actionRef: defaultInlineCodeActionRef(), retryPolicy: { ...(node.retryPolicy as object), maxAttempts: 1 } })}
            >
              Inline code (TypeScript)
            </button>
          </div>

          {isInlineCode ? (
            <>
              <p className="text-[10px] font-normal text-slate-500">
                Runs server-side, right here — reads <code className="font-mono">req.body</code> (Input mapping below) and{' '}
                <code className="font-mono">req.query</code> (Config mapping below); call <code className="font-mono">res.json(...)</code> with this node&apos;s output.
              </p>
              <div className="h-64 overflow-hidden rounded border border-slate-300">
                <MonacoEditorPanel
                  documentKey={node.key}
                  defaultLanguage="typescript"
                  language={actionRef.language === 'js' ? 'javascript' : 'typescript'}
                  value={actionRef.code ?? ''}
                  onMount={(editor, monaco) => setupEdgeCodeEditorOnMount(editor, monaco)}
                  onChange={(value) => set({ actionRef: { ...rawActionRef, code: value ?? '' } })}
                  options={{
                    fontSize: 12,
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    padding: { top: 12, bottom: 12 },
                    wordWrap: 'on',
                  }}
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
                Action key
                <ActionKeyCombobox
                  value={actionRef.action?.actionKey ?? ''}
                  actionCatalog={actionCatalog}
                  onChange={(actionKey) => set({ actionRef: { ...node.actionRef as object, action: { ...actionRef.action, actionKey } } })}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
                Version
                <UiInput
                  size="sm"
                  aiAssist={false}
                  autoDir={false}
                  className="text-xs font-normal"
                  value={actionRef.action?.actionVersion ?? ''}
                  onChange={(e) => set({ actionRef: { ...node.actionRef as object, action: { ...actionRef.action, actionVersion: e.target.value } } })}
                  placeholder="1"
                />
              </label>
            </div>
          )}
          {!isInlineCode && selectedAction?.key === 'integration.http-request' ? (
            <HttpRequestActionForm
              definitionId={definitionId}
              input={asMapping(node.input)}
              config={asMapping(node.config)}
              onChangeInput={(m) => set({ input: m })}
              onChangeConfig={(m) => set({ config: m })}
              context={ctx}
              getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
            />
          ) : !isInlineCode && actionRef.action?.actionKey === INTERNAL_API_CALL_ACTION_KEY ? (
            <InternalApiCallActionForm
              definitionId={definitionId}
              input={asMapping(node.input)}
              onChangeInput={(m) => set({ input: m })}
              context={ctx}
              getOutputFieldNames={getOutputFieldNames}
              getOutputFieldPaths={getOutputFieldPaths}
            />
          ) : (
            <>
              <ActionFieldsMappingEditor label="Input mapping" definitionId={definitionId} schema={resolvedInputSchema} mapping={asMapping(node.input)} onChange={(m) => set({ input: m })} context={ctx} secretFieldNames={secretInputFieldNames} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} secretReferences={secretReferences} dataSources={dataSources} edgeApis={edgeApis} siblingConfigValues={extractLiteralConfigValues(asMapping(node.config))} />
              <ActionFieldsMappingEditor label="Config mapping" definitionId={definitionId} schema={resolvedConfigSchema} mapping={asMapping(node.config)} onChange={(m) => set({ config: m })} context={ctx} secretFieldNames={secretConfigFieldNames} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} secretReferences={secretReferences} dataSources={dataSources} edgeApis={edgeApis} />
            </>
          )}
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            Max attempts (retry policy)
            <UiInput
              type="number"
              size="sm"
              aiAssist={false}
              min={1}
              max={isInlineCode ? 1 : undefined}
              disabled={isInlineCode}
              className="w-24 text-xs font-normal"
              value={isInlineCode ? 1 : ((node.retryPolicy as { maxAttempts?: number } | undefined)?.maxAttempts ?? 1)}
              onChange={(e) => set({ retryPolicy: { ...(node.retryPolicy as object), maxAttempts: Number(e.target.value) } })}
              ariaLabel={isInlineCode ? 'Inline code has no declared idempotency guarantee — automatic retries are disabled.' : 'Max attempts'}
            />
          </label>
          {(() => {
            const compensation = node.compensation as { actionRef?: { action?: { actionKey?: string; actionVersion?: string } }; config?: unknown; input?: unknown } | undefined;
            const compRef = (compensation?.actionRef ?? {}) as { action?: { actionKey?: string; actionVersion?: string } };
            return (
              <div className="flex flex-col gap-2 rounded border border-dashed border-slate-300 p-2">
                <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                  <UiCheckbox
                    size="sm"
                    checked={!!node.compensation}
                    onChange={(e) =>
                      set({
                        compensation: e.target.checked
                          ? { actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: '', actionVersion: '1' }, providerId: 'core', providerVersion: '1' }, config: { type: 'OBJECT', fields: {} }, input: { type: 'OBJECT', fields: {} } }
                          : undefined,
                      })
                    }
                  />
                  Compensate on instance failure (Saga)
                </label>
                {node.compensation ? (
                  <>
                    <p className="text-[10px] font-normal text-slate-400">Runs once, LIFO with every other compensated step, only if the instance later fails. Reference this node&apos;s own output via NODE_OUTPUT.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
                        Compensation action key
                        <ActionKeyCombobox
                          value={compRef.action?.actionKey ?? ''}
                          actionCatalog={actionCatalog}
                          onChange={(actionKey) => set({ compensation: { ...compensation, actionRef: { ...compRef, action: { ...compRef.action, actionKey } } } })}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
                        Version
                        <UiInput
                          size="sm"
                          aiAssist={false}
                          autoDir={false}
                          className="text-xs font-normal"
                          value={compRef.action?.actionVersion ?? ''}
                          onChange={(e) => set({ compensation: { ...compensation, actionRef: { ...compRef, action: { ...compRef.action, actionVersion: e.target.value } } } })}
                          placeholder="1"
                        />
                      </label>
                    </div>
                    <MappingFieldsEditor label="Compensation input mapping" definitionId={definitionId} mapping={asMapping(compensation?.input)} onChange={(m) => set({ compensation: { ...compensation, input: m } })} context={ctx} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} />
                    <MappingFieldsEditor label="Compensation config mapping" definitionId={definitionId} mapping={asMapping(compensation?.config)} onChange={(m) => set({ compensation: { ...compensation, config: m } })} context={ctx} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} />
                  </>
                ) : null}
              </div>
            );
          })()}
        </div>
      );
    }

    case 'FOR_EACH': {
      const actionRef = (node.actionRef ?? {}) as { action?: { actionKey?: string; actionVersion?: string } };
      const selectedAction = actionCatalog.find((a) => a.key === actionRef.action?.actionKey);
      const resolvedInputSchema = resolveInlineActionSchema(selectedAction?.inputSchema);
      const resolvedConfigSchema = resolveInlineActionSchema(selectedAction?.configSchema);
      const secretInputFieldNames = secretFieldNamesForRoot(selectedAction?.secretReferenceFields, 'input');
      const secretConfigFieldNames = secretFieldNamesForRoot(selectedAction?.secretReferenceFields, 'config');
      const joinMode = (node.joinMode as string) ?? 'ALL';
      return (
        <div className="flex flex-col gap-3">
          <ExpressionField
            label="Items (must evaluate to an array)"
            definitionId={definitionId}
            value={node.items as never}
            onChange={(expression) => set({ items: expression })}
            context={ctx}
            placeholder="Evaluated once, no item bound yet — e.g. @NODE:previous.list"
            getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
              Action key (runs once per item)
              <ActionKeyCombobox
                value={actionRef.action?.actionKey ?? ''}
                actionCatalog={actionCatalog}
                onChange={(actionKey) => set({ actionRef: { ...node.actionRef as object, action: { ...actionRef.action, actionKey } } })}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
              Version
              <UiInput
                size="sm"
                aiAssist={false}
                autoDir={false}
                className="text-xs font-normal"
                value={actionRef.action?.actionVersion ?? ''}
                onChange={(e) => set({ actionRef: { ...node.actionRef as object, action: { ...actionRef.action, actionVersion: e.target.value } } })}
                placeholder="1"
              />
            </label>
          </div>
          <p className="text-[10px] font-normal text-slate-400">Type "@" inside "Input mapping" below and pick "Current Item" or "Current Item Index" to reference this iteration's value.</p>
          <ActionFieldsMappingEditor label="Input mapping (per item)" definitionId={definitionId} schema={resolvedInputSchema} mapping={asMapping(node.input)} onChange={(m) => set({ input: m })} context={forEachItemCtx} secretFieldNames={secretInputFieldNames} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} secretReferences={secretReferences} dataSources={dataSources} edgeApis={edgeApis} siblingConfigValues={extractLiteralConfigValues(asMapping(node.config))} />
          <ActionFieldsMappingEditor label="Config mapping (evaluated once, shared)" definitionId={definitionId} schema={resolvedConfigSchema} mapping={asMapping(node.config)} onChange={(m) => set({ config: m })} context={ctx} secretFieldNames={secretConfigFieldNames} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} secretReferences={secretReferences} dataSources={dataSources} edgeApis={edgeApis} />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
              Join mode
              <UiSelect size="sm" className="text-xs font-normal" value={joinMode} onChange={(e) => set({ joinMode: e.target.value })}>
                <option value="ALL">ALL — every item must succeed</option>
                <option value="ANY">ANY — at least one item must succeed</option>
                <option value="THRESHOLD">THRESHOLD — at least N items must succeed</option>
              </UiSelect>
            </label>
            {joinMode === 'THRESHOLD' ? (
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
                Threshold count
                <UiInput type="number" size="sm" aiAssist={false} min={1} className="text-xs font-normal" value={(node.thresholdCount as number | undefined) ?? 1} onChange={(e) => set({ thresholdCount: Number(e.target.value) })} />
              </label>
            ) : (
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
                Max concurrency
                <UiInput type="number" size="sm" aiAssist={false} min={1} className="text-xs font-normal" value={(node.maxConcurrency as number | undefined) ?? 5} onChange={(e) => set({ maxConcurrency: Number(e.target.value) })} />
              </label>
            )}
          </div>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            Max attempts per item (retry policy)
            <UiInput
              type="number"
              size="sm"
              aiAssist={false}
              min={1}
              className="w-24 text-xs font-normal"
              value={(node.retryPolicy as { maxAttempts?: number } | undefined)?.maxAttempts ?? 1}
              onChange={(e) => set({ retryPolicy: { ...(node.retryPolicy as object), maxAttempts: Number(e.target.value) } })}
            />
          </label>
        </div>
      );
    }

    case 'LOOP': {
      const actionRef = (node.actionRef ?? {}) as { action?: { actionKey?: string; actionVersion?: string } };
      const selectedAction = actionCatalog.find((a) => a.key === actionRef.action?.actionKey);
      const resolvedInputSchema = resolveInlineActionSchema(selectedAction?.inputSchema);
      const resolvedConfigSchema = resolveInlineActionSchema(selectedAction?.configSchema);
      const secretInputFieldNames = secretFieldNamesForRoot(selectedAction?.secretReferenceFields, 'input');
      const secretConfigFieldNames = secretFieldNamesForRoot(selectedAction?.secretReferenceFields, 'config');
      return (
        <div className="flex flex-col gap-3">
          <ExpressionField
            label="While condition (re-evaluated before each iteration)"
            definitionId={definitionId}
            value={node.condition as never}
            onChange={(expression) => set({ condition: expression })}
            context={forEachItemCtx}
            placeholder="True to run another pass. Use Current Item (previous output) or Current Item Index."
            getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
              Action key (runs once per iteration)
              <ActionKeyCombobox
                value={actionRef.action?.actionKey ?? ''}
                actionCatalog={actionCatalog}
                onChange={(actionKey) => set({ actionRef: { ...node.actionRef as object, action: { ...actionRef.action, actionKey } } })}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
              Version
              <UiInput
                size="sm"
                aiAssist={false}
                autoDir={false}
                className="text-xs font-normal"
                value={actionRef.action?.actionVersion ?? ''}
                onChange={(e) => set({ actionRef: { ...node.actionRef as object, action: { ...actionRef.action, actionVersion: e.target.value } } })}
                placeholder="1"
              />
            </label>
          </div>
          <p className="text-[10px] font-normal text-slate-400">Type "@" and pick "Current Item" (previous output, null on the first pass) or "Current Item Index".</p>
          <ActionFieldsMappingEditor label="Input mapping (per iteration)" definitionId={definitionId} schema={resolvedInputSchema} mapping={asMapping(node.input)} onChange={(m) => set({ input: m })} context={forEachItemCtx} secretFieldNames={secretInputFieldNames} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} secretReferences={secretReferences} dataSources={dataSources} edgeApis={edgeApis} siblingConfigValues={extractLiteralConfigValues(asMapping(node.config))} />
          <ActionFieldsMappingEditor label="Config mapping (evaluated once, shared)" definitionId={definitionId} schema={resolvedConfigSchema} mapping={asMapping(node.config)} onChange={(m) => set({ config: m })} context={ctx} secretFieldNames={secretConfigFieldNames} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} secretReferences={secretReferences} dataSources={dataSources} edgeApis={edgeApis} />
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            Max iterations
            <UiInput
              type="number"
              size="sm"
              aiAssist={false}
              min={1}
              max={100}
              className="w-24 text-xs font-normal"
              value={(node.maxIterations as number | undefined) ?? 5}
              onChange={(e) => set({ maxIterations: Number(e.target.value) })}
            />
          </label>
        </div>
      );
    }

    case 'DECISION':
      return (
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
          Ambiguity mode
          <UiSelect size="sm" className="text-xs font-normal" value={(node.mode as string) ?? 'EXACT_ONE'} onChange={(e) => set({ mode: e.target.value })}>
            <option value="EXACT_ONE">EXACT_ONE — exactly one condition must match</option>
            <option value="FIRST_MATCH">FIRST_MATCH — first matching edge (by priority) wins</option>
            <option value="MULTI_MATCH">MULTI_MATCH — every true path runs in parallel (join required)</option>
          </UiSelect>
          <p className="text-[10px] font-normal text-slate-400">Each condition lives on the outgoing edge — set it when you drag-connect to the next node. MULTI_MATCH is an inclusive gateway: matching branches must reconverge on a Parallel join.</p>
        </label>
      );

    case 'SWITCH':
      return (
        <ExpressionField
          label="Switch value"
          definitionId={definitionId}
          value={node.value as never}
          onChange={(expression) => set({ value: expression })}
          context={ctx}
          placeholder="Evaluated once; outgoing SWITCH_CASE edges match this value exactly."
          getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
        />
      );

    case 'END':
      return <MappingFieldsEditor label="Output mapping" definitionId={definitionId} mapping={asMapping(node.output)} onChange={(m) => set({ output: m })} context={ctx} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} />;

    case 'FAIL':
      return (
        <div className="flex flex-col gap-3">
          <ExpressionField label="Error code" definitionId={definitionId} value={node.errorCode as never} onChange={(expression) => set({ errorCode: expression })} context={ctx} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} />
          <ExpressionField label="Safe message" definitionId={definitionId} value={node.safeMessage as never} onChange={(expression) => set({ safeMessage: expression })} context={ctx} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} />
        </div>
      );

    case 'DELAY': {
      const delay = (node.delay ?? { type: 'DURATION_MS', value: { op: 'LITERAL', value: 60_000 } }) as { type: string; value: unknown };
      return (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            Delay type
            <UiSelect size="sm" className="text-xs font-normal" value={delay.type} onChange={(e) => set({ delay: { ...delay, type: e.target.value } })}>
              <option value="DURATION_MS">DURATION_MS — wait this many milliseconds</option>
              <option value="UNTIL">UNTIL — wait until an absolute instant</option>
            </UiSelect>
          </label>
          <ExpressionField
            label={delay.type === 'UNTIL' ? 'Until (ISO instant)' : 'Duration (ms)'}
            definitionId={definitionId}
            value={delay.value as never}
            onChange={(expression) => set({ delay: { ...delay, value: expression } })}
            context={ctx}
            getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
          />
        </div>
      );
    }

    case 'WORK_ITEM': {
      type WorkItemAssignment =
        | { strategy: 'ROLE'; roleId?: string }
        | { strategy: 'USER'; userId?: string }
        | { strategy: 'EXPRESSION'; expression?: unknown }
        | { strategy: 'SAME_AS_WORK_ITEM'; workItemNodeKey?: string }
        | { strategy: 'ROUND_ROBIN'; userIds?: string[] }
        | { strategy: 'SHORTEST_QUEUE'; roleId?: string };
      const assignment = (node.assignment ?? { strategy: 'ROLE', roleId: '' }) as WorkItemAssignment;
      const allowedOutcomes = (node.allowedOutcomes as string[] | undefined) ?? [];
      const summary = node.summary;
      const hasSummary = summary !== undefined;
      const effectiveSummary = summary ?? { op: 'LITERAL', value: '' };
      const dueAt = node.dueAt;
      const hasDueAt = dueAt !== undefined;
      const effectiveDueAt = dueAt ?? { op: 'LITERAL', value: '' };
      const followUpAt = node.followUpAt;
      const hasFollowUpAt = followUpAt !== undefined;
      const effectiveFollowUpAt = followUpAt ?? { op: 'LITERAL', value: '' };
      return (
        <div className="flex flex-col gap-3">
          <ExpressionField label="Title" definitionId={definitionId} value={node.title as never} onChange={(expression) => set({ title: expression })} context={ctx} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} />
          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
            <UiCheckbox size="sm" checked={hasSummary} onChange={(e) => set({ summary: e.target.checked ? effectiveSummary : undefined })} />
            Summary
          </label>
          {hasSummary ? (
            <ExpressionField label="Summary text" definitionId={definitionId} value={effectiveSummary as never} onChange={(expression) => set({ summary: expression })} context={ctx} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} />
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                <UiCheckbox size="sm" checked={hasDueAt} onChange={(e) => set({ dueAt: e.target.checked ? effectiveDueAt : undefined })} />
                Due date (HWF-2.1)
              </label>
              {hasDueAt ? (
                <ExpressionField label="Due at (must evaluate to an ISO timestamp)" definitionId={definitionId} value={effectiveDueAt as never} onChange={(expression) => set({ dueAt: expression })} context={ctx} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} />
              ) : null}
            </div>
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                <UiCheckbox size="sm" checked={hasFollowUpAt} onChange={(e) => set({ followUpAt: e.target.checked ? effectiveFollowUpAt : undefined })} />
                Follow-up date
              </label>
              {hasFollowUpAt ? (
                <ExpressionField label="Follow-up at (ISO timestamp)" definitionId={definitionId} value={effectiveFollowUpAt as never} onChange={(expression) => set({ followUpAt: expression })} context={ctx} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} />
              ) : null}
            </div>
          </div>
          <p className="text-[10px] font-normal text-slate-400">Due/Follow-up are pure metadata for sort/filter in the Inbox — they don&apos;t trigger anything automatically. Use Escalation Policy below for automatic behavior.</p>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            Work item type
            <UiSelect size="sm" className="text-xs font-normal" value={(node.workItemType as string) ?? 'APPROVAL'} onChange={(e) => set({ workItemType: e.target.value })}>
              <option value="APPROVAL">APPROVAL</option>
              <option value="REVIEW">REVIEW</option>
              <option value="DATA_ENTRY">DATA_ENTRY</option>
              <option value="DECISION">DECISION</option>
              <option value="CONFIRMATION">CONFIRMATION</option>
              <option value="EXCEPTION">EXCEPTION</option>
              <option value="AI_REVIEW">AI_REVIEW</option>
            </UiSelect>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
              Assign to
              <UiSelect
                size="sm"
                className="text-xs font-normal"
                value={assignment.strategy}
                onChange={(e) => {
                  const strategy = e.target.value;
                  if (strategy === 'ROLE') set({ assignment: { strategy: 'ROLE', roleId: (assignment as { roleId?: string }).roleId ?? '' } });
                  else if (strategy === 'USER') set({ assignment: { strategy: 'USER', userId: (assignment as { userId?: string }).userId ?? '' } });
                  else if (strategy === 'SAME_AS_WORK_ITEM') set({ assignment: { strategy: 'SAME_AS_WORK_ITEM', workItemNodeKey: (assignment as { workItemNodeKey?: string }).workItemNodeKey ?? '' } });
                  else if (strategy === 'ROUND_ROBIN') set({ assignment: { strategy: 'ROUND_ROBIN', userIds: (assignment as { userIds?: string[] }).userIds ?? [] } });
                  else if (strategy === 'SHORTEST_QUEUE') set({ assignment: { strategy: 'SHORTEST_QUEUE', roleId: (assignment as { roleId?: string }).roleId ?? '' } });
                  else set({ assignment: { strategy: 'EXPRESSION', expression: (assignment as { expression?: unknown }).expression ?? { op: 'LITERAL', value: '' } } });
                }}
              >
                <option value="ROLE">Role</option>
                <option value="USER">Specific user (id)</option>
                <option value="SAME_AS_WORK_ITEM">Same assignee as another work item</option>
                <option value="ROUND_ROBIN">Round robin (user id list)</option>
                <option value="SHORTEST_QUEUE">Shortest queue (role members)</option>
                <option value="EXPRESSION">Expression (computed user id)</option>
              </UiSelect>
            </label>
            {assignment.strategy === 'ROLE' ? (
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
                Role name
                <UiInput
                  size="sm"
                  aiAssist={false}
                  autoDir={false}
                  className="text-xs font-normal"
                  value={assignment.roleId ?? ''}
                  onChange={(e) => set({ assignment: { strategy: 'ROLE', roleId: e.target.value } })}
                />
              </label>
            ) : null}
            {assignment.strategy === 'USER' ? (
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
                User id
                <UiInput
                  size="sm"
                  aiAssist={false}
                  autoDir={false}
                  className="text-xs font-normal"
                  value={assignment.userId ?? ''}
                  onChange={(e) => set({ assignment: { strategy: 'USER', userId: e.target.value } })}
                />
              </label>
            ) : null}
            {assignment.strategy === 'SAME_AS_WORK_ITEM' ? (
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
                Work item node key
                <UiInput
                  size="sm"
                  aiAssist={false}
                  autoDir={false}
                  className="text-xs font-normal"
                  value={assignment.workItemNodeKey ?? ''}
                  onChange={(e) => set({ assignment: { strategy: 'SAME_AS_WORK_ITEM', workItemNodeKey: e.target.value } })}
                />
              </label>
            ) : null}
            {assignment.strategy === 'ROUND_ROBIN' ? (
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
                User ids (comma-separated)
                <UiInput
                  size="sm"
                  aiAssist={false}
                  autoDir={false}
                  className="text-xs font-normal"
                  value={(assignment.userIds ?? []).join(', ')}
                  onChange={(e) => set({ assignment: { strategy: 'ROUND_ROBIN', userIds: e.target.value.split(',').map((part) => part.trim()).filter(Boolean) } })}
                />
              </label>
            ) : null}
            {assignment.strategy === 'SHORTEST_QUEUE' ? (
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
                Role name
                <UiInput
                  size="sm"
                  aiAssist={false}
                  autoDir={false}
                  className="text-xs font-normal"
                  value={assignment.roleId ?? ''}
                  onChange={(e) => set({ assignment: { strategy: 'SHORTEST_QUEUE', roleId: e.target.value } })}
                />
              </label>
            ) : null}
          </div>
          {assignment.strategy === 'EXPRESSION' ? (
            <ExpressionField
              label="Assignee user id (expression)"
              definitionId={definitionId}
              value={assignment.expression as never}
              onChange={(expression) => set({ assignment: { strategy: 'EXPRESSION', expression } })}
              context={ctx}
              getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
            />
          ) : null}
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            Allowed outcomes (comma-separated)
            <UiInput
              size="sm"
              aiAssist={false}
              autoDir={false}
              className="text-xs font-normal"
              value={allowedOutcomes.join(', ')}
              onChange={(e) => set({ allowedOutcomes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              placeholder="APPROVE, REJECT"
            />
            <p className="text-[10px] font-normal text-slate-400">Each outcome needs its own outgoing WORK_ITEM_OUTCOME edge.</p>
          </label>
          {allowedOutcomes.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-700">Require a reason on these outcomes (HWF-4.5, optional)</span>
              <div className="flex flex-wrap gap-3">
                {allowedOutcomes.map((o) => {
                  const requireReasonOutcomes = (node.requireReasonOutcomes as string[] | undefined) ?? [];
                  const checked = requireReasonOutcomes.includes(o);
                  return (
                    <label key={o} className="flex items-center gap-1.5 text-[11px] font-normal text-slate-700">
                      <UiCheckbox
                        size="sm"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked ? [...requireReasonOutcomes, o] : requireReasonOutcomes.filter((k) => k !== o);
                          set({ requireReasonOutcomes: next.length > 0 ? next : undefined });
                        }}
                      />
                      {o}
                    </label>
                  );
                })}
              </div>
              <p className="text-[10px] font-normal text-slate-400">Completion with a checked outcome must include a non-empty output.reason.</p>
            </div>
          ) : null}
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            Approval group key (HWF-3.1, optional)
            <UiInput
              size="sm"
              aiAssist={false}
              autoDir={false}
              className="text-xs font-normal"
              value={(node.approvalGroupKey as string) ?? ''}
              onChange={(e) => set({ approvalGroupKey: e.target.value.trim() === '' ? undefined : e.target.value })}
              placeholder="e.g. purchase-order-approval"
            />
            <p className="text-[10px] font-normal text-slate-400">
              Give multiple WORK_ITEM nodes under the same PARALLEL_SPLIT the same key to group them into one logical multi-approver task in the Inbox. Purely a UI grouping label — no engine effect.
            </p>
          </label>
          <MappingFieldsEditor label="Input mapping" definitionId={definitionId} mapping={asMapping(node.input)} onChange={(m) => set({ input: m })} context={ctx} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} />
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            Completion form (HWF-1.1)
            <UiSelect
              size="sm"
              className="text-xs font-normal"
              value={(node.formMode as string) ?? 'RAW_JSON'}
              onChange={(e) => set({ formMode: e.target.value })}
            >
              <option value="RAW_JSON">Raw JSON (expert/debug)</option>
              <option value="DYNAMIC_SCHEMA_FORM">Dynamic form (generated at runtime from Output schema)</option>
              <option value="DESIGNED_COMPONENT">Designed component (Component Designer)</option>
            </UiSelect>
            <p className="text-[10px] font-normal text-slate-400">
              Dynamic form renders real typed inputs straight from Output schema below — no design artifact needed. Designed component requires a Component Designer reference.
            </p>
          </label>
          {node.formMode === 'DESIGNED_COMPONENT' ? (
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
              Component reference (folder/name)
              <UiInput
                size="sm"
                aiAssist={false}
                autoDir={false}
                className="text-xs font-normal"
                value={(node.formComponentRef as string) ?? ''}
                onChange={(e) => set({ formComponentRef: e.target.value })}
                placeholder="e.g. workflows/approval-review-form"
              />
            </label>
          ) : null}
          <EscalationPolicyEditor
            definitionId={definitionId}
            policy={node.escalationPolicy as EscalationPolicy | undefined}
            onChange={(policy) => set({ escalationPolicy: policy })}
            context={ctx}
            getOutputFieldNames={getOutputFieldNames}
            getOutputFieldPaths={getOutputFieldPaths}
          />
        </div>
      );
    }

    case 'PARALLEL_JOIN': {
      const parallelJoinMode = (node.mode as string) ?? 'ALL';
      return (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            Join mode
            <UiSelect size="sm" className="text-xs font-normal" value={parallelJoinMode} onChange={(e) => set({ mode: e.target.value })}>
              <option value="ALL">ALL — every branch that started must arrive</option>
              <option value="ANY">ANY — first branch to arrive wins</option>
              <option value="THRESHOLD">THRESHOLD — at least N branches must arrive</option>
            </UiSelect>
          </label>
          {parallelJoinMode === 'THRESHOLD' ? (
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
              Threshold count
              <UiInput type="number" size="sm" aiAssist={false} min={1} className="text-xs font-normal" value={(node.thresholdCount as number | undefined) ?? 1} onChange={(e) => set({ thresholdCount: Number(e.target.value) })} />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
            <UiCheckbox size="sm" checked={Boolean(node.cancelRemaining)} onChange={(e) => set({ cancelRemaining: e.target.checked })} />
            Cancel remaining branches once satisfied
          </label>
          <p className="text-[10px] font-normal text-slate-400">
            ALL counts only branches that actually started, not every authored branch — pair a Decision in MULTI_MATCH mode (inclusive gateway) with a join in ALL mode here to get a Multi-Choice / OR-split pattern without a dedicated node kind. THRESHOLD gives an N-out-of-M (discriminator) join.
          </p>
        </div>
      );
    }

    case 'WAIT_EVENT': {
      const timeout = node.timeout as { afterMs: unknown; outcomeKey: string } | undefined;
      const hasTimeout = Boolean(timeout);
      const effectiveTimeout = timeout ?? { afterMs: { op: 'LITERAL', value: 86_400_000 }, outcomeKey: 'TIMEOUT' };
      return (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            Event name
            <UiInput
              size="sm"
              aiAssist={false}
              autoDir={false}
              className="text-xs font-normal"
              value={(node.eventName as string) ?? ''}
              onChange={(e) => set({ eventName: e.target.value })}
              placeholder="e.g. payment.captured"
            />
          </label>
          <ExpressionField
            label="Correlation (must match the incoming event's correlation key)"
            definitionId={definitionId}
            value={node.correlation as never}
            onChange={(expression) => set({ correlation: expression })}
            context={ctx}
            getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
          />
          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
            <UiCheckbox size="sm" checked={hasTimeout} onChange={(e) => set({ timeout: e.target.checked ? effectiveTimeout : undefined })} />
            Timeout (falls through to a WAIT_TIMEOUT edge if the event never arrives)
          </label>
          {hasTimeout ? (
            <div className="flex flex-col gap-2 rounded border border-slate-100 p-2">
              <ExpressionField
                label="After (ms)"
                definitionId={definitionId}
                value={effectiveTimeout.afterMs as never}
                onChange={(expression) => set({ timeout: { ...effectiveTimeout, afterMs: expression } })}
                context={ctx}
                getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
              />
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
                Timeout outcome key
                <UiInput
                  size="sm"
                  aiAssist={false}
                  autoDir={false}
                  className="text-xs font-normal"
                  value={effectiveTimeout.outcomeKey}
                  onChange={(e) => set({ timeout: { ...effectiveTimeout, outcomeKey: e.target.value } })}
                  placeholder="must match a WAIT_TIMEOUT edge's outcomeKey"
                />
              </label>
            </div>
          ) : null}
        </div>
      );
    }

    case 'SUBFLOW': {
      const ref = (node.workflowDefinitionRef ?? { workflowDefinitionKey: '' }) as { workflowDefinitionKey: string; scopeKey?: string };
      const cancelEvent = node.cancelEvent as { eventName: string; correlation: unknown } | undefined;
      const hasCancelEvent = Boolean(cancelEvent);
      const effectiveCancelEvent = cancelEvent ?? { eventName: '', correlation: { op: 'LITERAL', value: '' } };
      // p-99/WFT-9 — cancelEvent.correlation evaluates like WAIT_EVENT's own correlation (no
      // CURRENT_EVENT at that point), so it gets the same context flag WAIT_EVENT nodes get; `input`
      // above stays on the plain shared `ctx` (CURRENT_EVENT is never legal there).
      const cancelEventCtx: Ctx = { ...ctx, isWaitEventContext: true };
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
              Sub-workflow key
              <UiInput
                size="sm"
                aiAssist={false}
                autoDir={false}
                className="text-xs font-normal"
                value={ref.workflowDefinitionKey}
                onChange={(e) => set({ workflowDefinitionRef: { ...ref, workflowDefinitionKey: e.target.value } })}
                placeholder="e.g. refund-child-process"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
              Scope key (optional)
              <UiInput
                size="sm"
                aiAssist={false}
                autoDir={false}
                className="text-xs font-normal"
                value={ref.scopeKey ?? ''}
                onChange={(e) => set({ workflowDefinitionRef: { ...ref, scopeKey: e.target.value || undefined } })}
              />
            </label>
          </div>
          <MappingFieldsEditor label="Input mapping" definitionId={definitionId} mapping={asMapping(node.input)} onChange={(m) => set({ input: m })} context={ctx} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} />
          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
            <UiCheckbox size="sm" checked={hasCancelEvent} onChange={(e) => set({ cancelEvent: e.target.checked ? effectiveCancelEvent : undefined })} />
            Cancel Region — external event cancels this child workflow without failing the parent
          </label>
          {hasCancelEvent ? (
            <div className="flex flex-col gap-2 rounded border border-slate-100 p-2">
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
                Cancel event name
                <UiInput
                  size="sm"
                  aiAssist={false}
                  autoDir={false}
                  className="text-xs font-normal"
                  value={effectiveCancelEvent.eventName}
                  onChange={(e) => set({ cancelEvent: { ...effectiveCancelEvent, eventName: e.target.value } })}
                  placeholder="e.g. order.cancelled"
                />
              </label>
              <ExpressionField
                label="Correlation (must match the incoming event's correlation key)"
                definitionId={definitionId}
                value={effectiveCancelEvent.correlation as never}
                onChange={(expression) => set({ cancelEvent: { ...effectiveCancelEvent, correlation: expression } })}
                context={cancelEventCtx}
                getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths}
              />
              <p className="text-[10px] font-normal text-slate-500">
                Route the resulting CANCEL_REGION edge from this node in the canvas to wherever the parent workflow should continue.
              </p>
            </div>
          ) : null}
        </div>
      );
    }

    default:
      return (
        <p className="text-xs text-slate-500">
          {node.kind} does not have a bespoke form yet — edit it via the raw JSON below.
        </p>
      );
  }
};

export const NODE_KINDS_WITH_FORM = new Set(['ACTION', 'FOR_EACH', 'LOOP', 'DECISION', 'SWITCH', 'END', 'FAIL', 'DELAY', 'WORK_ITEM', 'PARALLEL_JOIN', 'WAIT_EVENT', 'SUBFLOW']);
