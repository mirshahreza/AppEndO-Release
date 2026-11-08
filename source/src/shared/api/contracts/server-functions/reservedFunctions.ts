/**
 * Managed server functions registered for platform internals (scheduler bindings, etc.).
 * They must exist in the function store but are not editable catalog items in Studio.
 */
export const RESERVED_SCHEDULED_START_FUNCTION_ID = 'workflow-engine.scheduled-start';

const CATALOG_HIDDEN_SERVER_FUNCTION_IDS = new Set<string>([
  RESERVED_SCHEDULED_START_FUNCTION_ID,
]);

const CATALOG_HIDDEN_SERVER_FUNCTION_EDIT_SLUGS = new Set<string>([
  'workflow-engine/scheduled-start',
  RESERVED_SCHEDULED_START_FUNCTION_ID,
]);

export function isCatalogHiddenServerFunction(fn: { id: string }): boolean {
  return CATALOG_HIDDEN_SERVER_FUNCTION_IDS.has(fn.id);
}

export function isHiddenServerFunctionEditSlug(slug: string): boolean {
  return CATALOG_HIDDEN_SERVER_FUNCTION_EDIT_SLUGS.has(slug.trim());
}
