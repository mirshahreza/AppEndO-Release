import { describe, expect, it } from "vitest";
import { enabledWorkshopKeyValues, tabFromSavedRequest } from "../apiTalkTabTypes";
import type { HttpWorkshopRequestSummary } from "../../../shared/api/queries/api-talk";

describe("tabFromSavedRequest", () => {
  it("keeps disabled headers so placeholders are visible but not sent", () => {
    const request = {
      id: "r1",
      collectionId: "c1",
      folderId: null,
      name: "HWY-Test",
      method: "POST",
      url: "https://hawiety.com/talk-to-me/",
      queryParams: [],
      headers: [{ key: "token", value: "", enabled: false }],
      bodyMode: "json",
      bodyRaw: "[]",
      auth: { kind: "none", hasSecret: false },
      assertions: [],
      sortOrder: 0,
    } satisfies HttpWorkshopRequestSummary;

    const tab = tabFromSavedRequest(request);
    expect(tab.headers).toEqual([{ key: "token", value: "", enabled: false }]);
    expect(enabledWorkshopKeyValues(tab.headers)).toEqual([]);
  });
});

describe("enabledWorkshopKeyValues", () => {
  it("drops disabled rows and blank keys", () => {
    expect(enabledWorkshopKeyValues([
      { key: "token", value: "abc", enabled: true },
      { key: "X-Off", value: "y", enabled: false },
      { key: "", value: "z", enabled: true },
    ])).toEqual([{ key: "token", value: "abc", enabled: true }]);
  });
});
