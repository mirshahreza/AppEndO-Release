import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runAdHocHttpRequest } from "../adHocHttpExecutor";
import { formatHttpWorkshopResponseBody } from "../../../../shared/lib/httpWorkshopResponseBody";

const collectionsPath = path.join(process.cwd(), "workspace/http-connections/collections.json");

describe("HWY talk-to-me live send (integration)", () => {
  it("posts HWY-Test body without throwing and returns a talk-to-me envelope", async () => {
    const collections = JSON.parse(fs.readFileSync(collectionsPath, "utf8")) as {
      requests: Array<{ name: string; bodyRaw: string }>;
    };
    const hwy = collections.requests.find((r) => r.name === "HWY-Test");
    expect(hwy).toBeDefined();

    const result = await runAdHocHttpRequest({
      method: "POST",
      url: "https://hawiety.com/talk-to-me/",
      bodyMode: "json",
      bodyRaw: hwy!.bodyRaw,
    });

    expect(result.status).toBe(200);
    expect(result.truncated).toBe(false);
    const envelope = result.body as { Responses?: Array<{ Result?: boolean }> };
    expect(envelope.Responses?.[0]?.Result).toBe(true);

    const formatted = formatHttpWorkshopResponseBody(result.body);
    expect(formatted.length).toBeGreaterThan(50);
    expect(formatted).toContain("Responses");
  }, 30_000);
});
