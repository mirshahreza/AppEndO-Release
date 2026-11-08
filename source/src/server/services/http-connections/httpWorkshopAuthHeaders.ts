import { HTTP_WORKSHOP_VAULT_OWNER_TYPE, getHttpVaultSecret } from "./httpConnectionVault";
import type { HttpWorkshopAuthInput } from "./apiTalkTypes";
import { resolveEffectiveAuth, type ResolvedHttpWorkshopAuth } from "./collectionsStore";

async function buildStoredAuthHeaders(auth: ResolvedHttpWorkshopAuth): Promise<Record<string, string>> {
  const secret = auth.hasSecret && auth.vaultOwnerId
    ? await getHttpVaultSecret(HTTP_WORKSHOP_VAULT_OWNER_TYPE, auth.vaultOwnerId)
    : null;
  if (auth.kind === "apiKey" && auth.apiKeyHeaderName && secret) {
    return { [auth.apiKeyHeaderName]: secret };
  }
  if (auth.kind === "bearer" && secret) {
    return { Authorization: `Bearer ${secret}` };
  }
  if (auth.kind === "basic" && auth.basicUsername && secret) {
    return { Authorization: `Basic ${Buffer.from(`${auth.basicUsername}:${secret}`).toString("base64")}` };
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

export async function applyWorkshopAuthToHeaders(
  headers: Record<string, string>,
  auth: HttpWorkshopAuthInput | undefined,
  savedRequestId: string | undefined,
): Promise<void> {
  if (!auth || auth.kind !== "inherit") {
    return;
  }
  if (!savedRequestId) {
    return;
  }
  Object.assign(headers, await buildStoredAuthHeaders(resolveEffectiveAuth(savedRequestId)));
}

export async function buildStoredAuthHeadersForRequest(requestId: string): Promise<Record<string, string>> {
  return buildStoredAuthHeaders(resolveEffectiveAuth(requestId));
}
