import React from 'react';
import { AppButton, FormField, FormSection, UiInput } from '../../shared/ui';
import { UiTextareaCore } from '../../shared/ui/HeroFieldControls';
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
  DEV_REFERENCE_WORKSPACE_INSET_CLASS,
} from './devReferenceLayout';
import {
  SCHEMA_FORMATS_DEFAULT_VALUE,
  ASYNC_HANDLER_SNIPPET,
  BLOCKED_GLOBALS,
  CONSOLE_LOGGING_SNIPPET,
  CRUD_HANDLER_SNIPPET,
  DB_DATA_SOURCE_SNIPPET,
  GLOBALS_REFERENCE,
  INJECTABLE_SNIPPET_ENTRIES,
  PACKAGE_API_SNIPPET,
  REGEX_ERROR_SNIPPET,
  REGEX_USAGE_SNIPPET,
  REQ_BODY_SNIPPET,
  REQ_QUERY_SNIPPET,
  RES_PATTERNS_SNIPPET,
  RESPONSE_CONTRACT_SNIPPET,
  ROLE_GUARD_SNIPPET,
  SANDBOX_LIMITS,
  SCHEMA_FORMATS_SNIPPET,
  SCHEMA_USAGE_SNIPPET,
  TYPESCRIPT_TYPES_SNIPPET,
  WORKFLOW_AI_SCHEMA_SNIPPET,
  WORKFLOW_REGEX_SNIPPET,
} from './devReferenceTopics';
import type { RunResult, SandboxExecuteOptions } from './devReferenceShared';
import { cn } from '../../lib/utils';

export type TopicPanelProps = {
  run: (code: string, options?: SandboxExecuteOptions) => Promise<void>;
  reportError: (message: string) => void;
  runResult: RunResult;
};

const RunResultPreview: React.FC<{
  label: string;
  runResult: RunResult;
  tone?: 'emerald' | 'cyan' | 'violet' | 'slate' | 'amber' | 'rose' | 'indigo';
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

export const GuidePanel: React.FC<{
  title: string;
  description: string;
  snippets: { label: string; code: string; tone?: 'slate' | 'emerald' | 'cyan' | 'violet' | 'amber' | 'rose' }[];
  children?: React.ReactNode;
}> = ({ title, description, snippets, children }) => (
  <div className={cn(DEV_REFERENCE_WORKSPACE_INSET_CLASS, 'flex min-h-0 min-w-0 flex-1 flex-col')}>
    <DevReferencePreviewFrame>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs text-slate-600">{description}</p>
        </div>
        {children}
        {snippets.map((snippet) => (
          <div key={snippet.label}>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{snippet.label}</p>
            <DevReferenceJsonPreview json={snippet.code} tone={snippet.tone ?? 'slate'} />
          </div>
        ))}
      </div>
    </DevReferencePreviewFrame>
  </div>
);

export const GlobalsReferenceCard: React.FC = () => (
  <div className="overflow-hidden rounded-lg border border-slate-200">
    <table className="w-full text-left text-[11px]">
      <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <tr>
          <th className="px-2 py-1.5">Global</th>
          <th className="px-2 py-1.5">Type</th>
          <th className="px-2 py-1.5">Summary</th>
        </tr>
      </thead>
      <tbody>
        {GLOBALS_REFERENCE.map((row) => (
          <tr key={row.name} className="border-t border-slate-100">
            <td className="px-2 py-1.5 font-mono text-emerald-800">{row.name}</td>
            <td className="px-2 py-1.5 text-slate-500">{row.type}</td>
            <td className="px-2 py-1.5 text-slate-700">{row.summary}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const LimitsReferenceCard: React.FC = () => (
  <div className="overflow-hidden rounded-lg border border-slate-200">
    <table className="w-full text-left text-[11px]">
      <tbody>
        {SANDBOX_LIMITS.map((row) => (
          <tr key={row.label} className="border-t border-slate-100 first:border-t-0">
            <td className="px-2 py-1.5 font-medium text-slate-700">{row.label}</td>
            <td className="px-2 py-1.5 text-slate-600">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const TypeScriptTypesPanel: React.FC = () => (
  <GuidePanel
    title="TypeScript types"
    description="Paste these types at the top of your Server Function. The editor also offers @inject:req-types, @inject:res-types, and @inject:db-types snippets."
    snippets={[{ label: 'EdgeReq / EdgeRes / EdgeDb', code: TYPESCRIPT_TYPES_SNIPPET, tone: 'cyan' }]}
  />
);

export const SecurityLimitsPanel: React.FC<TopicPanelProps> = ({ run, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="Security probe" tone="rose">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <p className="text-xs text-slate-600">
              Confirms blocked globals and lists platform-enforced limits.
            </p>
            <AppButton
              intent="primary"
              size="sm"
              onClick={() => run(`res.json({
  blocked: {
    require: typeof require,
    process: typeof process,
    module: typeof module,
    global: typeof global,
  },
  limits: {
    regexMaxPattern: 500,
    regexMaxSubject: 100000,
    timeoutMs: '100-15000 (default 3000)',
    memoryMb: '64 | 128 | 256',
  },
});`)}
              disabled={runResult.loading}
            >
              {runResult.loading ? 'Probing…' : 'Run security probe'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="Probe result" runResult={runResult} tone="rose" />
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Blocked globals</p>
          <p className="mb-2 text-xs text-slate-600">{BLOCKED_GLOBALS.join(', ')}</p>
          <LimitsReferenceCard />
        </div>
      </div>
    )}
  />
);

export const RegexErrorsPanel: React.FC<TopicPanelProps> = ({ run, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="Error scenarios" tone="amber">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <p className="text-xs text-slate-600">util.regexMatch returns structured errors — never throws.</p>
            <div className="flex flex-wrap gap-2">
              <AppButton intent="secondary" size="sm" disabled={runResult.loading} onClick={() => run("res.json(util.regexMatch('[', 'abc'));")}>
                Invalid pattern
              </AppButton>
              <AppButton intent="secondary" size="sm" disabled={runResult.loading} onClick={() => run(`res.json(util.regexMatch(${JSON.stringify('a'.repeat(501))}, 'x'));`)}>
                Pattern too long
              </AppButton>
              <AppButton intent="secondary" size="sm" disabled={runResult.loading} onClick={() => run(`res.json(util.regexMatch('test', ${JSON.stringify('x'.repeat(100001))}));`)}>
                Subject too long
              </AppButton>
              <AppButton intent="secondary" size="sm" disabled={runResult.loading} onClick={() => run("res.json(util.regexMatch('(a+)+b', 'a'.repeat(64) + 'c'));")}>
                ReDoS-safe (no hang)
              </AppButton>
            </div>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="Result" runResult={runResult} tone="amber" />
        <DevReferenceJsonPreview json={REGEX_ERROR_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

export const SchemaFormatsPanel: React.FC<TopicPanelProps & {
  valueText: string;
  setValueText: (v: string) => void;
}> = ({ valueText, setValueText, run, reportError, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="ajv-formats" tone="cyan">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <FormField label="Value (JSON)" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiTextareaCore size="sm" className="min-h-[5rem] w-full font-mono text-[11px]" value={valueText} onChange={(e) => setValueText(e.target.value)} />
            </FormField>
            <AppButton
              intent="primary"
              size="sm"
              disabled={runResult.loading}
              onClick={() => {
                let parsed: unknown;
                try { parsed = JSON.parse(valueText); } catch { reportError('Value is not valid JSON.'); return; }
                const schema = {
                  type: 'object',
                  required: ['email', 'createdAt', 'id'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    createdAt: { type: 'string', format: 'date-time' },
                    id: { type: 'string', format: 'uuid' },
                    website: { type: 'string', format: 'uri' },
                  },
                };
                run(`res.json(util.validateSchema(${JSON.stringify(schema)}, ${JSON.stringify(parsed)}));`);
              }}
            >
              {runResult.loading ? 'Validating…' : 'Validate formats'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="Validation result" runResult={runResult} tone="cyan" />
        <DevReferenceJsonPreview json={SCHEMA_FORMATS_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

export const ReqBodyPanel: React.FC<TopicPanelProps & {
  payloadText: string;
  setPayloadText: (v: string) => void;
}> = ({ payloadText, setPayloadText, run, reportError, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="req.body" tone="indigo">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <p className="text-xs text-slate-600">Extra POST fields become req.body keys (use payload for simulated client data).</p>
            <FormField label="payload (JSON)" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiTextareaCore size="sm" className="min-h-[4rem] w-full font-mono text-[11px]" value={payloadText} onChange={(e) => setPayloadText(e.target.value)} />
            </FormField>
            <AppButton intent="primary" size="sm" disabled={runResult.loading} onClick={() => {
              let payload: unknown;
              try { payload = JSON.parse(payloadText); } catch { reportError('payload is not valid JSON.'); return; }
              run(`async function handler() {
  const payload = req.body.payload || req.body;
  res.json({ method: req.method, bodyKeys: Object.keys(req.body || {}), payload });
}`, { sandboxBody: { payload } });
            }}>
              {runResult.loading ? 'Reading…' : 'Read req.body'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="req.body echo" runResult={runResult} tone="indigo" />
        <DevReferenceJsonPreview json={REQ_BODY_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

export const ReqQueryPanel: React.FC<TopicPanelProps & {
  page: string; setPage: (v: string) => void;
  sort: string; setSort: (v: string) => void;
}> = ({ page, setPage, sort, setSort, run, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="req.query" tone="indigo">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <p className="text-xs text-slate-600">Query params are sent on the execute URL and appear in req.query.</p>
            <FormField label="page" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiInput size="sm" className={DEV_REFERENCE_SPLIT_INPUT_CLASS} value={page} onChange={(e) => setPage(e.target.value)} />
            </FormField>
            <FormField label="sort" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiInput size="sm" className={DEV_REFERENCE_SPLIT_INPUT_CLASS} value={sort} onChange={(e) => setSort(e.target.value)} />
            </FormField>
            <AppButton intent="primary" size="sm" disabled={runResult.loading} onClick={() => run(REQ_QUERY_SNIPPET, { query: { page, sort } })}>
              {runResult.loading ? 'Reading…' : 'Read req.query'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="req.query echo" runResult={runResult} tone="indigo" />
        <DevReferenceJsonPreview json={REQ_QUERY_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

export const RoleGuardPanel: React.FC<TopicPanelProps & {
  requiredRole: string;
  setRequiredRole: (v: string) => void;
}> = ({ requiredRole, setRequiredRole, run, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="Role guard" tone="violet">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <FormField label="Required role" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiInput size="sm" className={DEV_REFERENCE_SPLIT_INPUT_CLASS} value={requiredRole} onChange={(e) => setRequiredRole(e.target.value)} />
            </FormField>
            <AppButton intent="primary" size="sm" disabled={runResult.loading} onClick={() => run(
              `const roles = req.auth?.roles || [];
const required = ${JSON.stringify(requiredRole)};
if (!roles.includes(required)) {
  return res.status(403).json({ success: false, error: 'Forbidden: requires ' + required, roles });
}
res.json({ success: true, message: 'Access granted.', roles });`,
            )}>
              {runResult.loading ? 'Checking…' : 'Run role guard'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="Guard result" runResult={runResult} tone="violet" />
        <DevReferenceJsonPreview json={ROLE_GUARD_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

export const ResPatternsPanel: React.FC<TopicPanelProps> = ({ run, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="Response patterns" tone="emerald">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <div className="flex flex-wrap gap-2">
              <AppButton intent="secondary" size="sm" disabled={runResult.loading} onClick={() => run("res.json({ success: true, data: { id: 1 } });")}>res.json</AppButton>
              <AppButton intent="secondary" size="sm" disabled={runResult.loading} onClick={() => run("res.status(201).json({ success: true, data: { id: 2 } });")}>status + json</AppButton>
              <AppButton intent="secondary" size="sm" disabled={runResult.loading} onClick={() => run("res.status(200).send('OK');")}>res.send</AppButton>
              <AppButton intent="secondary" size="sm" disabled={runResult.loading} onClick={() => run("res.json({ sent: res.headersSent() }); res.json({ second: 'blocked' });")}>headersSent</AppButton>
            </div>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="Response" runResult={runResult} tone="emerald" />
        <DevReferenceJsonPreview json={RES_PATTERNS_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

export const ResponseContractPanel: React.FC<TopicPanelProps> = ({ run, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="Response contract" tone="emerald">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <div className="flex flex-wrap gap-2">
              <AppButton intent="secondary" size="sm" disabled={runResult.loading} onClick={() => run("res.json({ success: true, data: [{ id: 1 }], count: 1 });")}>Success 200</AppButton>
              <AppButton intent="secondary" size="sm" disabled={runResult.loading} onClick={() => run("res.status(400).json({ success: false, error: 'Invalid input', errors: ['/email must match format email'] });")}>Error 400</AppButton>
              <AppButton intent="secondary" size="sm" disabled={runResult.loading} onClick={() => run("res.status(401).json({ success: false, error: 'Authentication required.' });")}>Error 401</AppButton>
              <AppButton intent="secondary" size="sm" disabled={runResult.loading} onClick={() => run("res.status(403).json({ success: false, error: 'Forbidden.' });")}>Error 403</AppButton>
            </div>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="Response body" runResult={runResult} tone="emerald" />
        <DevReferenceJsonPreview json={RESPONSE_CONTRACT_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

export const DbDataSourcePanel: React.FC<TopicPanelProps> = ({ run, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="Data source context" tone="rose">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <p className="text-xs text-slate-600">Pass dataSourceId/database as the third argument to db.query.</p>
            <AppButton intent="primary" size="sm" disabled={runResult.loading} onClick={() => run(
              `async function handler() {
  const result = await db.query('SELECT 1 AS n', [], { dataSourceId: 'reporting-db', database: 'analytics' });
  res.json(result);
}`,
            )}>
              {runResult.loading ? 'Querying…' : 'Run with context'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="Query result" runResult={runResult} tone="rose" />
        <DevReferenceJsonPreview json={DB_DATA_SOURCE_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

export const AsyncHandlerPanel: React.FC<TopicPanelProps> = ({ run, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="async handler()" tone="slate">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <AppButton intent="primary" size="sm" disabled={runResult.loading} onClick={() => run(
              `async function handler(): Promise<void> {
  const schema = { type: 'object', required: ['id'], properties: { id: { type: 'number' } } };
  const check = util.validateSchema(schema, req.body.payload || {});
  if (!check.valid) {
    res.status(400).json({ success: false, errors: check.errors });
    return;
  }
  const result = await db.query('SELECT * FROM items WHERE id = @p0', [req.body.payload.id]);
  res.json({ success: true, data: result.data });
}`,
              { sandboxBody: { payload: { id: 1 } } },
            )}>
              {runResult.loading ? 'Running…' : 'Run async handler'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="Response" runResult={runResult} tone="slate" />
        <DevReferenceJsonPreview json={ASYNC_HANDLER_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

export const ConsoleLoggingPanel: React.FC<TopicPanelProps> = ({ run, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="console.log / console.error" tone="slate">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <p className="text-xs text-slate-600">Logs go to server output ([Server Function] prefix). The HTTP response is separate.</p>
            <AppButton intent="primary" size="sm" disabled={runResult.loading} onClick={() => run(CONSOLE_LOGGING_SNIPPET)}>
              {runResult.loading ? 'Running…' : 'Run with logging'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="HTTP response (logs are server-side)" runResult={runResult} tone="slate" />
        <DevReferenceJsonPreview json={CONSOLE_LOGGING_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

export const InjectableSnippetsPanel: React.FC = () => (
  <GuidePanel
    title="Injectable snippets"
    description="Use these markers in the Server Functions editor (snippet toolbar) or paste directly into your function."
    snippets={[]}
  >
    <div className="flex flex-col gap-3">
      {INJECTABLE_SNIPPET_ENTRIES.map((entry) => (
        <div key={entry.key}>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {entry.label}
            <span className="ms-2 font-mono font-normal normal-case text-slate-400">{entry.marker}</span>
          </p>
          <DevReferenceJsonPreview json={entry.body} tone="slate" />
        </div>
      ))}
    </div>
  </GuidePanel>
);

export const CrudHandlerPanel: React.FC<TopicPanelProps & {
  code: string; setCode: (v: string) => void;
  payloadText: string; setPayloadText: (v: string) => void;
  method: string; setMethod: (v: string) => void;
}> = ({ code, setCode, payloadText, setPayloadText, method, setMethod, run, reportError, runResult }) => (
  <SplitTopicShell
    form={(
      <div className={DEV_REFERENCE_SECTION_STACK_CLASS}>
        <FormSection title="CRUD handler example" tone="slate">
          <div className={DEV_REFERENCE_FIELDS_STACK_CLASS}>
            <FormField label="Simulated method (req.method)" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiInput size="sm" className={DEV_REFERENCE_SPLIT_INPUT_CLASS} value={method} onChange={(e) => setMethod(e.target.value)} placeholder="GET" />
            </FormField>
            <FormField label="Handler code" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiTextareaCore size="sm" className="min-h-[8rem] w-full font-mono text-[11px]" value={code} onChange={(e) => setCode(e.target.value)} />
            </FormField>
            <FormField label="payload (JSON)" className={DEV_REFERENCE_FIELD_CLASS}>
              <UiTextareaCore size="sm" className="min-h-[3rem] w-full font-mono text-[11px]" value={payloadText} onChange={(e) => setPayloadText(e.target.value)} />
            </FormField>
            <AppButton intent="primary" size="sm" disabled={runResult.loading} onClick={() => {
              let payload: unknown;
              try { payload = JSON.parse(payloadText); } catch { reportError('payload is not valid JSON.'); return; }
              run(code, { sandboxBody: { payload, _method: method } });
            }}>
              {runResult.loading ? 'Running…' : 'Run CRUD handler'}
            </AppButton>
          </div>
        </FormSection>
      </div>
    )}
    preview={(
      <div className={DEV_REFERENCE_PREVIEW_BODY_CLASS}>
        <RunResultPreview label="Response" runResult={runResult} tone="slate" />
        <DevReferenceJsonPreview json={CRUD_HANDLER_SNIPPET} tone="slate" />
      </div>
    )}
  />
);

export const WorkflowAiSchemaPanel: React.FC = () => (
  <GuidePanel
    title="Workflow: AI structured output"
    description="ai.llm-structured validates model JSON against outputSchema using the same ajv primitive as util.validateSchema."
    snippets={[
      { label: 'ACTION node with outputSchema', code: WORKFLOW_AI_SCHEMA_SNIPPET, tone: 'violet' },
      { label: 'Server Function equivalent', code: SCHEMA_USAGE_SNIPPET, tone: 'slate' },
    ]}
  />
);

export const WorkflowRegexGuidePanel: React.FC = () => (
  <GuidePanel
    title="Workflow: text.regex-match"
    description="Use the corePack Action instead of free-form regex. Same RE2-backed util.regexMatch primitive."
    snippets={[
      { label: 'ACTION node config', code: WORKFLOW_REGEX_SNIPPET, tone: 'emerald' },
      { label: 'Server Function equivalent', code: REGEX_USAGE_SNIPPET, tone: 'slate' },
    ]}
  />
);

export const PackageApiGuidePanel: React.FC = () => (
  <GuidePanel
    title="Package API handler"
    description="Installed package routes use module.exports with req, res, and util.* (imported from canonical server utils)."
    snippets={[
      { label: 'edge/*.js handler', code: PACKAGE_API_SNIPPET, tone: 'cyan' },
      { label: 'Validation pattern', code: SCHEMA_USAGE_SNIPPET, tone: 'slate' },
    ]}
  />
);
