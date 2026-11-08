import { resolveEffectiveTestPayloadJson } from '../../shared/api/server-functions/buildFunctionDerivedMetadata';
import type { ManagedFunctionOpenApiInput } from '../../shared/api/openapi/buildManagedFunctionOpenApi';

export const toAccessibleRouteListItem = (fn: ManagedFunctionOpenApiInput) => ({
  id: fn.id,
  name: fn.name,
  folder: fn.folder || 'general',
  method: fn.method.toUpperCase(),
  path: fn.path,
  testPayload: resolveEffectiveTestPayloadJson({
    code: fn.code ?? '',
    method: fn.method,
    path: fn.path,
    testPayload: fn.test_payload ?? undefined,
    metadataJson: fn.metadata_json,
  }),
  engineType: fn.engine_type === 'DATA_API' ? 'DATA_API' : 'SANDBOX_JS',
  isBuiltIn: Boolean(fn.is_built_in),
});

export type AccessibleRouteListItem = ReturnType<typeof toAccessibleRouteListItem>;
