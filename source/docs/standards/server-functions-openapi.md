# Edge functions OpenAPI documentation

> **Shard:** `edge-openapi`

- Every managed route: OpenAPI `3.1.2` + server Swagger UI (`swagger-ui-dist` >= 5.32.x); not embedded in React admin.
- Reserved paths:
  - `GET /api/docs/openapi.json` (aggregated, auth-filtered)
  - `GET /api/docs/routes/:functionId/openapi.json`
  - `GET /api/docs` · `GET /api/docs/routes/:functionId` (Swagger UI)
  - `POST /api/docs/refresh` (optional `?functionId=`) — rebuilds Swagger + OpenAPI caches; triggered from Server Functions **API documentation** menu (**Refresh docs**), not from Swagger topbar
- Never under business paths (e.g. `/api/orders/:id/docs`).
- Generator: `buildManagedFunctionOpenApi.ts` + `parseServerFunctionScriptDoc.ts` (primary input = function `code`).
- Fallback: `apiDoc` + `test_payload`.
- Include managed + built-in routes (`serverFunctionDocCatalog.ts`); cache by fingerprint in `openApiSpec.service.ts`.

**IDs:** `api.server-functions.openapi-docs`.
