import React, { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Save, Send } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  AppButton,
  ICON_ACTION_BUTTON_MD_CLASS,
  ICON_ACTION_DUPLICATE_CLASS,
  ICON_ACTION_EDIT_CLASS,
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
  SplitButtonMenuItem,
  UiInput,
  UiSelect,
  WORKSPACE_SPLIT_PANEL_KEYS,
  WorkspaceHorizontalSplitHandle,
  useWorkspaceHorizontalSplitPanel,
} from "../../shared/ui";
import {
  SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS,
  useFixedDropDownMenuStyle,
  useSplitButtonMenu,
} from "../../shared/ui/AppSplitButton";
import { overlayMotionDocumentDir, overlayMotionPanelProps } from "../../shared/ui/overlay-motion/overlayMotion";
import { showAppFeedbackToast } from "../../shared/ui/appFeedbackToast";
import { generateHttpSnippet, SNIPPET_FORMAT_LABELS, type SnippetFormat } from "../../shared/lib/httpSnippetGenerator";
import { UiTabs, type UiTabItem } from "../../shared/ui/UiTabs";
import type {
  HttpWorkshopAssertion,
  HttpWorkshopAuthKind,
  HttpWorkshopBodyMode,
  HttpWorkshopMethod,
} from "../../shared/api/queries/api-talk";
import type { WorkshopTab } from "./apiTalkTabTypes";
import { ApiTalkKeyValueListField } from "./ApiTalkKeyValueListField";
import { enabledWorkshopKeyValues } from "./apiTalkTabTypes";
import { InspectorKeyValueListField } from "../component-designer/components/InspectorKeyValueListField";
import { formatHttpWorkshopResponseBody } from "../../shared/lib/httpWorkshopResponseBody";
import { MonacoEditorPanel } from "../server-functions/components/MonacoEditorPanel";

const METHODS: HttpWorkshopMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const METHOD_COLOR_CLASS: Record<HttpWorkshopMethod, string> = {
  GET: "text-emerald-600",
  POST: "text-amber-600",
  PUT: "text-sky-600",
  PATCH: "text-violet-600",
  DELETE: "text-rose-600",
  HEAD: "text-slate-500",
  OPTIONS: "text-slate-500",
};

const AUTH_KIND_LABELS: Record<Exclude<HttpWorkshopAuthKind, "inherit">, string> = {
  none: "No auth",
  apiKey: "API key header",
  bearer: "Bearer token",
  basic: "Basic auth",
  customHeaders: "Custom headers",
};

const JSON_EDITOR_OPTIONS = {
  fontSize: 12,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  minimap: { enabled: false },
  lineNumbers: "on" as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: "on" as const,
};

const READONLY_JSON_EDITOR_OPTIONS = { ...JSON_EDITOR_OPTIONS, readOnly: true };

function statusToneClass(status: number): string {
  if (status >= 200 && status < 300) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (status >= 300 && status < 400) return "text-sky-700 bg-sky-50 border-sky-200";
  if (status >= 400) return "text-rose-700 bg-rose-50 border-rose-200";
  return "text-slate-700 bg-slate-50 border-slate-200";
}

function formatBytes(value: unknown): string {
  const serialized = formatHttpWorkshopResponseBody(value);
  const size = new TextEncoder().encode(serialized).length;
  return size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`;
}

export function buildSnippetSpec(tab: WorkshopTab): { method: string; url: string; headers: Record<string, string>; body?: string } {
  const headers: Record<string, string> = {};
  for (const header of enabledWorkshopKeyValues(tab.headers)) {
    headers[header.key] = header.value;
  }
  if (tab.authKind === "apiKey" && tab.apiKeyHeaderName) {
    headers[tab.apiKeyHeaderName] = tab.secretPlaintext;
  } else if (tab.authKind === "bearer") {
    headers.Authorization = `Bearer ${tab.secretPlaintext}`;
  } else if (tab.authKind === "basic") {
    headers.Authorization = `Basic ${btoa(`${tab.basicUsername}:${tab.secretPlaintext}`)}`;
  } else if (tab.authKind === "customHeaders") {
    for (const [key, value] of Object.entries(tab.customHeaders ?? {})) {
      headers[key] = value;
    }
  }
  const queryEntries = enabledWorkshopKeyValues(tab.queryParams).map((item) => [item.key, item.value] as const);
  const url = queryEntries.length > 0
    ? `${tab.url}${tab.url.includes("?") ? "&" : "?"}${queryEntries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")}`
    : tab.url;
  return { method: tab.method, url, headers, body: tab.bodyMode !== "none" ? tab.bodyRaw : undefined };
}

export type ApiTalkRequestEditorProps = {
  tab: WorkshopTab;
  onChange: (patch: Partial<WorkshopTab>) => void;
  onSend: () => void;
  onSave: () => void;
  /** true when this tab is a saved request living inside a folder/collection (so "inherit" auth is meaningful). */
  canInheritAuth: boolean;
};

export const ApiTalkRequestEditor: React.FC<ApiTalkRequestEditorProps> = ({ tab, onChange, onSend, onSave, canInheritAuth }) => {
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [responseTab, setResponseTab] = useState("response-body");
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const copyMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const requestHeightSplit = useWorkspaceHorizontalSplitPanel({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.apiTalkRequestHeight,
    defaultSize: 320,
    minSize: 160,
    maxSize: 800,
    measure: "leading",
    containerRef: splitContainerRef,
    displayClassName: "block",
  });
  const copyMenuContainRefs = useMemo(() => [copyMenuPanelRef], []);
  const copyMenuRef = useSplitButtonMenu(copyMenuOpen, setCopyMenuOpen, copyMenuContainRefs);
  const copyMenuStyle = useFixedDropDownMenuStyle(copyMenuOpen, copyMenuRef, { align: "end", minWidth: 180 });
  const copyMenuMotion = overlayMotionPanelProps({
    kind: "popover",
    origin: "top-end",
    dir: overlayMotionDocumentDir(),
  });
  const copyAs = (format: SnippetFormat) => {
    const snippet = generateHttpSnippet(format, buildSnippetSpec(tab));
    void navigator.clipboard.writeText(snippet).then(() => {
      showAppFeedbackToast(`Copied as ${SNIPPET_FORMAT_LABELS[format]}`, { type: "success" });
    });
    setCopyMenuOpen(false);
  };

  const updateAssertion = (index: number, next: HttpWorkshopAssertion) => {
    onChange({ assertions: tab.assertions.map((item, i) => (i === index ? next : item)) });
  };
  const removeAssertion = (index: number) => {
    onChange({ assertions: tab.assertions.filter((_, i) => i !== index) });
  };
  const addAssertion = () => {
    onChange({ assertions: [...tab.assertions, { kind: "status", op: "equals", value: 200 }] });
  };

  const requestTabs: UiTabItem[] = useMemo(() => [
    {
      id: "request-params",
      label: "Params",
      badge: enabledWorkshopKeyValues(tab.queryParams).length || undefined,
      content: (
        <div className="h-full min-h-0 overflow-auto p-3">
          <ApiTalkKeyValueListField
            value={tab.queryParams}
            onChange={(next) => onChange({ queryParams: next, dirty: true })}
            keyPlaceholder="key"
            valuePlaceholder="value"
            fieldLabel="Query param"
            autoPadRows={5}
          />
        </div>
      ),
    },
    {
      id: "request-headers",
      label: "Headers",
      badge: enabledWorkshopKeyValues(tab.headers).length || undefined,
      content: (
        <div className="h-full min-h-0 overflow-auto p-3">
          <ApiTalkKeyValueListField
            value={tab.headers}
            onChange={(next) => onChange({ headers: next, dirty: true })}
            keyPlaceholder="header name"
            valuePlaceholder="value"
            fieldLabel="Header"
            autoPadRows={5}
          />
        </div>
      ),
    },
    {
      id: "request-body",
      label: "Body",
      content: (
        <div className="flex h-full min-h-0 flex-col p-3">
          <div className="mb-2 flex items-center gap-3">
            {(["none", "json", "raw"] as HttpWorkshopBodyMode[]).map((mode) => (
              <label key={mode} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                <input
                  type="radio"
                  name={`bodyMode-${tab.id}`}
                  checked={tab.bodyMode === mode}
                  onChange={() => onChange({ bodyMode: mode, dirty: true })}
                />
                {mode === "none" ? "None" : mode === "json" ? "JSON" : "Raw"}
              </label>
            ))}
          </div>
          {tab.bodyMode !== "none" ? (
            <div className="min-h-0 flex-1 overflow-hidden rounded border border-slate-200">
              <MonacoEditorPanel
                language={tab.bodyMode === "json" ? "json" : "plaintext"}
                value={tab.bodyRaw}
                onChange={(value) => onChange({ bodyRaw: value ?? "", dirty: true })}
                options={JSON_EDITOR_OPTIONS}
              />
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">This request has no body.</p>
          )}
        </div>
      ),
    },
    {
      id: "request-auth",
      label: "Auth",
      content: (
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3">
          <div className="max-w-xs">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Type</span>
            <UiSelect value={tab.authKind} onChange={(event) => onChange({ authKind: event.target.value as HttpWorkshopAuthKind, dirty: true })} size="sm" ariaLabel="Auth type">
              {canInheritAuth ? <option value="inherit">Inherit from parent</option> : null}
              {Object.entries(AUTH_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </UiSelect>
          </div>
          {tab.authKind === "inherit" ? (
            <p className="text-[11px] text-slate-500">Uses the auth configured on the parent folder or collection.</p>
          ) : null}
          {tab.authKind === "apiKey" ? (
            <div className="grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Header name</span>
                <UiInput value={tab.apiKeyHeaderName} onChange={(event) => onChange({ apiKeyHeaderName: event.target.value, dirty: true })} size="sm" ariaLabel="API key header name" placeholder="X-Api-Key" className="font-mono" />
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Value</span>
                <UiInput value={tab.secretPlaintext} onChange={(event) => onChange({ secretPlaintext: event.target.value, dirty: true })} size="sm" type="password" ariaLabel="API key value" />
              </div>
            </div>
          ) : null}
          {tab.authKind === "bearer" ? (
            <div className="max-w-md">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Token</span>
              <UiInput value={tab.secretPlaintext} onChange={(event) => onChange({ secretPlaintext: event.target.value, dirty: true })} size="sm" type="password" ariaLabel="Bearer token" />
            </div>
          ) : null}
          {tab.authKind === "basic" ? (
            <div className="grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Username</span>
                <UiInput value={tab.basicUsername} onChange={(event) => onChange({ basicUsername: event.target.value, dirty: true })} size="sm" ariaLabel="Basic auth username" />
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Password</span>
                <UiInput value={tab.secretPlaintext} onChange={(event) => onChange({ secretPlaintext: event.target.value, dirty: true })} size="sm" type="password" ariaLabel="Basic auth password" />
              </div>
            </div>
          ) : null}
          {tab.authKind === "customHeaders" ? (
            <InspectorKeyValueListField
              value={tab.customHeaders}
              onChange={(next) => onChange({ customHeaders: next, dirty: true })}
              keyPlaceholder="header name"
              valuePlaceholder="value"
              addLabel="Add header"
              fieldLabel="Auth header"
            />
          ) : null}
        </div>
      ),
    },
    {
      id: "request-tests",
      label: "Tests",
      badge: tab.assertions.length || undefined,
      content: (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-3">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Assertions</span>
              <AppButton type="button" intent="secondary" size="sm" onClick={addAssertion}>+ Add assertion</AppButton>
            </div>
            <div className="flex flex-col gap-2">
              {tab.assertions.map((assertion, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2">
                  <UiSelect
                    size="sm"
                    ariaLabel="Assertion kind"
                    value={assertion.kind}
                    onChange={(event) => {
                      const kind = event.target.value;
                      if (kind === "status") updateAssertion(index, { kind: "status", op: "equals", value: 200 });
                      else if (kind === "duration") updateAssertion(index, { kind: "duration", op: "lt", ms: 1000 });
                      else if (kind === "header") updateAssertion(index, { kind: "header", name: "", op: "exists" });
                      else updateAssertion(index, { kind: "jsonPath", path: "", op: "exists" });
                    }}
                    className="w-32"
                  >
                    <option value="status">Status</option>
                    <option value="duration">Duration</option>
                    <option value="header">Header</option>
                    <option value="jsonPath">JSON path</option>
                  </UiSelect>
                  {assertion.kind === "status" ? (
                    <>
                      <UiSelect size="sm" ariaLabel="Status op" value={assertion.op} onChange={(event) => updateAssertion(index, { ...assertion, op: event.target.value as "equals" | "in-range" })} className="w-28">
                        <option value="equals">equals</option>
                        <option value="in-range">in range</option>
                      </UiSelect>
                      <UiInput size="sm" ariaLabel="Status value" className="w-24 font-mono" value={String(assertion.value)} onChange={(event) => updateAssertion(index, { ...assertion, value: assertion.op === "equals" ? Number(event.target.value) : assertion.value })} />
                    </>
                  ) : null}
                  {assertion.kind === "duration" ? (
                    <>
                      <span className="text-[11px] text-slate-500">less than</span>
                      <UiInput size="sm" ariaLabel="Duration ms" className="w-24 font-mono" value={String(assertion.ms)} onChange={(event) => updateAssertion(index, { ...assertion, ms: Number(event.target.value) || 0 })} />
                      <span className="text-[11px] text-slate-500">ms</span>
                    </>
                  ) : null}
                  {assertion.kind === "header" ? (
                    <>
                      <UiInput size="sm" ariaLabel="Header name" className="w-32 font-mono" placeholder="header name" value={assertion.name} onChange={(event) => updateAssertion(index, { ...assertion, name: event.target.value })} />
                      <UiSelect size="sm" ariaLabel="Header op" value={assertion.op} onChange={(event) => updateAssertion(index, { ...assertion, op: event.target.value as "exists" | "equals" })} className="w-24">
                        <option value="exists">exists</option>
                        <option value="equals">equals</option>
                      </UiSelect>
                      {assertion.op === "equals" ? (
                        <UiInput size="sm" ariaLabel="Header expected value" className="w-32 font-mono" value={assertion.value ?? ""} onChange={(event) => updateAssertion(index, { ...assertion, value: event.target.value })} />
                      ) : null}
                    </>
                  ) : null}
                  {assertion.kind === "jsonPath" ? (
                    <>
                      <UiInput size="sm" ariaLabel="JSON path" className="w-32 font-mono" placeholder="data.id" value={assertion.path} onChange={(event) => updateAssertion(index, { ...assertion, path: event.target.value })} />
                      <UiSelect size="sm" ariaLabel="JSON path op" value={assertion.op} onChange={(event) => updateAssertion(index, { ...assertion, op: event.target.value as "exists" | "equals" | "contains" })} className="w-24">
                        <option value="exists">exists</option>
                        <option value="equals">equals</option>
                        <option value="contains">contains</option>
                      </UiSelect>
                      {assertion.op !== "exists" ? (
                        <UiInput size="sm" ariaLabel="Expected value" className="w-32 font-mono" value={String(assertion.value ?? "")} onChange={(event) => updateAssertion(index, { ...assertion, value: event.target.value })} />
                      ) : null}
                    </>
                  ) : null}
                  <AppButton type="button" size="icon-sm" intent="cancel" onClick={() => removeAssertion(index)}>×</AppButton>
                </div>
              ))}
              {tab.assertions.length === 0 ? <p className="text-[11px] text-slate-400">No assertions.</p> : null}
            </div>
          </div>
        </div>
      ),
    },

  ], [tab, canInheritAuth, onChange]);

  const result = tab.response;
  const responseTabs: UiTabItem[] = useMemo(() => [
    {
      id: "response-body",
      label: "Body",
      content: (
        <div className="h-full min-h-0 w-full overflow-hidden">
          <MonacoEditorPanel
            language="json"
            value={result ? formatHttpWorkshopResponseBody(result.body) : ""}
            onChange={() => {}}
            options={READONLY_JSON_EDITOR_OPTIONS}
          />
        </div>
      ),
    },
    {
      id: "response-headers",
      label: "Headers",
      badge: result ? Object.keys(result.headers).length : undefined,
      content: (
        <div className="flex h-full min-h-0 flex-col gap-1 overflow-auto p-3">
          {result && Object.keys(result.headers).length > 0 ? (
            Object.entries(result.headers).map(([key, value]) => (
              <div key={key} className="grid grid-cols-[minmax(0,160px)_1fr] gap-2 text-[11px]">
                <span className="truncate font-mono font-medium text-slate-500">{key}</span>
                <span className="truncate font-mono text-slate-700">{value}</span>
              </div>
            ))
          ) : (
            <p className="text-[11px] text-slate-400">No response headers.</p>
          )}
        </div>
      ),
    },
    {
      id: "response-tests",
      label: "Tests",
      badge: tab.assertionResults ? `${tab.assertionResults.filter((r) => r.passed).length}/${tab.assertionResults.length}` : undefined,
      status: tab.assertionResults ? (tab.assertionResults.every((r) => r.passed) ? "success" : "error") : "none",
      content: (
        <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-auto p-3">
          {!tab.assertionResults || tab.assertionResults.length === 0 ? (
            <p className="text-[11px] text-slate-400">No assertions were evaluated for this run.</p>
          ) : (
            tab.assertionResults.map((outcome, index) => (
              <div key={index} className={`rounded border px-2 py-1 text-[11px] ${outcome.passed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                {outcome.passed ? "✓" : "✗"} {outcome.message}
              </div>
            ))
          )}
        </div>
      ),
    },
  ], [result, tab.assertionResults]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className={cn(PAGE_TOOLBAR_SINGLE_ROW_CLASS, "relative z-20 min-w-0")}>
        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <div className="flex min-w-0 flex-1 items-stretch">
            <div className="w-[110px] shrink-0">
              <UiSelect
                value={tab.method}
                onChange={(event) => onChange({ method: event.target.value as HttpWorkshopMethod, dirty: true })}
                size="sm"
                ariaLabel="HTTP method"
                className={cn("!rounded-e-none font-mono font-bold", METHOD_COLOR_CLASS[tab.method])}
              >
                {METHODS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </UiSelect>
            </div>
            <div className="min-w-0 flex-1 -ms-px">
              <UiInput
                value={tab.url}
                onChange={(event) => onChange({ url: event.target.value, dirty: true })}
                size="sm"
                ariaLabel="Request URL"
                placeholder="https://api.example.com/users/{{id}}"
                autoDir={false}
                className="font-mono !rounded-s-none"
              />
            </div>
          </div>
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <AppButton
            type="button"
            intent="primary"
            size="sm"
            disabled={tab.isSending}
            onClick={onSend}
          >
            <Send className="h-3.5 w-3.5" />
            {tab.isSending ? "Sending…" : "Send"}
          </AppButton>
          <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
          <div ref={copyMenuRef} className="relative shrink-0">
            <AppButton
              type="button"
              aria-label="Copy as"
              aria-haspopup="menu"
              aria-expanded={copyMenuOpen}
              title="Copy as"
              className={cn(ICON_ACTION_BUTTON_MD_CLASS, ICON_ACTION_DUPLICATE_CLASS, "h-8 w-8 shrink-0")}
              onClick={() => setCopyMenuOpen((open) => !open)}
            >
              <Copy className="h-3.5 w-3.5" />
            </AppButton>
            {copyMenuOpen && typeof document !== "undefined"
              ? createPortal(
                <div
                  ref={copyMenuPanelRef}
                  className={cn(SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS, copyMenuMotion.className, "min-w-[11rem]")}
                  data-overlay-kind={copyMenuMotion["data-overlay-kind"]}
                  data-overlay-origin={copyMenuMotion["data-overlay-origin"]}
                  data-overlay-dir={copyMenuMotion["data-overlay-dir"]}
                  style={copyMenuStyle}
                  role="menu"
                  aria-label="Copy as"
                >
                  {(Object.keys(SNIPPET_FORMAT_LABELS) as SnippetFormat[]).map((format) => (
                    <SplitButtonMenuItem key={format} onClick={() => copyAs(format)}>
                      {SNIPPET_FORMAT_LABELS[format]}
                    </SplitButtonMenuItem>
                  ))}
                </div>,
                document.body,
              )
              : null}
          </div>
          <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
          <AppButton
            type="button"
            onClick={onSave}
            aria-label="Save"
            title="Save"
            className={cn(ICON_ACTION_BUTTON_MD_CLASS, ICON_ACTION_EDIT_CLASS, "h-8 w-8 shrink-0")}
          >
            <Save className="h-3.5 w-3.5" />
          </AppButton>
        </div>
      </div>
      {tab.sendError ? (
        <p className="shrink-0 border-b border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-600 sm:px-5">
          {tab.sendError}
        </p>
      ) : null}
      <div
        ref={splitContainerRef}
        className={cn("flex min-h-0 min-w-0 flex-1 flex-col", requestHeightSplit.isResizing && "select-none")}
      >
        <section
          className="flex min-h-0 shrink-0 flex-col overflow-hidden"
          style={{ height: `${requestHeightSplit.size}px` }}
        >
          <UiTabs items={requestTabs} ariaLabel="Request configuration" variant="line" panelLifecycle="lazy-keep" className="h-full min-h-0" />
        </section>

        <WorkspaceHorizontalSplitHandle
          {...requestHeightSplit.splitHandleProps}
          displayClassName="block"
          title="Drag to resize the request and response panes"
        />

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {tab.isSending || result ? (
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/60 px-3 py-2">
              {tab.isSending ? (
                <span className="text-[11px] text-slate-500">Sending request…</span>
              ) : result ? (
                <>
                  <span className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold ${statusToneClass(result.status)}`}>
                    {result.status}
                  </span>
                  <span className="text-[11px] text-slate-500">{result.durationMs} ms</span>
                  <span className="text-[11px] text-slate-500">{formatBytes(result.body)}</span>
                  {result.sentRequest ? (
                    <span className="text-[11px] text-slate-500" title={result.sentRequest.headerNames.join(", ") || "No request headers"}>
                      Sent {result.sentRequest.method} · {result.sentRequest.bodyByteLength} B body
                      {result.sentRequest.headerNames.length > 0 ? ` · ${result.sentRequest.headerNames.length} header(s)` : ""}
                    </span>
                  ) : null}
                  {result.truncated ? <span className="text-[11px] font-medium text-amber-600">Truncated</span> : null}
                </>
              ) : null}
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <UiTabs
              items={responseTabs}
              selectedKey={responseTab}
              onSelectionChange={setResponseTab}
              ariaLabel="Response"
              variant="line"
              panelLifecycle="lazy-keep"
              className="h-full min-h-0"
            />
          </div>
        </section>
      </div>
    </div>
  );
};
