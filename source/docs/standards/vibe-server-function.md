# WF-1 — Server Functions (vibe shard)

> **Shard key:** `get_project_standards({ shard: "vibe-server-function" })`  
> **Workflow:** [`vibe-coding-workflows.md`](./vibe-coding-workflows.md) § WF-1  
> **Playbook:** [`vibe-operator-playbook.md`](./vibe-operator-playbook.md)

---

## When to use

User is on **Server Functions** (`pageKey: server-functions`) and wants a new or changed API/function.

## Manual UI parity (mandatory)

Simulate **Server Functions → Create / Save** — not ad-hoc file writes.

| Manual step | Agent equivalent |
|-------------|------------------|
| Name + HTTP method (+ optional catalog tags) | `draft_server_function` args: `name`, `method` (folder defaults to `general`) |
| Route path `/api/{name}` for new customs | `path` (default computed like UI catalog path) |
| Managed id `{folder}.{name}` | `functionId` on draft/change set (e.g. `general.sum-two-numbers`) |
| Source editor | `source` — sandbox TypeScript |
| Test Console payload | `testPayload` JSON |
| Save | proposal → this editor panel writes source into Monaco (Agent auto-applies). Catalog persist is still **Save** |

Operators do **not** set folder in the UI. Folder remains storage-only (default `general`). Rename and catalog tags are edited from the **list**, not the editor chrome.

**On disk after apply (same as UI Save):**

- `workspace/server-functions/custom/{folder}.{name}.ts`
- `workspace/server-functions/custom/{folder}.{name}.metadata.json`

Catalog tags persist in `metadataJson.catalogTags` (not OpenAPI `apiDoc.tags`).

**Never:** `draft_file_patch` under `workspace/server-functions/` — use `draft_server_function` only.

## Execute — do not re-ask

If the user message already states what to build (e.g. POST, inputs, logic), **do not** respond with "tell me what function you want". After retrieve:

1. `list_server_functions` — check for similar functions
2. `get_server_function` / `read_file` — read closest example (`useServerFunctionActions.handleCreateFunction`, `templates.ts`)
3. **`draft_server_function`** — name, folder, method, path, source, testPayload
4. **`test_server_function`** — verify on live runtime. On the editor, pass `source` + `payload` from the snapshot so the run matches Test Console Execute (unsaved Monaco + current payload). Read `lastRun.output` / `lastRun.logs` in the snapshot before guessing.
5. Proposal → the Server Functions editor AI panel writes `function_source_patch` / `draft_server_function` source into Monaco (Agent auto-applies). Catalog Save is still the operator Save button. Do not claim the editor changed without that apply. In the editor AI column, assistant code fences and apply cards show a **changed-line diff** against the current Monaco source (`codeDiffBaseline`), collapsed after five displayed lines — not a full handler dump.

## Source template

Managed functions use the sandbox runtime (`req`, `res`, `db`, `console`) — **never** `export default`, `import`, or `module.exports`:

```typescript
type EdgeReq = {
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  params: Record<string, string>;
  method: string;
  headers: Record<string, string | undefined>;
};

type EdgeRes = {
  json: (data: unknown) => unknown;
  send: (data: unknown) => unknown;
  status: (code: number) => EdgeRes;
};

const edgeReq = req as EdgeReq;
const edgeRes = res as EdgeRes;

async function handler(): Promise<void> {
  // POST body: edgeReq.body
  edgeRes.json({ success: true, data: {} });
}

(async () => { await handler(); })();
```

Reference: `src/shared/api/contracts/server-functions/templates.ts` · `buildServerFunctionTemplate`.

## `draft_server_function` args

| Arg | Required | Notes |
|-----|----------|-------|
| `name` | yes | Slug name (e.g. `sum-two-numbers`) |
| `source` | yes | Full TypeScript source |
| `folder` | no | API folder segment (default `general`, e.g. `math`, `users`) |
| `method` | no | `GET` \| `POST` \| `PUT` \| `DELETE` \| `PATCH` — match semantics (POST when reading `req.body`) |
| `path` | no | Default `/api/{folder}/{name}` (same as UI) |
| `testPayload` | no | Test Console JSON — body fields at root (e.g. `{ "a": "", "b": "" }`); use `params` / `query` only for path/query params; POST default `{}` |
| `functionId` | no | Existing `{folder}.{name}` when patching |

## Route conventions

- REST: method = operation; path = resource
- POST write: read inputs from `edgeReq.body`
- Success envelope: `{ success: true, data, ... }`
- OpenAPI: [`server-functions-openapi.md`](./server-functions-openapi.md)

## Related shards

- `data-studio` — generated Data API routes
- `edge-openapi` — OpenAPI / Swagger
- `vibe-coding-workflows` — full WF-1..4 map
