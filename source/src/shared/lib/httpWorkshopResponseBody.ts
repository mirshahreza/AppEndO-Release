/** Pretty-print for the response panel — no API-specific reshaping. */
export function formatHttpWorkshopResponseBody(body: unknown): string {
  if (body === null || body === undefined) {
    return "";
  }
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        return body;
      }
    }
    return body;
  }
  return JSON.stringify(body, null, 2);
}
