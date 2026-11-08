import { aiManager } from '../../../../../core/ai/AiManager';
import { DEFAULT_AI_WEB_SEARCH_SETTINGS } from '../../../../../shared/api/contracts/ai/constants';
import type { BuiltinCapabilityPackRegistrar } from './types';
import { createWebTools } from './webTools';

/** appendo-web — web_search · fetch_url · screenshot_url (SSRF-protected). */
export const registerWebPackTools: BuiltinCapabilityPackRegistrar = (registry) => {
  const tools = createWebTools({
    getWebSearchSettings: () => aiManager.getSettings()?.webSearch ?? DEFAULT_AI_WEB_SEARCH_SETTINGS,
  });
  tools.forEach((tool) => registry.register(tool));
};
