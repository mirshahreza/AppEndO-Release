import { describe, expect, it } from "vitest";
import { formatHttpWorkshopResponseBody } from "../httpWorkshopResponseBody";

describe("formatHttpWorkshopResponseBody", () => {
  it("pretty-prints objects without transforming structure", () => {
    const text = formatHttpWorkshopResponseBody({ ok: true, Responses: [{ Body: "{\"a\":1}" }] });
    expect(text).toBe('{\n  "ok": true,\n  "Responses": [\n    {\n      "Body": "{\\"a\\":1}"\n    }\n  ]\n}');
  });

  it("pretty-prints JSON text when the HTTP body is a JSON string", () => {
    const text = formatHttpWorkshopResponseBody('{"Result":true,"Responses":[]}');
    expect(text).toBe('{\n  "Result": true,\n  "Responses": []\n}');
  });

  it("returns non-JSON strings verbatim", () => {
    expect(formatHttpWorkshopResponseBody("plain text")).toBe("plain text");
  });

  it("returns empty for nullish", () => {
    expect(formatHttpWorkshopResponseBody(null)).toBe("");
    expect(formatHttpWorkshopResponseBody(undefined)).toBe("");
  });
});
