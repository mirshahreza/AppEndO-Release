import type { ServerFunctionItem } from '../../../shared/api/contracts/server-functions/types';

export function serverFunctionSearchHaystack(fn: ServerFunctionItem): string {
  return [
    fn.id,
    fn.name,
    fn.folder,
    fn.method,
    fn.path,
    ...(fn.metadataJson?.catalogTags ?? []),
    fn.metadataJson?.apiDoc?.summary,
    fn.metadataJson?.apiDoc?.description,
    fn.metadataJson?.derived?.docHints?.summary,
    fn.metadataJson?.derived?.docHints?.routeNote,
    ...(fn.metadataJson?.derived?.docHints?.validationFields ?? []),
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();
}

export function filterServerFunctionsForInternalApi(
  functions: readonly ServerFunctionItem[],
  query: string,
): ServerFunctionItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...functions];
  return functions.filter((fn) => serverFunctionSearchHaystack(fn).includes(needle));
}

export function resolveServerFunctionSample(fn: ServerFunctionItem): Record<string, unknown> | null {
  const raw = fn.testPayload?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore invalid stored sample
    }
  }

  const example = fn.metadataJson?.derived?.requestExample;
  if (!example) return null;
  const envelope: Record<string, unknown> = {};
  if (example.body && typeof example.body === 'object' && Object.keys(example.body).length > 0) {
    envelope.body = example.body;
  }
  if (example.query && typeof example.query === 'object' && Object.keys(example.query).length > 0) {
    envelope.query = example.query;
  }
  if (example.params && typeof example.params === 'object' && Object.keys(example.params).length > 0) {
    envelope.params = example.params;
  }
  return Object.keys(envelope).length > 0 ? envelope : null;
}

export function serverFunctionDocSummary(fn: ServerFunctionItem): string | null {
  const summary = fn.metadataJson?.apiDoc?.summary?.trim()
    || fn.metadataJson?.derived?.docHints?.summary?.trim();
  return summary || null;
}

export function serverFunctionDocDescription(fn: ServerFunctionItem): string | null {
  const description = fn.metadataJson?.apiDoc?.description?.trim()
    || fn.metadataJson?.derived?.docHints?.routeNote?.trim();
  return description || null;
}
