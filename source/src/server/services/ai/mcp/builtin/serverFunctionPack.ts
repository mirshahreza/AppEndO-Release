import type { BuiltinCapabilityPackRegistrar } from './types';
import { createServerFunctionTools } from './serverFunctionTools';

/** appendo-server-functions — list_server_functions · get_server_function · test_server_function. */
export const registerServerFunctionPackTools: BuiltinCapabilityPackRegistrar = (registry) => {
  createServerFunctionTools().forEach((tool) => registry.register(tool));
};
