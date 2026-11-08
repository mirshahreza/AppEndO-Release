import { aiManager } from '../../../../../core/ai/AiManager';
import { DEFAULT_AI_HTTP_SETTINGS } from '../../../../../shared/api/contracts/ai/constants';
import type { BuiltinCapabilityPackRegistrar } from './types';
import { createHttpTools } from './httpTools';

/** appendo-http — http_request (allowlist + SSRF-protected). */
export const registerHttpPackTools: BuiltinCapabilityPackRegistrar = (registry) => {
  const tools = createHttpTools({
    getHttpSettings: () => aiManager.getSettings()?.http ?? DEFAULT_AI_HTTP_SETTINGS,
  });
  tools.forEach((tool) => registry.register(tool));
};
