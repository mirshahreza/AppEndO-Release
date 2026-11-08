import { describe, expect, it } from "vitest";
import { parsePostmanCollection } from "../postmanCollectionImporter";

const fixture = {
  info: { name: "Payments API", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
  auth: { type: "bearer", bearer: [{ key: "token", value: "collection-token" }] },
  item: [
    {
      name: "Users",
      item: [
        {
          name: "List users",
          request: {
            method: "GET",
            header: [{ key: "X-Trace", value: "abc", disabled: false }],
            url: { raw: "https://api.example.com/users?page=1", query: [{ key: "page", value: "1" }] },
          },
        },
      ],
    },
    {
      name: "Create user",
      request: {
        method: "POST",
        header: [],
        url: "https://api.example.com/users",
        body: { mode: "raw", raw: '{"name":"Rex"}', options: { raw: { language: "json" } } },
        auth: { type: "apikey", apikey: [{ key: "key", value: "X-Api-Key" }, { key: "value", value: "secret-key" }] },
      },
    },
  ],
};

describe("parsePostmanCollection", () => {
  it("reads the collection name and collection-level bearer auth", () => {
    const result = parsePostmanCollection(JSON.stringify(fixture));
    expect(result.collectionName).toBe("Payments API");
    expect(result.auth).toEqual({ kind: "bearer", secretPlaintext: "collection-token" });
  });

  it("builds a nested folder with its request, including headers and query params", () => {
    const result = parsePostmanCollection(JSON.stringify(fixture));
    expect(result.folders).toHaveLength(1);
    const usersFolder = result.folders[0];
    expect(usersFolder.name).toBe("Users");
    expect(usersFolder.requests).toHaveLength(1);
    expect(usersFolder.requests[0]).toMatchObject({
      name: "List users",
      method: "GET",
      url: "https://api.example.com/users",
      headers: [{ key: "X-Trace", value: "abc", enabled: true }],
      queryParams: [{ key: "page", value: "1", enabled: true }],
    });
  });

  it("puts a request with no parent folder at the root and reads its per-request apiKey auth", () => {
    const result = parsePostmanCollection(JSON.stringify(fixture));
    expect(result.rootRequests).toHaveLength(1);
    expect(result.rootRequests[0].name).toBe("Create user");
    expect(result.rootRequests[0].bodyMode).toBe("json");
    expect(result.rootRequests[0].bodyRaw).toBe('{"name":"Rex"}');
    expect(result.rootRequests[0].auth).toEqual({ kind: "apiKey", apiKeyHeaderName: "X-Api-Key", secretPlaintext: "secret-key" });
  });

  it("throws on a JSON payload that is not a Postman collection", () => {
    expect(() => parsePostmanCollection(JSON.stringify({ foo: "bar" }))).toThrow('"item"');
  });
});
