import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock, httpsRequestMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  httpsRequestMock: vi.fn(),
}));

vi.mock("node:https", () => ({
  default: { request: httpsRequestMock },
}));

vi.mock("../../ai/mcp/mcpUrlGuard", () => ({
  validateMcpRemoteUrl: vi.fn(async (urlString: string) => new URL(urlString)),
  createSsrfGuardedFetch: () => fetchMock,
}));

import { runAdHocHttpRequest } from "../adHocHttpExecutor";
import { validateMcpRemoteUrl } from "../../ai/mcp/mcpUrlGuard";

describe("runAdHocHttpRequest", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    httpsRequestMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  });

  it("runs a free-form URL that was never part of any imported spec, through the SSRF guard", async () => {
    await runAdHocHttpRequest({ method: "GET", url: "https://api.example.com/anything" });
    expect(validateMcpRemoteUrl).toHaveBeenCalledWith("https://api.example.com/anything");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("only applies enabled query params and headers", async () => {
    await runAdHocHttpRequest({
      method: "GET",
      url: "https://api.example.com/x",
      queryParams: [
        { key: "page", value: "1", enabled: true },
        { key: "skip", value: "x", enabled: false },
      ],
      headers: [
        { key: "X-Trace", value: "abc", enabled: true },
        { key: "X-Off", value: "y", enabled: false },
      ],
    });
    const [urlArg, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(urlArg.searchParams.get("page")).toBe("1");
    expect(urlArg.searchParams.has("skip")).toBe(false);
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Trace"]).toBe("abc");
    expect(headers["X-Off"]).toBeUndefined();
  });

  it("attaches a bearer Authorization header from an inline auth input", async () => {
    await runAdHocHttpRequest({
      method: "GET",
      url: "https://api.example.com/x",
      auth: { kind: "bearer", secretPlaintext: "abc123" },
    });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer abc123");
  });

  it("attaches custom auth headers from an inline auth input", async () => {
    await runAdHocHttpRequest({
      method: "GET",
      url: "https://api.example.com/x",
      auth: { kind: "customHeaders", customHeaders: [{ name: "X-Custom", value: "v" }] },
    });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect((init.headers as Record<string, string>)["X-Custom"]).toBe("v");
  });

  it("sends a JSON body on POST via fetch and on GET via node https (Postman parity)", async () => {
    await runAdHocHttpRequest({
      method: "POST",
      url: "https://api.example.com/x",
      bodyMode: "json",
      bodyRaw: '{"name":"Rex"}',
    });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.body).toBe('{"name":"Rex"}');
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

    fetchMock.mockClear();
    let writtenBody = "";
    httpsRequestMock.mockImplementation((_opts, callback) => {
      const req = new EventEmitter() as EventEmitter & {
        write: (chunk: string) => void;
        end: () => void;
        destroy: () => void;
      };
      req.write = (chunk: string) => {
        writtenBody += chunk;
      };
      req.end = vi.fn();
      req.destroy = vi.fn();
      setImmediate(() => {
        const res = new EventEmitter() as EventEmitter & {
          statusCode: number;
          headers: Record<string, string>;
        };
        res.statusCode = 200;
        res.headers = { "content-type": "application/json" };
        callback(res);
        res.emit("data", Buffer.from('{"from":"get-body"}'));
        res.emit("end");
      });
      return req;
    });

    const getResult = await runAdHocHttpRequest({
      method: "GET",
      url: "https://api.example.com/x",
      bodyMode: "json",
      bodyRaw: '{"ignored":true}',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(writtenBody).toBe('{"ignored":true}');
    expect(getResult.body).toEqual({ from: "get-body" });
  });

  it("sends talk-to-me GET requests with a JSON body as POST", async () => {
    await runAdHocHttpRequest({
      method: "GET",
      url: "https://api.example.com/talk-to-me/",
      bodyMode: "json",
      bodyRaw: "[]",
    });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe("[]");
  });

  it("returns status, duration, parsed JSON body and truncation flag", async () => {
    const result = await runAdHocHttpRequest({ method: "GET", url: "https://api.example.com/x" });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
    expect(result.truncated).toBe(false);
    expect(typeof result.durationMs).toBe("number");
  });

  it("keeps a JSON string body as a string after one parse", async () => {
    const inner = { Result: true, Responses: [{ Body: { Records: { Master: [{ id: 1 }] } } }] };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(JSON.stringify(inner)), { status: 200 }));
    const result = await runAdHocHttpRequest({ method: "POST", url: "https://api.example.com/x" });
    expect(result.body).toBe(JSON.stringify(inner));
  });

  it("falls back to plain text when the response is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("plain text body", { status: 200 }));
    const result = await runAdHocHttpRequest({ method: "GET", url: "https://api.example.com/x" });
    expect(result.body).toBe("plain text body");
  });
});
