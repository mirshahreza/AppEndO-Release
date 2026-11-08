import http from "node:http";
import https from "node:https";
import { createSsrfGuardedFetch, validateMcpRemoteUrl } from "../ai/mcp/mcpUrlGuard";
import type {
  HttpWorkshopAuthInput,
  HttpWorkshopKeyValue,
  HttpWorkshopMethod,
} from "./apiTalkTypes";
import { applyWorkshopAuthToHeaders } from "./httpWorkshopAuthHeaders";
const CALL_TIMEOUT_MS = 15000;
const MAX_RESPONSE_BYTES = 200_000;

const ssrfGuardedFetch = createSsrfGuardedFetch();

export type AdHocBodyMode = "none" | "json" | "raw";

export type AdHocHttpRequestInput = {
  method: HttpWorkshopMethod;
  url: string;
  queryParams?: HttpWorkshopKeyValue[];
  headers?: HttpWorkshopKeyValue[];
  bodyMode?: AdHocBodyMode;
  bodyRaw?: string;
  auth?: HttpWorkshopAuthInput;
  /** Required when auth.kind is inherit — resolves collection/folder/request auth server-side. */
  savedRequestId?: string;
};

export type AdHocHttpRequestResult = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
  truncated: boolean;
  /** What actually left the workshop executor (for diffing with Postman). */
  sentRequest?: {
    method: HttpWorkshopMethod;
    url: string;
    headerNames: string[];
    bodyByteLength: number;
  };
};

function buildAuthHeaders(auth: HttpWorkshopAuthInput | undefined): Record<string, string> {
  if (!auth || auth.kind === "none" || auth.kind === "inherit") {
    return {};
  }
  if (auth.kind === "apiKey" && auth.apiKeyHeaderName && auth.secretPlaintext !== undefined) {
    return { [auth.apiKeyHeaderName]: auth.secretPlaintext };
  }
  if (auth.kind === "bearer" && auth.secretPlaintext !== undefined) {
    return { Authorization: `Bearer ${auth.secretPlaintext}` };
  }
  if (auth.kind === "basic" && auth.basicUsername !== undefined && auth.secretPlaintext !== undefined) {
    return { Authorization: `Basic ${Buffer.from(`${auth.basicUsername}:${auth.secretPlaintext}`).toString("base64")}` };
  }
  if (auth.kind === "customHeaders" && auth.customHeaders) {
    const result: Record<string, string> = {};
    for (const header of auth.customHeaders) {
      result[header.name] = header.value;
    }
    return result;
  }
  return {};
}

export function resolveHttpWorkshopRequestBody(
  method: HttpWorkshopMethod,
  bodyMode: AdHocBodyMode,
  bodyRaw: string | undefined,
): string | undefined {
  if (bodyMode === "none" || bodyRaw === undefined || method === "HEAD") {
    return undefined;
  }
  if (!bodyRaw.trim()) {
    return undefined;
  }
  return bodyRaw;
}

const APPENDO_TALK_TO_ME_PATH = /\/talk-to-me\/?$/i;

/** AppEnd /talk-to-me gateways read the RPC payload only on POST (GET returns an empty JSON string). */
export function resolveHttpWorkshopMethod(
  method: HttpWorkshopMethod,
  url: URL,
  body: string | undefined,
): HttpWorkshopMethod {
  if (method === "GET" && body !== undefined && APPENDO_TALK_TO_ME_PATH.test(url.pathname)) {
    return "POST";
  }
  return method;
}

function parseHttpResponseText(rawText: string): { body: unknown; truncated: boolean } {
  const truncated = rawText.length > MAX_RESPONSE_BYTES;
  const text = truncated ? rawText.slice(0, MAX_RESPONSE_BYTES) : rawText;
  let parsedBody: unknown = text;
  try {
    parsedBody = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON response - return as plain text.
  }
  return { body: parsedBody, truncated };
}

/**
 * Node fetch rejects GET/HEAD with a body; legacy APIs (and Postman) still send GET + JSON body.
 */
function executeNodeHttpCall(
  method: HttpWorkshopMethod,
  url: URL,
  headers: Record<string, string>,
  body: string,
  signal: AbortSignal,
): Promise<{ status: number; headers: Record<string, string>; rawText: string }> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;
    const requestHeaders = { ...headers };
    if (!Object.keys(requestHeaders).some((key) => key.toLowerCase() === "content-length")) {
      requestHeaders["Content-Length"] = String(Buffer.byteLength(body));
    }

    const port = url.port ? Number(url.port) : isHttps ? 443 : 80;
    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port,
        path: `${url.pathname}${url.search}`,
        method,
        headers: requestHeaders,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          reject(new Error("MCP HTTP redirect is not allowed."));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const responseHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (value === undefined) {
              continue;
            }
            responseHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
          }
          resolve({
            status,
            headers: responseHeaders,
            rawText: Buffer.concat(chunks).toString("utf8"),
          });
        });
        res.on("error", reject);
      },
    );

    const onAbort = () => {
      req.destroy(new DOMException("The operation was aborted.", "AbortError"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    req.on("error", (err) => {
      signal.removeEventListener("abort", onAbort);
      reject(err);
    });
    req.on("close", () => signal.removeEventListener("abort", onAbort));

    req.write(body);
    req.end();
  });
}

/**
 * Low-level network call shared by the ad-hoc executor (plaintext auth from the request body) and
 * the saved-request executor (auth decrypted server-side from stored records) - the only
 * difference between the two callers is how headers/body get built before reaching here.
 */
export async function executeHttpCall(
  method: HttpWorkshopMethod,
  url: URL,
  headers: Record<string, string>,
  body: string | undefined,
): Promise<AdHocHttpRequestResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    if (method === "GET" && body !== undefined) {
      const nodeResult = await executeNodeHttpCall(method, url, headers, body, controller.signal);
      const durationMs = Date.now() - startedAt;
      const { body: parsedBody, truncated } = parseHttpResponseText(nodeResult.rawText);
      return {
        status: nodeResult.status,
        headers: nodeResult.headers,
        body: parsedBody,
        durationMs,
        truncated,
      };
    }

    const response = await ssrfGuardedFetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;

    const rawText = await response.text();
    const { body: parsedBody, truncated } = parseHttpResponseText(rawText);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return { status: response.status, headers: responseHeaders, body: parsedBody, durationMs, truncated };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runAdHocHttpRequest(input: AdHocHttpRequestInput): Promise<AdHocHttpRequestResult> {
  const url = await validateMcpRemoteUrl(input.url);

  for (const param of input.queryParams ?? []) {
    if (!param.enabled || !param.key) {
      continue;
    }
    url.searchParams.set(param.key, param.value);
  }

  const headers: Record<string, string> = {};
  for (const header of input.headers ?? []) {
    if (!header.enabled || !header.key) {
      continue;
    }
    headers[header.key] = header.value;
  }
  Object.assign(headers, buildAuthHeaders(input.auth));
  await applyWorkshopAuthToHeaders(headers, input.auth, input.savedRequestId);

  const bodyMode = input.bodyMode ?? "none";
  const resolvedBody = resolveHttpWorkshopRequestBody(input.method, bodyMode, input.bodyRaw);
  if (resolvedBody !== undefined && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
    headers["Content-Type"] = bodyMode === "json" ? "application/json" : "text/plain";
  }

  if (bodyMode === "json" && resolvedBody !== undefined && resolvedBody.trim()) {
    try {
      JSON.parse(resolvedBody);
    } catch {
      throw new Error("Request body is not valid JSON.");
    }
  }

  const effectiveMethod = resolveHttpWorkshopMethod(input.method, url, resolvedBody);
  const result = await executeHttpCall(effectiveMethod, url, headers, resolvedBody);
  return {
    ...result,
    sentRequest: {
      method: effectiveMethod,
      url: url.toString(),
      headerNames: Object.keys(headers).sort(),
      bodyByteLength: resolvedBody ? Buffer.byteLength(resolvedBody, "utf8") : 0,
    },
  };
}
