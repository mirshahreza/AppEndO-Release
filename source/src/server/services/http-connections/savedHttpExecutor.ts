import { validateMcpRemoteUrl } from "../ai/mcp/mcpUrlGuard";
import {
  executeHttpCall,
  resolveHttpWorkshopMethod,
  resolveHttpWorkshopRequestBody,
  type AdHocHttpRequestResult,
} from "./adHocHttpExecutor";
import { buildStoredAuthHeadersForRequest } from "./httpWorkshopAuthHeaders";
import { getRequestRecord } from "./collectionsStore";

export type RunSavedRequestInput = { requestId: string };

export async function runSavedHttpRequest(input: RunSavedRequestInput): Promise<AdHocHttpRequestResult> {
  const request = getRequestRecord(input.requestId);
  if (!request) {
    throw new Error(`Request "${input.requestId}" not found.`);
  }
  const url = await validateMcpRemoteUrl(request.url);
  for (const param of request.queryParams) {
    if (!param.enabled || !param.key) {
      continue;
    }
    url.searchParams.set(param.key, param.value);
  }

  const headers: Record<string, string> = {};
  for (const header of request.headers) {
    if (!header.enabled || !header.key) {
      continue;
    }
    headers[header.key] = header.value;
  }
  Object.assign(headers, await buildStoredAuthHeadersForRequest(input.requestId));

  const bodyMode = request.bodyMode === "none" ? "none" : request.bodyMode;
  const resolvedBody = resolveHttpWorkshopRequestBody(request.method, bodyMode, request.bodyRaw);
  if (bodyMode === "json" && resolvedBody !== undefined && resolvedBody.trim()) {
    try {
      JSON.parse(resolvedBody);
    } catch {
      throw new Error("Request body is not valid JSON.");
    }
  }
  if (resolvedBody !== undefined && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
    headers["Content-Type"] = request.bodyMode === "json" ? "application/json" : "text/plain";
  }

  const effectiveMethod = resolveHttpWorkshopMethod(request.method, url, resolvedBody);
  return executeHttpCall(effectiveMethod, url, headers, resolvedBody);
}
