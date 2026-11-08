import { describe, expect, it } from "vitest";
import { parseCurlCommand } from "../curlCommandImporter";

describe("parseCurlCommand", () => {
  it("parses a plain GET with no flags", () => {
    const result = parseCurlCommand("curl https://api.example.com/users");
    expect(result.method).toBe("GET");
    expect(result.url).toBe("https://api.example.com/users");
    expect(result.bodyMode).toBe("none");
  });

  it("infers POST when -d is present without -X", () => {
    const result = parseCurlCommand(`curl https://api.example.com/users -d '{"name":"Rex"}'`);
    expect(result.method).toBe("POST");
    expect(result.bodyMode).toBe("json");
    expect(result.bodyRaw).toBe('{"name":"Rex"}');
  });

  it("parses -X, -H headers, and a raw text body", () => {
    const result = parseCurlCommand(`curl -X PUT https://api.example.com/users/1 -H "X-Trace: abc" -H "Content-Type: text/plain" -d "hello"`);
    expect(result.method).toBe("PUT");
    expect(result.headers).toEqual(expect.arrayContaining([{ key: "X-Trace", value: "abc", enabled: true }]));
    expect(result.bodyMode).toBe("raw");
    expect(result.bodyRaw).toBe("hello");
  });

  it("parses -u into basic auth", () => {
    const result = parseCurlCommand("curl https://api.example.com/secure -u admin:s3cret");
    expect(result.auth).toEqual({ kind: "basic", basicUsername: "admin", secretPlaintext: "s3cret" });
  });

  it("handles a leading $ prompt and --url", () => {
    const result = parseCurlCommand("$ curl --url https://api.example.com/x -X DELETE");
    expect(result.url).toBe("https://api.example.com/x");
    expect(result.method).toBe("DELETE");
  });

  it("throws when no URL can be found", () => {
    expect(() => parseCurlCommand("curl -X GET")).toThrow("URL");
  });
});
