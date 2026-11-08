import type {
  HttpWorkshopAssertion,
  HttpWorkshopAuthKind,
  HttpWorkshopBodyMode,
  HttpWorkshopKeyValue,
  HttpWorkshopMethod,
  HttpWorkshopRequestSummary,
  RunAdHocRequestResult,
} from "../../shared/api/queries/api-talk";

export type WorkshopTab = {
  id: string;
  savedRequestId?: string;
  collectionId?: string;
  folderId?: string | null;
  name: string;
  dirty: boolean;
  method: HttpWorkshopMethod;
  url: string;
  queryParams: HttpWorkshopKeyValue[] | undefined;
  headers: HttpWorkshopKeyValue[] | undefined;
  bodyMode: HttpWorkshopBodyMode;
  bodyRaw: string;
  authKind: HttpWorkshopAuthKind;
  apiKeyHeaderName: string;
  basicUsername: string;
  secretPlaintext: string;
  customHeaders: Record<string, string> | undefined;
  assertions: HttpWorkshopAssertion[];
  response?: RunAdHocRequestResult;
  assertionResults?: Array<{ assertion: HttpWorkshopAssertion; passed: boolean; message: string }>;
  sendError: string | null;
  isSending: boolean;
};

let tabIdCounter = 0;
const nextTabId = (): string => {
  tabIdCounter += 1;
  return `tab-${tabIdCounter}-${Math.random().toString(36).slice(2, 7)}`;
};

export function createBlankTab(name = "Untitled request"): WorkshopTab {
  return {
    id: nextTabId(),
    name,
    dirty: false,
    method: "GET",
    url: "",
    queryParams: undefined,
    headers: undefined,
    bodyMode: "none",
    bodyRaw: "",
    authKind: "none",
    apiKeyHeaderName: "",
    basicUsername: "",
    secretPlaintext: "",
    customHeaders: undefined,
    assertions: [],
    sendError: null,
    isSending: false,
  };
}

export function enabledWorkshopKeyValues(items: HttpWorkshopKeyValue[] | undefined): HttpWorkshopKeyValue[] {
  return (items ?? []).filter((item) => item.enabled && item.key.trim().length > 0);
}

export function tabFromSavedRequest(request: HttpWorkshopRequestSummary): WorkshopTab {
  const auth = request.auth;
  return {
    id: nextTabId(),
    savedRequestId: request.id,
    collectionId: request.collectionId,
    folderId: request.folderId,
    name: request.name,
    dirty: false,
    method: request.method,
    url: request.url,
    queryParams: request.queryParams.length > 0 ? request.queryParams.map((item) => ({ ...item })) : undefined,
    headers: request.headers.length > 0 ? request.headers.map((item) => ({ ...item })) : undefined,
    bodyMode: request.bodyMode === "json" || request.bodyMode === "raw" ? request.bodyMode : "none",
    bodyRaw: request.bodyRaw ?? "",
    authKind: auth.kind,
    apiKeyHeaderName: auth.apiKeyHeaderName ?? "",
    basicUsername: auth.basicUsername ?? "",
    secretPlaintext: "",
    customHeaders: auth.customHeaders ? Object.fromEntries(auth.customHeaders.map((h) => [h.name, h.value])) : undefined,
    assertions: request.assertions,
    sendError: null,
    isSending: false,
  };
}

export function authInputFromTab(tab: WorkshopTab): { kind: WorkshopTab["authKind"]; apiKeyHeaderName?: string; basicUsername?: string; secretPlaintext?: string; customHeaders?: Array<{ name: string; value: string }> } {
  if (tab.authKind === "inherit") return { kind: "inherit" };
  if (tab.authKind === "none") return { kind: "none" };
  if (tab.authKind === "apiKey") return { kind: "apiKey", apiKeyHeaderName: tab.apiKeyHeaderName, secretPlaintext: tab.secretPlaintext };
  if (tab.authKind === "bearer") return { kind: "bearer", secretPlaintext: tab.secretPlaintext };
  if (tab.authKind === "basic") return { kind: "basic", basicUsername: tab.basicUsername, secretPlaintext: tab.secretPlaintext };
  return {
    kind: "customHeaders",
    customHeaders: Object.entries(tab.customHeaders ?? {}).map(([name, value]) => ({ name, value })),
  };
}
