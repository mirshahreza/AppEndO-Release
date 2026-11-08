import type { HttpWorkshopAssertion } from "./apiTalkTypes";

export type AssertionOutcome = { assertion: HttpWorkshopAssertion; passed: boolean; message: string };

function getByDotPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc === undefined || acc === null || typeof acc !== "object") {
      return undefined;
    }
    return (acc as Record<string, unknown>)[segment];
  }, value);
}

export function evaluateAssertions(
  assertions: HttpWorkshopAssertion[],
  ctx: { status: number; durationMs: number; headers: Record<string, string>; body: unknown },
): AssertionOutcome[] {
  return assertions.map((assertion): AssertionOutcome => {
    if (assertion.kind === "status") {
      if (assertion.op === "equals") {
        const passed = ctx.status === assertion.value;
        return { assertion, passed, message: passed ? `Status is ${ctx.status}` : `Expected status ${String(assertion.value)}, got ${ctx.status}` };
      }
      const [min, max] = assertion.value as [number, number];
      const passed = ctx.status >= min && ctx.status <= max;
      return { assertion, passed, message: passed ? `Status ${ctx.status} is in range` : `Expected status in [${min}, ${max}], got ${ctx.status}` };
    }
    if (assertion.kind === "duration") {
      const passed = ctx.durationMs < assertion.ms;
      return { assertion, passed, message: passed ? `Duration ${ctx.durationMs}ms < ${assertion.ms}ms` : `Duration ${ctx.durationMs}ms exceeded ${assertion.ms}ms` };
    }
    if (assertion.kind === "header") {
      const actual = Object.entries(ctx.headers).find(([key]) => key.toLowerCase() === assertion.name.toLowerCase())?.[1];
      if (assertion.op === "exists") {
        const passed = actual !== undefined;
        return { assertion, passed, message: passed ? `Header "${assertion.name}" exists` : `Header "${assertion.name}" is missing` };
      }
      const passed = actual === assertion.value;
      return { assertion, passed, message: passed ? `Header "${assertion.name}" equals expected value` : `Header "${assertion.name}" was "${actual ?? ""}", expected "${assertion.value ?? ""}"` };
    }
    const actual = getByDotPath(ctx.body, assertion.path);
    if (assertion.op === "exists") {
      const passed = actual !== undefined;
      return { assertion, passed, message: passed ? `"${assertion.path}" exists` : `"${assertion.path}" is missing` };
    }
    if (assertion.op === "equals") {
      const passed = JSON.stringify(actual) === JSON.stringify(assertion.value);
      return { assertion, passed, message: passed ? `"${assertion.path}" equals expected value` : `"${assertion.path}" was ${JSON.stringify(actual)}, expected ${JSON.stringify(assertion.value)}` };
    }
    const passed = typeof actual === "string" && typeof assertion.value === "string" && actual.includes(assertion.value);
    return { assertion, passed, message: passed ? `"${assertion.path}" contains expected value` : `"${assertion.path}" does not contain expected value` };
  });
}
