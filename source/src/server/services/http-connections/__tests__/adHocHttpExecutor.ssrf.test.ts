import { describe, expect, it } from "vitest";
import { runAdHocHttpRequest } from "../adHocHttpExecutor";

/**
 * Uses the real mcpUrlGuard (no mock) to prove the free-form ad-hoc executor still enforces the
 * same SSRF protection as every other MCP-guarded call site, even though it accepts any URL.
 */
describe("runAdHocHttpRequest SSRF regression (real guard)", () => {
  it("rejects a loopback address", async () => {
    await expect(runAdHocHttpRequest({ method: "GET", url: "http://127.0.0.1/admin" }))
      .rejects.toThrow();
  });

  it("rejects a private 10.x address", async () => {
    await expect(runAdHocHttpRequest({ method: "GET", url: "http://10.0.0.5/internal" }))
      .rejects.toThrow();
  });

  it("rejects the localhost hostname", async () => {
    await expect(runAdHocHttpRequest({ method: "GET", url: "http://localhost:9999/secret" }))
      .rejects.toThrow();
  });

  it("rejects a non-http(s) protocol", async () => {
    await expect(runAdHocHttpRequest({ method: "GET", url: "file:///etc/passwd" }))
      .rejects.toThrow();
  });
});
