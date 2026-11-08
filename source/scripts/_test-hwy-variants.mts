import { runAdHocHttpRequest } from "../src/server/services/http-connections/adHocHttpExecutor.ts";

type Case = { label: string; method: "GET" | "POST"; headers?: Array<{ key: string; value: string; enabled: boolean }>; body: unknown };

const cases: Case[] = [
  {
    label: "post saved shape",
    method: "POST",
    body: [{
      Controller: "HWY_Members",
      Method: "Read_Inquiry",
      Inputs: {
        Master: {
          AND: {
            id: { InputParam: "id", CompareMethod: "Ignore", Value: "00000000-0000-0000-0000-000000000000" },
            UserName: { InputParam: "UserName", CompareMethod: "Ignore", Value: "101810" },
          },
        },
      },
    }],
  },
  {
    label: "get postman style",
    method: "GET",
    body: [{
      Controller: "HWY_Members",
      Method: "Read_Inquiry",
      Inputs: {
        Master: {
          AND: {
            id: { InputParam: "id", CompareMethod: "Ignore", Value: "00000000-0000-0000-0000-000000000000" },
            UserName: { InputParam: "UserName", CompareMethod: "Ignore", Value: "101810" },
          },
        },
      },
    }],
  },
  {
    label: "post user-agent postman",
    method: "POST",
    headers: [{ key: "User-Agent", value: "PostmanRuntime/7.39.0", enabled: true }],
    body: [{
      Controller: "HWY_Members",
      Method: "Read_Inquiry",
      Inputs: {
        Master: {
          AND: {
            id: { InputParam: "id", CompareMethod: "Ignore", Value: "00000000-0000-0000-0000-000000000000" },
            UserName: { InputParam: "UserName", CompareMethod: "Ignore", Value: "101810" },
          },
        },
      },
    }],
  },
];

for (const testCase of cases) {
  const result = await runAdHocHttpRequest({
    method: testCase.method,
    url: "https://hawiety.com/talk-to-me/",
    headers: testCase.headers,
    bodyMode: "json",
    bodyRaw: JSON.stringify(testCase.body),
  });
  const resp = (result.body as { Responses?: Array<{ Result?: boolean; Message?: string; Body?: { Records?: unknown } }> }).Responses?.[0];
  const len = JSON.stringify(result.body).length;
  let masterHint = "";
  const records = resp?.Body?.Records;
  if (Array.isArray(records) && records[0]) {
    masterHint = ` arr=${records.length} user=${(records[0] as { Master?: { UserName?: string } }).Master?.UserName ?? "?"}`;
  } else if (records && typeof records === "object") {
    const m = (records as { Master?: unknown[] }).Master;
    masterHint = ` masterLen=${Array.isArray(m) ? m.length : "?"}`;
  }
  console.log(
    testCase.label,
    "http",
    result.status,
    "cmd",
    resp?.Result,
    "chars",
    len,
    masterHint,
    resp?.Result === false ? String(resp?.Message).slice(0, 80) : "",
  );
}
