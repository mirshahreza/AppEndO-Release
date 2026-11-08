import type { BuiltinCapabilityPackRegistrar } from './types';
import { createOpenApiTools } from './openapiTools';

/** appendo-openapi — list_openapi_routes · get_openapi_spec (G15). */
export const registerOpenApiPackTools: BuiltinCapabilityPackRegistrar = (registry) => {
  createOpenApiTools().forEach((tool) => registry.register(tool));
};
