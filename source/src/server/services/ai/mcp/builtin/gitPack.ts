import { GIT_READ_TOOLS } from '../../../../../core/ai/tools/native/git/gitTools';
import { GIT_WRITE_TOOLS } from '../../../../../core/ai/tools/native/git/gitWriteTools';
import type { BuiltinCapabilityPackRegistrar } from './types';

/** appendo-git — read + write git tools (write requires confirm gate on apply). */
export const registerGitPackTools: BuiltinCapabilityPackRegistrar = (registry) => {
  GIT_READ_TOOLS.forEach((tool) => registry.register(tool));
  GIT_WRITE_TOOLS.forEach((tool) => registry.register(tool));
};
