/**
 * Self-implemented "Copy as" snippet generator (p-97 decision 3) — five hand-written, table-driven
 * formats instead of pulling in an httpsnippet dependency, matching the project's policy of
 * explicit control over dependencies. Add a new format by adding one function + one table row.
 */

export type SnippetRequestSpec = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
};

export type SnippetFormat = "curl" | "fetch" | "axios" | "python" | "powershell";

export const SNIPPET_FORMAT_LABELS: Record<SnippetFormat, string> = {
  curl: "cURL",
  fetch: "JavaScript (fetch)",
  axios: "Node (axios)",
  python: "Python (requests)",
  powershell: "PowerShell",
};

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\''")}'`;
}

function generateCurl(spec: SnippetRequestSpec): string {
  const lines = [`curl -X ${spec.method} ${shellQuote(spec.url)}`];
  for (const [key, value] of Object.entries(spec.headers)) {
    lines.push(`  -H ${shellQuote(`${key}: ${value}`)}`);
  }
  if (spec.body) {
    lines.push(`  -d ${shellQuote(spec.body)}`);
  }
  return lines.join(" \\n");
}

function generateFetch(spec: SnippetRequestSpec): string {
  const headersLiteral = JSON.stringify(spec.headers, null, 2);
  const bodyLine = spec.body ? `,\n  body: ${JSON.stringify(spec.body)}` : "";
  return `fetch(${JSON.stringify(spec.url)}, {\n  method: ${JSON.stringify(spec.method)},\n  headers: ${headersLiteral}${bodyLine}\n})\n  .then((response) => response.json())\n  .then((data) => console.log(data));`;
}

function generateAxios(spec: SnippetRequestSpec): string {
  const headersLiteral = JSON.stringify(spec.headers, null, 2);
  const dataLine = spec.body ? `,\n  data: ${JSON.stringify(spec.body)}` : "";
  return `const axios = require("axios");\n\naxios({\n  method: ${JSON.stringify(spec.method)},\n  url: ${JSON.stringify(spec.url)},\n  headers: ${headersLiteral}${dataLine}\n})\n  .then((response) => console.log(response.data))\n  .catch((error) => console.error(error));`;
}

function generatePython(spec: SnippetRequestSpec): string {
  const headersLiteral = JSON.stringify(spec.headers, null, 4).replace(/"/g, "'");
  const dataLine = spec.body ? `\n    data=${JSON.stringify(spec.body)},` : "";
  return `import requests\n\nresponse = requests.request(\n    ${JSON.stringify(spec.method)},\n    ${JSON.stringify(spec.url)},\n    headers=${headersLiteral},${dataLine}\n)\n\nprint(response.status_code)\nprint(response.text)`;
}

function generatePowershell(spec: SnippetRequestSpec): string {
  const headerLines = Object.entries(spec.headers)
    .map(([key, value]) => `    ${JSON.stringify(key)} = ${JSON.stringify(value)}`)
    .join("\n");
  const bodyLine = spec.body ? `\n  -Body ${JSON.stringify(spec.body)}` : "";
  return `$headers = @{\n${headerLines}\n}\n\nInvoke-RestMethod -Uri ${JSON.stringify(spec.url)} -Method ${spec.method} -Headers $headers${bodyLine}`;
}

const GENERATORS: Record<SnippetFormat, (spec: SnippetRequestSpec) => string> = {
  curl: generateCurl,
  fetch: generateFetch,
  axios: generateAxios,
  python: generatePython,
  powershell: generatePowershell,
};

export function generateHttpSnippet(format: SnippetFormat, spec: SnippetRequestSpec): string {
  return GENERATORS[format](spec);
}
