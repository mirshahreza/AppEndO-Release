import {
  listHttpConnectionRecordsInternal,
  type HttpConnectionAuthKind,
} from "../src/server/services/http-connections/httpConnectionStore";
import {
  createCollection,
  createRequest,
  findCollectionByMigratedLegacyId,
} from "../src/server/services/http-connections/collectionsStore";
import {
  HTTP_CONNECTION_VAULT_OWNER_TYPE,
  getHttpVaultSecret,
} from "../src/server/services/http-connections/httpConnectionVault";
import type { HttpWorkshopAuthKind } from "../src/server/services/http-connections/apiTalkTypes";
import { ensureCredentialVaultTable } from "../src/server/domain/security/credentialVault/credentialVaultSequelizeModel";
import { closeControlPlaneSequelize } from "../src/server/db/controlPlaneSequelize";

const AUTH_KIND_MAP: Record<HttpConnectionAuthKind, HttpWorkshopAuthKind> = {
  none: "none",
  apiKey: "apiKey",
  bearer: "bearer",
  basic: "basic",
};

/** OpenAPI-style single-brace path params ("/users/{id}") become {{id}} so the new
 * double-brace variable substitution (shared with the Workflow engine) resolves them. */
function convertPathParamBraces(url: string): string {
  return url.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => `{{${key}}}`);
}

function joinBaseUrlAndPath(baseUrl: string, requestPath: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const trimmedPath = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;
  return `${trimmedBase}${trimmedPath}`;
}

async function main(): Promise<void> {
  const legacyRecords = listHttpConnectionRecordsInternal();
  if (legacyRecords.length === 0) {
    console.log("[http-workshop:migrate] No legacy HTTP Connections found - nothing to migrate.");
    return;
  }

  let migratedCollections = 0;
  let skippedCollections = 0;
  let migratedRequests = 0;

  try {
    await ensureCredentialVaultTable();

    for (const legacy of legacyRecords) {
      const alreadyMigrated = findCollectionByMigratedLegacyId(legacy.id);
      if (alreadyMigrated) {
        skippedCollections += 1;
        console.log(`[http-workshop:migrate] Skipping "${legacy.name}" - already migrated (collection ${alreadyMigrated.id}).`);
        continue;
      }

      const secretPlaintext = legacy.hasSecret
        ? await getHttpVaultSecret(HTTP_CONNECTION_VAULT_OWNER_TYPE, legacy.id) ?? undefined
        : undefined;
      const collection = await createCollection({
        name: legacy.name,
        description: `Migrated from legacy HTTP Connection (baseUrl: ${legacy.baseUrl}).`,
        migratedFromLegacyId: legacy.id,
        createdByUserId: legacy.createdByUserId,
        auth: {
          kind: AUTH_KIND_MAP[legacy.authKind],
          apiKeyHeaderName: legacy.apiKeyHeaderName,
          basicUsername: legacy.basicUsername,
          secretPlaintext,
        },
      });
      migratedCollections += 1;

      const operations = legacy.openApiSpec?.operations ?? [];
      for (const [index, operation] of operations.entries()) {
        const url = convertPathParamBraces(joinBaseUrlAndPath(legacy.baseUrl, operation.path));
        await createRequest({
          collectionId: collection.id,
          name: operation.summary || operation.operationId,
          method: operation.method,
          url,
          auth: { kind: "inherit" },
          sortOrder: index,
        });
        migratedRequests += 1;
      }

      console.log(`[http-workshop:migrate] Migrated "${legacy.name}" -> collection ${collection.id} (${operations.length} request(s)).`);
    }

    console.log("[http-workshop:migrate] Done.", { migratedCollections, skippedCollections, migratedRequests });
  } finally {
    await closeControlPlaneSequelize();
  }
}

void main();
