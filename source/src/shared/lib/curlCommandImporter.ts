/**
 * Parses a single `curl ...` command (as pasted from a terminal or copied from a browser's
 * devtools "Copy as cURL") into a method/url/headers/body/auth shape the HTTP Workshop import
 * flow can turn into one Request. Handles the flags people actually paste: -X/--request,
 * -H/--header, -d/--data/--data-raw/--data-binary, -u/--user (basic auth), --url, and a bare
 * URL argument. Does not attempt to run a real shell parser (no $(...), no env expansion).
 */

export type CurlImportMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type CurlImportKeyValue = { key: string; value: string; enabled: boolean };
export type CurlImportAuth =
  | { kind: "none" }
  | { kind: "basic"; basicUsername: string; secretPlaintext: string };

export type CurlImportResult = {
  method: CurlImportMethod;
  url: string;
  headers: CurlImportKeyValue[];
  bodyMode: "none" | "json" | "raw";
  bodyRaw?: string;
  auth: CurlImportAuth;
};

const VALID_METHODS: CurlImportMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "\\" && command[i + 1] === "\n") {
      i += 1;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

export function parseCurlCommand(raw: string): CurlImportResult {
  const trimmed = raw.trim().replace(/^\$\s*/, "");
  if (!trimmed) {
    throw new Error("Paste a curl command.");
  }
  const tokens = tokenize(trimmed).filter((token) => token !== "curl");

  let method: CurlImportMethod | undefined;
  let url = "";
  const headers: CurlImportKeyValue[] = [];
  let bodyRaw: string | undefined;
  let auth: CurlImportAuth = { kind: "none" };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "-X" || token === "--request") {
      const value = tokens[++i]?.toUpperCase();
      if (value && (VALID_METHODS as string[]).includes(value)) {
        method = value as CurlImportMethod;
      }
      continue;
    }
    if (token === "-H" || token === "--header") {
      const headerLine = tokens[++i] ?? "";
      const separatorIndex = headerLine.indexOf(":");
      if (separatorIndex > 0) {
        headers.push({ key: headerLine.slice(0, separatorIndex).trim(), value: headerLine.slice(separatorIndex + 1).trim(), enabled: true });
      }
      continue;
    }
    if (token === "-d" || token === "--data" || token === "--data-raw" || token === "--data-binary" || token === "--data-ascii") {
      bodyRaw = tokens[++i] ?? "";
      continue;
    }
    if (token === "-u" || token === "--user") {
      const value = tokens[++i] ?? "";
      const [username, password = ""] = value.split(":");
      auth = { kind: "basic", basicUsername: username, secretPlaintext: password };
      continue;
    }
    if (token === "--url") {
      url = tokens[++i] ?? "";
      continue;
    }
    if (token.startsWith("-")) {
      continue;
    }
    if (!url) {
      url = token;
    }
  }

  if (!url) {
    throw new Error("Could not find a URL in the curl command.");
  }

  const resolvedMethod = method ?? (bodyRaw !== undefined ? "POST" : "GET");
  const isJson = headers.some((header) => header.key.toLowerCase() === "content-type" && header.value.toLowerCase().includes("json"))
    || (bodyRaw !== undefined && bodyRaw.trim().startsWith("{"));

  return {
    method: resolvedMethod,
    url,
    headers,
    bodyMode: bodyRaw === undefined ? "none" : (isJson ? "json" : "raw"),
    bodyRaw,
    auth,
  };
}
