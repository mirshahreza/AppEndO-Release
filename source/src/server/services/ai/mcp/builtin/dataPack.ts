import type { BuiltinCapabilityPackRegistrar } from './types';
import { createDataTools, createDefaultDataToolsDeps } from './dataTools';
import { createDataApiTools, createDefaultDataApiToolsDeps } from './dataApiTools';
import { queryDashboardDomainTool } from '../../../../../core/ai/tools/native/queryDashboardDomain';

/** appendo-data — list_data_sources · describe_schema · query_readonly · data_api_* · query_dashboard_domain (G13). */
export const registerDataPackTools: BuiltinCapabilityPackRegistrar = (registry) => {
  const tools = createDataTools(createDefaultDataToolsDeps());
  tools.forEach((tool) => registry.register(tool));

  const dataApiTools = createDataApiTools(createDefaultDataApiToolsDeps());
  dataApiTools.forEach((tool) => registry.register(tool));
  registry.register(queryDashboardDomainTool);
};
