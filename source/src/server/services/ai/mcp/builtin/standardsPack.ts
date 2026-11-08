import { getOperatorPageEditLocksTool } from '../../../../../core/ai/tools/native/getOperatorPageEditLocks';
import { getProjectStandardsTool } from '../../../../../core/ai/tools/native/getProjectStandards';
import { runTestsTool } from '../../../../../core/ai/tools/native/runTests';
import type { BuiltinCapabilityPackRegistrar } from './types';

/** appendo-standards — get_project_standards · get_operator_page_edit_locks · run_tests (VC-4.1). */
export const registerStandardsPackTools: BuiltinCapabilityPackRegistrar = (registry) => {
  registry.register(getProjectStandardsTool);
  registry.register(getOperatorPageEditLocksTool);
  registry.register(runTestsTool);
};
