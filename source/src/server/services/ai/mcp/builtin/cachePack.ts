import type { BuiltinCapabilityPackRegistrar } from './types';
import { createCacheTools } from './cacheTools';

/** appendo-cache — list_cache_keys · get_cache_entry · evict_cache_key. */
export const registerCachePackTools: BuiltinCapabilityPackRegistrar = (registry) => {
  createCacheTools().forEach((tool) => registry.register(tool));
};
