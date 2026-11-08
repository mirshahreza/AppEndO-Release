export type SandboxTestRequest = {
  method: string;
  body: unknown;
  query: Record<string, unknown>;
  params: Record<string, string>;
  headers: Record<string, unknown>;
};

/** Reserved Test Console envelope keys — other top-level keys are treated as POST/PUT body fields. */
export const TEST_PAYLOAD_ENVELOPE_KEYS = new Set(['body', 'query', 'params', 'headers']);

export const extractBodyFieldsFromTestPayload = (
  payload: Record<string, unknown>,
): Record<string, unknown> => {
  if (payload.body && typeof payload.body === 'object' && !Array.isArray(payload.body)) {
    return payload.body as Record<string, unknown>;
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !TEST_PAYLOAD_ENVELOPE_KEYS.has(key)),
  );
};

/** Test Console payload: body fields at root; optional `query` / `params` wrappers when needed. */
export const buildRequestFromTestPayload = (
  method: string,
  payload: Record<string, unknown>,
): SandboxTestRequest => {
  const hasEnvelope = 'body' in payload || 'query' in payload || 'params' in payload;
  if (hasEnvelope) {
    return {
      method,
      body: payload.body ?? {},
      query: payload.query && typeof payload.query === 'object' && !Array.isArray(payload.query)
        ? payload.query as Record<string, unknown>
        : {},
      params: payload.params && typeof payload.params === 'object' && !Array.isArray(payload.params)
        ? Object.fromEntries(
          Object.entries(payload.params as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
        )
        : {},
      headers: {},
    };
  }

  return {
    method,
    body: payload,
    query: {},
    params: {},
    headers: {},
  };
};
