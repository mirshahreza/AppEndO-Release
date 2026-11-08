import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Canonical JSON Schema validation primitive for AppEndO. Repository Reality Audit (Workflow
 * Engine Slices 3/5) found no ajv/JSON-Schema-validation dependency anywhere in this repo — this
 * module closes that gap once, platform-wide, so no feature invents its own parallel validator.
 * Mirrors the `JsonSchemaRefOrInline` shape from src/server/domain/workflow/awm/types.ts:
 * `REF` schemas are not resolvable (no schema registry exists anywhere in the repo either — same
 * "no registry" gap shape already documented for Actions/events), so validation against a `REF`
 * honestly reports `SCHEMA_REF_UNRESOLVED` rather than silently passing or guessing.
 */

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

export type JsonSchemaRefOrInline = { type: 'REF'; ref: string } | { type: 'INLINE'; schema: unknown };

export type JsonSchemaValidationResult = { valid: true } | { valid: false; errors: string[] };

/** Core primitive: validates `value` against a raw JSON Schema object. An empty/absent schema (`{}`) imposes no constraints. */
export function validateJsonSchema(schema: unknown, value: unknown): JsonSchemaValidationResult {
  if (schema === null || typeof schema !== 'object' || Object.keys(schema).length === 0) {
    return { valid: true };
  }
  let validate: ReturnType<typeof ajv.compile>;
  try {
    validate = ajv.compile(schema);
  } catch (error) {
    return { valid: false, errors: [`SCHEMA_INVALID: ${error instanceof Error ? error.message : 'could not compile schema'}`] };
  }
  const ok = validate(value);
  if (ok) return { valid: true };
  return { valid: false, errors: (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? 'is invalid'}`.trim()) };
}

/** Workflow-specific wrapper around `validateJsonSchema` for the `JsonSchemaRefOrInline` shape (doc 05 section 19). */
export function validateAgainstJsonSchema(schemaRef: JsonSchemaRefOrInline, value: unknown): JsonSchemaValidationResult {
  if (schemaRef.type === 'REF') {
    return { valid: false, errors: [`SCHEMA_REF_UNRESOLVED: no schema registry exists to resolve ref "${schemaRef.ref}".`] };
  }
  return validateJsonSchema(schemaRef.schema, value);
}
