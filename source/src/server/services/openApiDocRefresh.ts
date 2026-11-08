import { builtinFunctionRegistry } from './builtinFunctionRegistry.service';
import { managedFunctionRouteRegistry } from './managedFunctionRouteRegistry';
import { openApiSpecService } from './openApiSpec.service';

/**
 * Drops cached OpenAPI specs and route discovery so the next read rebuilds from
 * current function code/metadata. Use after managed-function mutations or manual
 * refresh from `/api/docs`.
 */
export const refreshOpenApiDocumentationCaches = (
  functionId?: string,
  options?: { includeBuiltinRegistry?: boolean },
): void => {
  managedFunctionRouteRegistry.invalidate(functionId);
  openApiSpecService.invalidate(functionId);

  if (!functionId || options?.includeBuiltinRegistry) {
    builtinFunctionRegistry.invalidate();
  }
};
