import { describe, expect, it } from "vitest";
import { parseOpenApiConnectorSpecRich } from "../openApiConnectorSpec";

const spec = {
  info: { title: "Pet Store" },
  servers: [{ url: "https://api.petstore.example" }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: "apiKey", in: "header", name: "X-Api-Key" },
    },
  },
  paths: {
    "/pets/{petId}": {
      parameters: [{ name: "petId", in: "path", required: true }],
      get: {
        operationId: "getPet",
        summary: "Get a pet",
        parameters: [{ name: "verbose", in: "query" }],
      },
    },
    "/pets": {
      post: {
        operationId: "createPet",
        requestBody: {
          content: {
            "application/json": { example: { name: "Rex" } },
          },
        },
      },
    },
  },
};

describe("parseOpenApiConnectorSpecRich", () => {
  it("captures path and query parameters per operation, merging path-item-level and operation-level", () => {
    const parsed = parseOpenApiConnectorSpecRich(JSON.stringify(spec));
    const getPet = parsed.operations.find((op) => op.operationId === "getPet");
    expect(getPet?.parameters).toEqual(expect.arrayContaining([
      { name: "petId", location: "path", required: true },
      { name: "verbose", location: "query", required: false },
    ]));
  });

  it("captures a requestBody example as a JSON string", () => {
    const parsed = parseOpenApiConnectorSpecRich(JSON.stringify(spec));
    const createPet = parsed.operations.find((op) => op.operationId === "createPet");
    expect(createPet?.requestBodyExample).toBe(JSON.stringify({ name: "Rex" }, null, 2));
  });

  it("suggests apiKey auth with header name from securitySchemes", () => {
    const parsed = parseOpenApiConnectorSpecRich(JSON.stringify(spec));
    expect(parsed.suggestedAuthKind).toBe("apiKey");
    expect(parsed.suggestedApiKeyHeaderName).toBe("X-Api-Key");
  });

  it("suggests bearer auth for http/bearer scheme", () => {
    const bearerSpec = { ...spec, components: { securitySchemes: { Bearer: { type: "http", scheme: "bearer" } } } };
    expect(parseOpenApiConnectorSpecRich(JSON.stringify(bearerSpec)).suggestedAuthKind).toBe("bearer");
  });
});
