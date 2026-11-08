import type { BuiltinCapabilityPackRegistrar } from './types';
import { createJobsTools } from './jobsTools';

/** appendo-jobs — list_jobs · get_job · run_job. */
export const registerJobsPackTools: BuiltinCapabilityPackRegistrar = (registry) => {
  createJobsTools().forEach((tool) => registry.register(tool));
};
