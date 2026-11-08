/**
 * Phase 51 — lightweight Dynamic Action that starts a Workflow Engine instance.
 * Destination is fixed (`/api/workflow-runtime/definitions/:id/start`); payload comes from
 * `payloadMapping` store paths — same idea as `callMutation`, without a Data Source.
 */

export const WORKFLOW_RUNTIME_START_PATH_PREFIX = '/api/workflow-runtime/definitions';

/** Positive integer definition id (Workflow Engine uses numeric PK). */
export const isValidWorkflowDefinitionId = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return false;
  }
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && numeric > 0;
};

export const normalizeWorkflowDefinitionId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const buildWorkflowStartEndpoint = (workflowDefinitionId: string): string =>
  `${WORKFLOW_RUNTIME_START_PATH_PREFIX}/${encodeURIComponent(workflowDefinitionId.trim())}/start`;

const readNestedStoreValue = (store: Record<string, unknown>, path: string): unknown => {
  const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
  let cursor: unknown = store;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object') {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
};

/**
 * Builds the Workflow `input` object from `payloadMapping` (apiField → store path).
 * Empty mapping → `{}` (Workflow accepts null/empty input).
 */
export const resolveWorkflowInputFromStore = (
  designerStore: Record<string, unknown>,
  payloadMapping?: Record<string, string>,
): Record<string, unknown> => {
  const input: Record<string, unknown> = {};
  if (!payloadMapping) {
    return input;
  }
  for (const [apiField, storePath] of Object.entries(payloadMapping)) {
    const key = apiField.trim();
    const path = storePath.trim();
    if (!key || !path) {
      continue;
    }
    input[key] = readNestedStoreValue(designerStore, path);
  }
  return input;
};

export const sanitizeWorkflowPayloadMapping = (
  value: unknown,
): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
    .map(([key, mapped]) => [key.trim(), mapped.trim()] as const)
    .filter(([key, mapped]) => key.length > 0 && mapped.length > 0);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

/** Codegen: emit a JS object literal that reads store paths at runtime. */
export const renderWorkflowInputExpressionForCodegen = (
  payloadMapping: Record<string, string> | undefined,
  storeExpression: string,
): string => {
  if (!payloadMapping || Object.keys(payloadMapping).length === 0) {
    return '{}';
  }

  const parts: string[] = [];
  for (const [apiField, storePath] of Object.entries(payloadMapping)) {
    const segments = storePath.split('.').map((segment) => segment.trim()).filter(Boolean);
    if (segments.length === 0) {
      continue;
    }
    const access = segments
      .map((segment) => `?.[${JSON.stringify(segment)}]`)
      .join('');
    parts.push(`${JSON.stringify(apiField)}: ${storeExpression}${access}`);
  }
  return parts.length > 0 ? `{ ${parts.join(', ')} }` : '{}';
};
