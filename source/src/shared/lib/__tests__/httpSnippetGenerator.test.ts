import { describe, expect, it } from "vitest";
import { generateHttpSnippet } from "../httpSnippetGenerator";

const spec = { method: "POST", url: "https://api.example.com/users", headers: { "Content-Type": "application/json", Authorization: "Bearer abc" }, body: '{"name":"Rex"}' };

describe("generateHttpSnippet", () => {
  it("generates a runnable curl command with headers and body", () => {
    const snippet = generateHttpSnippet("curl", spec);
    expect(snippet).toContain("curl -X POST");
    expect(snippet).toContain("https://api.example.com/users");
    expect(snippet).toContain("Authorization: Bearer abc");
    expect(snippet).toContain('{"name":"Rex"}');
  });

  it("generates a fetch snippet", () => {
    const snippet = generateHttpSnippet("fetch", spec);
    expect(snippet).toContain("fetch(");
    expect(snippet).toContain('method: "POST"');
  });

  it("generates an axios snippet", () => {
    const snippet = generateHttpSnippet("axios", spec);
    expect(snippet).toContain('require("axios")');
    expect(snippet).toContain("axios({");
  });

  it("generates a python requests snippet", () => {
    const snippet = generateHttpSnippet("python", spec);
    expect(snippet).toContain("import requests");
    expect(snippet).toContain("requests.request(");
  });

  it("generates a PowerShell Invoke-RestMethod snippet", () => {
    const snippet = generateHttpSnippet("powershell", spec);
    expect(snippet).toContain("Invoke-RestMethod");
    expect(snippet).toContain("-Method POST");
  });

  it("omits the body block entirely when there is no body", () => {
    const noBodySpec = { ...spec, body: undefined };
    expect(generateHttpSnippet("curl", noBodySpec)).not.toContain("-d ");
    expect(generateHttpSnippet("python", noBodySpec)).not.toContain("data=");
  });
});
