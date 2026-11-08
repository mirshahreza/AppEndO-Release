import fs from "node:fs";

const BASE = process.env.APPENDO_URL ?? "http://127.0.0.1:3000";
const COOKIE_JAR = "tmp-api-talk-cookies.txt";

async function login(): Promise<string> {
  const body = JSON.stringify({ identifier: "admin", password: "P#ssC0de" });
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Login failed ${res.status}: ${raw.slice(0, 200)}`);
  }
  fs.writeFileSync(COOKIE_JAR, setCookie.map((c) => c.split(";")[0]).join("; "));
  return setCookie.join("; ");
}

function cookieHeader(): string {
  if (fs.existsSync(COOKIE_JAR)) {
    return fs.readFileSync(COOKIE_JAR, "utf8").trim();
  }
  return "";
}

async function runAdHocViaApi(bodyRaw: string) {
  const payload = {
    method: "POST",
    url: "https://hawiety.com/talk-to-me/",
    queryParams: [],
    headers: [],
    bodyMode: "json",
    bodyRaw,
    auth: { kind: "none" },
    savedRequestId: "00713292-f5dd-430e-9781-a677cb5441d2",
  };
  const res = await fetch(`${BASE}/api/api-talk/run-adhoc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(),
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    console.log("NON-JSON", res.status, text.slice(0, 500));
    return;
  }
  console.log("api-talk status", res.status, "success", data.success, "error", data.error);
  if (data.success === false) {
    return;
  }
  const bodyJson = JSON.stringify(data.body);
  console.log("remote status", data.status, "durationMs", data.durationMs, "truncated", data.truncated);
  console.log("bodyChars", bodyJson.length);
  const resp = (data.body as { Responses?: Array<{ Result?: boolean; Message?: string; Body?: unknown }> })?.Responses?.[0];
  console.log("cmd", resp?.Result, resp?.Result === false ? String(resp?.Message).slice(0, 120) : "");
  const records = (resp?.Body as { Records?: unknown })?.Records;
  if (Array.isArray(records)) {
    console.log("records array len", records.length, "first user", (records[0] as { Master?: { UserName?: string } })?.Master?.UserName);
  } else if (records && typeof records === "object") {
    const master = (records as { Master?: unknown[] }).Master;
    console.log("records object masterLen", Array.isArray(master) ? master.length : master);
  }
}

const collections = JSON.parse(fs.readFileSync("workspace/http-connections/collections.json", "utf8")) as {
  requests: Array<{ name: string; bodyRaw: string }>;
};
const hwy = collections.requests.find((r) => r.name === "HWY-Test");
if (!hwy) {
  throw new Error("HWY-Test not found");
}

await login();
console.log("--- run-adhoc via AppEndO API (saved HWY body) ---");
await runAdHocViaApi(hwy.bodyRaw);
