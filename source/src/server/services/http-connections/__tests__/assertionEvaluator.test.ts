import { describe, expect, it } from "vitest";
import { evaluateAssertions } from "../assertionEvaluator";

const ctx = { status: 200, durationMs: 42, headers: { "content-type": "application/json" }, body: { data: { id: 7, name: "Ali" } } };

describe("evaluateAssertions", () => {
  it("evaluates status equals", () => {
    expect(evaluateAssertions([{ kind: "status", op: "equals", value: 200 }], ctx)[0].passed).toBe(true);
    expect(evaluateAssertions([{ kind: "status", op: "equals", value: 404 }], ctx)[0].passed).toBe(false);
  });

  it("evaluates status in-range", () => {
    expect(evaluateAssertions([{ kind: "status", op: "in-range", value: [200, 299] }], ctx)[0].passed).toBe(true);
    expect(evaluateAssertions([{ kind: "status", op: "in-range", value: [300, 399] }], ctx)[0].passed).toBe(false);
  });

  it("evaluates duration less-than", () => {
    expect(evaluateAssertions([{ kind: "duration", op: "lt", ms: 100 }], ctx)[0].passed).toBe(true);
    expect(evaluateAssertions([{ kind: "duration", op: "lt", ms: 10 }], ctx)[0].passed).toBe(false);
  });

  it("evaluates header exists/equals case-insensitively", () => {
    expect(evaluateAssertions([{ kind: "header", name: "Content-Type", op: "exists" }], ctx)[0].passed).toBe(true);
    expect(evaluateAssertions([{ kind: "header", name: "X-Missing", op: "exists" }], ctx)[0].passed).toBe(false);
    expect(evaluateAssertions([{ kind: "header", name: "Content-Type", op: "equals", value: "application/json" }], ctx)[0].passed).toBe(true);
  });

  it("evaluates jsonPath exists/equals/contains via dot-path", () => {
    expect(evaluateAssertions([{ kind: "jsonPath", path: "data.id", op: "exists" }], ctx)[0].passed).toBe(true);
    expect(evaluateAssertions([{ kind: "jsonPath", path: "data.missing", op: "exists" }], ctx)[0].passed).toBe(false);
    expect(evaluateAssertions([{ kind: "jsonPath", path: "data.id", op: "equals", value: 7 }], ctx)[0].passed).toBe(true);
    expect(evaluateAssertions([{ kind: "jsonPath", path: "data.name", op: "contains", value: "Al" }], ctx)[0].passed).toBe(true);
  });
});
