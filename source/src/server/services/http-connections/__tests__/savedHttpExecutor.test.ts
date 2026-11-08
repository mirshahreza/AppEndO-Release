import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock("../../ai/mcp/mcpUrlGuard", () => ({
  validateMcpRemoteUrl: vi.fn(async (urlString: string) => new URL(urlString)),
  createSsrfGuardedFetch: () => fetchMock,
}));

vi.mock("../httpConnectionVault", () => ({
  HTTP_WORKSHOP_VAULT_OWNER_TYPE: "http_workshop_request",
  getHttpVaultSecret: vi.fn(async () => "decrypted-secret"),
}));

const requestFixture = {
  id: "req-1",
  collectionId: "col-1",
  folderId: null,
  name: "Get todo",
  method: "GET" as const,
  url: "https://api.example.com/todos/1",
  queryParams: [{ key: "page", value: "1", enabled: true }, { key: "off", value: "x", enabled: false }],
  headers: [{ key: "X-Trace", value: "abc", enabled: true }],
  bodyMode: "none" as const,
  auth: { kind: "inherit" as const },
  assertions: [],
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const { getRequestRecordMock, resolveEffectiveAuthMock } = vi.hoisted(() => ({
  getRequestRecordMock: vi.fn(),
  resolveEffectiveAuthMock: vi.fn(),
}));

vi.mock("../collectionsStore", () => ({
  getRequestRecord: getRequestRecordMock,
  resolveEffectiveAuth: resolveEffectiveAuthMock,
}));

import { runSavedHttpRequest } from "../savedHttpExecutor";

describe("runSavedHttpRequest", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    getRequestRecordMock.mockReset().mockReturnValue(requestFixture);
    resolveEffectiveAuthMock.mockReset().mockReturnValue({ kind: "none" });
  });

  it("throws when the request does not exist", async () => {
    getRequestRecordMock.mockReturnValue(null);
    await expect(runSavedHttpRequest({ requestId: "missing" })).rejects.toThrow("not found");
  });

  it("only applies enabled query params and headers from the stored request", async () => {
    await runSavedHttpRequest({ requestId: "req-1" });
    const [urlArg, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(urlArg.searchParams.get("page")).toBe("1");
    expect(urlArg.searchParams.has("off")).toBe(false);
    expect((init.headers as Record<string, string>)["X-Trace"]).toBe("abc");
  });

  it("decrypts the resolved effective auth server-side and attaches it", async () => {
    resolveEffectiveAuthMock.mockReturnValue({
      kind: "bearer",
      hasSecret: true,
      vaultOwnerId: "req-1",
    });
    await runSavedHttpRequest({ requestId: "req-1" });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer decrypted-secret");
  });

  it("returns status, duration and parsed body", async () => {
    const result = await runSavedHttpRequest({ requestId: "req-1" });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });
});
