/**
 * Parses a Postman Collection v2.1 export into a plain tree the HTTP Workshop import flow can
 * feed straight into collectionsStore.createCollection/createFolder/createRequest. Deliberately
 * shallow like openApiConnectorSpec.ts: no variable/environment import, no pre-request/test
 * scripts (those require arbitrary JS execution, out of scope per p-97 decision 2), no formdata
 * file fields.
 */

export type PostmanImportMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type PostmanImportAuth =
  | { kind: "none" }
  | { kind: "apiKey"; apiKeyHeaderName: string; secretPlaintext: string }
  | { kind: "bearer"; secretPlaintext: string }
  | { kind: "basic"; basicUsername: string; secretPlaintext: string };

export type PostmanImportKeyValue = { key: string; value: string; enabled: boolean };

export type PostmanImportRequest = {
  name: string;
  method: PostmanImportMethod;
  url: string;
  headers: PostmanImportKeyValue[];
  queryParams: PostmanImportKeyValue[];
  bodyMode: "none" | "json" | "raw";
  bodyRaw?: string;
  auth?: PostmanImportAuth;
};

export type PostmanImportFolder = {
  name: string;
  requests: PostmanImportRequest[];
  folders: PostmanImportFolder[];
};

export type PostmanImportResult = {
  collectionName: string;
  auth?: PostmanImportAuth;
  rootRequests: PostmanImportRequest[];
  folders: PostmanImportFolder[];
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
);

const VALID_METHODS: PostmanImportMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function readAuth(authRaw: unknown): PostmanImportAuth | undefined {
  if (!isPlainObject(authRaw) || typeof authRaw.type !== "string") {
    return undefined;
  }
  const readField = (arr: unknown, key: string): string => {
    if (!Array.isArray(arr)) return "";
    const entry = arr.find((item) => isPlainObject(item) && item.key === key);
    return isPlainObject(entry) && typeof entry.value === "string" ? entry.value : "";
  };
  if (authRaw.type === "apikey") {
    const apikey = authRaw.apikey;
    return { kind: "apiKey", apiKeyHeaderName: readField(apikey, "key") || "X-Api-Key", secretPlaintext: readField(apikey, "value") };
  }
  if (authRaw.type === "bearer") {
    return { kind: "bearer", secretPlaintext: readField(authRaw.bearer, "token") };
  }
  if (authRaw.type === "basic") {
    return { kind: "basic", basicUsername: readField(authRaw.basic, "username"), secretPlaintext: readField(authRaw.basic, "password") };
  }
  return { kind: "none" };
}

function readUrl(urlRaw: unknown): { url: string; queryParams: PostmanImportKeyValue[] } {
  if (typeof urlRaw === "string") {
    return { url: urlRaw, queryParams: [] };
  }
  if (!isPlainObject(urlRaw)) {
    return { url: "", queryParams: [] };
  }
  const raw = typeof urlRaw.raw === "string" ? urlRaw.raw : "";
  const query = Array.isArray(urlRaw.query) ? urlRaw.query : [];
  const queryParams: PostmanImportKeyValue[] = query
    .filter((item): item is Record<string, unknown> => isPlainObject(item) && typeof item.key === "string")
    .map((item) => ({ key: String(item.key), value: typeof item.value === "string" ? item.value : "", enabled: item.disabled !== true }));
  const url = raw.split("?")[0] || raw;
  return { url, queryParams };
}

function readHeaders(headerRaw: unknown): PostmanImportKeyValue[] {
  if (!Array.isArray(headerRaw)) return [];
  return headerRaw
    .filter((item): item is Record<string, unknown> => isPlainObject(item) && typeof item.key === "string")
    .map((item) => ({ key: String(item.key), value: typeof item.value === "string" ? item.value : "", enabled: item.disabled !== true }));
}

function readBody(bodyRaw: unknown): { bodyMode: "none" | "json" | "raw"; bodyRaw?: string } {
  if (!isPlainObject(bodyRaw) || bodyRaw.mode !== "raw" || typeof bodyRaw.raw !== "string" || !bodyRaw.raw.trim()) {
    return { bodyMode: "none" };
  }
  const language = isPlainObject(bodyRaw.options) && isPlainObject(bodyRaw.options.raw) ? bodyRaw.options.raw.language : undefined;
  return { bodyMode: language === "json" || language === undefined ? "json" : "raw", bodyRaw: bodyRaw.raw };
}

function readRequest(name: string, requestRaw: unknown): PostmanImportRequest | null {
  if (!isPlainObject(requestRaw)) return null;
  const methodRaw = typeof requestRaw.method === "string" ? requestRaw.method.toUpperCase() : "GET";
  const method = (VALID_METHODS as string[]).includes(methodRaw) ? (methodRaw as PostmanImportMethod) : "GET";
  const { url, queryParams } = readUrl(requestRaw.url);
  const { bodyMode, bodyRaw } = readBody(requestRaw.body);
  return {
    name,
    method,
    url,
    headers: readHeaders(requestRaw.header),
    queryParams,
    bodyMode,
    bodyRaw,
    auth: readAuth(requestRaw.auth),
  };
}

function readItems(items: unknown[]): { requests: PostmanImportRequest[]; folders: PostmanImportFolder[] } {
  const requests: PostmanImportRequest[] = [];
  const folders: PostmanImportFolder[] = [];
  for (const itemRaw of items) {
    if (!isPlainObject(itemRaw) || typeof itemRaw.name !== "string") continue;
    if (Array.isArray(itemRaw.item)) {
      const nested = readItems(itemRaw.item);
      folders.push({ name: itemRaw.name, requests: nested.requests, folders: nested.folders });
      continue;
    }
    const request = readRequest(itemRaw.name, itemRaw.request);
    if (request) requests.push(request);
  }
  return { requests, folders };
}

export function parsePostmanCollection(raw: string): PostmanImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Postman collection must be valid JSON.");
  }
  if (!isPlainObject(parsed)) {
    throw new Error("Postman collection must be a JSON object.");
  }
  const info = isPlainObject(parsed.info) ? parsed.info : {};
  const collectionName = typeof info.name === "string" ? info.name : "Imported collection";
  if (!Array.isArray(parsed.item)) {
    throw new Error('Postman collection is missing its top-level "item" array.');
  }
  const { requests, folders } = readItems(parsed.item);
  return { collectionName, auth: readAuth(parsed.auth), rootRequests: requests, folders };
}
