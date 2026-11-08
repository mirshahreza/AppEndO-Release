import React from 'react';
import { AppButton, FormField, FormSection, UiCheckboxChoice, UiInput } from '../../shared/ui';
import { UiTextareaCore } from '../../shared/ui/HeroFieldControls';
import { cn } from '../../lib/utils';
import {
  DevReferenceJsonPreview,
  DevReferencePreviewFrame,
} from './DevReferencePreview';
import {
  DEV_REFERENCE_FIELD_CLASS,
  DEV_REFERENCE_FIELDS_STACK_CLASS,
  DEV_REFERENCE_SECTION_STACK_CLASS,
  DEV_REFERENCE_SPLIT_INPUT_CLASS,
  DEV_REFERENCE_SPLIT_WORKSPACE_CLASS,
  DEV_REFERENCE_COLUMN_CLASS,
  DEV_REFERENCE_PREVIEW_BODY_CLASS,
} from './devReferenceLayout';
import {
  AUTH_USAGE_SNIPPET,
  CTX_USAGE_SNIPPET,
  DB_QUERY_USAGE_SNIPPET,
  GLOBALS_OVERVIEW_SNIPPET,
  REGEX_USAGE_SNIPPET,
  SCHEMA_USAGE_SNIPPET,
  type ServerUtilityTopicId,
} from './devReferenceTopics';
import type { RunResult, SandboxExecuteOptions } from './devReferenceShared';
import {
  AsyncHandlerPanel,
  ConsoleLoggingPanel,
  CrudHandlerPanel,
  DbDataSourcePanel,
  GlobalsReferenceCard,
  GuidePanel,
  InjectableSnippetsPanel,
  PackageApiGuidePanel,
  RegexErrorsPanel,
  ReqBodyPanel,
  ReqQueryPanel,
  ResPatternsPanel,
  ResponseContractPanel,
  RoleGuardPanel,
  SchemaFormatsPanel,
  SecurityLimitsPanel,
  TypeScriptTypesPanel,
  WorkflowAiSchemaPanel,
  WorkflowRegexGuidePanel,
} from './DevReferenceExtendedPanels';

export type TopicRunFn = (code: string, options?: SandboxExecuteOptions) => Promise<void>;

type TopicPanelProps = {
  run: TopicRunFn;
  reportError: (message: string) => void;
  runResult: RunResult;
};

const RunResultPreview: React.FC<{
  label: string;
  runResult: RunResult;
  tone?: 'emerald' | 'cyan' | 'violet' | 'slate';
  emptyHint?: string;
}> = ({ label, runResult, tone = 'slate', emptyHint = 'Run the tester to see a real result.' }) => (
  <div>
    <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
    {runResult.error ? (
      <p className="text-xs text-rose-600">{runResult.error}</p>
    ) : (
      <DevReferenceJsonPreview
        json={JSON.stringify(runResult.data ?? { info: emptyHint }, null, 2)}
        tone={tone}
      />
    )}
  </div>
);

const SplitTopicShell: React.FC<{ form: React.ReactNode; preview: React.ReactNode }> = ({ form, preview }) => (
  <div className={cn(DEV_REFERENCE_SPLIT_WORKSPACE_CLASS, 'min-h-0 flex-1')}>
    <div className={DEV_REFERENCE_COLUMN_CLASS}>{form}</div>
    <DevReferencePreviewFrame>
      {preview}
    </DevReferencePreviewFrame>
  </div>
);

const OverviewTopicPanel: React.FC<TopicPanelProps> = ({ run, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="Probe sandbox globals" tone="slate">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <p className="text-xs text-slate-600">
              Lists every global, util keys, and confirms npm/require are blocked.
            </p>
            <AppButton
              intent="primary"
              size="sm"
              onClick={() => run(`res.json({
  globals: { req: typeof req, res: typeof res, db: typeof db, ctx: typeof ctx, util: typeof util },
  utilKeys: Object.keys(util),
  blocked: { require: typeof require, process: typeof process },
  reqShape: { body: typeof req.body, query: typeof req.query, params: typeof req.params, method: req.method, auth: req.auth },
});`)}
              disabled={runResult.loading}
            >
              {runResult.loading ? 'Probing…' : 'Run global probe'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="Probe result" runResult={runResult} tone="slate" />
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Globals reference</p>
          <GlobalsReferenceCard />
        </div>
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Quick reference</p>
          <DevReferenceJsonPreview json={GLOBALS_OVERVIEW_SNIPPET} tone="slate" />
        </div>
      </div>
    )}
  />
);

const RegexMatchTopicPanel: React.FC<TopicPanelProps & {
  pattern: string; setPattern: (v: string) => void;
  flags: string; setFlags: (v: string) => void;
  isGlobal: boolean; setIsGlobal: (v: boolean) => void;
  subjectText: string; setSubjectText: (v: string) => void;
}> = ({ pattern, setPattern, flags, setFlags, isGlobal, setIsGlobal, subjectText, setSubjectText, run, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="Regex match (RE2, ReDoS-safe)" tone="emerald">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <FormField label="Pattern" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiInput size="sm" className={DEV_REFERENCE_SPLIT_INPUT_CLASS} value={pattern} onChange={(e) => setPattern(e.target.value)} />
            </FormField>
            <FormField label="Flags" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiInput size="sm" className={DEV_REFERENCE_SPLIT_INPUT_CLASS} value={flags} onChange={(e) => setFlags(e.target.value)} placeholder="i" />
            </FormField>
            <FormField label="" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiCheckboxChoice checked={isGlobal} onChange={setIsGlobal}>Match all occurrences (global)</UiCheckboxChoice>
            </FormField>
            <FormField label="Subject text" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiTextareaCore size="sm" className="min-h-[4.5rem] w-full" value={subjectText} onChange={(e) => setSubjectText(e.target.value)} />
            </FormField>
            <AppButton intent="primary" size="sm" onClick={() => run(`res.json(util.regexMatch(${JSON.stringify(pattern)}, ${JSON.stringify(subjectText)}, ${JSON.stringify({ flags, global: isGlobal })}));`)} disabled={runResult.loading}>
              {runResult.loading ? 'Running…' : 'Run util.regexMatch'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="Result" runResult={runResult} tone="emerald" />
        <DevReferenceJsonPreview json={REGEX_USAGE_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

const ValidateSchemaTopicPanel: React.FC<TopicPanelProps & {
  schemaText: string; setSchemaText: (v: string) => void;
  valueText: string; setValueText: (v: string) => void;
  onRun: () => void;
}> = ({ schemaText, setSchemaText, valueText, setValueText, onRun, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="JSON Schema validate (ajv)" tone="cyan">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <FormField label="Schema (JSON)" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiTextareaCore size="sm" className="min-h-[6rem] w-full font-mono text-[11px]" value={schemaText} onChange={(e) => setSchemaText(e.target.value)} />
            </FormField>
            <FormField label="Value (JSON)" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiTextareaCore size="sm" className="min-h-[4rem] w-full font-mono text-[11px]" value={valueText} onChange={(e) => setValueText(e.target.value)} />
            </FormField>
            <AppButton intent="primary" size="sm" onClick={onRun} disabled={runResult.loading}>
              {runResult.loading ? 'Validating…' : 'Run util.validateSchema'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="Result" runResult={runResult} tone="cyan" />
        <DevReferenceJsonPreview json={SCHEMA_USAGE_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

const AuthTopicPanel: React.FC<TopicPanelProps> = ({ run, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="req.auth" tone="violet">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <p className="text-xs text-slate-600">Reads the authenticated caller from your current session.</p>
            <AppButton intent="primary" size="sm" onClick={() => run('res.json(req.auth);')} disabled={runResult.loading}>
              {runResult.loading ? 'Reading…' : 'Read req.auth'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="req.auth" runResult={runResult} tone="violet" />
        <DevReferenceJsonPreview json={AUTH_USAGE_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

const SessionCtxTopicPanel: React.FC<TopicPanelProps & { ctxKey: string; setCtxKey: (v: string) => void }> = ({ ctxKey, setCtxKey, run, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="ctx (session context)" tone="amber">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <FormField label="Key to read" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiInput size="sm" className={DEV_REFERENCE_SPLIT_INPUT_CLASS} value={ctxKey} onChange={(e) => setCtxKey(e.target.value)} placeholder="tenantId" />
            </FormField>
            <AppButton intent="primary" size="sm" onClick={() => run(`res.json({ key: ${JSON.stringify(ctxKey)}, value: ctx.get(${JSON.stringify(ctxKey)}), serverValue: ctx.server.get(${JSON.stringify(ctxKey)}), clientValue: ctx.client.get(${JSON.stringify(ctxKey)}) });`)} disabled={runResult.loading}>
              {runResult.loading ? 'Reading…' : 'Read ctx key'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="ctx values" runResult={runResult} tone="amber" />
        <DevReferenceJsonPreview json={CTX_USAGE_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

const DbQueryTopicPanel: React.FC<TopicPanelProps> = ({ run, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="db.query" tone="rose">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <p className="text-xs text-slate-600">Mock rows in this tester; real data source in production runs.</p>
            <AppButton intent="primary" size="sm" onClick={() => run(`async function handler() { const result = await db.query('SELECT 1 AS n', []); res.json(result); }`)} disabled={runResult.loading}>
              {runResult.loading ? 'Querying…' : 'Run db.query'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="Query result" runResult={runResult} tone="rose" />
        <DevReferenceJsonPreview json={DB_QUERY_USAGE_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

const HandlerPlaygroundTopicPanel: React.FC<TopicPanelProps & {
  code: string; setCode: (v: string) => void;
  payloadText: string; setPayloadText: (v: string) => void;
}> = ({ code, setCode, payloadText, setPayloadText, run, reportError, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="Handler playground" tone="slate">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <FormField label="Handler code" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiTextareaCore size="sm" className="min-h-[10rem] w-full font-mono text-[11px]" value={code} onChange={(e) => setCode(e.target.value)} />
            </FormField>
            <FormField label="payload (JSON)" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiTextareaCore size="sm" className="min-h-[3.5rem] w-full font-mono text-[11px]" value={payloadText} onChange={(e) => setPayloadText(e.target.value)} />
            </FormField>
            <AppButton intent="primary" size="sm" disabled={runResult.loading} onClick={() => {
              let payload: unknown;
              try { payload = JSON.parse(payloadText); } catch { reportError('payload is not valid JSON.'); return; }
              run(code, { sandboxBody: { payload } });
            }}>
              {runResult.loading ? 'Running…' : 'Run handler'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={<div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}><RunResultPreview label="Response" runResult={runResult} tone="slate" /></div>}
  />
);

export type DevReferenceTopicPanelsProps = {
  activeTopic: ServerUtilityTopicId;
  runResult: RunResult;
  run: TopicRunFn;
  reportError: (message: string) => void;
  regex: { pattern: string; setPattern: (v: string) => void; flags: string; setFlags: (v: string) => void; isGlobal: boolean; setIsGlobal: (v: boolean) => void; subjectText: string; setSubjectText: (v: string) => void };
  schema: { schemaText: string; setSchemaText: (v: string) => void; valueText: string; setValueText: (v: string) => void; onRun: () => void };
  schemaFormats: { valueText: string; setValueText: (v: string) => void };
  reqBody: { payloadText: string; setPayloadText: (v: string) => void };
  reqQuery: { page: string; setPage: (v: string) => void; sort: string; setSort: (v: string) => void };
  roleGuard: { requiredRole: string; setRequiredRole: (v: string) => void };
  sessionCtx: { ctxKey: string; setCtxKey: (v: string) => void };
  handler: { code: string; setCode: (v: string) => void; payloadText: string; setPayloadText: (v: string) => void };
  crud: { code: string; setCode: (v: string) => void; payloadText: string; setPayloadText: (v: string) => void; method: string; setMethod: (v: string) => void };
};

export const DevReferenceTopicPanels: React.FC<DevReferenceTopicPanelsProps> = ({
  activeTopic, runResult, run, reportError,
  regex, schema, schemaFormats, reqBody, reqQuery, roleGuard, sessionCtx, handler, crud,
}) => {
  const panelProps = { run, reportError, runResult };

  switch (activeTopic) {
    case 'overview': return <OverviewTopicPanel {...panelProps} />;
    case 'typescript-types': return <TypeScriptTypesPanel />;
    case 'security-limits': return <SecurityLimitsPanel {...panelProps} />;
    case 'regex-match': return <RegexMatchTopicPanel {...panelProps} {...regex} />;
    case 'regex-errors': return <RegexErrorsPanel {...panelProps} />;
    case 'validate-schema': return <ValidateSchemaTopicPanel {...panelProps} {...schema} />;
    case 'schema-formats': return <SchemaFormatsPanel {...panelProps} {...schemaFormats} />;
    case 'req-body': return <ReqBodyPanel {...panelProps} {...reqBody} />;
    case 'req-query': return <ReqQueryPanel {...panelProps} {...reqQuery} />;
    case 'req-auth': return <AuthTopicPanel {...panelProps} />;
    case 'role-guard': return <RoleGuardPanel {...panelProps} {...roleGuard} />;
    case 'session-ctx': return <SessionCtxTopicPanel {...panelProps} {...sessionCtx} />;
    case 'res-patterns': return <ResPatternsPanel {...panelProps} />;
    case 'response-contract': return <ResponseContractPanel {...panelProps} />;
    case 'db-query': return <DbQueryTopicPanel {...panelProps} />;
    case 'db-data-source': return <DbDataSourcePanel {...panelProps} />;
    case 'async-handler': return <AsyncHandlerPanel {...panelProps} />;
    case 'console-logging': return <ConsoleLoggingPanel {...panelProps} />;
    case 'injectable-snippets': return <InjectableSnippetsPanel />;
    case 'handler-playground': return <HandlerPlaygroundTopicPanel {...panelProps} {...handler} />;
    case 'handler-crud': return <CrudHandlerPanel {...panelProps} {...crud} />;
    case 'workflow-regex': return <WorkflowRegexGuidePanel />;
    case 'workflow-ai-schema': return <WorkflowAiSchemaPanel />;
    case 'package-api': return <PackageApiGuidePanel />;
    default: return null;
  }
};
