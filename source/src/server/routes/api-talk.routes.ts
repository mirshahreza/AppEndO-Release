import { Router, type Express } from "express";
import { createBuiltInRouteGuard } from "../middleware/builtInFunctionAccess.middleware";
import {
  createCollection,
  createFolder,
  createRequest,
  deleteCollection,
  deleteFolder,
  deleteRequest,
  duplicateCollection,
  duplicateFolder,
  duplicateRequest,
  getCollectionSummary,
  getFolderRecord,
  getRequestSummary,
  listCollections,
  listFolders,
  listRequests,
  updateCollection,
  updateFolder,
  updateRequest,
} from "../services/http-connections/collectionsStore";
import { evaluateAssertions } from "../services/http-connections/assertionEvaluator";
import { runAdHocHttpRequest, type AdHocBodyMode } from "../services/http-connections/adHocHttpExecutor";
import { runSavedHttpRequest } from "../services/http-connections/savedHttpExecutor";
import type { HttpWorkshopAuthKind, HttpWorkshopAuthInput, HttpWorkshopMethod } from "../services/http-connections/apiTalkTypes";
import { validateMcpRemoteUrl, createSsrfGuardedFetch } from "../services/ai/mcp/mcpUrlGuard";
import { parseOpenApiConnectorSpecRich } from "../../shared/lib/openApiConnectorSpec";
import { parsePostmanCollection, type PostmanImportFolder, type PostmanImportRequest } from "../../shared/lib/postmanCollectionImporter";
import { parseCurlCommand } from "../../shared/lib/curlCommandImporter";

const importSsrfGuardedFetch = createSsrfGuardedFetch();

const VALID_AUTH_KINDS: HttpWorkshopAuthKind[] = ["inherit", "none", "apiKey", "bearer", "basic", "customHeaders"];
const isValidAuthKind = (value: unknown): value is HttpWorkshopAuthKind => (
  typeof value === "string" && (VALID_AUTH_KINDS as string[]).includes(value)
);

const VALID_METHODS: HttpWorkshopMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const isValidMethod = (value: unknown): value is HttpWorkshopMethod => (
  typeof value === "string" && (VALID_METHODS as string[]).includes(value)
);

function readAuthInput(body: Record<string, unknown> | undefined) {
  const auth = body?.auth as Record<string, unknown> | undefined;
  if (!auth || !isValidAuthKind(auth.kind)) {
    return undefined;
  }
  return {
    kind: auth.kind,
    apiKeyHeaderName: typeof auth.apiKeyHeaderName === "string" ? auth.apiKeyHeaderName : undefined,
    basicUsername: typeof auth.basicUsername === "string" ? auth.basicUsername : undefined,
    secretPlaintext: typeof auth.secretPlaintext === "string" ? auth.secretPlaintext : undefined,
    customHeaders: Array.isArray(auth.customHeaders) ? auth.customHeaders : undefined,
  };
}

export const mountApiTalkRoutes = (app: Express): void => {
  const routeGuard = createBuiltInRouteGuard("ADMIN");
  const router = Router();

  // ---- Collections ----

  router.get("/collections", (_req, res) => {
    res.json({ success: true, items: listCollections() });
  });

  router.post("/collections", async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized." });
      return;
    }
    const name = String(req.body?.name || "").trim();
    if (!name) {
      res.status(400).json({ success: false, error: "name is required." });
      return;
    }
    const item = await createCollection({
      name,
      description: typeof req.body?.description === "string" ? req.body.description : undefined,
      auth: readAuthInput(req.body),
      createdByUserId: userId,
    });
    res.json({ success: true, item });
  });

  router.get("/collections/:id", (req, res) => {
    const item = getCollectionSummary(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: "Collection not found." });
      return;
    }
    res.json({ success: true, item });
  });

  router.patch("/collections/:id", async (req, res) => {
    const patch = req.body || {};
    const item = await updateCollection(req.params.id, {
      ...(patch.name !== undefined ? { name: String(patch.name).trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(readAuthInput(patch) !== undefined ? { auth: readAuthInput(patch) } : {}),
    });
    if (!item) {
      res.status(404).json({ success: false, error: "Collection not found." });
      return;
    }
    res.json({ success: true, item });
  });

  router.delete("/collections/:id", async (req, res) => {
    const deleted = await deleteCollection(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Collection not found." });
      return;
    }
    res.json({ success: true });
  });

  router.post("/collections/:id/duplicate", async (req, res) => {
    const item = await duplicateCollection(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: "Collection not found." });
      return;
    }
    res.json({ success: true, item });
  });

  // ---- Folders ----

  router.get("/collections/:collectionId/folders", (req, res) => {
    res.json({ success: true, items: listFolders(req.params.collectionId) });
  });

  router.post("/collections/:collectionId/folders", async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      res.status(400).json({ success: false, error: "name is required." });
      return;
    }
    const item = await createFolder({
      collectionId: req.params.collectionId,
      parentFolderId: typeof req.body?.parentFolderId === "string" ? req.body.parentFolderId : null,
      name,
      auth: readAuthInput(req.body),
      sortOrder: typeof req.body?.sortOrder === "number" ? req.body.sortOrder : undefined,
    });
    res.json({ success: true, item });
  });

  router.patch("/folders/:id", async (req, res) => {
    const patch = req.body || {};
    const item = await updateFolder(req.params.id, {
      ...(patch.name !== undefined ? { name: String(patch.name).trim() } : {}),
      ...(patch.parentFolderId !== undefined ? { parentFolderId: patch.parentFolderId } : {}),
      ...(readAuthInput(patch) !== undefined ? { auth: readAuthInput(patch) } : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: Number(patch.sortOrder) } : {}),
    });
    if (!item) {
      res.status(404).json({ success: false, error: "Folder not found." });
      return;
    }
    res.json({ success: true, item });
  });

  router.delete("/folders/:id", async (req, res) => {
    const existing = getFolderRecord(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, error: "Folder not found." });
      return;
    }
    await deleteFolder(req.params.id);
    res.json({ success: true });
  });

  router.post("/folders/:id/duplicate", async (req, res) => {
    const item = await duplicateFolder(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: "Folder not found." });
      return;
    }
    res.json({ success: true, item });
  });

  // ---- Requests ----

  router.get("/collections/:collectionId/requests", (req, res) => {
    const folderIdRaw = req.query.folderId;
    let folderId: string | null | undefined;
    if (folderIdRaw === undefined) {
      folderId = undefined;
    } else if (folderIdRaw === "" || folderIdRaw === "null") {
      folderId = null;
    } else {
      folderId = String(folderIdRaw);
    }
    res.json({ success: true, items: listRequests(req.params.collectionId, folderId) });
  });

  router.post("/collections/:collectionId/requests", async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const url = String(req.body?.url || "").trim();
    const method = req.body?.method;
    if (!name || !url || !isValidMethod(method)) {
      res.status(400).json({ success: false, error: "name, url and a valid method are required." });
      return;
    }
    const item = await createRequest({
      collectionId: req.params.collectionId,
      folderId: typeof req.body?.folderId === "string" ? req.body.folderId : null,
      name,
      method,
      url,
      queryParams: Array.isArray(req.body?.queryParams) ? req.body.queryParams : undefined,
      headers: Array.isArray(req.body?.headers) ? req.body.headers : undefined,
      bodyMode: typeof req.body?.bodyMode === "string" ? req.body.bodyMode : undefined,
      bodyRaw: typeof req.body?.bodyRaw === "string" ? req.body.bodyRaw : undefined,
      bodyForm: Array.isArray(req.body?.bodyForm) ? req.body.bodyForm : undefined,
      auth: readAuthInput(req.body),
      assertions: Array.isArray(req.body?.assertions) ? req.body.assertions : undefined,
      sortOrder: typeof req.body?.sortOrder === "number" ? req.body.sortOrder : undefined,
    });
    res.json({ success: true, item });
  });

  router.get("/requests/:id", (req, res) => {
    const item = getRequestSummary(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: "Request not found." });
      return;
    }
    res.json({ success: true, item });
  });

  router.patch("/requests/:id", async (req, res) => {
    const patch = req.body || {};
    const item = await updateRequest(req.params.id, {
      ...(patch.name !== undefined ? { name: String(patch.name).trim() } : {}),
      ...(patch.folderId !== undefined ? { folderId: patch.folderId } : {}),
      ...(patch.method !== undefined && isValidMethod(patch.method) ? { method: patch.method } : {}),
      ...(patch.url !== undefined ? { url: String(patch.url).trim() } : {}),
      ...(patch.queryParams !== undefined ? { queryParams: patch.queryParams } : {}),
      ...(patch.headers !== undefined ? { headers: patch.headers } : {}),
      ...(patch.bodyMode !== undefined ? { bodyMode: patch.bodyMode } : {}),
      ...(patch.bodyRaw !== undefined ? { bodyRaw: patch.bodyRaw } : {}),
      ...(patch.bodyForm !== undefined ? { bodyForm: patch.bodyForm } : {}),
      ...(readAuthInput(patch) !== undefined ? { auth: readAuthInput(patch) } : {}),
      ...(patch.assertions !== undefined ? { assertions: patch.assertions } : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: Number(patch.sortOrder) } : {}),
    });
    if (!item) {
      res.status(404).json({ success: false, error: "Request not found." });
      return;
    }
    res.json({ success: true, item });
  });

  router.delete("/requests/:id", async (req, res) => {
    const deleted = await deleteRequest(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Request not found." });
      return;
    }
    res.json({ success: true });
  });

  router.post("/requests/:id/duplicate", async (req, res) => {
    const item = await duplicateRequest(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: "Request not found." });
      return;
    }
    res.json({ success: true, item });
  });

  // ---- Run a saved request (resolves inherited auth + decrypts stored secrets server-side) ----

  router.post("/requests/:id/run", async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized." });
      return;
    }
    const requestSummary = getRequestSummary(req.params.id);
    if (!requestSummary) {
      res.status(404).json({ success: false, error: "Request not found." });
      return;
    }
    try {
      const result = await runSavedHttpRequest({ requestId: req.params.id });
      const assertionResults = requestSummary.assertions.length > 0
        ? evaluateAssertions(requestSummary.assertions, result)
        : undefined;
      res.json({ success: true, ...result, assertionResults });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Request failed.";
      res.status(502).json({ success: false, error: message });
    }
  });


  // ---- Import (OpenAPI enriched + Postman Collection v2.1 + cURL) ----

  router.post("/import/openapi", async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized." });
      return;
    }
    const specUrl = typeof req.body?.specUrl === "string" ? req.body.specUrl.trim() : "";
    const specText = typeof req.body?.specText === "string" ? req.body.specText : "";
    const targetCollectionId = typeof req.body?.targetCollectionId === "string" ? req.body.targetCollectionId : undefined;

    try {
      let raw = specText;
      if (!raw && specUrl) {
        const url = await validateMcpRemoteUrl(specUrl);
        const response = await importSsrfGuardedFetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) {
          res.status(400).json({ success: false, error: `Failed to fetch spec: HTTP ${response.status}` });
          return;
        }
        raw = await response.text();
      }
      if (!raw.trim()) {
        res.status(400).json({ success: false, error: "Provide either specText or specUrl." });
        return;
      }
      const spec = parseOpenApiConnectorSpecRich(raw);
      const createdCollection = targetCollectionId
        ? { id: targetCollectionId }
        : await createCollection({
          name: spec.title || "Imported API",
          description: spec.baseUrl ? `Imported from OpenAPI spec (baseUrl: ${spec.baseUrl}).` : "Imported from OpenAPI spec.",
          auth: spec.suggestedAuthKind
            ? { kind: spec.suggestedAuthKind, apiKeyHeaderName: spec.suggestedApiKeyHeaderName }
            : { kind: "none" },
          createdByUserId: userId,
        });
      const collectionId = createdCollection.id;

      let created = 0;
      for (const operation of spec.operations) {
        const path = operation.path.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => `{{${key}}}`);
        const base = (spec.baseUrl ?? "").replace(/\/+$/, "");
        const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
        await createRequest({
          collectionId,
          name: operation.summary || operation.operationId,
          method: operation.method,
          url,
          queryParams: operation.parameters.filter((p) => p.location === "query").map((p) => ({ key: p.name, value: "", enabled: true })),
          headers: operation.parameters.filter((p) => p.location === "header").map((p) => ({ key: p.name, value: "", enabled: true })),
          bodyMode: operation.requestBodyExample ? "json" : "none",
          bodyRaw: operation.requestBodyExample,
          auth: { kind: "inherit" },
        });
        created += 1;
      }
      res.json({ success: true, collectionId, requestCount: created });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to import OpenAPI spec.";
      res.status(400).json({ success: false, error: message });
    }
  });

  router.post("/import/postman", async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized." });
      return;
    }
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    const targetCollectionId = typeof req.body?.targetCollectionId === "string" ? req.body.targetCollectionId : undefined;
    if (!text.trim()) {
      res.status(400).json({ success: false, error: "Paste a Postman Collection v2.1 JSON export." });
      return;
    }

    try {
      const parsed = parsePostmanCollection(text);
      const createdCollection = targetCollectionId
        ? { id: targetCollectionId }
        : await createCollection({
          name: parsed.collectionName,
          description: "Imported from a Postman Collection v2.1 export.",
          auth: (parsed.auth as HttpWorkshopAuthInput | undefined) ?? { kind: "none" },
          createdByUserId: userId,
        });
      const collectionId = createdCollection.id;

      let requestCount = 0;
      const createImportedRequest = async (item: PostmanImportRequest, folderId: string | null) => {
        await createRequest({
          collectionId,
          folderId,
          name: item.name,
          method: item.method,
          url: item.url,
          queryParams: item.queryParams,
          headers: item.headers,
          bodyMode: item.bodyMode,
          bodyRaw: item.bodyRaw,
          auth: (item.auth as HttpWorkshopAuthInput | undefined) ?? { kind: "inherit" },
        });
        requestCount += 1;
      };
      const createImportedFolder = async (folder: PostmanImportFolder, parentFolderId: string | null) => {
        const created = await createFolder({ collectionId, parentFolderId, name: folder.name });
        for (const request of folder.requests) {
          await createImportedRequest(request, created.id);
        }
        for (const child of folder.folders) {
          await createImportedFolder(child, created.id);
        }
      };

      for (const request of parsed.rootRequests) {
        await createImportedRequest(request, null);
      }
      for (const folder of parsed.folders) {
        await createImportedFolder(folder, null);
      }

      res.json({ success: true, collectionId, requestCount });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to import Postman collection.";
      res.status(400).json({ success: false, error: message });
    }
  });

  router.post("/import/curl", async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized." });
      return;
    }
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    const targetCollectionId = typeof req.body?.targetCollectionId === "string" ? req.body.targetCollectionId : undefined;
    const folderId = typeof req.body?.folderId === "string" ? req.body.folderId : null;
    if (!text.trim()) {
      res.status(400).json({ success: false, error: "Paste a curl command." });
      return;
    }

    try {
      const parsed = parseCurlCommand(text);
      const createdCollection = targetCollectionId
        ? { id: targetCollectionId }
        : await createCollection({
          name: "Imported from cURL",
          auth: { kind: "none" },
          createdByUserId: userId,
        });
      const collectionId = createdCollection.id;

      const item = await createRequest({
        collectionId,
        folderId: targetCollectionId ? folderId : null,
        name: `${parsed.method} ${parsed.url}`.slice(0, 80),
        method: parsed.method,
        url: parsed.url,
        headers: parsed.headers,
        bodyMode: parsed.bodyMode,
        bodyRaw: parsed.bodyRaw,
        auth: (parsed.auth as HttpWorkshopAuthInput),
      });
      res.json({ success: true, collectionId, requestId: item.id });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to parse curl command.";
      res.status(400).json({ success: false, error: message });
    }
  });

  // ---- Ad-hoc execution (free-form request, decision 1: same SSRF guard, no operation allowlist) ----

  router.post("/run-adhoc", async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized." });
      return;
    }
    const method = req.body?.method;
    const url = String(req.body?.url || "").trim();
    if (!isValidMethod(method) || !url) {
      res.status(400).json({ success: false, error: "A valid method and url are required." });
      return;
    }
    const bodyMode: AdHocBodyMode = req.body?.bodyMode === "json" || req.body?.bodyMode === "raw" ? req.body.bodyMode : "none";

    try {
      const result = await runAdHocHttpRequest({
        method,
        url,
        queryParams: Array.isArray(req.body?.queryParams) ? req.body.queryParams : undefined,
        headers: Array.isArray(req.body?.headers) ? req.body.headers : undefined,
        bodyMode,
        bodyRaw: typeof req.body?.bodyRaw === "string" ? req.body.bodyRaw : undefined,
        auth: readAuthInput(req.body),
        savedRequestId: typeof req.body?.savedRequestId === "string" ? req.body.savedRequestId : undefined,
      });
      const assertions = Array.isArray(req.body?.assertions) ? req.body.assertions : [];
      const assertionResults = assertions.length > 0 ? evaluateAssertions(assertions, result) : undefined;
      res.json({ success: true, ...result, assertionResults });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Request failed.";
      res.status(502).json({ success: false, error: message });
    }
  });

  app.use("/api/api-talk", routeGuard, router);
};
