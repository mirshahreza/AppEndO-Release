import type { BuiltinCapabilityPackRegistrar } from './types';
import { createMemoryTools } from './memoryTools';

/** appendo-memory — read_memory · write_memory. */
export const registerMemoryPackTools: BuiltinCapabilityPackRegistrar = (registry) => {
  createMemoryTools().forEach((tool) => registry.register(tool));
};
